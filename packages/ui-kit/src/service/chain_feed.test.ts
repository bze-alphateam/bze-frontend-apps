import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createChainFeed, type FeedSocket, type FeedStatus} from './chain_feed';

class FakeSocket implements FeedSocket {
    sent: Record<string, unknown>[] = [];
    closed = false;
    onopen: (() => void) | null = null;
    onmessage: ((ev: {data: unknown}) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(readonly url: string) {}

    send(data: string) { this.sent.push(JSON.parse(data)); }
    close() { this.closed = true; }

    open() { this.onopen?.(); }
    receive(msg: unknown) { this.onmessage?.({data: JSON.stringify(msg)}); }
    drop() { this.onclose?.(); }
    fail() { this.onerror?.(); }

    subscribes() { return this.sent.filter(m => m.method === 'subscribe'); }
    unsubscribes() { return this.sent.filter(m => m.method === 'unsubscribe'); }
    idOf(query: string) { return this.subscribes().find(m => (m.params as {query: string}).query === query)!.id; }
}

const BLOCK = "tm.event='NewBlock'";
const TX = "tm.event='Tx' AND transfer.sender='bze1abc'";
const NOTIFICATION = {data: {value: {height: '1'}}};

describe('createChainFeed', () => {
    let sockets: FakeSocket[];
    let feed: ReturnType<typeof createChainFeed>;
    let statuses: FeedStatus[];

    const latest = () => sockets[sockets.length - 1];
    const notify = (socket: FakeSocket, query = BLOCK) => socket.receive({jsonrpc: '2.0', id: socket.idOf(query), result: NOTIFICATION});
    const liveSocket = () => {
        const socket = latest();
        socket.open();
        notify(socket);
        return socket;
    };

    beforeEach(() => {
        vi.useFakeTimers();
        sockets = [];
        feed = createChainFeed({
            url: 'wss://rpc.example.com/websocket',
            createSocket: (url) => {
                const socket = new FakeSocket(url);
                sockets.push(socket);
                return socket;
            },
            timers: {
                setTimeout: (fn, ms) => setTimeout(fn, ms),
                clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
            },
        });
        statuses = [];
        feed.onStatus(s => statuses.push(s));
    });

    afterEach(() => {
        feed.close();
        vi.useRealTimers();
    });

    it('does not connect until the first subscribe', () => {
        vi.advanceTimersByTime(60_000);
        expect(sockets).toHaveLength(0);

        feed.subscribe(BLOCK, () => {});
        expect(sockets).toHaveLength(1);
        expect(sockets[0].url).toBe('wss://rpc.example.com/websocket');
    });

    it('starts connecting and reports the status to a new listener immediately', () => {
        expect(statuses).toEqual(['connecting']);
    });

    it('sends one server subscription per query and unsubscribes after the last handler leaves', () => {
        const first = vi.fn();
        const second = vi.fn();
        const unsubFirst = feed.subscribe(BLOCK, first);
        const unsubSecond = feed.subscribe(BLOCK, second);
        const socket = liveSocket();

        expect(socket.subscribes()).toHaveLength(1);
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);

        unsubFirst();
        expect(socket.unsubscribes()).toHaveLength(0);
        notify(socket);
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);

        unsubSecond();
        expect(socket.unsubscribes()).toEqual([expect.objectContaining({params: {query: BLOCK}})]);
    });

    it('sends subscriptions registered while connecting once the socket opens', () => {
        feed.subscribe(BLOCK, () => {});
        feed.subscribe(TX, () => {});
        expect(latest().sent).toHaveLength(0);

        latest().open();
        expect(latest().subscribes().map(m => (m.params as {query: string}).query)).toEqual([BLOCK, TX]);
    });

    it('sends a subscription registered on an open socket right away', () => {
        feed.subscribe(BLOCK, () => {});
        latest().open();
        feed.subscribe(TX, () => {});

        expect(latest().subscribes()).toHaveLength(2);
    });

    it('subscribes after the reconnect when the first connect fails', () => {
        feed.subscribe(BLOCK, () => {});
        latest().fail();
        expect(statuses[statuses.length - 1]).toBe('down');

        vi.advanceTimersByTime(1_000);
        expect(sockets).toHaveLength(2);
        latest().open();
        expect(latest().subscribes()).toHaveLength(1);
    });

    it('ignores the empty ack and goes live on the first notification', () => {
        const handler = vi.fn();
        feed.subscribe(BLOCK, handler);
        const socket = latest();
        socket.open();

        socket.receive({jsonrpc: '2.0', id: socket.idOf(BLOCK), result: {}});
        expect(handler).not.toHaveBeenCalled();
        expect(statuses[statuses.length - 1]).toBe('connecting');

        notify(socket);
        expect(handler).toHaveBeenCalledWith(NOTIFICATION);
        expect(statuses[statuses.length - 1]).toBe('live');
    });

    it('resends a cancelled subscription at once', () => {
        feed.subscribe(BLOCK, () => {});
        const socket = liveSocket();

        socket.receive({jsonrpc: '2.0', id: socket.idOf(BLOCK), error: {code: -32000, message: 'Server error', data: 'subscription was canceled (reason: client is not pulling messages fast enough)'}});

        expect(socket.subscribes()).toHaveLength(2);
        expect(statuses[statuses.length - 1]).toBe('live');
    });

    it('goes down and reconnects after a second cancel within 30 s', () => {
        feed.subscribe(BLOCK, () => {});
        const socket = liveSocket();
        const cancel = {jsonrpc: '2.0', id: socket.idOf(BLOCK), error: {code: -32000, message: 'Server error', data: 'subscription was canceled (reason: x)'}};

        socket.receive(cancel);
        vi.advanceTimersByTime(10_000);
        socket.receive(cancel);

        expect(statuses[statuses.length - 1]).toBe('down');
        expect(socket.closed).toBe(true);
        vi.advanceTimersByTime(1_000);
        expect(sockets).toHaveLength(2);
    });

    it('resends again when the second cancel comes after 30 s', () => {
        feed.subscribe(BLOCK, () => {});
        const socket = liveSocket();
        const cancel = {jsonrpc: '2.0', id: socket.idOf(BLOCK), error: {code: -32000, message: 'Server error', data: 'subscription was canceled (reason: x)'}};

        socket.receive(cancel);
        // keep the watchdog quiet while the error window passes
        for (let i = 0; i < 3; i++) {
            vi.advanceTimersByTime(10_000);
            notify(socket);
        }
        socket.receive(cancel);

        expect(statuses[statuses.length - 1]).toBe('live');
        expect(socket.subscribes()).toHaveLength(3);
    });

    it.each(['max_subscription_clients 100 reached', 'max_subscriptions_per_client 5 reached'])('goes down and backs off when the node refuses with %s', (reason) => {
        feed.subscribe(BLOCK, () => {});
        const socket = latest();
        socket.open();

        socket.receive({jsonrpc: '2.0', id: socket.idOf(BLOCK), error: {code: -32603, message: 'Internal error', data: reason}});

        expect(statuses[statuses.length - 1]).toBe('down');
        expect(socket.closed).toBe(true);
        vi.advanceTimersByTime(999);
        expect(sockets).toHaveLength(1);
        vi.advanceTimersByTime(1);
        expect(sockets).toHaveLength(2);
    });

    it('falls back to the error message when the error has no data', () => {
        feed.subscribe(BLOCK, () => {});
        const socket = latest();
        socket.open();

        socket.receive({jsonrpc: '2.0', id: socket.idOf(BLOCK), error: {code: -32603, message: 'max_subscription_clients 100 reached'}});

        expect(statuses[statuses.length - 1]).toBe('down');
    });

    it('replaces a silent socket after 30 s with exactly one new socket', () => {
        feed.subscribe(BLOCK, () => {});
        const socket = liveSocket();

        vi.advanceTimersByTime(29_999);
        expect(statuses[statuses.length - 1]).toBe('live');
        vi.advanceTimersByTime(1);

        expect(statuses[statuses.length - 1]).toBe('down');
        expect(socket.closed).toBe(true);
        expect(sockets).toHaveLength(2);

        // the replaced socket's late close must not schedule another reconnect
        socket.drop();
        vi.advanceTimersByTime(60_000);
        expect(sockets.length).toBeLessThanOrEqual(3);
        expect(sockets.filter(s => !s.closed)).toHaveLength(1);
    });

    it('arms the watchdog from open, before any notification', () => {
        feed.subscribe(BLOCK, () => {});
        latest().open();

        vi.advanceTimersByTime(30_000);
        expect(statuses[statuses.length - 1]).toBe('down');
        expect(sockets).toHaveLength(2);
    });

    it('counts onerror and onclose of one socket as one failure', () => {
        feed.subscribe(BLOCK, () => {});
        const socket = latest();

        socket.fail();
        socket.drop();

        vi.advanceTimersByTime(1_000);
        expect(sockets).toHaveLength(2);
        vi.advanceTimersByTime(1_000);
        expect(sockets).toHaveLength(2);
    });

    it('backs off 1/2/4/8/16/30/30 s and resets only after a notification', () => {
        feed.subscribe(BLOCK, () => {});
        const failAndWait = (ms: number) => {
            const before = sockets.length;
            latest().open();
            latest().drop(); // an open socket that never delivered a notification does not reset the delay
            vi.advanceTimersByTime(ms - 1);
            expect(sockets).toHaveLength(before);
            vi.advanceTimersByTime(1);
            expect(sockets).toHaveLength(before + 1);
        };

        for (const ms of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) failAndWait(ms);

        liveSocket();
        latest().drop();
        vi.advanceTimersByTime(1_000);
        expect(sockets).toHaveLength(9);
    });

    it('never gives up reconnecting', () => {
        feed.subscribe(BLOCK, () => {});
        for (let i = 0; i < 50; i++) {
            latest().fail();
            vi.advanceTimersByTime(30_000);
        }
        expect(sockets).toHaveLength(51);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('resubscribes every registered query on a new socket', () => {
        feed.subscribe(BLOCK, () => {});
        feed.subscribe(TX, () => {});
        liveSocket().drop();

        vi.advanceTimersByTime(1_000);
        latest().open();

        expect(latest().subscribes()).toHaveLength(2);
    });

    it('goes live again after a recovery', () => {
        feed.subscribe(BLOCK, () => {});
        liveSocket().drop();
        expect(statuses[statuses.length - 1]).toBe('down');

        vi.advanceTimersByTime(1_000);
        latest().open();
        expect(statuses[statuses.length - 1]).toBe('down');
        notify(latest());
        expect(statuses[statuses.length - 1]).toBe('live');
    });

    it('stops notifying a removed status listener', () => {
        const listener = vi.fn();
        const stop = feed.onStatus(listener);
        stop();
        listener.mockClear();

        feed.subscribe(BLOCK, () => {});
        liveSocket();

        expect(listener).not.toHaveBeenCalled();
    });

    it('close() leaves no timers and no open sockets', () => {
        feed.subscribe(BLOCK, () => {});
        liveSocket();
        latest().drop();
        feed.close();

        expect(vi.getTimerCount()).toBe(0);
        expect(sockets.every(s => s.closed || s.onopen === null)).toBe(true);
        vi.advanceTimersByTime(120_000);
        expect(sockets).toHaveLength(1);
    });

    it('close() closes the open socket and cancels the watchdog', () => {
        feed.subscribe(BLOCK, () => {});
        const socket = liveSocket();

        feed.close();

        expect(socket.closed).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
});
