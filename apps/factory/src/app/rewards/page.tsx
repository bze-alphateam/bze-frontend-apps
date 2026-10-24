"use client"

import React, { Suspense, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { Box, Button, HStack, Input, InputGroup, NativeSelect, Text, VStack } from '@chakra-ui/react'
import { LuGift, LuPlus, LuRefreshCw, LuSearch } from 'react-icons/lu'
import {
    HgCard,
    PageContainer,
    PageState,
    Shimmer,
    getChainName,
    hgVariant,
    isLpDenom,
    useAssets,
    useAssetsContext,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { InnerHero } from '@/components/ui/inner-hero'
import { FilterChip } from '@/components/ui/filter-chip'
import { RewardGroupRow, rewardRowId } from '@/components/rewards/reward-group-row'
import { useAllDenomRewards } from '@/hooks/useAllDenomRewards'
import { useDenomRewardDetails } from '@/hooks/useDenomRewardDetails'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { compoundedNewHref } from '@/lib/denom-reward'
import {
    RewardFilter,
    RewardKind,
    RewardSort,
    RewardsView,
    createdBy,
    groupRewards,
    parseRewardsView,
    rewardCount,
    rewardsHref,
    searchText,
    sortRewardGroups,
} from '@/lib/rewards-directory'

const KINDS: { value: RewardKind; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'compounded', label: 'Compounded' },
    { value: 'simple', label: 'Simple' },
]

const FILTERS: { value: RewardFilter; label: string }[] = [
    { value: 'all', label: 'Any' },
    { value: 'stakers', label: 'Has stakers' },
    { value: 'paying', label: 'Paying daily' },
    { value: 'mine', label: 'Yours' },
    { value: 'running', label: 'Running' },
    { value: 'finished', label: 'Finished' },
]

const SORTS: { value: RewardSort; label: string }[] = [
    { value: 'staked', label: 'Most staked (USD)' },
    { value: 'prizes', label: 'Most prize tokens' },
    { value: 'name', label: 'A–Z' },
]

const selectField = { h: '46px', borderRadius: '14px', bg: 'hg.card', borderColor: 'hg.lineStrong', fontSize: '14px' }

function ListSkeleton() {
    return (
        <VStack align="stretch" gap="10px" data-testid="rewards-loading" aria-busy="true">
            <Shimmer h="76px" borderRadius="16px" />
            <Shimmer h="76px" borderRadius="16px" />
            <Shimmer h="76px" borderRadius="16px" />
        </VStack>
    )
}

function LoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
    return (
        <HgCard p="16px">
            <PageState
                kind="error"
                title={title}
                description="The chain query failed. The node may be down; try again in a moment."
                action={(
                    <Button variant="outline" size="md" onClick={onRetry}>
                        <LuRefreshCw /> Retry
                    </Button>
                )}
            />
        </HgCard>
    )
}

/**
 * Every staking reward on the chain (they are permissionless), one row per staked token: its
 * compounded reward and the simple rewards that stake it, behind a click.
 */
function RewardsDirectory() {
    const { getQueryParam, replace } = useNavigationWithParams()
    const view = parseRewardsView(getQueryParam)
    // The search box keeps its own text, so typing never waits for the URL to catch up.
    const [q, setQ] = useState(() => searchText(view))
    // The rows opened or closed by hand; the rest follow their default (see `isOpen`).
    const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set())
    const { getAsset, denomTicker } = useAssets()
    const { usdPricesMap } = useAssetsContext()
    const { address } = useChain(getChainName())
    const compounded = useAllDenomRewards()
    const simple = useStakingRewards()
    const details = useDenomRewardDetails((compounded.list ?? []).map(dr => dr.staking_denom))

    const show = (next: Partial<RewardsView>) => replace(rewardsHref({ ...view, q, ...next }))
    const search = (value: string) => {
        setQ(value)
        // Typing replaces the deep-linked token: from here on it is an ordinary search.
        replace(rewardsHref({ ...view, q: value, denom: '' }))
    }
    const toggle = (denom: string) => setToggled(prev => {
        const next = new Set(prev)
        if (!next.delete(denom)) next.add(denom)
        return next
    })

    const schedules = Object.fromEntries(Object.entries(details).map(([denom, d]) => [denom, d ? d.schedules : null]))
    const groups = sortRewardGroups(groupRewards(
        { compounded: compounded.list ?? [], schedules, simple: simple.rewards, view: { ...view, q }, address },
        {
            token: denom => {
                const asset = getAsset(denom)
                return { denom, ticker: asset?.ticker ?? denomTicker(denom), name: asset?.name, decimals: asset?.decimals ?? 0 }
            },
            usdPrice: denom => usdPricesMap.get(denom),
        },
    ), view.sort)

    // A deep link (`?denom=`) opens that token's row and, once the rows are there, scrolls to it;
    // so does a list down to one row.
    const isOpen = (denom: string) => toggled.has(denom) !== (denom === view.denom || groups.length === 1)
    const loading = compounded.isLoading || simple.isLoading
    const scrolledTo = useRef('')
    useEffect(() => {
        if (!view.denom || loading || scrolledTo.current === view.denom) return
        scrolledTo.current = view.denom
        document.getElementById(rewardRowId(view.denom))?.scrollIntoView({ block: 'start' })
    }, [view.denom, loading])

    // "Make X stakable" belongs where every reward of the token shows, and only once the
    // compounded rewards are known. LP shares are staked in simple rewards.
    const offerStakable = (denom: string) =>
        compounded.list !== undefined && view.kind === 'all' && (view.filter === 'all' || view.filter === 'mine') && !isLpDenom(denom)

    const nothingYet = !loading && !compounded.hasError && !simple.hasError
        && (compounded.list ?? []).length === 0 && simple.rewards.length === 0
    const searching = q.trim() !== ''
    const total = groups.reduce((n, g) => n + rewardCount(g), 0)

    let list: React.ReactNode
    if (loading) {
        list = <ListSkeleton />
    } else if (nothingYet) {
        list = (
            <HgCard p="16px">
                <PageState
                    kind="empty"
                    icon={<LuGift />}
                    title="No staking rewards yet."
                    description="Make a token stakable: holders stake it and share daily prizes that anyone can add."
                    action={(
                        <Button asChild variant={hgVariant('primary')} size="lg">
                            <NextLink href={compoundedNewHref()}><LuPlus /> Make a token stakable</NextLink>
                        </Button>
                    )}
                />
            </HgCard>
        )
    } else if (groups.length === 0) {
        list = (
            <Text fontSize="14px" color="fg.muted" data-testid="rewards-no-match">
                {searching ? `No reward stakes a token matching '${q.trim()}'.` : 'Nothing matches these filters.'}
            </Text>
        )
    } else {
        list = (
            <VStack align="stretch" gap="10px">
                <Text fontSize="12px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint" data-testid="rewards-count">
                    {`${groups.length} token${groups.length === 1 ? '' : 's'} · ${total} reward${total === 1 ? '' : 's'}`}
                </Text>
                {groups.map(group => (
                    <RewardGroupRow
                        key={group.denom}
                        group={group}
                        mine={createdBy(group.denom, address)}
                        open={isOpen(group.denom)}
                        onToggle={() => toggle(group.denom)}
                        offerStakable={offerStakable(group.denom)}
                        onChanged={simple.refresh}
                    />
                ))}
            </VStack>
        )
    }

    return (
        <>
            <InnerHero
                title="Rewards"
                subtitle="Every staking reward on BeeZee. Anyone can extend or add to any of them. Find one by the token people stake."
                actions={(
                    <Button asChild variant={hgVariant('primary')} size="lg">
                        <NextLink href="/create/rewards"><LuPlus /> Create a reward</NextLink>
                    </Button>
                )}
            />
            <PageContainer as="main" pt="28px" pb="64px">
                <VStack align="stretch" gap="20px">
                    <HStack gap="10px" wrap="wrap" align="center">
                        <InputGroup flex="1 1 260px" startElement={<LuSearch size={18} aria-hidden />}>
                            <Input
                                aria-label="Search by staked token"
                                placeholder="Search by staked token"
                                h="46px"
                                borderRadius="14px"
                                bg="hg.card"
                                borderColor="hg.lineStrong"
                                value={q}
                                onChange={(e) => search(e.currentTarget.value)}
                            />
                        </InputGroup>
                        <HStack gap="6px" wrap="wrap" role="group" aria-label="Kind">
                            {KINDS.map(k => (
                                <FilterChip key={k.value} pressed={view.kind === k.value} onClick={() => show({ kind: k.value })}>
                                    {k.label}
                                </FilterChip>
                            ))}
                        </HStack>
                        <NativeSelect.Root size="sm" width="auto">
                            <NativeSelect.Field
                                aria-label="Filter"
                                {...selectField}
                                value={view.filter}
                                onChange={(e) => show({ filter: e.currentTarget.value as RewardFilter })}
                            >
                                {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                        </NativeSelect.Root>
                        <NativeSelect.Root size="sm" width="auto">
                            <NativeSelect.Field
                                aria-label="Sort"
                                {...selectField}
                                value={view.sort}
                                onChange={(e) => show({ sort: e.currentTarget.value as RewardSort })}
                            >
                                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                        </NativeSelect.Root>
                    </HStack>

                    {compounded.hasError && <LoadError title="Couldn't load the compounded rewards." onRetry={compounded.retry} />}
                    {simple.hasError && <LoadError title="Couldn't load the simple rewards." onRetry={simple.refresh} />}

                    <Box as="section" aria-label="Rewards by staked token">{list}</Box>
                </VStack>
            </PageContainer>
        </>
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
