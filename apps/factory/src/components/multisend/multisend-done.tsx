"use client"

import React from 'react'
import { getExplorerTxURL, useAsset } from '@bze/bze-ui-kit'
import { DoneScreen, type DoneLink } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { nextActions } from '@/lib/next-actions'

/** Up to this many transactions get one Explorer link each; more fold into a list. */
const OPEN_LINKS = 3

export interface MultisendDoneProps {
    denom: string;
    ticker: string;
    /** Wallets paid. */
    count: number;
    /** "31,200 HONEY". */
    totalLabel: string;
    /** One hash per transaction, in batch order. */
    hashes: string[];
    /** Batched runs: the report CSV as a data URI. */
    reportHref?: string;
    /** "Send to another list": a fresh list with the same token. */
    onSendAnother: () => void;
}

const REPORT_FILE = 'multisend-report.csv'

function download(href: string) {
    const a = document.createElement('a')
    a.href = href
    a.download = REPORT_FILE
    a.click()
}

/**
 * "Sent to 312 wallets." (canvas D5, row "Multi-send finished"): the Explorer link of each
 * transaction, then "Download the report" first when the list was batched, and "Send to another
 * list".
 */
export function MultisendDone({ denom, ticker, count, totalLabel, hashes, reportHref, onSendAnother }: MultisendDoneProps) {
    const { asset } = useAsset(denom)
    const returnTo = useReturnTo()
    const k = hashes.length
    const batched = k > 1

    const next = nextActions('multisendFinished', {
        denom,
        ticker,
        downloadReport: reportHref ? () => download(reportHref) : undefined,
    })
    // The page is already /multisend: a new list resets it in place instead of navigating to itself.
    const local = (a: NonNullable<typeof next.recommended>) => (a.key === 'sendAgain' ? { ...a, target: { onClick: onSendAnother } } : a)

    const txLinks: DoneLink[] = hashes.map((hash, i) => ({
        label: batched ? `Transaction ${i + 1}` : 'Explorer',
        href: getExplorerTxURL(hash),
        app: 'explorer',
    }))

    return (
        <DoneScreen
            avatar={{ ticker, logo: asset?.logo }}
            title={batched ? `Sent to **${count.toLocaleString('en-US')}** wallets in ${k} transactions.` : `Sent to **${count.toLocaleString('en-US')}** wallets.`}
            text={`${totalLabel} is now in their wallets.`}
            links={k <= OPEN_LINKS ? txLinks : []}
            linkList={k > OPEN_LINKS ? { summary: `${k} transactions on Explorer`, links: txLinks } : undefined}
            subject={ticker}
            recommended={next.recommended && local(next.recommended)}
            more={next.more.map(local)}
            back={returnTo}
        />
    )
}
