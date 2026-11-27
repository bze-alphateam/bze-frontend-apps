import {useEffect, useMemo, useState} from "react";
import {DenomConfigInfo, getDenomConfigInfo} from "../query/denom_config";

/**
 * The tokenfactory config (v8.3.0) of each given denom, by denom. Non-factory denoms are skipped
 * (they never have one); the reader caches per denom and shares in-flight requests, so repeated
 * renders and hooks asking for the same denom cost one request. A denom is absent until loaded.
 */
export function useDenomConfigs(denoms: string[]): Map<string, DenomConfigInfo> {
    const key = useMemo(() => Array.from(new Set(denoms.filter(d => d?.startsWith("factory/")))).sort().join("|"), [denoms]);
    const [configs, setConfigs] = useState<Map<string, DenomConfigInfo>>(new Map());

    useEffect(() => {
        const wanted = key ? key.split("|") : [];
        if (wanted.length === 0) {
            return;
        }

        let cancelled = false;
        // Each denom lands as soon as it resolves: one slow node must not hold every note back.
        wanted.forEach(async d => {
            const info = await getDenomConfigInfo(d);
            if (!cancelled) {
                setConfigs(prev => new Map(prev).set(d, info));
            }
        });

        return () => {
            cancelled = true;
        };
    }, [key]);

    return configs;
}
