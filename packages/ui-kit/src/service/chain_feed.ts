/**
 * Live chain feed: CometBFT event subscriptions over a WebSocket, with recovery.
 *
 * CometBFT keeps a socket open after cancelling the subscriptions of a slow client, refuses
 * a second subscription with the same query and caps the subscriptions per client, so an open
 * socket does not mean events are flowing. The feed therefore exposes a status that is `live`
 * only after a notification arrived on the current socket, and goes `down` (and reconnects
 * forever, with capped backoff) when the socket closes, the node refuses/cancels a subscription
 * or no notification arrives for WATCHDOG_MS.
 *
 * CometBFT sends notifications by reusing the id of the subscribe request, so subscriptions
 * are tracked by id, one id per query.
 */

export type FeedStatus = 'connecting' | 'live' | 'down';

export interface ChainFeed {
    /** Registers synchronously (before any connect), returns the unsubscribe function. */
    subscribe(query: string, handler: (result: unknown) => void): () => void;
    /** Calls the listener immediately with the current status, then on every change. */
    onStatus(listener: (status: FeedStatus) => void): () => void;
}

/** The subset of WebSocket the feed uses. */
export interface FeedSocket {
    send(data: string): void;
    close(code?: number, reason?: string): void;
    onopen: (() => void) | null;
    onmessage: ((ev: {data: unknown}) => void) | null;
    onclose: (() => void) | null;
    onerror: (() => void) | null;
}

export type SocketFactory = (url: string) => FeedSocket;

export interface FeedTimers {
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}

export interface ChainFeedDeps {
    url: string;
    createSocket: SocketFactory;
    timers: FeedTimers;
}

const WATCHDOG_MS = 30_000;
const REPEATED_ERROR_WINDOW_MS = 30_000;
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
const REFUSAL_PATTERN = /max_subscription_clients|max_subscriptions_per_client/;

type Subscription = {
    id: string;
    query: string;
    handlers: Set<(result: unknown) => void>;
};

const errorText = (error: unknown): string => {
    const e = error as {data?: unknown; message?: unknown} | string | null | undefined;
    if (typeof e === 'string') return e;
    const text = e?.data ?? e?.message;
    return typeof text === 'string' ? text : '';
};

export const createChainFeed = (deps: ChainFeedDeps): ChainFeed & {close(): void} => {
    const {url, createSocket, timers} = deps;

    const subscriptions = new Map<string, Subscription>(); // by query
    const queriesById = new Map<string, string>();
    const statusListeners = new Set<(status: FeedStatus) => void>();

    let status: FeedStatus = 'connecting';
    let socket: FeedSocket | null = null;
    let socketOpen = false;
    let reconnectTimer: unknown = null;
    let watchdogTimer: unknown = null;
    let attempt = 0;
    let nextId = 0;
    let closed = false;
    // ids whose subscription was cancelled once on this socket -> timer that forgets it
    const recentErrors = new Map<string, unknown>();

    const setStatus = (next: FeedStatus) => {
        if (status === next) return;
        status = next;
        for (const listener of [...statusListeners]) listener(next);
    };

    const sendSubscribe = (sub: Subscription) => {
        socket?.send(JSON.stringify({jsonrpc: '2.0', method: 'subscribe', id: sub.id, params: {query: sub.query}}));
    };

    const clearWatchdog = () => {
        if (watchdogTimer !== null) {
            timers.clearTimeout(watchdogTimer);
            watchdogTimer = null;
        }
    };

    const clearRecentErrors = () => {
        for (const handle of recentErrors.values()) timers.clearTimeout(handle);
        recentErrors.clear();
    };

    const clearReconnectTimer = () => {
        if (reconnectTimer !== null) {
            timers.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    const detachSocket = () => {
        clearWatchdog();
        clearRecentErrors();
        const old = socket;
        socket = null;
        socketOpen = false;
        if (!old) return;
        old.onopen = null;
        old.onmessage = null;
        old.onclose = null;
        old.onerror = null;
        try {
            old.close();
        } catch {
            // already closed
        }
    };

    const armWatchdog = () => {
        clearWatchdog();
        if (!socketOpen || subscriptions.size === 0) return;
        watchdogTimer = timers.setTimeout(() => {
            watchdogTimer = null;
            fail(0);
        }, WATCHDOG_MS);
    };

    const connect = () => {
        if (closed || socket || reconnectTimer !== null || subscriptions.size === 0) return;

        let created: FeedSocket;
        try {
            created = createSocket(url);
        } catch {
            fail();
            return;
        }
        socket = created;

        created.onopen = () => {
            if (socket !== created) return;
            socketOpen = true;
            for (const sub of subscriptions.values()) sendSubscribe(sub);
            armWatchdog();
        };
        created.onmessage = (ev) => {
            if (socket === created) handleMessage(ev.data);
        };
        created.onclose = () => {
            if (socket === created) fail();
        };
        created.onerror = () => {
            if (socket === created) fail();
        };
    };

    /** Drops the current socket, reports `down` and reconnects after `delay` (default: backoff step). */
    function fail(delay?: number) {
        detachSocket();
        setStatus('down');
        if (closed || subscriptions.size === 0 || reconnectTimer !== null) return;

        let wait = delay;
        if (wait === undefined) {
            wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
            attempt++;
        }
        if (wait === 0) {
            connect();
            return;
        }
        reconnectTimer = timers.setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, wait);
    }

    const handleSubscriptionError = (sub: Subscription, error: unknown) => {
        if (REFUSAL_PATTERN.test(errorText(error))) {
            fail();
            return;
        }
        if (recentErrors.has(sub.id)) {
            fail();
            return;
        }
        recentErrors.set(sub.id, timers.setTimeout(() => recentErrors.delete(sub.id), REPEATED_ERROR_WINDOW_MS));
        sendSubscribe(sub);
    };

    const handleMessage = (raw: unknown) => {
        let msg: {id?: unknown; result?: unknown; error?: unknown};
        try {
            msg = JSON.parse(String(raw));
        } catch {
            return;
        }
        const id = msg?.id === undefined || msg.id === null ? '' : String(msg.id);
        const query = queriesById.get(id);
        const sub = query === undefined ? undefined : subscriptions.get(query);
        if (!sub) return;

        if (msg.error) {
            handleSubscriptionError(sub, msg.error);
            return;
        }

        const result = msg.result as Record<string, unknown> | null | undefined;
        if (!result || typeof result !== 'object' || Object.keys(result).length === 0) return; // empty ack

        attempt = 0;
        setStatus('live');
        armWatchdog();
        for (const handler of [...sub.handlers]) handler(result);
    };

    const subscribe: ChainFeed['subscribe'] = (query, handler) => {
        if (closed) return () => {};

        let sub = subscriptions.get(query);
        if (!sub) {
            sub = {id: String(++nextId), query, handlers: new Set()};
            subscriptions.set(query, sub);
            queriesById.set(sub.id, query);
            if (socketOpen) {
                sendSubscribe(sub);
                armWatchdog();
            }
        }
        sub.handlers.add(handler);
        connect();

        let active = true;
        return () => {
            if (!active) return;
            active = false;
            const current = subscriptions.get(query);
            if (!current) return;
            current.handlers.delete(handler);
            if (current.handlers.size > 0) return;

            subscriptions.delete(query);
            queriesById.delete(current.id);
            if (socketOpen) {
                socket?.send(JSON.stringify({jsonrpc: '2.0', method: 'unsubscribe', id: String(++nextId), params: {query}}));
            }
            if (subscriptions.size === 0) {
                clearWatchdog();
                clearReconnectTimer();
            }
        };
    };

    const onStatus: ChainFeed['onStatus'] = (listener) => {
        statusListeners.add(listener);
        listener(status);
        return () => {
            statusListeners.delete(listener);
        };
    };

    const close = () => {
        closed = true;
        clearReconnectTimer();
        detachSocket();
        subscriptions.clear();
        queriesById.clear();
        statusListeners.clear();
    };

    return {subscribe, onStatus, close};
};

// ── Composition root ──────────────────────────────────────────────────────────

let current: {endpoint: string; feed: ReturnType<typeof createChainFeed>} | null = null;

/** One feed per tab, built on the browser WebSocket and window timers. */
export const getChainFeed = (rpcEndpoint: string): ChainFeed => {
    if (current?.endpoint === rpcEndpoint) return current.feed;

    current?.feed.close();
    const feed = createChainFeed({
        url: rpcEndpoint.replace(/\/?$/, '') + '/websocket',
        createSocket: (url) => new WebSocket(url) as unknown as FeedSocket,
        timers: {
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        },
    });
    current = {endpoint: rpcEndpoint, feed};
    return feed;
};
