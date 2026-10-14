"use client"

import React from 'react'
import { Button, Card, HStack, Text, VStack } from '@chakra-ui/react'
import { LuChartCandlestick, LuDroplets } from 'react-icons/lu'
import { withReturn } from '@/components/guided/return-to'
import { VOCABULARY } from '@/lib/vocabulary'
import { workspaceHref } from '@/lib/workspace'
import type { WorkspaceTabProps } from './types'

/** For now only the two create buttons; the lists come with the Trading tab ticket. */
export function TradingTab({ asset, goTo }: WorkspaceTabProps) {
    const back = { href: workspaceHref(asset.denom, 'trading'), label: asset.ticker }
    const base = encodeURIComponent(asset.denom)

    return (
        <Card.Root variant="outline" p="5">
            <VStack align="stretch" gap={4}>
                <Text fontSize="sm" color="fg.muted">
                    Where people can trade {asset.ticker}: a {VOCABULARY.pool.name.toLowerCase()} for swaps,
                    an {VOCABULARY.market.name.toLowerCase()} for limit orders.
                </Text>
                <HStack gap={2} flexWrap="wrap">
                    <Button colorPalette="yellow" onClick={() => goTo(withReturn(`/pool/new?base=${base}`, back))}>
                        <LuDroplets /> Create a liquidity pool
                    </Button>
                    <Button colorPalette="yellow" variant="outline" onClick={() => goTo(withReturn(`/market/new?base=${base}`, back))}>
                        <LuChartCandlestick /> Create an order-book market
                    </Button>
                </HStack>
            </VStack>
        </Card.Root>
    )
}
