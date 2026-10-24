"use client"

import React from 'react'
import { getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { nextActions } from '@/lib/next-actions'

/** What an airdrop through a simple reward hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface DistributeDoneInput {
    rewardId: string;
    stakingDenom: string;
    stakingTicker: string;
    prizeDenom: string;
    prizeTicker: string;
    /** The amount sent, formatted: "1,000". */
    amount: string;
}

/** "**1,000 HONEY** sent to HONEY/BZE LP stakers." then Stake on DEX. */
export function DistributeDone({ input, hash }: { input: DistributeDoneInput; hash: string }) {
    const { stakingDenom, stakingTicker, prizeTicker, amount } = input
    const { asset: stakingAsset } = useAsset(stakingDenom)
    const returnTo = useReturnTo()

    const gift = `${amount} ${prizeTicker}`
    const { recommended, more } = nextActions('prizeAdded', { stakedDenom: stakingDenom, stakedTicker: stakingTicker, viaSimpleReward: true })

    return (
        <DoneScreen
            avatar={{ ticker: stakingTicker, logo: stakingAsset?.logo }}
            title={`**${gift}** sent to ${stakingTicker} stakers.`}
            text={`Everyone staking ${stakingTicker} can claim their share now.`}
            links={[
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
            ]}
            subject={stakingTicker}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
