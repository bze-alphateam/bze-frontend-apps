import {useCallback, useEffect, useRef, useState} from 'react';
import type {EncodeObject} from '@bze/bzejs/types';
import type {TxLanding} from '@bze/bze-ui-kit';
import {clearAdminPending, loadAdminPending, saveAdminPending} from '@/lib/admin/pending';
import {sendDaoTx, type SignAndSend} from '@/lib/dao-tx';
import type {DraftStorage} from '@/lib/propose/draft';
import {useActionFlow, type ActionFlow, type ActionKind, type FlowState} from './useActionFlow';

export interface AdminFlowDeps {
    /** Signs and sends messages (ui-kit's signing client). */
    sign: SignAndSend;
    daoId: string;
    wallet: string;
    /** Where an unconfirmed hash is remembered across a reload (null: only this page remembers it). */
    storage: DraftStorage | null;
    /** Re-reads the DAO from the chain after a transaction. */
    refresh: () => Promise<'ok' | 'failed'>;
    /** What the DAO record shows now (admin, nomination), read fresh after a re-read. */
    fingerprint: () => string;
    /** Looks a transaction up on the node by its hash. */
    lookupTx: (hash: string) => Promise<TxLanding>;
}

export interface AdminFlow {
    flow: ActionFlow;
    /** Sends the messages of one console operation; nothing is sent while another transaction is in flight or may still land. */
    run: (kind: ActionKind, msgs: EncodeObject[]) => Promise<void>;
}

/**
 * The admin console's one flow (BFE-377): `useActionFlow` with the DAO sign options, so a refused simulation
 * signs nothing, and a transaction that may still land locks every operation, also across a reload (its hash is
 * kept in storage per DAO and wallet, and "Check again" asks the node before anything can be sent again).
 */
export function useAdminFlow({sign, daoId, wallet, storage, refresh, fingerprint, lookupTx}: AdminFlowDeps): AdminFlow {
    const kind = useRef<ActionKind>('admin-execute');
    const [initial] = useState<FlowState>(() => {
        const restored = loadAdminPending(storage, daoId, wallet);
        return restored
            ? {phase: 'unconfirmed', kind: restored.kind, error: 'A transaction you sent for this DAO was not confirmed. It may still be included.', txHash: restored.hash, batches: 0, baseline: fingerprint()}
            : {phase: 'idle'};
    });

    const flow = useActionFlow({
        send: (msgs) => sendDaoTx(sign, msgs, (hash) => saveAdminPending(storage, daoId, wallet, hash, kind.current)),
        refresh,
        fingerprint,
        lookupTx,
        isGone: async () => false,
    }, initial);

    // the hash stays remembered while the transaction may still land, and is dropped once its fate is known
    const {state} = flow;
    useEffect(() => {
        if (state.phase === 'unconfirmed' && state.txHash) saveAdminPending(storage, daoId, wallet, state.txHash, state.kind);
        else if (state.phase === 'sent' || state.phase === 'failed' || state.phase === 'rechecked') clearAdminPending(storage, daoId, wallet);
    }, [state, storage, daoId, wallet]);

    const run = useCallback(async (next: ActionKind, msgs: EncodeObject[]) => {
        kind.current = next;
        await flow.run(next, msgs);
    }, [flow]);

    return {flow, run};
}
