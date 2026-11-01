/**
 * SharedWorker entry of the chain feed (bundled by tsup as a self-contained script and served
 * as /chain-feed-worker.js by every app). The worker's name is `bze-chain-feed|<websocket url>`.
 */

import {CHAIN_FEED_WORKER_NAME_PREFIX as NAME_PREFIX, createChainFeed, type FeedSocket} from '../service/chain_feed';
import {createChainFeedHub, type ChainFeedHub, type HubPort} from '../service/chain_feed_hub';

const scope = self as unknown as {
    name: string;
    onconnect: ((ev: {ports: HubPort[]}) => void) | null;
};

let hub: ChainFeedHub | null = null;

scope.onconnect = (ev) => {
    if (!hub) {
        const url = scope.name.startsWith(NAME_PREFIX) ? scope.name.slice(NAME_PREFIX.length) : scope.name;
        hub = createChainFeedHub(createChainFeed({
            url,
            createSocket: (target) => new WebSocket(target) as unknown as FeedSocket,
            timers: {
                setTimeout: (fn, ms) => setTimeout(fn, ms),
                clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
            },
        }));
    }
    hub.connect(ev.ports[0]);
};
