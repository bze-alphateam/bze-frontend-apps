"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, chakra, Flex, Text, VStack } from '@chakra-ui/react'
import { LuArrowRight } from 'react-icons/lu'
import { HgCard, useCreationFees } from '@bze/bze-ui-kit'
import { CardGrid, ChooseFrame, ChoosePage, CreationFeeRow, OptionCard } from '@/components/create/choose-parts'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { rewardTargets } from '@/lib/create-routes'

/** Choose staking rewards (canvas A4): a simple or a compounded reward, on any token. */
function ChooseRewards() {
    const { getQueryParam } = useNavigationWithParams()
    const { fees, isLoading } = useCreationFees()
    const targets = rewardTargets({ get: getQueryParam })

    const existing = [
        { label: 'Extend a simple reward', line: 'Add more days.', href: targets.extendSimple },
        { label: 'Distribute to a simple reward', line: 'Send its stakers a one-time amount.', href: targets.distributeSimple },
        { label: 'Add a daily prize', line: 'Pay the stakers of a compounded reward every day, in any token.', href: targets.dailyPrize },
        { label: 'Airdrop to stakers, once', line: 'Split an amount between everyone staking the token today.', href: targets.airdrop },
    ]

    return (
        <ChoosePage crumb="Staking rewards" title="Which kind of reward?">
            <CardGrid>
                <OptionCard
                    title="Simple reward"
                    line="Pays stakers a fixed amount in one coin every day, for as many days as you choose. You can extend it as often as you like."
                    action={{ label: 'Create simple reward', href: targets.simple }}
                >
                    <CreationFeeRow fee={fees.createStakingRewardFee} isLoading={isLoading} />
                </OptionCard>
                <OptionCard
                    title="Compounded reward"
                    line="Pays stakers every day in up to 50 coins. You can extend it, change the daily amount, or send everyone staking a one-time airdrop."
                    action={{ label: 'Create compounded reward', href: targets.compounded }}
                >
                    <CreationFeeRow fee={fees.createDenomRewardFee} isLoading={isLoading} />
                </OptionCard>
            </CardGrid>

            <VStack as="section" aria-label="Already created a reward?" align="stretch" gap="12px">
                <Text as="h2" fontSize="20px" fontWeight="700">Already created a reward?</Text>
                <HgCard p="0" overflow="hidden">
                    <chakra.ul m="0" p="0" listStyleType="none">
                        {existing.map((row, i) => (
                            <chakra.li key={row.label} borderTopWidth={i === 0 ? 0 : '1px'} borderColor="hg.divider">
                                <chakra.a
                                    asChild
                                    display="flex"
                                    alignItems="center"
                                    gap="12px"
                                    px={{ base: '16px', md: '20px' }}
                                    py="14px"
                                    color="fg"
                                    textDecoration="none"
                                    _hover={{ bg: 'hg.hoverFill' }}
                                    focusVisibleRing="inside"
                                    data-testid="existing-reward-row"
                                >
                                    <NextLink href={row.href}>
                                        <Box flex="1" minW={0}>
                                            <Text fontWeight="600" fontSize="15px">{row.label}</Text>
                                            <Text fontSize="13px" color="fg.muted">{row.line}</Text>
                                        </Box>
                                        <Flex as="span" color="hg.link" flex="none"><LuArrowRight aria-hidden /></Flex>
                                    </NextLink>
                                </chakra.a>
                            </chakra.li>
                        ))}
                    </chakra.ul>
                </HgCard>
            </VStack>
        </ChoosePage>
    )
}

export default function ChooseRewardsPage() {
    return <ChooseFrame><ChooseRewards /></ChooseFrame>
}
