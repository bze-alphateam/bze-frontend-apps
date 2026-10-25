"use client"

import React from 'react'
import { createMarketId, getDexApp, getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { dexMarketHref } from '@/lib/create-routes'
import { nextActions } from '@/lib/next-actions'

/** What the Order-book market wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface MarketDoneInput {
    /** The pair as created: base is what trades, quote is what it is priced in. */
    base: string;
    quote: string;
    baseTicker: string;
    quoteTicker: string;
}

/**
 * "The <A>/<B> market is open." (canvas D5): the pair, its links, then the next steps. Creating a
 * pool for the pair is skipped when the pair already has one.
 */
export function MarketDone({ input, hash }: { input: MarketDoneInput; hash: string }) {
    const { base, quote, baseTicker, quoteTicker } = input
    const { asset: baseAsset } = useAsset(base)
    const { asset: quoteAsset } = useAsset(quote)
    const returnTo = useReturnTo()

    const pair = `${baseTicker}/${quoteTicker}`
    const { recommended, more } = nextActions('marketCreated', { base, quote })

    return (
        <DoneScreen
            avatar={[{ ticker: baseTicker, logo: baseAsset?.logo }, { ticker: quoteTicker, logo: quoteAsset?.logo }]}
            title={`The ${pair} market is **open**.`}
            links={[
                { label: 'Copy market link', href: dexMarketHref(getDexApp().href, createMarketId(base, quote)), copy: { copied: 'Market link' } },
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
            ]}
            subject={pair}
            recommended={recommended}
            more={more}
            back={returnTo}
        />
    )
}
