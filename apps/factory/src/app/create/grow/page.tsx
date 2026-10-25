"use client"

import React from 'react'
import { CardGrid, ChooseFrame, ChoosePage, OptionCard, Points } from '@/components/create/choose-parts'
import { GROW_TARGETS } from '@/lib/create-routes'

/** Choose how to grow a community (canvas A5): an airdrop or a burning raffle. */
export default function ChooseGrowPage() {
    return (
        <ChooseFrame>
            <ChoosePage
                crumb="Community"
                title="How do you want to grow?"
                intro="Put tokens in people's wallets, or give them a reason to come back."
            >
                <CardGrid>
                    <OptionCard
                        title="Airdrop tokens"
                        line="Send tokens to many wallets at once."
                        action={{ label: 'Airdrop', href: GROW_TARGETS.airdrop }}
                    >
                        <Points points={['A list of wallets: same amount or one per wallet', 'Everyone staking a token', 'Liquidity providers of a pool']} />
                    </OptionCard>
                    <OptionCard
                        title="Burning raffle"
                        line="People buy tickets to win from a prize pot you fund. What's left at the end is burned."
                        action={{ label: 'Start raffle', href: GROW_TARGETS.raffle }}
                    />
                </CardGrid>
            </ChoosePage>
        </ChooseFrame>
    )
}
