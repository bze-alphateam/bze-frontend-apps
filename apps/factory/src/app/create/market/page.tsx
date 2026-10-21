"use client"

import React from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { AppLink, getDexApp, useCreationFees } from '@bze/bze-ui-kit'
import { CardGrid, CareLine, ChooseFrame, ChoosePage, CreationFeeLine, OptionCard, Points } from '@/components/create/choose-parts'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { dexPoolsHref, marketTargets } from '@/lib/create-routes'

/** Choose a DEX market (canvas A3): a liquidity pool or an order-book market, for any pair. */
function ChooseMarket() {
    const { getQueryParam } = useNavigationWithParams()
    const { fees, isLoading } = useCreationFees()
    const targets = marketTargets({ get: getQueryParam })
    // Pools and order-book markets pay the same tradebin fee.
    const fee = <CreationFeeLine fee={fees.createMarketFee} isLoading={isLoading} />

    return (
        <ChoosePage
            crumb="DEX market"
            title="How should people trade it?"
            intro="Both work for any pair of tokens, yours or not. Most new tokens start with a pool and add an order book once there are regular traders."
        >
            <CardGrid>
                <OptionCard
                    title="Liquidity pool"
                    featuredTag="Most common first step"
                    line="People swap instantly. The price follows what you put in the pool."
                    action={{ label: 'Create liquidity pool', href: targets.pool }}
                >
                    <Points points={[
                        'Works from the first minute.',
                        'You set the starting price with your first deposit.',
                        'Anyone can add liquidity later and earn swap fees.',
                    ]} />
                    <CareLine>Your first deposit stays in the pool forever. You get no withdrawable share for it.</CareLine>
                    {fee}
                </OptionCard>
                <OptionCard
                    title="Order-book market"
                    line="Traders post buy and sell orders at the price they choose."
                    action={{ label: 'Create order-book market', href: targets.market }}
                >
                    <Points points={[
                        'Limit orders, like a classic exchange.',
                        'Nothing to deposit, only the creation fee.',
                        'Fits pairs that already have active traders.',
                    ]} />
                    <CareLine>A new market is empty. Nothing trades until people place orders.</CareLine>
                    {fee}
                </OptionCard>
            </CardGrid>
            <Flex align="center" gap="4px 8px" wrap="wrap" fontSize="14px" color="fg.muted">
                <Text>Want to add to a pool that already exists, or take your liquidity out?</Text>
                <AppLink app="dex" href={dexPoolsHref(getDexApp().href)}>DEX</AppLink>
            </Flex>
        </ChoosePage>
    )
}

export default function ChooseMarketPage() {
    return <ChooseFrame><ChooseMarket /></ChooseFrame>
}
