import {useCallback, useRef, useState} from 'react';
import type {EncodeObject} from '@bze/bzejs/types';
import {daoTxOptions} from '@bze/bze-ui-kit';
import type {TxLanding, TxOptions} from '@bze/bze-ui-kit';
import type {DraftStorage} from '@/lib/propose/draft';
import {clearPending, loadPending, readProposalId, savePending, type FetchTxEvents} from '@/lib/propose/pending';
import {proposalIdFromTx} from '@/lib/propose/submit-result';

/** The signing function of the ui-kit's `useBZETx`, injected so the hook is tested without a wallet. */
export type SignAndBroadcast = (msgs: EncodeObject[], options?: TxOptions) => Promise<boolean>;

export type SubmitState =
    | {phase: 'idle'}
    /** Simulating, signing, broadcasting and waiting for the block. */
    | {phase: 'working'}
    /** Nothing landed: refused before signing (simulation), rejected in the wallet, or refused by the chain. `hash` is set when the chain ran it. */
    | {phase: 'failed'; message: string; hash?: string}
    /**
     * Broadcast, but the block was not seen in time: it may still land, so submitting again is blocked until the
     * node says it did not (`check`) or the user says so (`allowResubmit`). `note` is the last answer of `check`.
     */
    | {phase: 'unconfirmed'; message: string; hash: string | null; note?: string}
    | {phase: 'done'; hash: string; proposalId: string | null};

export interface ProposalSubmitDeps {
    sign: SignAndBroadcast;
    daoId: string;
    /** Where an unconfirmed hash is remembered across a reload (null: only this page remembers it). */
    storage: DraftStorage | null;
    /** Where a broadcast transaction stands, from the node. */
    getTxLanding: (txHash: string) => Promise<TxLanding>;
    /** The events of a transaction, to read the new proposal's id when the response carries none. */
    fetchTxEvents: FetchTxEvents;
    /** How long reading the id may take before the proposal counts as created but unread. Default 15 s. */
    readTimeoutMs?: number;
}

const RESTORED = 'A transaction you sent for this DAO was not confirmed. It may still be included.';

/**
 * Sends one MsgSubmitProposal and tracks where it stands. Direct signing with the simulation required
 * (`daoTxOptions`): a proposal the chain would refuse (1118 not a voter, 1119 no voters, 1120 too many
 * open, 1121 expedited not allowed, a payment from nowhere) is reported with the chain's reason and
 * nothing is signed. After a broadcast the outcome can be unknown (a confirmation timeout): the state
 * is `unconfirmed`, with the hash, which is also kept in storage, so a slow block or a reload never turns
 * into a double submit. `check` asks the node; `allowResubmit` is the user's word that it did not land.
 */
export function useProposalSubmit({sign, daoId, storage, getTxLanding, fetchTxEvents, readTimeoutMs = 15_000}: ProposalSubmitDeps) {
    const [state, setStateValue] = useState<SubmitState>(() => {
        const hash = loadPending(storage, daoId);
        return hash ? {phase: 'unconfirmed', message: RESTORED, hash} : {phase: 'idle'};
    });
    const inFlight = useRef(false);
    const locked = useRef(state.phase === 'unconfirmed');

    const settle = useCallback((next: SubmitState) => {
        locked.current = next.phase === 'unconfirmed' || next.phase === 'done';
        setStateValue(next);
    }, []);

    /** The proposal a landed transaction created, read from the node's copy when the response had no events. */
    const land = useCallback(async (hash: string, response: object): Promise<SubmitState> => {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), readTimeoutMs));
        const proposalId = await Promise.race([readProposalId(response, hash, fetchTxEvents), timeout]);
        clearPending(storage, daoId);
        return {phase: 'done', hash, proposalId};
    }, [fetchTxEvents, readTimeoutMs, storage, daoId]);

    const submit = useCallback(async (msg: EncodeObject): Promise<void> => {
        if (inFlight.current || locked.current) return;
        inFlight.current = true;
        setStateValue({phase: 'working'});

        // read back after the wait: plain `let`s assigned in callbacks are narrowed to their initial value
        const seen: {hash: string | null; outcome: SubmitState | null; response: object | null} = {hash: null, outcome: null, response: null};
        try {
            await sign([msg], {
                ...daoTxOptions,
                toasts: false,
                onBroadcast: (txHash) => {
                    seen.hash = txHash;
                    savePending(storage, daoId, txHash);
                },
                onSuccess: (res) => {
                    seen.response = res;
                    seen.outcome = {phase: 'done', hash: res.txhash || seen.hash || '', proposalId: proposalIdFromTx(res)};
                },
                onFailure: (message, details) => {
                    const txHash = details?.txHash ?? seen.hash;
                    // a chain code means the transaction ran and was refused; a timeout, or a broadcast that ended in
                    // anything else, may still land
                    const refused = details?.stage === 'prepare' || details?.stage === 'sign' || (details?.stage === 'chain' && details.code !== undefined);
                    const unknown = !refused && (details?.stage === 'timeout' || !!txHash);
                    seen.outcome = unknown
                        ? {phase: 'unconfirmed', message, hash: txHash ?? null}
                        : {phase: 'failed', message, hash: txHash ?? undefined};
                },
            });
        } catch (e) {
            seen.outcome = {phase: 'failed', message: (e as Error)?.message || 'The transaction could not be sent.'};
        }

        let final: SubmitState = seen.outcome ?? (seen.hash
            ? {phase: 'unconfirmed', message: 'The transaction was sent but the result was not seen.', hash: seen.hash}
            : {phase: 'failed', message: 'The transaction was not sent.'});
        if (final.phase === 'done' && final.proposalId === null && final.hash) {
            final = await land(final.hash, seen.response ?? {});
        } else if (final.phase === 'done' || final.phase === 'failed') {
            clearPending(storage, daoId);
        } else if (final.phase === 'unconfirmed' && final.hash) {
            savePending(storage, daoId, final.hash);
        }
        inFlight.current = false;
        settle(final);
    }, [sign, storage, daoId, land, settle]);

    /** After an `unconfirmed` outcome: ask the node. Landed: the proposal exists. Refused: nothing was created, submitting again is safe. */
    const check = useCallback(async (): Promise<void> => {
        if (state.phase !== 'unconfirmed' || !state.hash || inFlight.current) return;
        const {hash, message} = state;
        let landing: TxLanding;
        try {
            landing = await getTxLanding(hash);
        } catch {
            setStateValue({phase: 'unconfirmed', message, hash, note: 'The node could not be asked. Check again in a moment.'});
            return;
        }
        if (landing === 'landed') {
            settle(await land(hash, {}));
        } else if (landing === 'failed') {
            clearPending(storage, daoId);
            settle({phase: 'failed', message: 'The chain refused that transaction. No proposal was created and nothing was charged; you can submit again.', hash});
        } else {
            setStateValue({phase: 'unconfirmed', message, hash, note: 'The node does not know the transaction yet. It may still be included: check again in a moment.'});
        }
    }, [state, getTxLanding, land, settle, storage, daoId]);

    /** The user checked the explorer and the transaction did not land: sending again is allowed. */
    const allowResubmit = useCallback(() => {
        clearPending(storage, daoId);
        locked.current = false;
        setStateValue({phase: 'idle'});
    }, [storage, daoId]);

    return {state, submit, check, allowResubmit};
}
