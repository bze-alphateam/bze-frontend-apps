/**
 * Tab-side chain feed that shares one WebSocket per origin through a SharedWorker.
 *
 * Fallback order (decided by trying, never by browser version): SharedWorker -> in-tab socket
 * (the local feed) -> polling (the feed reports `down`). The switch to the local feed happens at
 * most once per tab and is final: when createWorker throws, the worker reports an error, or no
 * status arrives within WORKER_STATUS_TIMEOUT_MS. The tab keeps its own registry of
 * subscriptions, mirrored to the worker, so they survive the switch.
 */

import type {ChainFeed, FeedStatus, FeedTimers} from './chain_feed';
import type {HubPort, TabMessage, WorkerMessage} from './chain_feed_hub';

export const WORKER_STATUS_TIMEOUT_MS = 3_000;

/** The subset of SharedWorker the tab uses. */
export interface SharedWorkerLike {
    port: Pick<HubPort, 'onmessage' | 'start'> & {postMessage(msg: TabMessage): void};
    onerror: ((ev: unknown) => void) | null;
}

export interface SharedChainFeedDeps {
    createWorker: () => SharedWorkerLike;
    createLocalFeed: () => ChainFeed;
    timers: FeedTimers;
    /**
     * Registers a callback for pagehide, called with the event's `persisted` flag. A persisted
     * page may be restored from the bfcache, so it keeps its worker connection.
     */
    onPageHide: (fn: (persisted: boolean) => void) => void;
}

type Registration = {query: string; handler: (result: unknown) => void; unsubscribeLocal?: () => void};

export const createSharedChainFeed = (deps: SharedChainFeedDeps): ChainFeed & {close(): void} => {
    const {createWorker, createLocalFeed, timers, onPageHide} = deps;

    const registrations = new Map<string, Registration>(); // by sid
    const statusListeners = new Set<(status: FeedStatus) => void>();
    let status: FeedStatus = 'connecting';
    let nextSid = 0;
    let worker: SharedWorkerLike | null = null;
    let local: ChainFeed | null = null;
    let statusTimer: unknown = null;

    const setStatus = (next: FeedStatus) => {
        if (status === next) return;
        status = next;
        for (const listener of [...statusListeners]) listener(next);
    };

    const clearStatusTimer = () => {
        if (statusTimer !== null) {
            timers.clearTimeout(statusTimer);
            statusTimer = null;
        }
    };

    const send = (msg: TabMessage) => {
        try {
            worker?.port.postMessage(msg);
        } catch {
            fallBack();
        }
    };

    function fallBack() {
        if (local) return;
        clearStatusTimer();
        if (worker) {
            const old = worker;
            worker = null;
            old.onerror = null;
            old.port.onmessage = null;
            try {
                old.port.postMessage({type: 'bye'});
            } catch {
                // the worker is gone already
            }
        }

        const feed = createLocalFeed();
        local = feed;
        for (const registration of registrations.values()) {
            registration.unsubscribeLocal = feed.subscribe(registration.query, registration.handler);
        }
        feed.onStatus(setStatus);
    }

    const handleWorkerMessage = (ev: {data: unknown}) => {
        const msg = ev.data as Partial<WorkerMessage> | null;
        if (msg?.type === 'status' && typeof msg.status === 'string') {
            clearStatusTimer();
            setStatus(msg.status);
        } else if (msg?.type === 'event' && typeof msg.sid === 'string') {
            registrations.get(msg.sid)?.handler(msg.result);
        }
    };

    try {
        const created = createWorker();
        worker = created;
        created.onerror = () => fallBack();
        created.port.onmessage = handleWorkerMessage;
        created.port.start?.();
        statusTimer = timers.setTimeout(() => {
            statusTimer = null;
            fallBack();
        }, WORKER_STATUS_TIMEOUT_MS);
    } catch {
        fallBack();
    }

    onPageHide((persisted) => {
        if (!persisted) send({type: 'bye'});
    });

    const subscribe: ChainFeed['subscribe'] = (query, handler) => {
        const sid = String(++nextSid);
        const registration: Registration = {query, handler};
        registrations.set(sid, registration);

        if (local) {
            registration.unsubscribeLocal = local.subscribe(query, handler);
        } else {
            send({type: 'subscribe', sid, query});
        }

        return () => {
            if (!registrations.delete(sid)) return;
            if (registration.unsubscribeLocal) {
                registration.unsubscribeLocal();
            } else if (!local) {
                send({type: 'unsubscribe', sid});
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
        clearStatusTimer();
        statusListeners.clear();
        registrations.clear();
        if (worker) {
            const old = worker;
            worker = null;
            old.onerror = null;
            old.port.onmessage = null;
            try {
                old.port.postMessage({type: 'bye'});
            } catch {
                // the worker is gone already
            }
        }
    };

    return {subscribe, onStatus, close};
};
