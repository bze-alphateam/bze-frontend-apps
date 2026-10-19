"use client"

import React, { useState } from 'react'
import {
    Box,
    Button,
    chakra,
    Flex,
    Grid,
    HStack,
    Text,
    VStack,
    VisuallyHidden,
} from '@chakra-ui/react'
import { LuArrowRight } from 'react-icons/lu'
import {
    AppLink,
    Eyebrow,
    GradientText,
    HeroGlow,
    HgCard,
    HomeHero,
    PageContainer,
    TokenLogo,
    getBurnerApp,
    useCreationFees,
} from '@bze/bze-ui-kit'
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

function YourTokensStrip() {
    const { tokens } = useMyTokens()
    const { navigate } = useNavigation()
    if (tokens.length === 0) return null

    return (
        <VStack as="section" aria-label="Your tokens" align="stretch" gap="12px">
            <HStack justify="space-between" gap="8px">
                <Text as="h2" fontSize="20px" fontWeight="700">Your tokens</Text>
                <Button size="sm" variant="ghost" color="hg.link" fontWeight="600" onClick={() => navigate('/manage')}>
                    All my tokens <LuArrowRight />
                </Button>
            </HStack>
            <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap="12px">
                {tokens.slice(0, STRIP_SIZE).map(({ asset, admin }) => (
                    <HgCard
                        key={asset.denom}
                        as="button"
                        interactive
                        textAlign="start"
                        p="14px"
                        borderRadius="14px"
                        color="fg"
                        cursor="pointer"
                        focusVisibleRing="outside"
                        onClick={() => navigate(workspaceHref(asset.denom))}
                        data-testid="strip-token"
                    >
                        <HStack gap="12px" minW={0}>
                            <TokenLogo src={asset.logo} symbol={asset.ticker} size="8" circular={true} />
                            <VStack align="start" gap="2px" minW={0}>
                                <Text as="strong" fontWeight="700" fontSize="14px" truncate maxW="full">{asset.ticker}</Text>
                                <SetupProgress denom={asset.denom} admin={admin} compact />
                            </VStack>
                        </HStack>
                    </HgCard>
                ))}
            </Grid>
        </VStack>
    )
}

/** An All tools chip: the technical name in mono on a quiet outline. */
const toolChip = {
    size: 'sm' as const,
    h: '32px',
    px: '12px',
    variant: 'outline' as const,
    borderRadius: '10px',
    borderColor: 'hg.lineStrong',
    bg: 'hg.secondaryFill',
    color: 'fg',
    fontFamily: 'mono',
    fontSize: '12px',
    fontWeight: '500',
    _hover: { borderColor: 'app.border', bg: 'hg.hoverFill' },
}

function ToolChip({ tool, onGoal }: { tool: ToolLink; onGoal: (goal: Goal) => void }) {
    const { navigate } = useNavigation()
    if ('external' in tool) {
        return (
            <AppLink app="burner" href={getBurnerApp().href}>{tool.label}</AppLink>
        )
    }
    const onClick = 'goal' in tool ? () => onGoal(goalById(tool.goal)) : () => navigate(tool.href)
    return <Button {...toolChip} onClick={onClick}>{tool.label}</Button>
}

function ToolChips({ onGoal }: { onGoal: (goal: Goal) => void }) {
    return (
        <HStack gap="8px" flexWrap="wrap">
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
        <Box position="relative" minH="100vh">
            <HeroGlow />
            <PageContainer as="main" position="relative" pt={{ base: '40px', md: '72px' }} pb="80px">
                <VStack align="stretch" gap={{ base: '32px', md: '44px' }}>
                    <HomeHero
                        align="center"
                        eyebrow={<Eyebrow app="factory">BeeZee Factory</Eyebrow>}
                        title={<>What do you want to <GradientText>build</GradientText>?</>}
                        subtitle="Launch your own token. No code needed. Then get it traded, grow its community and make it official. Say it in your own words."
                    >
                        <VStack gap="20px">
                            <GoalSearch
                                tokens={tokens.map(t => t.asset)}
                                onGoal={openGoal}
                                onToken={(denom) => navigate(workspaceHref(denom))}
                                tools={<ToolChips onGoal={openGoal} />}
                            />
                            <HStack gap="8px" flexWrap="wrap" justify="center">
                                {GOAL_CHIPS.map(chip => (
                                    <Button
                                        key={chip.goal}
                                        size="sm"
                                        h="34px"
                                        px="14px"
                                        variant="outline"
                                        borderRadius="hg.pill"
                                        borderColor="hg.lineStrong"
                                        bg="hg.secondaryFill"
                                        color="hg.text.secondary"
                                        fontSize="13px"
                                        fontWeight="500"
                                        _hover={{ borderColor: 'app.border', color: 'fg' }}
                                        onClick={() => openGoal(goalById(chip.goal))}
                                    >
                                        {chip.label}
                                    </Button>
                                ))}
                            </HStack>
                        </VStack>
                    </HomeHero>

                    <YourTokensStrip />

                    <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px" alignItems="start">
                        {GOAL_GROUPS.map(group => {
                            const goals = GOALS.filter(g => g.group === group.id)
                            return (
                                <HgCard
                                    key={group.id}
                                    as="section"
                                    aria-label={group.title}
                                    p={{ base: '18px', md: '22px' }}
                                    borderRadius="18px"
                                    data-testid={`goal-group-${group.id}`}
                                >
                                    <VStack align="stretch" gap="14px">
                                        <Flex justify="space-between" align="center" gap="12px">
                                            <chakra.h2 m="0" display="flex" alignItems="center" gap="12px" fontSize="19px" fontWeight="700">
                                                <Flex
                                                    as="span"
                                                    boxSize="36px"
                                                    flex="none"
                                                    align="center"
                                                    justify="center"
                                                    borderRadius="10px"
                                                    bgImage="app"
                                                    color="hg.buttonText"
                                                    fontSize="16px"
                                                    fontWeight="800"
                                                >
                                                    {group.number}
                                                </Flex>
                                                <VisuallyHidden> · </VisuallyHidden>
                                                {group.title}
                                            </chakra.h2>
                                            {group.id === 'community' && <RewardInfoButton withLabel />}
                                        </Flex>
                                        <VStack align="stretch" gap="8px">
                                            {goals.map(goal => (
                                                <GoalCard key={goal.id} goal={goal} fee={goal.feeKey ? fees[goal.feeKey] : undefined} onOpen={openGoal} />
                                            ))}
                                        </VStack>
                                    </VStack>
                                </HgCard>
                            )
                        })}
                    </Grid>

                    <PlaybooksSection />

                    <VStack as="section" aria-label="All tools" align="stretch" gap="10px">
                        <Text fontSize="13px" fontWeight="600" color="fg.muted">All tools</Text>
                        <ToolChips onGoal={openGoal} />
                    </VStack>
                </VStack>
            </PageContainer>

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
