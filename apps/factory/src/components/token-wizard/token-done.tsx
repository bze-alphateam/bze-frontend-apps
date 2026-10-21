"use client"

import React from 'react'
import { getDexApp, getExplorerTxURL, prettyAmount, toBigNumber, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { factsFromTokenSetup, nextActions } from '@/lib/next-actions'
import { workspaceHref } from '@/lib/workspace'

/** What the Create token wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface TokenDoneInput {
    denom: string;
    ticker: string;
    name: string;
    /** Initial supply in display units, as typed. */
    supply: string;
    /** The token's admin after the tx: the creator or the other address picked. */
    admin: string;
}

/**
 * "<TICKER> is live." (canvas B3): the token, its denom and links, then the next steps for a new
 * token. The chain facts (pools, compounded reward, registry, brand kit) drop the steps already done.
 */
export function TokenDone({ input, hash }: { input: TokenDoneInput; hash: string }) {
    const { denom, ticker } = input
    const { asset } = useAsset(denom)
    const setup = useTokenSetup(denom)
    const returnTo = useReturnTo()
    const { recommended, more } = nextActions('tokenCreated', { denom, ticker }, factsFromTokenSetup(setup))
    const tokenPage = workspaceHref(denom)

    return (
        <DoneScreen
            celebrate
            avatar={{ ticker, logo: asset?.logo }}
            title={`${ticker} is **live**.`}
            text={`${prettyAmount(toBigNumber(input.supply))} ${ticker} just landed in your wallet. Nice work.`}
            code={{ label: 'Denom', value: denom }}
            links={[
                { label: 'Open token page', href: tokenPage },
                { label: 'DEX', href: `${getDexApp().href}/assets/details?denom=${encodeURIComponent(denom)}`, app: 'dex' },
                { label: 'Explorer', href: getExplorerTxURL(hash), app: 'explorer' },
            ]}
            subject={ticker}
            recommended={recommended}
            more={more}
            footnote={{ text: 'Not now? Every one of these waits for you on', link: { label: `${ticker}'s token page`, href: tokenPage }, after: '.' }}
            back={returnTo}
        />
    )
}
