"use client"

import React from 'react'
import { Badge, Box, HStack, Text, VStack } from '@chakra-ui/react'
import { FeeCoin, prettyAmount, uAmountToBigNumberAmount, useAsset } from '@bze/bze-ui-kit'
import type { Goal } from '@/lib/goals'

/** "· 25,000 BZE": nothing while the fee or its asset is unknown. */
function GoalFee({ fee }: { fee?: FeeCoin }) {
    const { asset } = useAsset(fee?.denom ?? '')
    if (!fee || !asset) return null
    return <Text as="span" data-testid="goal-fee">{` · ${prettyAmount(uAmountToBigNumberAmount(fee.amount, asset.decimals))} ${asset.ticker}`}</Text>
}

/** One goal on the home page; a goal without a target shows as "Coming soon". */
export function GoalCard({ goal, fee, onOpen }: { goal: Goal; fee?: FeeCoin; onOpen: (goal: Goal) => void }) {
    const isLive = Boolean(goal.href)

    return (
        <Box
            as="button"
            textAlign="start"
            w="full"
            p={4}
            borderRadius="lg"
            borderWidth="1px"
            borderColor="border.muted"
            bg="bg.panel"
            cursor={isLive ? 'pointer' : 'not-allowed'}
            opacity={isLive ? 1 : 0.65}
            aria-disabled={!isLive}
            transition="all 0.15s"
            _hover={isLive ? { borderColor: 'yellow.500/50', bg: 'yellow.500/5' } : {}}
            onClick={() => { if (isLive) onOpen(goal) }}
            data-testid={`goal-${goal.id}`}
        >
            <VStack align="start" gap={1}>
                <HStack gap={2} flexWrap="wrap">
                    <Text fontWeight="semibold">{goal.title}</Text>
                    {goal.badge && <Badge colorPalette="yellow" size="sm" variant="solid">{goal.badge}</Badge>}
                    {!isLive && <Badge colorPalette="gray" size="sm" variant="surface">Coming soon</Badge>}
                </HStack>
                <Text fontSize="sm" color="fg.muted">{goal.description}</Text>
                <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
                    <Text as="span">{goal.techTag}</Text>
                    <GoalFee fee={fee} />
                </Text>
            </VStack>
        </Box>
    )
}
