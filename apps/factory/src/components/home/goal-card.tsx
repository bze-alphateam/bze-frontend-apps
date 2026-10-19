"use client"

import React from 'react'
import { Badge, Box, chakra, Flex, Text, VStack } from '@chakra-ui/react'
import { FeeCoin, hgVariant, prettyAmount, uAmountToBigNumberAmount, useAsset } from '@bze/bze-ui-kit'
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
            px="16px"
            py="14px"
            borderRadius="12px"
            borderWidth="1px"
            borderColor="transparent"
            bg="hg.inset"
            color="fg"
            cursor={isLive ? 'pointer' : 'not-allowed'}
            opacity={isLive ? 1 : 0.65}
            aria-disabled={!isLive}
            transition="border-color 0.15s"
            _hover={isLive ? { borderColor: 'app.border' } : {}}
            focusVisibleRing="outside"
            onClick={() => { if (isLive) onOpen(goal) }}
            data-testid={`goal-${goal.id}`}
        >
            <Flex align="center" justify="space-between" gap="12px">
                <VStack align="start" gap="4px" minW={0}>
                    <Flex align="center" gap="8px" wrap="wrap">
                        <Text as="strong" fontSize="15px" fontWeight="700">{goal.title}</Text>
                        {goal.badge && (
                            <chakra.span fontSize="11px" fontWeight="700" px="8px" py="3px" borderRadius="hg.pill" bgImage="app" color="hg.buttonText">
                                {goal.badge}
                            </chakra.span>
                        )}
                        {!isLive && <Badge variant={hgVariant('neutral')} size="sm" borderRadius="hg.pill">Coming soon</Badge>}
                    </Flex>
                    <Text fontSize="13px" lineHeight="1.45" color="fg.muted">{goal.description}</Text>
                    <Text fontSize="12px" color="hg.text.faint" fontFamily="mono">
                        <Text as="span">{goal.techTag}</Text>
                        <GoalFee fee={fee} />
                    </Text>
                </VStack>
                {isLive && <chakra.span aria-hidden color="hg.link" fontSize="18px" flex="none">→</chakra.span>}
            </Flex>
        </Box>
    )
}
