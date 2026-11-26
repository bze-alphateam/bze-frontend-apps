import {useCallback, useEffect, useRef, useState} from 'react';
import type {EncodeObject} from '@bze/bzejs/types';
import type {TxOutcome} from '@/lib/dao-tx';
import {cleanupProposal} from '@/lib/proposal-cleanup';

export type ActionKind = 'vote' | 'vote-settle' | 'settle' | 'cancel' | 'cleanup';

export type FlowState =
    | {phase: 'idle'}
    /** The wallet is signing (or the transaction is on its way); `batches` counts the accepted clean-up batches. */
    | {phase: 'signing'; kind: ActionKind; batches: number; /** Ballots deleted so far by a clean-up; null when the chain's events did not say. */ processed: number | null}
    /** Refused or not signed: nothing was sent, the actions are open again. */
    | {phase: 'failed'; kind: ActionKind; error: string; batches: number}
    /** Sent but not confirmed (or confirmed but the chain cannot be asked): locked until the proposal is re-read. */
    | {phase: 'unconfirmed'; kind: ActionKind; error: string; txHash?: string; batches: number}
    /** On chain. `reread: 'failed'` keeps the actions locked, since the page still shows the state before it. */
    | {phase: 'sent'; kind: ActionKind; txHash: string; reread: 'ok' | 'failed'; batches: number}
    /** The user re-read the proposal after an unconfirmed transaction: the actions are open again. */
    | {phase: 'rechecked'; kind: ActionKind; txHash?: string};

export interface ActionFlowDeps {
    /** Signs and sends messages (ui-kit's signing client through `sendDaoTx`). */
    send: (msgs: EncodeObject[]) => Promise<TxOutcome>;
    /** Re-reads the proposal from the chain after a transaction. */
    refresh: () => Promise<'ok' | 'gone' | 'failed'>;
    /** True once the chain no longer has the proposal (clean-up). Throws when it cannot be read. */
    isGone: () => Promise<boolean>;
}

export interface ActionFlow {
    state: FlowState;
    /** True while no new transaction may start: one is being signed, may still land, or the page is stale. */
    locked: boolean;
    run: (kind: ActionKind, msgs: EncodeObject[]) => Promise<void>;
    /** Repeats a clean-up batch until the chain has deleted the proposal. */
    runCleanup: (msg: EncodeObject) => Promise<void>;
    /** Re-reads the proposal after an unconfirmed transaction (or a failed re-read) and opens the actions again once it was read. */
    recheck: () => Promise<void>;
}

const isLocked = (s: FlowState): boolean =>
    s.phase === 'signing' || s.phase === 'unconfirmed' || (s.phase === 'sent' && s.reread === 'failed');

/**
 * The state of one action at a time. A transaction whose fate is unknown (a confirmation timeout) locks the
 * actions and shows its hash: it may still land, so the user re-reads the proposal before anything else is sent.
 */
export function useActionFlow(deps: ActionFlowDeps): ActionFlow {
    const [state, setState] = useState<FlowState>({phase: 'idle'});
    const busy = useRef(false);
    const latest = useRef(deps);
    const stateRef = useRef(state);
    useEffect(() => {
        latest.current = deps;
        stateRef.current = state;
    });

    const run = useCallback(async (kind: ActionKind, msgs: EncodeObject[]) => {
        if (busy.current || isLocked(stateRef.current)) return;
        busy.current = true;
        setState({phase: 'signing', kind, batches: 0, processed: null});
        try {
            const out = await latest.current.send(msgs);
            if (!out.ok) {
                setState(out.unconfirmed
                    ? {phase: 'unconfirmed', kind, error: out.error, txHash: out.txHash, batches: 0}
                    : {phase: 'failed', kind, error: out.error, batches: 0});
                return;
            }
            const reread = await latest.current.refresh();
            setState({phase: 'sent', kind, txHash: out.txHash, reread: reread === 'failed' ? 'failed' : 'ok', batches: 0});
        } finally {
            busy.current = false;
        }
    }, []);

    const runCleanup = useCallback(async (msg: EncodeObject) => {
        if (busy.current || isLocked(stateRef.current)) return;
        busy.current = true;
        setState({phase: 'signing', kind: 'cleanup', batches: 0, processed: null});
        try {
            const result = await cleanupProposal({
                sendBatch: () => latest.current.send([msg]),
                isGone: () => latest.current.isGone(),
                onProgress: (batches, processed) => setState({phase: 'signing', kind: 'cleanup', batches, processed}),
            });
            if (result.state === 'completed') {
                const reread = await latest.current.refresh();
                setState({phase: 'sent', kind: 'cleanup', txHash: '', reread: reread === 'failed' ? 'failed' : 'ok', batches: result.batches});
            } else if (result.reason === 'tx') {
                const out = result.outcome;
                setState(out.unconfirmed
                    ? {phase: 'unconfirmed', kind: 'cleanup', error: out.error, txHash: out.txHash, batches: result.batches}
                    : {phase: 'failed', kind: 'cleanup', error: out.error, batches: result.batches});
            } else if (result.reason === 'unreadable') {
                setState({phase: 'unconfirmed', kind: 'cleanup', error: 'The last batch went through, but the chain could not be read to see whether the clean-up is finished.', batches: result.batches});
            } else {
                setState({phase: 'failed', kind: 'cleanup', error: 'The clean-up did not finish after many batches. Try again later.', batches: result.batches});
            }
        } finally {
            busy.current = false;
        }
    }, []);

    const recheck = useCallback(async () => {
        const current = stateRef.current;
        if (current.phase !== 'unconfirmed' && !(current.phase === 'sent' && current.reread === 'failed')) return;
        const result = await latest.current.refresh();
        if (result === 'failed') return;
        setState(current.phase === 'sent' ? {...current, reread: 'ok'} : {phase: 'rechecked', kind: current.kind, txHash: current.txHash});
    }, []);

    return {state, locked: isLocked(state), run, runCleanup, recheck};
}
