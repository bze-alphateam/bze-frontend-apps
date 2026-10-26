'use client'

import { useCallback, useMemo } from 'react'
import BigNumber from 'bignumber.js'
import {
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useAssets,
    useLiquidityPools,
    useMarkets,
} from '@bze/bze-ui-kit'
import { useDenomBranding } from '@/hooks/useDenomBranding'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useRegistryListing } from '@/hooks/useRegistryListing'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { scheduleDaysLeft } from '@/lib/denom-reward'
import { computeTokenSetup } from '@/lib/token-setup'

export interface TokenSetupOptions {
    /** From useMyTokens: an address, '' when renounced, undefined when unknown. */
    admin?: string;
    /** Live total supply (base units); falls back to the asset's supply. */
    supply?: string;
}

/**
 * The token's setup checklist, read from the chain on every mount (BFE-146). Also returns the data
 * it read (denom reward, pools, market) so the Overview needs no second round of queries.
 */
export function useTokenSetup(denom: string, { admin, supply }: TokenSetupOptions = {}) {
    const { asset, isLoading: isAssetLoading } = useAsset(denom)
    const { denomTicker } = useAssets()
    const { metadata, isLoading: isMetadataLoading, refresh: refreshMetadata } = useTokenMetadata(denom)
    const { branding, hasError: brandingError, isLoading: isBrandingLoading, refresh: refreshBranding } = useDenomBranding(denom)
    const { denomReward, schedules, hasError: denomRewardError, isLoading: isDenomRewardLoading, refresh: refreshDenomReward } = useDenomReward(denom)
    const { pools: allPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { markets, isLoading: isMarketsLoading } = useMarkets()
    const registry = useRegistryListing(denom)

    const pools = useMemo(() => allPools.filter(p => p.base === denom || p.quote === denom), [allPools, denom])
    const hasMarket = useMemo(() => markets.some(m => m.base === denom || m.quote === denom), [markets, denom])

    const ticker = asset?.ticker ?? denomTicker(denom)
    const supplyLabel = prettyAmount(uAmountToBigNumberAmount(supply ?? asset?.supply ?? 0, asset?.decimals ?? 0))
    const runningSchedules = schedules.filter(s => scheduleDaysLeft(s) > 0).length

    const setup = computeTokenSetup({
        denom,
        ticker,
        supplyLabel,
        isLocked: admin === '',
        description: metadata?.description,
        brandKit: brandingError ? 'error' : branding ? 'set' : 'none',
        pools: pools.map(p => ({ id: p.id, label: `${denomTicker(p.base)} / ${denomTicker(p.quote)}` })),
        denomReward: denomRewardError ? 'error' : denomReward ? { runningSchedules } : 'none',
        hasMarket,
        registry: registry.status === 'loading' ? 'not-listed' : registry.status,
    })

    const refresh = useCallback(async () => {
        if (registry.status === 'error') registry.retry()
        await Promise.all([refreshMetadata(), refreshBranding(), refreshDenomReward()])
    }, [refreshMetadata, refreshBranding, refreshDenomReward, registry])

    return {
        ...setup,
        isLoading: isAssetLoading || isMetadataLoading || isBrandingLoading || isDenomRewardLoading || isPoolsLoading || isMarketsLoading || registry.status === 'loading',
        hasError: brandingError || denomRewardError || registry.status === 'error',
        refresh,
        denomReward,
        pools,
        hasMarket,
        /** Something is staked in the token's compounded reward: airdrops have someone to reach. */
        hasStakers: Boolean(denomReward && new BigNumber(denomReward.staked_amount || 0).gt(0)),
    }
}
