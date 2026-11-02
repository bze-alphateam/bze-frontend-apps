import {describe, expect, it, vi} from 'vitest';
import {watchTabResume, type ResumeEvent, type ResumeEventType, type ResumeTarget} from './tab_resume';

class FakeTarget implements ResumeTarget {
    visibilityState: string = 'visible';
    listeners = new Map<ResumeEventType, Set<(ev: ResumeEvent) => void>>();

    addEventListener(type: ResumeEventType, fn: (ev: ResumeEvent) => void) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(fn);
    }
    removeEventListener(type: ResumeEventType, fn: (ev: ResumeEvent) => void) {
        this.listeners.get(type)?.delete(fn);
    }
    count() {
        return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
    }
    emit(type: ResumeEventType, ev: ResumeEvent = {}) {
        this.listeners.get(type)?.forEach(fn => fn(ev));
    }
    setState(state: string) {
        this.visibilityState = state;
        this.emit('visibilitychange');
    }
}

const setup = () => {
    const target = new FakeTarget();
    let time = 1_000_000;
    const onResume = vi.fn();
    const stop = watchTabResume({target, now: () => time, minHiddenMs: 30_000}, onResume);
    return {target, onResume, stop, advance: (ms: number) => { time += ms; }};
};

describe('watchTabResume', () => {
    it('calls onResume once when visible again after 31 s hidden', () => {
        const {target, onResume, advance} = setup();
        target.setState('hidden');
        advance(31_000);
        target.setState('visible');
        expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('does not call onResume after a 10 s hide', () => {
        const {target, onResume, advance} = setup();
        target.setState('hidden');
        advance(10_000);
        target.setState('visible');
        expect(onResume).not.toHaveBeenCalled();
    });

    it('does not count a short hide towards a later one', () => {
        const {target, onResume, advance} = setup();
        target.setState('hidden');
        advance(10_000);
        target.setState('visible');
        advance(60_000);
        target.setState('hidden');
        advance(5_000);
        target.setState('visible');
        expect(onResume).not.toHaveBeenCalled();
    });

    it('calls onResume for a pageshow restored from the bfcache', () => {
        const {target, onResume} = setup();
        target.emit('pageshow', {persisted: true});
        expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('ignores a pageshow that is not persisted', () => {
        const {target, onResume} = setup();
        target.emit('pageshow', {persisted: false});
        expect(onResume).not.toHaveBeenCalled();
    });

    it('calls onResume once when visibilitychange and pageshow fire together', () => {
        const {target, onResume, advance} = setup();
        target.setState('hidden');
        advance(40_000);
        target.visibilityState = 'visible';
        target.emit('visibilitychange');
        target.emit('pageshow', {persisted: true});
        expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('calls onResume once when pageshow fires before visibilitychange', () => {
        const {target, onResume, advance} = setup();
        target.setState('hidden');
        advance(40_000);
        target.visibilityState = 'visible';
        target.emit('pageshow', {persisted: true});
        target.emit('visibilitychange');
        expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('resumes again on a later long hide', () => {
        const {target, onResume, advance} = setup();
        target.setState('hidden');
        advance(40_000);
        target.setState('visible');
        advance(5_000);
        target.setState('hidden');
        advance(40_000);
        target.setState('visible');
        expect(onResume).toHaveBeenCalledTimes(2);
    });

    it('removes both listeners on unsubscribe', () => {
        const {target, onResume, stop, advance} = setup();
        expect(target.count()).toBe(2);
        stop();
        expect(target.count()).toBe(0);
        target.setState('hidden');
        advance(40_000);
        target.setState('visible');
        target.emit('pageshow', {persisted: true});
        expect(onResume).not.toHaveBeenCalled();
    });
});
