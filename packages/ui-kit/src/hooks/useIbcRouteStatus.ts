'use client'

import {useCallback, useEffect, useMemo, useState} from "react";
import {getBlockedDenoms, getClosedChannels} from "../query/guardian";

export interface UseIbcRouteStatusResult {
    /** `channelId` is the BZE-side channel id; exact match (`channel-3` is not `channel-30`). */
    isChannelClosed: (channelId: string | undefined) => boolean;
    /** `denom` is the BZE-side denom; exact, case-sensitive match. */
    isDenomBlocked: (denom: string | undefined) => boolean;
    loading: boolean;
    /**
     * Re-reads both lists (the readers' 60 s cache keeps it cheap) and returns the fresh checks,
     * for a last look right before signing. Also updates the hook's own state.
     */
    refresh: () => Promise<Pick<UseIbcRouteStatusResult, 'isChannelClosed' | 'isDenomBlocked'>>;
}

type Lists = {channels: string[]; denoms: string[]};

const checksFor = (lists: Lists | undefined) => {
    const channels = new Set(lists?.channels ?? []);
    const denoms = new Set(lists?.denoms ?? []);
    return {
        isChannelClosed: (id: string | undefined) => !!id && channels.has(id),
        isDenomBlocked: (d: string | undefined) => !!d && denoms.has(d),
    };
};

/**
 * Guardian stops on IBC routes (chain v8.3.0): closed transfer channels and blocked denoms.
 * Nothing is stopped while loading and when the queries fail (fail open). Reloads on mount and
 * whenever `refreshKey` changes (pass e.g. the drawer-open flag); the readers' 60s cache keeps
 * that cheap.
 */
export function useIbcRouteStatus(refreshKey?: unknown): UseIbcRouteStatusResult {
    const [state, setState] = useState<Lists | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getClosedChannels(), getBlockedDenoms()]).then(([channels, denoms]) => {
            if (!cancelled) setState({channels, denoms});
        });
        return () => { cancelled = true; };
    }, [refreshKey]);

    const checks = useMemo(() => checksFor(state), [state]);

    const refresh = useCallback(async () => {
        const [channels, denoms] = await Promise.all([getClosedChannels(), getBlockedDenoms()]);
        setState({channels, denoms});
        return checksFor({channels, denoms});
    }, []);

    return {...checks, loading: state === undefined, refresh};
}
