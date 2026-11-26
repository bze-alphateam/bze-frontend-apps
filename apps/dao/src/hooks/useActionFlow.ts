import {useCallback, useEffect, useRef, useState} from 'react';
import type {EncodeObject} from '@bze/bzejs/types';
import type {TxLanding} from '@bze/bze-ui-kit';
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
    | {phase: 'unconfirmed'; kind: ActionKind; error: string; txHash?: string; batches: number; /** What the proposal looked like when it was sent, to tell later whether it changed. */ baseline: string; /** Why the last check could not settle it. */ note?: string}
    /** On chain. `reread: 'failed'` keeps the actions locked, since the page still shows the state before it. */
    | {phase: 'sent'; kind: ActionKind; txHash: string; reread: 'ok' | 'failed'; batches: number}
    /** The user re-read the proposal after an unconfirmed transaction: the actions are open again. */
    /** The node does not know the transaction (yet): the actions are open again, at the user's risk. */
    | {phase: 'rechecked'; kind: ActionKind; txHash?: string};

export interface ActionFlowDeps {
    /** Signs and sends messages (ui-kit's signing client through `sendDaoTx`). */
    send: (msgs: EncodeObject[]) => Promise<TxOutcome>;
    /** Re-reads the proposal from the chain after a transaction. */
    refresh: () => Promise<'ok' | 'gone' | 'failed'>;
    /** True once the chain no longer has the proposal (clean-up). Throws when it cannot be read. */
    isGone: () => Promise<boolean>;
    /** A short text of what the proposal shows (status and tally), compared before and after to see that a transaction landed. */
    fingerprint: () => string;
    /** Looks a transaction up on the node by its hash; throws when the node cannot be read. */
    lookupTx: (hash: string) => Promise<TxLanding>;
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
    const baselines = useRef('');
    const latest = useRef(deps);
    const stateRef = useRef(state);
    useEffect(() => {
        latest.current = deps;
        stateRef.current = state;
    });

    const run = useCallback(async (kind: ActionKind, msgs: EncodeObject[]) => {
        if (busy.current || isLocked(stateRef.current)) return;
        busy.current = true;
        baselines.current = latest.current.fingerprint();
        setState({phase: 'signing', kind, batches: 0, processed: null});
        try {
            const out = await latest.current.send(msgs);
            if (!out.ok) {
                setState(out.unconfirmed
                    ? {phase: 'unconfirmed', kind, error: out.error, txHash: out.txHash, batches: 0, baseline: baselines.current}
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
        baselines.current = latest.current.fingerprint();
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
                    ? {phase: 'unconfirmed', kind: 'cleanup', error: out.error, txHash: out.txHash, batches: result.batches, baseline: baselines.current}
                    : {phase: 'failed', kind: 'cleanup', error: out.error, batches: result.batches});
            } else if (result.reason === 'unreadable') {
                setState({phase: 'unconfirmed', kind: 'cleanup', error: 'The last batch went through, but the chain could not be read to see whether the clean-up is finished.', batches: result.batches, baseline: baselines.current});
            } else {
                setState({phase: 'failed', kind: 'cleanup', batches: result.batches, error: result.reason === 'no-progress'
                    ? 'The chain said the clean-up is not finished but deleted nothing in the last batch, so no more batches were sent. Try again later.'
                    : 'The clean-up did not finish after many batches. Try again later.'});
            }
        } finally {
            busy.current = false;
        }
    }, []);

    const recheck = useCallback(async () => {
        const current = stateRef.current;
        const stale = current.phase === 'sent' && current.reread === 'failed';
        if (current.phase !== 'unconfirmed' && !stale) return;
        const result = await latest.current.refresh();
        if (current.phase === 'sent') {
            if (result !== 'failed') setState({...current, reread: 'ok'});
            return;
        }
        if (current.phase !== 'unconfirmed') return;
        const stillLocked = (note: string) => setState({...current, note});
        if (result === 'failed') return stillLocked('The proposal could not be read from the chain, so it is not known whether the transaction landed.');

        // the proposal moved on as this action moves it: the transaction landed. A vote only shifts the tally,
        // which other voters shift too, so a vote is judged by the transaction itself
        const moves = current.kind !== 'vote';
        if (result === 'gone' || (moves && latest.current.fingerprint() !== current.baseline)) {
            setState({phase: 'sent', kind: current.kind, txHash: current.txHash ?? '', reread: 'ok', batches: current.batches});
            return;
        }
        if (!current.txHash) {
            setState({phase: 'rechecked', kind: current.kind});
            return;
        }
        let found: TxLanding;
        try {
            found = await latest.current.lookupTx(current.txHash);
        } catch {
            return stillLocked('The node could not be asked about the transaction, so it is not known whether it landed.');
        }
        if (found === 'notfound') setState({phase: 'rechecked', kind: current.kind, txHash: current.txHash});
        else if (found === 'landed') setState({phase: 'sent', kind: current.kind, txHash: current.txHash, reread: 'ok', batches: current.batches});
        else setState({phase: 'failed', kind: current.kind, error: 'The chain refused the transaction, so nothing happened. You can try again.', batches: current.batches});
    }, []);

    return {state, locked: isLocked(state), run, runCleanup, recheck};
}
