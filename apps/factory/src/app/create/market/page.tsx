"use client"

import React from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { AppLink, getDexApp, useCreationFees } from '@bze/bze-ui-kit'
import { CardGrid, ChooseFrame, ChoosePage, CreationFeeLine, OptionCard, Points } from '@/components/create/choose-parts'
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
            title="What kind of market do you want to create?"
            intro="Both work for any pair of tokens. Pools suit new tokens best: anyone can swap from the first minute. Order books need people placing buy and sell orders, so they suit tokens with an active community."
        >
            <CardGrid>
                <OptionCard
                    title="Liquidity pool"
                    featuredTag="Most common"
                    action={{ label: 'Create liquidity pool', href: targets.pool }}
                >
                    <Points points={[
                        'Swaps happen instantly, at the pool\'s price.',
                        'Your first deposit sets the starting price.',
                        'Anyone can add liquidity and earn swap fees.',
                    ]} />
                    {fee}
                </OptionCard>
                <OptionCard
                    title="Order-book market"
                    action={{ label: 'Create order-book market', href: targets.market }}
                >
                    <Points points={[
                        'A trade happens only when a buy and a sell order match.',
                        'No deposit needed.',
                        'Buyers and sellers each set their own price.',
                    ]} />
                    {fee}
                </OptionCard>
            </CardGrid>
            <Flex align="center" gap="4px 8px" wrap="wrap" fontSize="14px" color="fg.muted">
                <Text>Want to manage the liquidity of an existing pool? Visit the</Text>
                <AppLink app="dex" href={dexPoolsHref(getDexApp().href)}>DEX</AppLink>
            </Flex>
        </ChoosePage>
    )
}

export default function ChooseMarketPage() {
    return <ChooseFrame><ChooseMarket /></ChooseFrame>
}
