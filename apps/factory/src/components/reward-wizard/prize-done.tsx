"use client"

import React from 'react'
import { getCommunitiesApp, getDexApp, getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { useDenomReward } from '@/hooks/useDenomReward'
import { dexStakingHref } from '@/lib/create-routes'
import { nextActions } from '@/lib/next-actions'
import { type PrizeDoneInput, findNewSchedule, prizeAnnouncement, prizeDoneText, prizeDoneTitle } from '@/lib/prize-wizard'

/**
 * "**50 BZE a day** for HONEY stakers." / "**10,000 BEE** sent to HONEY stakers." (canvas D5,
 * "Daily prize or airdrop added"). A daily prize also offers "Extend before it ends": a new one
 * is found on chain first (the tx keeps only its hash), so that action waits for the read.
 */
export function PrizeDone({ input, hash }: { input: PrizeDoneInput; hash: string }) {
    const { kind, stakedDenom, stakedTicker, prizeDenom, prizeTicker, dailyAmount, days } = input
    const { asset } = useAsset(stakedDenom)
    const { schedules } = useDenomReward(kind === 'add' ? stakedDenom : '')
    const returnTo = useReturnTo()

    const added = kind === 'add' && dailyAmount !== undefined && days !== undefined
        ? findNewSchedule(schedules, { prizeDenom, dailyAmount, days })
        : undefined
    const scheduleId = kind === 'extend' ? input.scheduleId : added?.schedule_id

    const { recommended, more } = nextActions('prizeAdded', {
        stakedDenom,
        stakedTicker,
        prizeDenom,
        prizeTicker,
        prize: prizeAnnouncement(input),
        prizeKind: kind === 'airdrop' ? 'airdrop' : 'daily',
        scheduleId,
    })
    const waiting = (a: typeof more[number]) => a.key === 'extend' && !scheduleId
        ? { ...a, pending: true, disabledReason: 'Finding the new daily prize on the chain.' }
        : a

    return (
        <DoneScreen
            avatar={{ ticker: stakedTicker, logo: asset?.logo }}
            title={prizeDoneTitle(input)}
            text={prizeDoneText(input)}
            links={[
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
                { label: 'Communities', href: `${getCommunitiesApp().href}/token?denom=${encodeURIComponent(stakedDenom)}`, app: 'communities' },
                { label: 'Stake on DEX', href: dexStakingHref(getDexApp().href, stakedTicker), app: 'dex' },
            ]}
            subject={stakedTicker}
            recommended={recommended && waiting(recommended)}
            more={more.map(waiting)}
            back={returnTo}
        />
    )
}
