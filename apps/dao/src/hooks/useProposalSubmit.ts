import {useCallback, useRef, useState} from 'react';
import type {EncodeObject} from '@bze/bzejs/types';
import {daoTxOptions} from '@bze/bze-ui-kit';
import type {TxOptions} from '@bze/bze-ui-kit';
import {proposalIdFromTx} from '@/lib/propose/submit-result';

/** The signing function of the ui-kit's `useBZETx`, injected so the hook is tested without a wallet. */
export type SignAndBroadcast = (msgs: EncodeObject[], options?: TxOptions) => Promise<boolean>;

export type SubmitState =
    | {phase: 'idle'}
    /** Simulating, signing, broadcasting and waiting for the block. */
    | {phase: 'working'}
    /** Nothing landed: refused before signing (simulation), rejected in the wallet, or refused by the chain. `hash` is set when the chain ran it. */
    | {phase: 'failed'; message: string; hash?: string}
    /** Broadcast, but the block was not seen in time: it may still land, so submitting again is blocked until the user says it did not. */
    | {phase: 'unconfirmed'; message: string; hash: string | null}
    | {phase: 'done'; hash: string; proposalId: string | null};

/**
 * Sends one MsgSubmitProposal and tracks where it stands. Direct signing with the simulation required
 * (`daoTxOptions`): a proposal the chain would refuse (1118 not a voter, 1119 no voters, 1120 too many
 * open, 1121 expedited not allowed, a payment from nowhere) is reported with the chain's reason and
 * nothing is signed. After a broadcast the outcome can be unknown (a confirmation timeout): the state
 * is `unconfirmed`, with the hash, and `submit` refuses to send again until `allowResubmit` is called,
 * so a slow block never turns into a double submit by accident.
 */
export function useProposalSubmit(sign: SignAndBroadcast) {
    const [state, setState] = useState<SubmitState>({phase: 'idle'});
    const inFlight = useRef(false);
    const locked = useRef(false);

    const submit = useCallback(async (msg: EncodeObject): Promise<void> => {
        if (inFlight.current || locked.current) return;
        inFlight.current = true;
        setState({phase: 'working'});

        // read back after the wait: plain `let`s assigned in callbacks are narrowed to their initial value
        const seen: {hash: string | null; outcome: SubmitState | null} = {hash: null, outcome: null};
        try {
            await sign([msg], {
                ...daoTxOptions,
                toasts: false,
                onBroadcast: (txHash) => {
                    seen.hash = txHash;
                },
                onSuccess: (res) => {
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

        inFlight.current = false;
        const final: SubmitState = seen.outcome ?? (seen.hash
            ? {phase: 'unconfirmed', message: 'The transaction was sent but the result was not seen.', hash: seen.hash}
            : {phase: 'failed', message: 'The transaction was not sent.'});
        locked.current = final.phase === 'unconfirmed' || final.phase === 'done';
        setState(final);
    }, [sign]);

    /** After an `unconfirmed` outcome: the user checked, the transaction did not land, sending again is allowed. */
    const allowResubmit = useCallback(() => {
        locked.current = false;
        setState({phase: 'idle'});
    }, []);

    return {state, submit, allowResubmit};
}
