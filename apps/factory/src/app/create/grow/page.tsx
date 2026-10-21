"use client"

import React from 'react'
import { CardGrid, ChooseFrame, ChoosePage, LinkCard } from '@/components/create/choose-parts'
import { GROW_TARGETS } from '@/lib/create-routes'

// "No extra fee" from the canvas is left out of the airdrop card on purpose: an airdrop in a prize
// token new to that reward pays createDenomRewardPrizeFee, which the airdrop form shows.
const OPTIONS = [
    {
        title: 'Airdrop to stakers',
        line: 'Split an amount between everyone staking a token today. Yours or any other.',
        chips: ['Compounded reward', "Any token's stakers"],
        href: GROW_TARGETS.airdrop,
    },
    {
        title: 'Send to a list of wallets',
        line: 'Contest winners, early supporters, a snapshot. Paste or upload addresses and amounts.',
        chips: ['Multi-send', 'No fee', 'CSV'],
        href: GROW_TARGETS.multisend,
    },
    {
        title: 'Run a burning raffle',
        line: "People buy tickets to win from a prize pot you fund. What's left at the end is burned.",
        chips: ['Burner raffle', 'No fee'],
        href: GROW_TARGETS.raffle,
    },
    {
        title: 'Reach another community',
        line: "Give your token as a prize to people staking someone else's token, so they discover yours.",
        chips: ['Airdrop or daily prize', 'On their token'],
        href: GROW_TARGETS.reach,
    },
]

/** Choose how to grow a community (canvas A5): four ways to put tokens in people's wallets. */
export default function ChooseGrowPage() {
    return (
        <ChooseFrame>
            <ChoosePage
                crumb="Community"
                title="Who do you want to reach?"
                intro="Put tokens in people's wallets, or give them a reason to come back."
            >
                <CardGrid>
                    {OPTIONS.map(option => <LinkCard key={option.title} level="h2" {...option} />)}
                </CardGrid>
            </ChoosePage>
        </ChooseFrame>
    )
}
