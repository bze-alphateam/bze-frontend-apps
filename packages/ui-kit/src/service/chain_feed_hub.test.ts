import {describe, expect, it} from 'vitest';
import type {ChainFeed, FeedStatus} from './chain_feed';
import {createChainFeedHub, type HubPort, type TabMessage, type WorkerMessage} from './chain_feed_hub';

class FakeFeed implements ChainFeed {
    handlers: {query: string; handler: (result: unknown) => void}[] = [];
    statusListeners = new Set<(status: FeedStatus) => void>();
    status: FeedStatus = 'connecting';

    subscribe(query: string, handler: (result: unknown) => void) {
        const entry = {query, handler};
        this.handlers.push(entry);
        return () => {
            this.handlers = this.handlers.filter(h => h !== entry);
        };
    }

    onStatus(listener: (status: FeedStatus) => void) {
        this.statusListeners.add(listener);
        listener(this.status);
        return () => {
            this.statusListeners.delete(listener);
        };
    }

    emit(query: string, result: unknown) {
        for (const h of this.handlers.filter(x => x.query === query)) h.handler(result);
    }

    setStatus(status: FeedStatus) {
        this.status = status;
        for (const l of [...this.statusListeners]) l(status);
    }
}

class FakePort implements HubPort {
    sent: WorkerMessage[] = [];
    started = false;
    onmessage: ((ev: {data: unknown}) => void) | null = null;

    postMessage(msg: WorkerMessage) { this.sent.push(msg); }
    start() { this.started = true; }
    tab(msg: TabMessage) { this.onmessage?.({data: msg}); }
    events() { return this.sent.filter(m => m.type === 'event'); }
}

const BLOCK = "tm.event='NewBlock'";
const TX = "tm.event='Tx'";

describe('createChainFeedHub', () => {
    const setup = () => {
        const feed = new FakeFeed();
        const hub = createChainFeedHub(feed);
        const connectPort = () => {
            const port = new FakePort();
            hub.connect(port);
            return port;
        };
        return {feed, connectPort};
    };

    it('starts the port and sends the current status on connect', () => {
        const {feed, connectPort} = setup();
        feed.status = 'live';

        const port = connectPort();

        expect(port.started).toBe(true);
        expect(port.sent).toEqual([{type: 'status', status: 'live'}]);
    });

    it('sends every status change to every port', () => {
        const {feed, connectPort} = setup();
        const a = connectPort();
        const b = connectPort();

        feed.setStatus('live');
        feed.setStatus('down');

        for (const port of [a, b]) {
            expect(port.sent).toEqual([
                {type: 'status', status: 'connecting'},
                {type: 'status', status: 'live'},
                {type: 'status', status: 'down'},
            ]);
        }
    });

    it('routes events to the sid of the subscription, per query', () => {
        const {feed, connectPort} = setup();
        const port = connectPort();
        port.tab({type: 'subscribe', sid: '1', query: BLOCK});
        port.tab({type: 'subscribe', sid: '2', query: TX});

        feed.emit(BLOCK, {height: 1});
        feed.emit(TX, {hash: 'a'});

        expect(port.events()).toEqual([
            {type: 'event', sid: '1', result: {height: 1}},
            {type: 'event', sid: '2', result: {hash: 'a'}},
        ]);
    });

    it('gives two ports on the same query one handler each and delivers to both', () => {
        const {feed, connectPort} = setup();
        const a = connectPort();
        const b = connectPort();
        a.tab({type: 'subscribe', sid: '1', query: BLOCK});
        b.tab({type: 'subscribe', sid: '7', query: BLOCK});

        expect(feed.handlers).toHaveLength(2);
        feed.emit(BLOCK, {height: 5});

        expect(a.events()).toEqual([{type: 'event', sid: '1', result: {height: 5}}]);
        expect(b.events()).toEqual([{type: 'event', sid: '7', result: {height: 5}}]);
    });

    it('stops delivering after unsubscribe and releases the feed handler', () => {
        const {feed, connectPort} = setup();
        const port = connectPort();
        port.tab({type: 'subscribe', sid: '1', query: BLOCK});

        port.tab({type: 'unsubscribe', sid: '1'});
        feed.emit(BLOCK, {height: 1});

        expect(feed.handlers).toHaveLength(0);
        expect(port.events()).toEqual([]);
    });

    it('releases everything of a port on bye, leaving other ports alone', () => {
        const {feed, connectPort} = setup();
        const leaving = connectPort();
        const staying = connectPort();
        leaving.tab({type: 'subscribe', sid: '1', query: BLOCK});
        leaving.tab({type: 'subscribe', sid: '2', query: TX});
        staying.tab({type: 'subscribe', sid: '1', query: BLOCK});

        leaving.tab({type: 'bye'});
        feed.emit(BLOCK, {height: 2});
        feed.setStatus('live');

        expect(feed.handlers).toHaveLength(1);
        expect(leaving.events()).toEqual([]);
        expect(leaving.sent.filter(m => m.type === 'status')).toEqual([{type: 'status', status: 'connecting'}]);
        expect(staying.events()).toEqual([{type: 'event', sid: '1', result: {height: 2}}]);
    });

    it('replaces a subscription that reuses a sid instead of leaking the old handler', () => {
        const {feed, connectPort} = setup();
        const port = connectPort();
        port.tab({type: 'subscribe', sid: '1', query: BLOCK});
        port.tab({type: 'subscribe', sid: '1', query: TX});

        expect(feed.handlers.map(h => h.query)).toEqual([TX]);
    });

    it('ignores malformed messages', () => {
        const {feed, connectPort} = setup();
        const port = connectPort();

        port.onmessage?.({data: null});
        port.onmessage?.({data: {type: 'subscribe', sid: 1}});
        port.onmessage?.({data: {type: 'nope'}});

        expect(feed.handlers).toHaveLength(0);
    });
});
