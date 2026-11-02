/**
 * Worker-side hub of the shared chain feed: gives every tab (port) of one origin access to a
 * single ChainFeed, so n tabs hold one WebSocket and one node subscription per query.
 *
 * Protocol (bump CHAIN_FEED_PROTOCOL_VERSION on every change; it is part of the worker URL, so
 * tabs and workers of incompatible deploys never meet):
 *   tab -> worker: {type: 'subscribe', sid, query} | {type: 'unsubscribe', sid} | {type: 'bye'}
 *   worker -> tab: {type: 'status', status} | {type: 'event', sid, result}
 * `sid` is a tab-local subscription id.
 */

import type {ChainFeed, FeedStatus} from './chain_feed';

export const CHAIN_FEED_PROTOCOL_VERSION = 1;

export type TabMessage =
    | {type: 'subscribe'; sid: string; query: string}
    | {type: 'unsubscribe'; sid: string}
    | {type: 'bye'};

export type WorkerMessage =
    | {type: 'status'; status: FeedStatus}
    | {type: 'event'; sid: string; result: unknown};

/** The subset of MessagePort the hub uses. */
export interface HubPort {
    postMessage(msg: WorkerMessage): void;
    onmessage: ((ev: {data: unknown}) => void) | null;
    start?(): void;
}

export interface ChainFeedHub {
    connect(port: HubPort): void;
}

export const createChainFeedHub = (feed: ChainFeed): ChainFeedHub => {
    const connect = (port: HubPort) => {
        const unsubscribers = new Map<string, () => void>(); // by sid
        let stopStatus: (() => void) | null = null;
        let closed = false;

        const release = (sid: string) => {
            unsubscribers.get(sid)?.();
            unsubscribers.delete(sid);
        };

        const bye = () => {
            closed = true;
            for (const sid of [...unsubscribers.keys()]) release(sid);
            stopStatus?.();
            stopStatus = null;
            port.onmessage = null;
        };

        port.onmessage = (ev) => {
            if (closed) return;
            const msg = ev.data as Partial<TabMessage> | null;
            switch (msg?.type) {
                case 'subscribe': {
                    const {sid, query} = msg;
                    if (typeof sid !== 'string' || typeof query !== 'string') return;
                    release(sid);
                    unsubscribers.set(sid, feed.subscribe(query, (result) => {
                        port.postMessage({type: 'event', sid, result});
                    }));
                    return;
                }
                case 'unsubscribe':
                    if (typeof msg.sid === 'string') release(msg.sid);
                    return;
                case 'bye':
                    bye();
                    return;
            }
        };

        // The feed calls the listener right away, which is the status sent on connect.
        stopStatus = feed.onStatus((status) => port.postMessage({type: 'status', status}));
        port.start?.();
    };

    return {connect};
};
