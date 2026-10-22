"use client"

import React from 'react'
import { DoneScreen } from '@/components/done'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { factsFromTokenSetup, nextActions } from '@/lib/next-actions'

/**
 * "HONEY is **listed**." The registry guide ends here once the Cosmos Chain Registry lists the
 * token: back to its page, then the brand kit and making it stakable unless they are done.
 */
export function OfficialDone({ denom, ticker, logo }: { denom: string; ticker: string; logo?: string }) {
    const setup = useTokenSetup(denom)
    const { recommended, more } = nextActions('listed', { denom, ticker }, factsFromTokenSetup(setup))

    return (
        <DoneScreen
            avatar={{ ticker, logo }}
            title={`${ticker} is **listed**.`}
            text="Wallets and apps that read the Cosmos Chain Registry now show its logo."
            subject={ticker}
            recommended={recommended}
            more={more}
        />
    )
}
