"use client"

import React from 'react'
import { getDexApp, getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { dexStakingHref } from '@/lib/create-routes'
import { nextActions } from '@/lib/next-actions'

/** What the Distribute wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface DistributeDoneInput {
    rewardId: string;
    stakingDenom: string;
    stakingTicker: string;
    prizeDenom: string;
    prizeTicker: string;
    /** The amount sent, formatted: "1,000". */
    amount: string;
}

/** "**1,000 HONEY** sent to HONEY/BZE LP stakers." then the prize-added next steps. */
export function DistributeDone({ input, hash }: { input: DistributeDoneInput; hash: string }) {
    const { rewardId, stakingDenom, stakingTicker, prizeDenom, prizeTicker, amount } = input
    const { asset: stakingAsset } = useAsset(stakingDenom)
    const returnTo = useReturnTo()

    const gift = `${amount} ${prizeTicker}`
    const { recommended, more } = nextActions('prizeAdded', {
        rewardId,
        stakedDenom: stakingDenom,
        stakedTicker: stakingTicker,
        prizeDenom,
        prizeTicker,
        prize: `${gift}, sent once`,
        prizeKind: 'airdrop',
    })

    return (
        <DoneScreen
            avatar={{ ticker: stakingTicker, logo: stakingAsset?.logo }}
            title={`**${gift}** sent to ${stakingTicker} stakers.`}
            text={`Everyone staking ${stakingTicker} can claim their share now.`}
            links={[
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
                { label: 'Stake on DEX', href: dexStakingHref(getDexApp().href, stakingTicker), app: 'dex' },
            ]}
            subject={stakingTicker}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
