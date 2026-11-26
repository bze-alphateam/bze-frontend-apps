import {daoTxOptions, type TxFailureDetails, type TxOptions, type TxSuccessResponse} from '@bze/bze-ui-kit';
import type {EncodeObject} from '@bze/bzejs/types';

/** The signing function of ui-kit's `useSDKTx`, injected so the flows are tested without a wallet. */
export type SignAndSend = (msgs: EncodeObject[], options?: TxOptions) => Promise<boolean>;

export type TxOutcome =
    | {ok: true; txHash: string; /** What the chain answered once the transaction was in a block (its events included). */ response?: TxSuccessResponse}
    | {
        ok: false;
        /** Where it stopped: before the wallet opened, in the wallet, on chain, or while waiting for the block. */
        stage: 'prepare' | 'sign' | 'chain' | 'timeout';
        /** The reason in plain words (mapped by ui-kit's `prettyError`). */
        error: string;
        txHash?: string;
        /**
         * The transaction was broadcast and its fate is not known: a confirmation timeout, or a failure after
         * the broadcast that carries no chain verdict. It may still land, so it must never be sent again blindly.
         */
        unconfirmed: boolean;
    };

/**
 * Signs and sends x/dao messages with `daoTxOptions` (direct signing, and no signing at all when the fee
 * simulation fails). `onBroadcast` hears the hash as soon as the transaction is out, before anyone knows its fate. The page draws its own panels, so ui-kit's toasts are off and every failure, including
 * the ones before the wallet opens, arrives through the outcome.
 */
export async function sendDaoTx(signAndSend: SignAndSend, msgs: EncodeObject[], onBroadcast?: (txHash: string) => void): Promise<TxOutcome> {
    let failure: {error: string; details?: TxFailureDetails} | null = null;
    let broadcastHash: string | undefined;
    let success: TxSuccessResponse | undefined;
    try {
        const sent = await signAndSend(msgs, {
            ...daoTxOptions,
            toasts: false,
            onBroadcast: (hash) => {
                broadcastHash = hash;
                onBroadcast?.(hash);
            },
            onSuccess: (response) => { success = response; },
            onFailure: (error, details) => { failure = {error, details}; },
        });
        if (sent) return {ok: true, txHash: success?.txhash ?? broadcastHash ?? '', response: success};
    } catch (e) {
        failure = {error: e instanceof Error ? e.message : String(e)};
    }

    const f = failure as {error: string; details?: TxFailureDetails} | null;
    const txHash = f?.details?.txHash ?? broadcastHash;
    const stage = f?.details?.stage ?? (broadcastHash ? 'timeout' : 'prepare');
    // a chain verdict carries a code; a "chain" stage without one is an error after the broadcast
    const unconfirmed = stage === 'timeout' || (!!txHash && stage === 'chain' && f?.details?.code === undefined);
    return {ok: false, stage, error: f?.error || 'The transaction was not sent.', txHash, unconfirmed};
}

interface TxEvent {
    type?: unknown;
    attributes?: unknown;
}

const attribute = (event: TxEvent, key: string): string | null => {
    if (!Array.isArray(event.attributes)) return null;
    const found = event.attributes.find((a: unknown) => typeof a === 'object' && a !== null && (a as {key?: unknown}).key === key) as {value?: unknown} | undefined;
    // typed events carry JSON values: true is "true", a count is "\"3\""
    return found && typeof found.value === 'string' ? found.value.replace(/^"|"$/g, '') : null;
};

/**
 * What the chain said about a clean-up batch in its `EventProposalCleaned` (`completed`, `processed`), read
 * from the transaction's events; null when the events are not there or not in that shape (the caller then
 * asks the chain whether the proposal is gone).
 */
export function cleanupBatchResult(response: TxSuccessResponse | undefined): {completed: boolean; processed: number | null} | null {
    const events = response?.events;
    if (!Array.isArray(events)) return null;
    const event = (events as TxEvent[]).find((e) => typeof e?.type === 'string' && e.type.endsWith('EventProposalCleaned'));
    if (!event) return null;
    const completed = attribute(event, 'completed');
    if (completed !== 'true' && completed !== 'false') return null;
    const processed = Number(attribute(event, 'processed'));
    return {completed: completed === 'true', processed: Number.isFinite(processed) ? processed : null};
}
