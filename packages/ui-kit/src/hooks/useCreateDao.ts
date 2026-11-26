'use client';

import {useCallback, useState} from 'react';
import {EncodeObject} from '@bze/bzejs/types';
import {daoTxOptions} from '../utils/dao/msgs';
import {DaoCreated, FetchTxEvents, readDaoCreated} from '../utils/dao/created';
import type {TxOptions} from './useTx';

/** What signing needs: the app's `useBZETx().tx`. */
export type CreateDaoTx = (msgs: EncodeObject[], options?: TxOptions) => Promise<boolean>;

export type CreateDaoStatus = 'idle' | 'signing' | 'created' | 'failed' | 'unread';

export interface UseCreateDaoDeps {
    tx: CreateDaoTx;
    fetchTxEvents: FetchTxEvents;
}

/**
 * Signs a MsgCreateDao (direct sign, nothing signed when the fee simulation fails) and reads the
 * new DAO from the result. Both collaborators are injected. `unread` is a transaction that went
 * through but whose DAO id could not be read: the DAO exists, the page cannot link to it.
 */
export function useCreateDao({tx, fetchTxEvents}: UseCreateDaoDeps) {
    const [status, setStatus] = useState<CreateDaoStatus>('idle');
    const [error, setError] = useState<string | undefined>();
    const [created, setCreated] = useState<DaoCreated | undefined>();
    const [txHash, setTxHash] = useState<string | undefined>();

    const submit = useCallback(async (msg: EncodeObject): Promise<DaoCreated | undefined> => {
        setStatus('signing');
        setError(undefined);
        let result: DaoCreated | undefined;
        let resolved: Promise<void> = Promise.resolve();
        await tx([msg], {
            ...daoTxOptions,
            toasts: false,
            onSuccess: (resp) => {
                resolved = readDaoCreated(resp as {txhash: string; events?: unknown}, fetchTxEvents).then((c) => {
                    setTxHash(resp.txhash);
                    if (c) {
                        result = c;
                        setCreated(c);
                        setStatus('created');
                    } else {
                        setStatus('unread');
                    }
                });
            },
            onFailure: (err) => {
                setStatus('failed');
                setError(err);
            },
        });
        await resolved;
        return result;
    }, [tx, fetchTxEvents]);

    return {submit, status, error, created, txHash};
}
