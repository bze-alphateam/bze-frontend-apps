"use client"

import React, { useEffect, useState } from 'react'
import { getDexApp, getExplorerTxURL, getSettings, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { dexStakingHref } from '@/lib/create-routes'
import { nextActions } from '@/lib/next-actions'
import { fetchRewardId } from '@/lib/reward-new'

/** What the Simple reward wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface SimpleRewardDoneInput {
    stakingDenom: string;
    stakingTicker: string;
    prizeDenom: string;
    prizeTicker: string;
    /** The daily amount, formatted: "100". */
    perDay: string;
    /** "100 HONEY a day for 30 days". */
    prize: string;
}

/**
 * "Your simple reward is live." (canvas D5): the reward id (read back from the tx's event), the
 * DEX staking link, then the next steps with "Share the staking link" first.
 */
export function SimpleRewardDone({ input, hash }: { input: SimpleRewardDoneInput; hash: string }) {
    const { stakingDenom, stakingTicker, prizeDenom, prizeTicker, perDay, prize } = input
    const { asset: stakingAsset } = useAsset(stakingDenom)
    const returnTo = useReturnTo()
    const [rewardId, setRewardId] = useState<string | undefined>(undefined)

    useEffect(() => {
        let stopped = false
        fetchRewardId(getSettings().endpoints.restEndpoint, hash).then(id => {
            if (!stopped && id) setRewardId(id)
        })
        return () => {
            stopped = true
        }
    }, [hash])

    const { recommended, more } = nextActions('simpleRewardCreated', {
        stakedDenom: stakingDenom,
        stakedTicker: stakingTicker,
        prizeDenom,
        prizeTicker,
        rewardId,
        prize,
    })

    return (
        <DoneScreen
            avatar={{ ticker: stakingTicker, logo: stakingAsset?.logo }}
            title="Your simple reward is **live**."
            text={`People can stake ${stakingTicker} and share ${perDay} ${prizeTicker} a day.`}
            code={{ label: 'Reward id', value: rewardId }}
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
