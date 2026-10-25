"use client"

import React from 'react'
import { getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { nextActions } from '@/lib/next-actions'

/** What the Compounded reward wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface CompoundedDoneInput {
    denom: string;
    ticker: string;
    /** The first daily prize, when one was funded with it. */
    prizeDenom?: string;
    prizeTicker?: string;
    /** "50 BZE/day × 30 days". */
    prize?: string;
}

/**
 * "HONEY is stakable." (canvas C4), then Stake on DEX and Add more rewards. Without a prize, an
 * amber line says stakers earn nothing yet.
 */
export function CompoundedDone({ input, hash }: { input: CompoundedDoneInput; hash: string }) {
    const { denom, ticker, prize } = input
    const { asset } = useAsset(denom)
    const returnTo = useReturnTo()
    const funded = Boolean(prize)

    const { recommended, more } = nextActions('compoundedCreated', { denom, ticker })

    return (
        <DoneScreen
            avatar={{ ticker, logo: asset?.logo }}
            title={`${ticker} is **stakable**.`}
            text={`${ticker} can be staked now.`}
            links={[
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
            ]}
            subject={ticker}
            notice={funded
                ? undefined
                : 'No daily reward yet.'}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
