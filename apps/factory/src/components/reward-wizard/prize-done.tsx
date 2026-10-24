"use client"

import React from 'react'
import { getCommunitiesApp, getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { nextActions } from '@/lib/next-actions'
import { type PrizeDoneInput, prizeDoneText, prizeDoneTitle } from '@/lib/prize-wizard'

/**
 * "**50 BZE a day** for HONEY stakers." / "**10,000 BEE** sent to HONEY stakers." (canvas D5),
 * then Stake on DEX and Add more rewards.
 */
export function PrizeDone({ input, hash }: { input: PrizeDoneInput; hash: string }) {
    const { stakedDenom, stakedTicker } = input
    const { asset } = useAsset(stakedDenom)
    const returnTo = useReturnTo()

    const { recommended, more } = nextActions('prizeAdded', { stakedDenom, stakedTicker })

    return (
        <DoneScreen
            avatar={{ ticker: stakedTicker, logo: asset?.logo }}
            title={prizeDoneTitle(input)}
            text={prizeDoneText(input)}
            links={[
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
                { label: 'Communities', href: `${getCommunitiesApp().href}/token?denom=${encodeURIComponent(stakedDenom)}`, app: 'communities' },
            ]}
            subject={stakedTicker}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
