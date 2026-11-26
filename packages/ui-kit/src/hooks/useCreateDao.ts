'use client';

import {useCallback, useRef, useState} from 'react';
import {EncodeObject} from '@bze/bzejs/types';
import {daoTxOptions} from '../utils/dao/msgs';
import {DaoCreated, FetchTxEvents, readDaoCreated} from '../utils/dao/created';
import type {TxLanding} from '../query/dao_sources';
import type {TxOptions} from './useTx';

/** What signing needs: the app's `useBZETx().tx`. */
export type CreateDaoTx = (msgs: EncodeObject[], options?: TxOptions) => Promise<boolean>;

/**
 * - `signing`: the wallet or the node is working on it;
 * - `pending`: broadcast but not confirmed. It may still land, so nothing can be sent again;
 * - `created`: the DAO exists and its id is known; `unread`: it exists, its id could not be read;
 * - `failed`: nothing was created, signing again is safe.
 */
export type CreateDaoStatus = 'idle' | 'signing' | 'pending' | 'created' | 'failed' | 'unread';

export interface UseCreateDaoDeps {
    tx: CreateDaoTx;
    fetchTxEvents: FetchTxEvents;
    /** Looks a broadcast transaction up by hash. */
    getTxLanding: (txHash: string) => Promise<TxLanding>;
    /** How long reading the new DAO from the result may take before it counts as unread. Default 15 s. */
    readTimeoutMs?: number;
}

export interface CreateDaoSubmitResult {
    status: CreateDaoStatus;
    created?: DaoCreated;
}

const NOT_SENT = 'The transaction was not sent. Check that your wallet is connected and unlocked, then try again.';

/**
 * Signs a MsgCreateDao (direct sign, nothing signed when the fee simulation fails) and reads the
 * new DAO from the result. The collaborators are injected.
 *
 * Once the transaction is broadcast the hook never lets a second one go out until it knows the
 * first did not land: a timeout (or any failure after the broadcast that the chain did not answer)
 * leaves the status `pending` with the hash; `check()` asks the node and resolves it.
 */
export function useCreateDao({tx, fetchTxEvents, getTxLanding, readTimeoutMs = 15_000}: UseCreateDaoDeps) {
    const [status, setStatusState] = useState<CreateDaoStatus>('idle');
    const [error, setError] = useState<string | undefined>();
    const [created, setCreated] = useState<DaoCreated | undefined>();
    const [txHash, setTxHash] = useState<string | undefined>();
    // true from the first submit until a failure proves nothing was created: no second transaction in between
    const blocked = useRef(false);
    const statusRef = useRef<CreateDaoStatus>('idle');

    const setStatus = useCallback((next: CreateDaoStatus) => { statusRef.current = next; setStatusState(next); }, []);
    const fail = useCallback(() => { blocked.current = false; setStatus('failed'); }, [setStatus]);

    const settleLanded = useCallback(async (hash: string, events?: unknown): Promise<CreateDaoSubmitResult> => {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), readTimeoutMs));
        const c = await Promise.race([readDaoCreated({txhash: hash, events}, fetchTxEvents), timeout]);
        setTxHash(hash);
        if (c) {
            setCreated(c);
            setStatus('created');
            return {status: 'created', created: c};
        }
        setStatus('unread');
        return {status: 'unread'};
    }, [fetchTxEvents, readTimeoutMs, setStatus]);

    const submit = useCallback(async (msg: EncodeObject): Promise<CreateDaoSubmitResult> => {
        if (blocked.current) return {status: statusRef.current};
        blocked.current = true;
        setStatus('signing');
        setError(undefined);
        let broadcastHash: string | undefined;
        let outcome: CreateDaoSubmitResult | undefined;
        let landed: Promise<CreateDaoSubmitResult> | undefined;
        try {
            const ok = await tx([msg], {
                ...daoTxOptions,
                toasts: false,
                onBroadcast: (hash) => { broadcastHash = hash; setTxHash(hash); },
                onSuccess: (resp) => { landed = settleLanded(resp.txhash, (resp as {events?: unknown}).events); },
                onFailure: (err, details) => {
                    const hash = details?.txHash ?? broadcastHash;
                    // the chain answered "no": nothing was created. Anything else after a broadcast may still land.
                    if (hash && details?.stage !== 'chain') {
                        setTxHash(hash);
                        setStatus('pending');
                        setError(err);
                        outcome = {status: 'pending'};
                        return;
                    }
                    fail();
                    setError(err);
                    outcome = {status: 'failed'};
                },
            });
            if (landed) return await landed;
            if (!outcome) {
                // tx resolved without telling us anything (no wallet, no signing client)
                if (broadcastHash) {
                    setStatus('pending');
                    setError('The transaction was sent but its result is unknown.');
                    return {status: 'pending'};
                }
                fail();
                setError(ok ? 'The transaction finished without a result. Check the explorer before trying again.' : NOT_SENT);
                return {status: 'failed'};
            }
            return outcome;
        } catch (e) {
            blocked.current = false;
            throw e;
        }
    }, [tx, settleLanded, setStatus, fail]);

    /** Ask the node about the pending transaction: it landed (the DAO exists), failed (safe to retry) or is still unknown. */
    const check = useCallback(async (): Promise<CreateDaoSubmitResult> => {
        if (!txHash || status !== 'pending') return {status};
        try {
            const landing = await getTxLanding(txHash);
            if (landing === 'landed') return await settleLanded(txHash);
            if (landing === 'failed') {
                fail();
                setError('The transaction was refused by the chain. Nothing was created and nothing was charged; you can try again.');
                return {status: 'failed'};
            }
            setError('The node does not know the transaction yet. It may still be included: check again in a moment.');
        } catch {
            setError('The node could not be asked. Check again in a moment.');
        }
        return {status: 'pending'};
    }, [txHash, status, getTxLanding, settleLanded, setStatus, fail]);

    return {submit, check, status, error, created, txHash};
}
