"use client"

import React, { Suspense, useEffect, useState } from 'react'
import { Box, chakra, Tabs, Text } from '@chakra-ui/react'
import { GradientText, PageContainer, Shimmer, getAllDenomRewards } from '@bze/bze-ui-kit'
import { BandTab, BandTabList } from '@/components/ui/band-tabs'
import { InnerHero } from '@/components/ui/inner-hero'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { RewardKindsLink } from '@/components/rewards/reward-kinds-link'
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
        <Tabs.Root
            value={view.tab}
            onValueChange={(e) => show({ tab: parseRewardsView(k => (k === 'tab' ? e.value : null)).tab })}
            lazyMount={true}
            unmountOnExit={true}
            variant="plain"
        >
            <InnerHero
                title={<>Rewards on <GradientText>BeeZee</GradientText></>}
                subtitle="Anyone can add prizes or airdrop to any of these."
                actions={<RewardKindsLink withLabel={true} />}
            >
                <BandTabList label="Rewards">
                    <BandTab value="holder">
                        Compounded rewards
                        {state.status === 'ready' && <CountPill active={view.tab === 'holder'}>{state.list.length}</CountPill>}
                    </BandTab>
                    <BandTab value="programs">
                        Simple rewards
                        {!programs.isLoading && !programs.hasError && (
                            // Phones get just the count: both labels must fit 390 px, or the selected
                            // second tab pushes the whole page sideways.
                            <CountPill active={view.tab === 'programs'}>
                                {runningPrograms}{' '}
                                <Text as="span" hideBelow="sm">running</Text>
                            </CountPill>
                        )}
                    </BandTab>
                </BandTabList>
            </InnerHero>

            <PageContainer as="main" pt="28px" pb="64px">
                <Tabs.Content value="holder" p="0">
                    <HolderRewardsTab
                        state={state}
                        filter={view.filter}
                        sort={view.sort}
                        onFilter={(filter) => show({ filter })}
                        onSort={(sort) => show({ sort })}
                        onRetry={retry}
                    />
                </Tabs.Content>
                <Tabs.Content value="programs" p="0">
                    <StakingProgramsList
                        pinMine={true}
                        programs={programs}
                        status={view.status}
                        onStatus={(status) => show({ status })}
                    />
                </Tabs.Content>
            </PageContainer>
        </Tabs.Root>
    )
}

/** A tab's count: app-tinted on the selected tab, neutral otherwise. */
function CountPill({ active, children }: { active: boolean; children: React.ReactNode }) {
    return (
        <chakra.span
            fontSize="11px"
            fontWeight="700"
            px="7px"
            py="2px"
            borderRadius="hg.pill"
            color={active ? 'hg.link' : 'hg.text.secondary'}
            bg={active ? 'app.subtle' : 'hg.hoverFill'}
        >
            {children}
        </chakra.span>
    )
}

export default function RewardsPage() {
    return (
        <Box minH="100vh">
            <Suspense fallback={<PageContainer pt="28px"><Shimmer h="192px" borderRadius="16px" /></PageContainer>}>
                <RewardsDirectory />
            </Suspense>
        </Box>
    )
}
