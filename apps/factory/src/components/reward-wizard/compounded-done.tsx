"use client"

import React from 'react'
import BigNumber from 'bignumber.js'
import { getDexApp, getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { useDenomReward } from '@/hooks/useDenomReward'
import { dexStakingHref } from '@/lib/create-routes'
import { nextActions } from '@/lib/next-actions'

/** What the Compounded reward wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface CompoundedDoneInput {
    denom: string;
    ticker: string;
    /** The first daily prize, when one was funded with it. */
    prizeDenom?: string;
    prizeTicker?: string;
    /** "50 BZE a day for 30 days". */
    prize?: string;
}

/**
 * "HONEY is stakable." (canvas C4). Without a prize, an amber line says stakers earn nothing yet and
 * "Add a daily prize" is recommended; with one, "Tell your stakers". The airdrop waits until the
 * chain shows something staked.
 */
export function CompoundedDone({ input, hash }: { input: CompoundedDoneInput; hash: string }) {
    const { denom, ticker, prizeDenom, prizeTicker, prize } = input
    const { asset } = useAsset(denom)
    const { denomReward } = useDenomReward(denom)
    const returnTo = useReturnTo()
    const funded = Boolean(prize)

    const { recommended, more } = nextActions('compoundedCreated', {
        denom,
        ticker,
        stakedDenom: denom,
        stakedTicker: ticker,
        prizeDenom,
        prizeTicker,
        prize,
        withPrize: funded,
    }, {
        hasCompoundedReward: true,
        hasStakers: new BigNumber(denomReward?.staked_amount ?? 0).gt(0),
    })

    return (
        <DoneScreen
            avatar={{ ticker, logo: asset?.logo }}
            title={`${ticker} is **stakable**.`}
            text={`Anyone holding ${ticker} can stake it now, and anyone can add prizes for them.`}
            links={[
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
                { label: 'Stake on DEX', href: dexStakingHref(getDexApp().href, ticker), app: 'dex' },
            ]}
            subject={ticker}
            notice={funded
                ? undefined
                : 'No prizes funded yet. Stakers earn nothing until a prize is added. Add the first one so the people who join today get paid.'}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
