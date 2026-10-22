'use client'

import { useSyncExternalStore } from 'react'
import {
    getChainName,
    getChainNativeAssetDenom,
    getFromLocalStorage,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    useLiquidityPools,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { scheduleDaysLeft } from '@/lib/denom-reward'
import {
    MAX_HOME_CARDS,
    MAX_SUGGESTED_TOKENS,
    homeDrafts,
    suggestions,
    type HomeSuggestions,
    type HomeToken,
    type StoredDrafts,
    type TokenFactsState,
} from '@/lib/home-suggestions'
import { MULTISEND_DRAFT_KEY, loadMultiSendDraft } from '@/lib/multisend'
import { MULTISEND_RUN_KEY, loadMultiSendRun } from '@/lib/multisend-run'
import { isStakingRewardFinished } from '@/lib/staking-rewards'
import { TOKEN_DRAFT_KEY, loadTokenDraft } from '@/lib/token-draft'

const NO_DRAFTS: StoredDrafts = {}
const noSubscribe = () => () => {}

// The parsed drafts are cached on the raw strings, so the snapshot keeps its identity between
// renders until something in storage really changes.
let draftsCache: { raw: string; drafts: StoredDrafts } | undefined

function readDrafts(): StoredDrafts {
    const raw = JSON.stringify([TOKEN_DRAFT_KEY, MULTISEND_DRAFT_KEY, MULTISEND_RUN_KEY].map(getFromLocalStorage))
    if (draftsCache?.raw !== raw) {
        draftsCache = { raw, drafts: { token: loadTokenDraft(), multisendDraft: loadMultiSendDraft(), multisendRun: loadMultiSendRun() } }
    }
    return draftsCache.drafts
}

/** The drafts this browser keeps; none on the server, so the first render matches it. */
function useStoredDrafts(): StoredDrafts {
    return useSyncExternalStore(noSubscribe, readDrafts, () => NO_DRAFTS)
}

interface RewardsState {
    stakingDenoms: string[];
    isLoading: boolean;
    hasError: boolean;
}

/** The chain facts one suggestion needs; an empty denom is a free slot and reads nothing. */
function useTokenFacts(denom: string, rewards: RewardsState): TokenFactsState | undefined {
    const { denomTicker, denomDecimals } = useAssets()
    const { pools: allPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { denomReward, schedules, hasError, isLoading } = useDenomReward(denom)

    if (!denom) return undefined
    if (hasError || rewards.hasError) return 'error'
    if (isLoading || isPoolsLoading || rewards.isLoading) return 'loading'

    const native = getChainNativeAssetDenom()
    const pools = allPools
        .filter(p => p.base === denom || p.quote === denom)
        .map(p => {
            const other = p.base === denom ? p.quote : p.base
            return { pair: `${denomTicker(denom)}/${denomTicker(other)}`, lpDenom: p.lp_denom, isNativePair: other === native }
        })

    return {
        pools,
        runningSimpleRewards: rewards.stakingDenoms,
        compounded: denomReward
            ? {
                stakedLabel: prettyAmount(uAmountToBigNumberAmount(denomReward.staked_amount || 0, denomDecimals(denom))),
                schedules: schedules.map(s => ({ id: s.schedule_id, daysLeft: scheduleDaysLeft(s) })),
            }
            : undefined,
    }
}

/**
 * "Pick up where you left off" for the connected wallet (BFE-275): browser drafts, then chain
 * suggestions for the first tokens it created. Nothing when no wallet is connected.
 */
export function useHomeSuggestions(): HomeSuggestions & { isConnected: boolean } {
    const { address } = useChain(getChainName())
    const { getAsset } = useAssets()
    const { tokens: myTokens, isLoading: isTokensLoading } = useMyTokens()
    const stored = useStoredDrafts()

    const tokens: HomeToken[] = myTokens.slice(0, MAX_SUGGESTED_TOKENS).map(t => ({ denom: t.asset.denom, ticker: t.asset.ticker, logo: t.asset.logo }))
    const simple = useStakingRewards(Boolean(address) && tokens.length > 0)
    const rewards: RewardsState = {
        stakingDenoms: simple.rewards.filter(r => !isStakingRewardFinished(r)).map(r => r.staking_denom),
        isLoading: simple.isLoading,
        hasError: simple.hasError,
    }

    // A fixed number of slots keeps the hook order stable however many tokens there are.
    const f0 = useTokenFacts(tokens[0]?.denom ?? '', rewards)
    const f1 = useTokenFacts(tokens[1]?.denom ?? '', rewards)
    const f2 = useTokenFacts(tokens[2]?.denom ?? '', rewards)

    if (!address) return { cards: [], pending: 0, isConnected: false }

    const facts: Record<string, TokenFactsState | undefined> = {}
    tokens.forEach((t, i) => { facts[t.denom] = [f0, f1, f2][i] })

    const tokenOf = (denom: string) => {
        const asset = getAsset(denom)
        return { ticker: asset?.ticker ?? '', logo: asset?.logo }
    }
    const result = suggestions(homeDrafts(stored, tokenOf), tokens, facts)
    // While the wallet's tokens are still being found, one shimmer holds a free slot.
    const pending = isTokensLoading && result.cards.length < MAX_HOME_CARDS ? Math.max(result.pending, 1) : result.pending
    return { ...result, pending, isConnected: true }
}
