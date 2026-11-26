import {useCallback, useEffect, useRef, useState} from 'react';
import type {EncodeObject} from '@bze/bzejs/types';
import type {TxLanding} from '@bze/bze-ui-kit';
import {adminPendingKey, clearAdminPending, loadAdminPending, saveAdminPending} from '@/lib/admin/pending';
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
    /** The hash of a transaction another tab of this wallet left unconfirmed for this DAO: nothing is sent here until it is settled there. Null when there is none. */
    foreignLock: string | null;
}

/**
 * The admin console's one flow (BFE-377): `useActionFlow` with the DAO sign options, so a refused simulation
 * signs nothing, and a transaction that may still land locks every operation, also across a reload (its hash is
 * kept in storage per DAO and wallet, and "Check again" asks the node before anything can be sent again).
 */
export function useAdminFlow({sign, daoId, wallet, storage, refresh, fingerprint, lookupTx}: AdminFlowDeps): AdminFlow {
    const kind = useRef<ActionKind>('admin-execute');
    // the hash this tab's own flow is waiting on (its own record in storage is not a foreign lock)
    const ownHash = useRef<string | null>(null);
    const [initial] = useState<FlowState>(() => {
        const restored = loadAdminPending(storage, daoId, wallet);
        return restored
            ? {phase: 'unconfirmed', kind: restored.kind, error: 'A transaction you sent for this DAO was not confirmed. It may still be included.', txHash: restored.hash, batches: 0, baseline: fingerprint()}
            : {phase: 'idle'};
    });

    const flow = useActionFlow({
        send: (msgs) => sendDaoTx(sign, msgs, (hash) => {
            ownHash.current = hash;
            saveAdminPending(storage, daoId, wallet, hash, kind.current);
        }),
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

    // another tab may have a transaction in the air for the same DAO and wallet: its hash is in storage, and this tab's flow knows nothing of it
    const [foreignLock, setForeignLock] = useState<string | null>(null);
    useEffect(() => {
        const key = adminPendingKey(daoId, wallet);
        const onStorage = (event: StorageEvent) => {
            if (event.key !== null && event.key !== key) return;
            setForeignLock(foreignHash());
        };
        const foreignHash = () => {
            const stored = loadAdminPending(storage, daoId, wallet);
            return stored && stored.hash !== ownHash.current ? stored.hash : null;
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [storage, daoId, wallet]);

    const run = useCallback(async (next: ActionKind, msgs: EncodeObject[]) => {
        // read again, now: a lock set after this page loaded still holds
        const stored = loadAdminPending(storage, daoId, wallet);
        if (stored && stored.hash !== ownHash.current && flow.state.phase !== 'unconfirmed') {
            setForeignLock(stored.hash);
            return;
        }
        kind.current = next;
        await flow.run(next, msgs);
    }, [flow, storage, daoId, wallet]);

    return {flow, run, foreignLock};
}
