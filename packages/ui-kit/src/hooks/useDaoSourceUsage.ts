'use client'

import {useEffect, useState} from "react";
import {
    defaultDaoSourceUsageReader,
    type DaoSourceUsage,
    type DaoSourceUsageReader,
    EMPTY_DAO_SOURCE_USAGE,
} from "../query/dao_source_usage";

export interface UseDaoSourceUsageResult extends DaoSourceUsage {
    loading: boolean;
}

/**
 * The DAOs that vote with a staking source (`sr/{reward_id}` or `dr/{staking_denom}`) and their
 * open proposals, from BZE Scan through the app's `/api/scan` proxy. Empty while loading and on any
 * failure (a v8.2.x chain, a Scan without the DAO routes, a network error).
 */
export function useDaoSourceUsage(source: string | undefined, reader: DaoSourceUsageReader = defaultDaoSourceUsageReader): UseDaoSourceUsageResult {
    const [loaded, setLoaded] = useState<{source: string; usage: DaoSourceUsage} | undefined>();

    useEffect(() => {
        if (!source) return;
        let cancelled = false;
        reader.read(source).then(
            (usage) => { if (!cancelled) setLoaded({source, usage}); },
            () => { if (!cancelled) setLoaded({source, usage: EMPTY_DAO_SOURCE_USAGE}); },
        );
        return () => { cancelled = true; };
    }, [source, reader]);

    const ready = Boolean(source) && loaded?.source === source;
    return {...(ready ? loaded!.usage : EMPTY_DAO_SOURCE_USAGE), loading: Boolean(source) && !ready};
}
