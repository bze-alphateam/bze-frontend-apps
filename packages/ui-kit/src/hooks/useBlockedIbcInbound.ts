'use client'

import {useEffect, useState} from "react";
import {getTxFeeCollectorParams, type BlockedIbcInbound} from "../query/txfeecollector_params";

/**
 * The chain's current IBC inbound block list (txfeecollector `blocked_ibc_inbound`).
 *
 * `undefined` while loading or when the params query fails. Pass it straight to
 * `isIbcInboundBlocked` / `getLegacyAssetNotice`, which treat `undefined` as
 * "nothing blocked" (fail open).
 */
export function useBlockedIbcInbound(): BlockedIbcInbound[] | undefined {
    const [blocked, setBlocked] = useState<BlockedIbcInbound[] | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        getTxFeeCollectorParams().then(params => {
            if (cancelled) return;
            setBlocked(params?.blockedIbcInbound);
        });
        return () => { cancelled = true; };
    }, []);

    return blocked;
}
