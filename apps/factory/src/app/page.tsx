"use client"

import React, { useState } from 'react'
import {
    Box,
    Button,
    Card,
    Container,
    Grid,
    HStack,
    Text,
    VStack,
} from '@chakra-ui/react'
import { LuArrowRight, LuArrowUpRight } from 'react-icons/lu'
import { TokenLogo, getBurnerApp, useCreationFees } from '@bze/bze-ui-kit'
import { GoalCard } from '@/components/home/goal-card'
import { GoalSearch } from '@/components/home/goal-search'
import { PlaybooksSection } from '@/components/home/playbooks-section'
import { TokenChoiceDialog } from '@/components/home/token-choice-dialog'
import { SetupProgress } from '@/components/manage/setup-progress'
import { RewardInfoButton } from '@/components/rewards/reward-info-button'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigation } from '@/hooks/useNavigation'
import { ALL_TOOLS, GOALS, GOAL_CHIPS, GOAL_GROUPS, type Goal, type ToolLink, goalById } from '@/lib/goals'
import { workspaceHref } from '@/lib/workspace'

/** The home strip shows this many of the user's tokens; the rest are on /manage. */
const STRIP_SIZE = 4

const openBurner = () => window.open(getBurnerApp().href, '_blank', 'noopener,noreferrer')

function YourTokensStrip() {
    const { tokens } = useMyTokens()
    const { navigate } = useNavigation()
    if (tokens.length === 0) return null

    return (
        <VStack as="section" aria-label="Your tokens" align="stretch" gap={3}>
            <HStack justify="space-between" gap={2}>
                <Text as="h2" fontSize="lg" fontWeight="bold">Your tokens</Text>
                <Button size="sm" variant="ghost" colorPalette="yellow" onClick={() => navigate('/manage')}>
                    All my tokens <LuArrowRight />
                </Button>
            </HStack>
            <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap={3}>
                {tokens.slice(0, STRIP_SIZE).map(({ asset, admin }) => (
                    <Box
                        key={asset.denom}
                        as="button"
                        textAlign="start"
                        p={3}
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor="yellow.500/20"
                        bg="bg.panel"
                        _hover={{ borderColor: 'yellow.500/50' }}
                        onClick={() => navigate(workspaceHref(asset.denom))}
                        data-testid="strip-token"
                    >
                        <HStack gap={2} minW={0}>
                            <TokenLogo src={asset.logo} symbol={asset.ticker} size="8" circular={true} />
                            <VStack align="start" gap={0} minW={0}>
                                <Text fontWeight="semibold" fontSize="sm" truncate maxW="full">{asset.ticker}</Text>
                                <SetupProgress denom={asset.denom} admin={admin} compact />
                            </VStack>
                        </HStack>
                    </Box>
                ))}
            </Grid>
        </VStack>
    )
}

function ToolChip({ tool, onGoal }: { tool: ToolLink; onGoal: (goal: Goal) => void }) {
    const { navigate } = useNavigation()
    if ('external' in tool) {
        return (
            <Button size="xs" variant="outline" onClick={openBurner}>
                {tool.label} <LuArrowUpRight />
            </Button>
        )
    }
    const onClick = 'goal' in tool ? () => onGoal(goalById(tool.goal)) : () => navigate(tool.href)
    return <Button size="xs" variant="outline" fontFamily="mono" onClick={onClick}>{tool.label}</Button>
}

function ToolChips({ onGoal }: { onGoal: (goal: Goal) => void }) {
    return (
        <HStack gap={2} flexWrap="wrap">
            {ALL_TOOLS.map(tool => <ToolChip key={tool.label} tool={tool} onGoal={onGoal} />)}
        </HStack>
    )
}

export default function FactoryHomePage() {
    const { fees } = useCreationFees()
    const { tokens, isLoading: isTokensLoading } = useMyTokens()
    const { navigate } = useNavigation()
    const [choosing, setChoosing] = useState<Goal>()

    const openGoal = (goal: Goal) => {
        if (!goal.href) return
        if (goal.external) {
            window.open(goal.href(), '_blank', 'noopener,noreferrer')
            return
        }
        if (!goal.needsToken) {
            navigate(goal.href())
            return
        }
        // Only one token of your own: nothing to choose.
        if (goal.needsToken === 'mine' && !isTokensLoading && tokens.length === 1) {
            navigate(goal.href(tokens[0].asset.denom))
            return
        }
        setChoosing(goal)
    }

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="6xl" py={{ base: 8, md: 12 }}>
                <VStack align="stretch" gap={8}>
                    <VStack gap={3} align="center" textAlign="center">
                        <Text as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" letterSpacing="tight">
                            What do you want to do?
                        </Text>
                        <Text color="fg.muted" maxW="2xl">
                            Create a token, get it traded, grow its community and make it official. Say it in your own words.
                        </Text>
                        <GoalSearch
                            tokens={tokens.map(t => t.asset)}
                            onGoal={openGoal}
                            onToken={(denom) => navigate(workspaceHref(denom))}
                            tools={<ToolChips onGoal={openGoal} />}
                        />
                        <HStack gap={2} flexWrap="wrap" justify="center">
                            {GOAL_CHIPS.map(chip => (
                                <Button key={chip.goal} size="xs" variant="subtle" colorPalette="yellow" borderRadius="full" onClick={() => openGoal(goalById(chip.goal))}>
                                    {chip.label}
                                </Button>
                            ))}
                        </HStack>
                    </VStack>

                    <YourTokensStrip />

                    <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap={4} alignItems="start">
                        {GOAL_GROUPS.map(group => {
                            const goals = GOALS.filter(g => g.group === group.id)
                            return (
                                <Card.Root key={group.id} as="section" aria-label={group.title} variant="outline" p={4} data-testid={`goal-group-${group.id}`}>
                                    <VStack align="stretch" gap={3}>
                                        <HStack justify="space-between" gap={2}>
                                            <Text as="h2" fontSize="lg" fontWeight="bold">{`${group.number} · ${group.title}`}</Text>
                                            {group.id === 'community' && <RewardInfoButton withLabel />}
                                        </HStack>
                                        {goals.map(goal => (
                                            <GoalCard key={goal.id} goal={goal} fee={goal.feeKey ? fees[goal.feeKey] : undefined} onOpen={openGoal} />
                                        ))}
                                    </VStack>
                                </Card.Root>
                            )
                        })}
                    </Grid>

                    <PlaybooksSection />

                    <VStack as="section" aria-label="All tools" align="stretch" gap={2}>
                        <Text fontSize="sm" fontWeight="semibold" color="fg.muted">All tools</Text>
                        <ToolChips onGoal={openGoal} />
                    </VStack>
                </VStack>
            </Container>

            <TokenChoiceDialog
                goal={choosing}
                onClose={() => setChoosing(undefined)}
                onPick={(denom) => {
                    const href = choosing?.href?.(denom)
                    setChoosing(undefined)
                    if (href) navigate(href)
                }}
            />
        </Box>
    )
}
