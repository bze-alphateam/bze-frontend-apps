import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ChainFeed, FeedStatus} from './chain_feed';
import type {TabMessage, WorkerMessage} from './chain_feed_hub';
import {createSharedChainFeed, WORKER_STATUS_TIMEOUT_MS, type SharedWorkerLike} from './shared_chain_feed';

class FakeWorker implements SharedWorkerLike {
    sent: TabMessage[] = [];
    onerror: ((ev: unknown) => void) | null = null;
    port = {
        onmessage: null as ((ev: {data: unknown}) => void) | null,
        started: false,
        postMessage: (msg: TabMessage) => { this.sent.push(msg); },
        start: () => { this.port.started = true; },
    };

    reply(msg: WorkerMessage) { this.port.onmessage?.({data: msg}); }
    sentOfType(type: TabMessage['type']) { return this.sent.filter(m => m.type === type); }
}

class FakeLocalFeed implements ChainFeed {
    handlers: {query: string; handler: (result: unknown) => void}[] = [];
    listeners = new Set<(status: FeedStatus) => void>();
    status: FeedStatus = 'connecting';

    subscribe(query: string, handler: (result: unknown) => void) {
        const entry = {query, handler};
        this.handlers.push(entry);
        return () => { this.handlers = this.handlers.filter(h => h !== entry); };
    }

    onStatus(listener: (status: FeedStatus) => void) {
        this.listeners.add(listener);
        listener(this.status);
        return () => { this.listeners.delete(listener); };
    }

    emit(query: string, result: unknown) {
        for (const h of this.handlers.filter(x => x.query === query)) h.handler(result);
    }

    setStatus(status: FeedStatus) {
        this.status = status;
        for (const l of [...this.listeners]) l(status);
    }
}

const BLOCK = "tm.event='NewBlock'";
const TX = "tm.event='Tx'";

describe('createSharedChainFeed', () => {
    let workers: FakeWorker[];
    let locals: FakeLocalFeed[];
    let hideCallbacks: ((persisted: boolean) => void)[];
    let createWorker: () => SharedWorkerLike;

    const build = () => createSharedChainFeed({
        createWorker: () => createWorker(),
        createLocalFeed: () => {
            const local = new FakeLocalFeed();
            locals.push(local);
            return local;
        },
        timers: {
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        },
        onPageHide: (fn) => { hideCallbacks.push(fn); },
    });

    beforeEach(() => {
        vi.useFakeTimers();
        workers = [];
        locals = [];
        hideCallbacks = [];
        createWorker = () => {
            const worker = new FakeWorker();
            workers.push(worker);
            return worker;
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('mirrors subscriptions to the worker and routes its events by sid', () => {
        const feed = build();
        const blocks: unknown[] = [];
        const txs: unknown[] = [];
        feed.subscribe(BLOCK, r => blocks.push(r));
        feed.subscribe(TX, r => txs.push(r));
        workers[0].reply({type: 'status', status: 'live'});

        expect(workers[0].port.started).toBe(true);
        expect(workers[0].sentOfType('subscribe')).toEqual([
            {type: 'subscribe', sid: '1', query: BLOCK},
            {type: 'subscribe', sid: '2', query: TX},
        ]);

        workers[0].reply({type: 'event', sid: '2', result: {hash: 'a'}});
        workers[0].reply({type: 'event', sid: '1', result: {height: 1}});

        expect(blocks).toEqual([{height: 1}]);
        expect(txs).toEqual([{hash: 'a'}]);
        expect(locals).toHaveLength(0);
    });

    it('reports the worker status to listeners, starting with connecting', () => {
        const feed = build();
        const statuses: FeedStatus[] = [];
        feed.onStatus(s => statuses.push(s));

        workers[0].reply({type: 'status', status: 'live'});
        workers[0].reply({type: 'status', status: 'down'});

        expect(statuses).toEqual(['connecting', 'live', 'down']);
    });

    it('tells the worker about unsubscribes and stops delivering', () => {
        const feed = build();
        const got: unknown[] = [];
        const unsubscribe = feed.subscribe(BLOCK, r => got.push(r));
        workers[0].reply({type: 'status', status: 'live'});

        unsubscribe();
        workers[0].reply({type: 'event', sid: '1', result: {height: 1}});

        expect(workers[0].sentOfType('unsubscribe')).toEqual([{type: 'unsubscribe', sid: '1'}]);
        expect(got).toEqual([]);
    });

    it('sends bye when the page is hidden', () => {
        build();
        workers[0].reply({type: 'status', status: 'live'});

        hideCallbacks.forEach(fn => fn(false));

        expect(workers[0].sentOfType('bye')).toHaveLength(1);
    });

    it('keeps the worker connection when the page may be restored from the bfcache', () => {
        const feed = build();
        const got: unknown[] = [];
        feed.subscribe(BLOCK, r => got.push(r));
        workers[0].reply({type: 'status', status: 'live'});

        hideCallbacks.forEach(fn => fn(true));
        workers[0].reply({type: 'event', sid: '1', result: {height: 1}});

        expect(workers[0].sentOfType('bye')).toHaveLength(0);
        expect(got).toEqual([{height: 1}]);
    });

    it('tells the worker bye when it falls back, so a late worker releases the tab', () => {
        build();

        vi.advanceTimersByTime(WORKER_STATUS_TIMEOUT_MS);

        expect(workers[0].sentOfType('bye')).toHaveLength(1);
    });

    it('does not bring back on the local feed a subscription removed before the fallback', () => {
        const feed = build();
        feed.subscribe(TX, () => {})();
        feed.subscribe(BLOCK, () => {});

        vi.advanceTimersByTime(WORKER_STATUS_TIMEOUT_MS);

        expect(locals[0].handlers.map(h => h.query)).toEqual([BLOCK]);
    });

    it('close() sends bye, stops the fallback timer and ignores later worker messages', () => {
        const feed = build();
        const got: unknown[] = [];
        feed.subscribe(BLOCK, r => got.push(r));

        feed.close();
        workers[0].reply({type: 'event', sid: '1', result: {height: 1}});
        vi.advanceTimersByTime(WORKER_STATUS_TIMEOUT_MS * 2);

        expect(workers[0].sentOfType('bye')).toHaveLength(1);
        expect(locals).toHaveLength(0);
        expect(got).toEqual([]);
    });

    it('falls back to the local feed when the worker cannot be created, re-registering subscriptions', () => {
        createWorker = () => { throw new Error('no SharedWorker'); };
        const feed = build();
        const got: unknown[] = [];
        const statuses: FeedStatus[] = [];
        feed.onStatus(s => statuses.push(s));
        feed.subscribe(BLOCK, r => got.push(r));

        expect(locals).toHaveLength(1);
        locals[0].setStatus('live');
        locals[0].emit(BLOCK, {height: 3});

        expect(got).toEqual([{height: 3}]);
        expect(statuses).toEqual(['connecting', 'live']);
    });

    it('falls back when the worker reports an error and re-registers earlier subscriptions', () => {
        const feed = build();
        const got: unknown[] = [];
        feed.subscribe(BLOCK, r => got.push(r));
        workers[0].reply({type: 'status', status: 'live'});

        workers[0].onerror?.(new Error('boom'));

        expect(locals).toHaveLength(1);
        expect(locals[0].handlers.map(h => h.query)).toEqual([BLOCK]);
        locals[0].emit(BLOCK, {height: 4});
        expect(got).toEqual([{height: 4}]);
    });

    it('falls back when no status arrives within the timeout, and not before', () => {
        const feed = build();
        feed.subscribe(BLOCK, () => {});

        vi.advanceTimersByTime(WORKER_STATUS_TIMEOUT_MS - 1);
        expect(locals).toHaveLength(0);

        vi.advanceTimersByTime(1);
        expect(locals).toHaveLength(1);
        expect(locals[0].handlers.map(h => h.query)).toEqual([BLOCK]);
    });

    it('does not fall back once the worker has reported a status', () => {
        build();
        workers[0].reply({type: 'status', status: 'connecting'});

        vi.advanceTimersByTime(WORKER_STATUS_TIMEOUT_MS * 2);

        expect(locals).toHaveLength(0);
    });

    it('delivers to subscriptions made before and after the fallback, and never retries the worker', () => {
        const feed = build();
        const before: unknown[] = [];
        const after: unknown[] = [];
        feed.subscribe(BLOCK, r => before.push(r));
        vi.advanceTimersByTime(WORKER_STATUS_TIMEOUT_MS);
        feed.subscribe(TX, r => after.push(r));

        locals[0].emit(BLOCK, {height: 1});
        locals[0].emit(TX, {hash: 'b'});

        expect(before).toEqual([{height: 1}]);
        expect(after).toEqual([{hash: 'b'}]);
        expect(workers).toHaveLength(1);
        expect(locals).toHaveLength(1);
    });

    it('ignores a late worker status after the fallback and forwards the local one', () => {
        const feed = build();
        const statuses: FeedStatus[] = [];
        feed.onStatus(s => statuses.push(s));
        vi.advanceTimersByTime(WORKER_STATUS_TIMEOUT_MS);

        workers[0].reply({type: 'status', status: 'live'});
        locals[0].setStatus('down');

        expect(statuses).toEqual(['connecting', 'down']);
    });

    it('releases local subscriptions on unsubscribe after the fallback', () => {
        const feed = build();
        const unsubscribe = feed.subscribe(BLOCK, () => {});
        vi.advanceTimersByTime(WORKER_STATUS_TIMEOUT_MS);

        unsubscribe();

        expect(locals[0].handlers).toHaveLength(0);
    });
});
