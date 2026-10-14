"use client"

import React, { Suspense, useEffect, useState } from 'react'
import { Badge, Box, Container, HStack, Skeleton, Tabs, Text, VStack } from '@chakra-ui/react'
import { LuGift } from 'react-icons/lu'
import { getAllDenomRewards } from '@bze/bze-ui-kit'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { RewardInfoButton } from '@/components/rewards/reward-info-button'
import { HolderListState, HolderRewardsTab } from '@/components/rewards/holder-rewards-tab'
import { StakingProgramsList } from '@/components/rewards/staking-programs-list'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { splitStakingRewards } from '@/lib/staking-rewards'
import { RewardsView, parseRewardsView, rewardsHref } from '@/lib/rewards-directory'

/** Every reward on the chain (they are permissionless), the wallet's own tokens first. */
function RewardsDirectory() {
    const { getQueryParam, replace } = useNavigationWithParams()
    const view = parseRewardsView(getQueryParam)
    const [state, setState] = useState<HolderListState>({ status: 'loading' })
    const [reload, setReload] = useState(0)
    // Loaded here rather than in the tab, so the tab label can count the running programs.
    const programs = useStakingRewards()
    const runningPrograms = splitStakingRewards(programs.rewards).active.length

    useEffect(() => {
        let cancelled = false
        getAllDenomRewards()
            .then((list): HolderListState => ({ status: 'ready', list }))
            .catch((e): HolderListState => {
                console.error('failed to load the denom rewards', e)
                return { status: 'error' }
            })
            .then(next => {
                if (!cancelled) setState(next)
            })
        return () => { cancelled = true }
    }, [reload])

    const retry = () => {
        setState({ status: 'loading' })
        setReload(n => n + 1)
    }
    const show = (next: Partial<RewardsView>) => replace(rewardsHref({ ...view, ...next }))

    return (
        <VStack align="stretch" gap={6}>
            <HStack gap={3} align="start">
                <Box p={2.5} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                    <LuGift size={22} />
                </Box>
                <VStack align="start" gap={0}>
                    <HStack gap={1} wrap="wrap">
                        <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">Rewards on BeeZee</Text>
                        <RewardInfoButton withLabel={true} />
                    </HStack>
                    <Text fontSize="sm" color="fg.muted">Anyone can add prizes or airdrop to any of these.</Text>
                </VStack>
            </HStack>

            <Tabs.Root
                value={view.tab}
                onValueChange={(e) => show({ tab: parseRewardsView(k => (k === 'tab' ? e.value : null)).tab })}
                lazyMount={true}
                unmountOnExit={true}
                colorPalette="yellow"
                variant="line"
            >
                <Tabs.List overflowX="auto" flexWrap="nowrap" maxW="full" css={{ scrollbarWidth: 'none' }}>
                    <Tabs.Trigger value="holder" flexShrink={0}>
                        Holder rewards
                        {state.status === 'ready' && <Badge size="sm" variant="subtle" colorPalette="yellow">{state.list.length}</Badge>}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="programs" flexShrink={0}>
                        Staking programs
                        {!programs.isLoading && !programs.hasError && (
                            <Badge size="sm" variant="subtle" colorPalette="yellow">{`${runningPrograms} running`}</Badge>
                        )}
                    </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="holder" pt={6}>
                    <HolderRewardsTab
                        state={state}
                        filter={view.filter}
                        sort={view.sort}
                        onFilter={(filter) => show({ filter })}
                        onSort={(sort) => show({ sort })}
                        onRetry={retry}
                    />
                </Tabs.Content>
                <Tabs.Content value="programs" pt={6}>
                    <StakingProgramsList
                        pinMine={true}
                        programs={programs}
                        status={view.status}
                        onStatus={(status) => show({ status })}
                    />
                </Tabs.Content>
            </Tabs.Root>
        </VStack>
    )
}

export default function RewardsPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="5xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="48" />}>
                    <RewardsDirectory />
                </Suspense>
            </Container>
        </Box>
    )
}
