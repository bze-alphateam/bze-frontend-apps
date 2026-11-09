'use client'

import {useEffect, useMemo, useState} from "react";
import {skipGetChains} from "../query/skip";
import type {SkipChain} from "../types/cross_chain";
import {useEvmWalletState} from "../evm/context";
import {createRegisteredChainLookup} from "../utils/cross_chain";

/**
 * A Skip chain enriched with a `canSign` flag indicating whether the
 * current app can sign transactions on it: a Cosmos chain registered with
 * ChainProvider, or an EVM chain when EvmProvider is in the tree.
 */
export interface SkipChainWithStatus extends SkipChain {
    /** True when the user can pay from this chain. For Cosmos, that means useChain() works on it. */
    canSign: boolean;
}

export interface UseSkipChainsResult {
    chains: SkipChainWithStatus[];
    isLoading: boolean;
    error: string;
}

/**
 * Fetches all Skip-supported chains (cached 5min by `skipGetChains`),
 * filters out testnets, and annotates each with `canSign`:
 *
 *   • Cosmos chains in `getWalletChainsNames()` → `canSign: true`
 *   • EVM chains → `canSign: true` when EvmProvider is in the tree
 *   • Anything else → `canSign: false` (shown in the picker as "Soon", not selectable)
 *
 * The chain list excludes BZE itself (it's the destination, not a source).
 */
export function useSkipChains(): UseSkipChainsResult {
    const [allChains, setAllChains] = useState<SkipChain[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError('');

        skipGetChains()
            .then(chains => {
                if (cancelled) return;
                setAllChains(chains ?? []);
            })
            .catch(e => {
                if (cancelled) return;
                console.error('[useSkipChains] error:', e);
                setError('Could not load chains from Skip');
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const {isAvailable: evmAvailable} = useEvmWalletState();

    const chains = useMemo<SkipChainWithStatus[]>(() => {
        if (allChains.length === 0) return [];

        const registeredChainName = createRegisteredChainLookup();
        return allChains
            .filter(c => !c.is_testnet)
            // Exclude BZE itself — it's the destination
            .filter(c => c.chain_id !== 'beezee-1')
            .map(c => ({
                ...c,
                canSign: c.chain_type === 'cosmos'
                    ? registeredChainName(c) !== undefined
                    : c.chain_type === 'evm' && evmAvailable,
            }))
            // Signable chains first, then alphabetical by name
            .sort((a, b) => {
                if (a.canSign !== b.canSign) return a.canSign ? -1 : 1;
                return (a.chain_name || '').localeCompare(b.chain_name || '');
            });
    }, [allChains, evmAvailable]);

    return {chains, isLoading, error};
}
