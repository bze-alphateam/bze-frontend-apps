"use client"

import React from 'react'
import { getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { nextActions } from '@/lib/next-actions'

/** What the Extend wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface ExtendDoneInput {
    rewardId: string;
    stakingDenom: string;
    stakingTicker: string;
    prizeDenom: string;
    prizeTicker: string;
    /** The fixed daily amount, formatted: "100". */
    perDay: string;
    /** The days added. */
    days: string;
    /** The new last day, formatted: "5 Nov". */
    newEnd: string;
}

/** "10 more days for HONEY/BZE stakers." then Stake on DEX. */
export function ExtendDone({ input, hash }: { input: ExtendDoneInput; hash: string }) {
    const { stakingDenom, stakingTicker, prizeTicker, perDay, days, newEnd } = input
    const { asset: stakingAsset } = useAsset(stakingDenom)
    const returnTo = useReturnTo()

    const dayCount = Number(days)
    const daysText = `${dayCount.toLocaleString('en-US')} more day${dayCount === 1 ? '' : 's'}`
    const { recommended, more } = nextActions('prizeAdded', { stakedDenom: stakingDenom, stakedTicker: stakingTicker, viaSimpleReward: true })

    return (
        <DoneScreen
            avatar={{ ticker: stakingTicker, logo: stakingAsset?.logo }}
            title={`**${daysText}** for ${stakingTicker} stakers.`}
            text={`Everyone staking ${stakingTicker} keeps sharing ${perDay} ${prizeTicker} a day until ${newEnd}.`}
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
