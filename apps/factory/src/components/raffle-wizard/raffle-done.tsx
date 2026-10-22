"use client"

import React from 'react'
import BigNumber from 'bignumber.js'
import { getBurnerApp, getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { useDenomReward } from '@/hooks/useDenomReward'
import { nextActions } from '@/lib/next-actions'
import { type RaffleDoneInput, burnerCoinHref, raffleDoneText } from '@/lib/raffle-new'

/**
 * "The HONEY raffle is **live**." (canvas D5, "Burning raffle started"). Open the raffle on Burner
 * is recommended; an airdrop to the token's stakers is offered when it is stakable.
 */
export function RaffleDone({ input, hash }: { input: RaffleDoneInput; hash: string }) {
    const { denom, ticker, endsAt } = input
    const { asset } = useAsset(denom)
    const { denomReward } = useDenomReward(denom)
    const returnTo = useReturnTo()

    const { recommended, more } = nextActions('raffleStarted', { denom, ticker }, {
        hasCompoundedReward: Boolean(denomReward),
        hasStakers: new BigNumber(denomReward?.staked_amount ?? 0).gt(0),
    })

    return (
        <DoneScreen
            avatar={{ ticker, logo: asset?.logo }}
            title={`The ${ticker} raffle is **live**.`}
            text={raffleDoneText(endsAt)}
            links={[
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
                { label: 'Burner', href: burnerCoinHref(getBurnerApp().href, denom), app: 'burner' },
            ]}
            subject={ticker}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
