import {useCallback, useState} from 'react';
import {loadDaoExtras, type DaoViewDeps} from '@/lib/dao-view-loader';
import type {ScanDaoDetail} from '@/lib/dao-types';
import {useAsync} from './useAsync';

export interface DaoExtras {
    /** Scan's detail of the DAO; null when Scan does not know it, undefined while loading or after a failure. */
    data: ScanDaoDetail | null | undefined;
    loading: boolean;
    /** Scan did not answer. */
    failed: boolean;
    retry: () => void;
}

/** What BZE Scan adds to a DAO's pages (creation time, names, proposal counts), with a retry. A null id reads nothing yet. */
export function useDaoExtras(deps: DaoViewDeps, daoId: string | null): DaoExtras {
    const [attempt, setAttempt] = useState(0);
    const extras = useAsync(daoId === null ? null : `${daoId}:${attempt}`, () => loadDaoExtras(deps, daoId!));
    const retry = useCallback(() => setAttempt((n) => n + 1), []);
    return {data: extras.data, loading: extras.loading, failed: !extras.loading && !!extras.error, retry};
}
