"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, chakra, Flex, Text, VStack } from '@chakra-ui/react'
import { LuArrowRight } from 'react-icons/lu'
import { HgCard, useCreationFees } from '@bze/bze-ui-kit'
import { CardGrid, ChooseFrame, ChoosePage, CreationFeeLine, Facts, OptionCard } from '@/components/create/choose-parts'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { rewardTargets } from '@/lib/create-routes'

function Example({ children }: { children: string }) {
    return <Text fontSize="14px" fontStyle="italic" color="hg.text.secondary">{`“${children}”`}</Text>
}

/** Choose staking rewards (canvas A4): a simple or a compounded reward, on any token. */
function ChooseRewards() {
    const { getQueryParam } = useNavigationWithParams()
    const { fees, isLoading } = useCreationFees()
    const targets = rewardTargets({ get: getQueryParam })

    const existing = [
        { label: 'Extend a simple reward', line: 'Add days to one that is running, with the same daily budget.', href: targets.extendSimple },
        { label: 'Add a daily prize', line: 'Pay the stakers of a compounded reward every day, in any token.', href: targets.dailyPrize },
        { label: 'Airdrop to stakers, once', line: 'Split an amount between everyone staking the token today.', href: targets.airdrop },
    ]

    return (
        <ChoosePage
            crumb="Staking rewards"
            title="Which kind of reward?"
            intro="Both pay people who stake a token. It can be any token, LP shares included, and it doesn't have to be yours."
        >
            <CardGrid>
                <OptionCard
                    title="Simple reward"
                    line="One reward token, a fixed daily budget, a set number of days."
                    action={{ label: 'Create simple reward', href: targets.simple }}
                >
                    <Example>Stake HONEY/BZE LP for 30 days, share 1,000 HONEY a day.</Example>
                    <Facts facts={[
                        ['Reward tokens', 'One'],
                        ['You fund', 'Everything up front: daily budget × days'],
                        ['Stakers', 'Can be asked to keep it staked a minimum number of days'],
                        ['Best for', 'Campaigns with an end date, LP rewards'],
                    ]} />
                    <CreationFeeLine fee={fees.createStakingRewardFee} isLoading={isLoading} />
                </OptionCard>
                <OptionCard
                    title="Compounded reward"
                    line="One staking spot per token. Anyone can add prizes to it, in any token, daily or once."
                    action={{ label: 'Create compounded reward', href: targets.compounded }}
                >
                    <Example>Stake HONEY, and anyone can add BZE or HONEY prizes to it, today or next year.</Example>
                    <Facts facts={[
                        ['Reward tokens', 'Many, from anyone'],
                        ['You fund', 'Optional at creation; add daily prizes or airdrops any time'],
                        ['Per token', 'Only one. If it exists, you add prizes to it'],
                        ['Best for', 'Making a token stakable for good'],
                    ]} />
                    <CreationFeeLine fee={fees.createDenomRewardFee} isLoading={isLoading} />
                </OptionCard>
            </CardGrid>

            <VStack as="section" aria-label="Add to a reward that already exists" align="stretch" gap="12px">
                <VStack align="stretch" gap="4px">
                    <Text as="h2" fontSize="20px" fontWeight="700">Add to a reward that already exists</Text>
                    <Text fontSize="14px" color="fg.muted">{`Anyone can do these on any reward. Funding one doesn't make you its owner.`}</Text>
                </VStack>
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
