"use client"

import React from 'react'
import { getCommunitiesApp, getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { factsFromTokenSetup, nextActions } from '@/lib/next-actions'
import { type ReachDoneInput, reachDoneText, reachDoneTitle } from '@/lib/reach'

/**
 * "**HONEY** is on its way to PAGE stakers." (canvas D5, "Reached another community"). Making the
 * gift stakable is recommended, skipped when the chain shows it already is.
 */
export function ReachDone({ input, hash }: { input: ReachDoneInput; hash: string }) {
    const { communityDenom, communityTicker, giftDenom, giftTicker } = input
    const { asset } = useAsset(giftDenom)
    const setup = useTokenSetup(giftDenom)
    const returnTo = useReturnTo()

    const { recommended, more } = nextActions('reachedCommunity', { denom: giftDenom, ticker: giftTicker }, factsFromTokenSetup(setup))

    return (
        <DoneScreen
            avatar={{ ticker: giftTicker, logo: asset?.logo }}
            title={reachDoneTitle(input)}
            text={reachDoneText(input)}
            links={[
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
                { label: 'Communities', href: `${getCommunitiesApp().href}/token?denom=${encodeURIComponent(communityDenom)}`, app: 'communities' },
            ]}
            subject={giftTicker}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
