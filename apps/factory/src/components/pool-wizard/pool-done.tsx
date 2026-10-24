"use client"

import React, { useEffect, useState } from 'react'
import { getDexApp, getExplorerTxURL, getLiquidityPool, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { dexPoolHref } from '@/lib/create-routes'
import { nextActions } from '@/lib/next-actions'

/** What the Liquidity pool wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface PoolDoneInput {
    poolId: string;
    /** The pair in the order the user picked it (not the chain's sorted order). */
    base: string;
    quote: string;
    baseTicker: string;
    quoteTicker: string;
    /** Quote per base, formatted: "0.002000". */
    price: string;
}

/**
 * "The <A>/<B> pool is open." (canvas C2): the pair, its pool share token, then the next steps.
 * The LP denom is read from the stored pool (its format depends on the chain version), so
 * rewarding its stakers waits for it.
 */
export function PoolDone({ input, hash }: { input: PoolDoneInput; hash: string }) {
    const { poolId, base, quote, baseTicker, quoteTicker, price } = input
    const { asset: baseAsset } = useAsset(base)
    const { asset: quoteAsset } = useAsset(quote)
    const returnTo = useReturnTo()
    const [lpDenom, setLpDenom] = useState<string | undefined>(undefined)

    useEffect(() => {
        let stopped = false
        getLiquidityPool(poolId).then(pool => {
            if (!stopped && pool?.lp_denom) setLpDenom(pool.lp_denom)
        })
        return () => {
            stopped = true
        }
    }, [poolId])

    const pair = `${baseTicker}/${quoteTicker}`
    const startingPrice = `${price} ${quoteTicker} per ${baseTicker}`
    const { recommended, more } = nextActions('poolCreated', { poolId })

    return (
        <DoneScreen
            avatar={[{ ticker: baseTicker, logo: baseAsset?.logo }, { ticker: quoteTicker, logo: quoteAsset?.logo }]}
            title={`The ${pair} pool is **open**.`}
            text={`People can swap ${baseTicker} for ${quoteTicker} right now, starting at ${startingPrice}.`}
            code={{ label: 'Pool share token', value: lpDenom }}
            links={[
                { label: 'Copy pool link', href: dexPoolHref(getDexApp().href, poolId), copy: { copied: 'Pool link' } },
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
            ]}
            subject={pair}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
