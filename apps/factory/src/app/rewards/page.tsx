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
    uAmountToBigNumberAmount,
    useAssets,
    useAssetsContext,
    useEpochs,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { InnerHero } from '@/components/ui/inner-hero'
import { FilterChip } from '@/components/ui/filter-chip'
import { CompoundedRewardCard, rewardCardId } from '@/components/rewards/compounded-reward-card'
import { SimpleRewardRow } from '@/components/rewards/simple-reward-row'
import { useAllDenomRewards } from '@/hooks/useAllDenomRewards'
import { useDenomRewardDetails } from '@/hooks/useDenomRewardDetails'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { compoundedNewHref } from '@/lib/denom-reward'
import {
    HolderRow,
    RewardFilter,
    RewardKind,
    RewardSort,
    RewardsView,
    SimpleRow,
    SimpleStatus,
    createdBy,
    filterHolderRows,
    filterSimpleRows,
    matchesStakedToken,
    parseRewardsView,
    rewardsHref,
    searchText,
    sortHolderRows,
    sortSimpleRows,
    toCounts,
} from '@/lib/rewards-directory'

const KINDS: { value: RewardKind; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'compounded', label: 'Compounded' },
    { value: 'simple', label: 'Simple' },
]

const FILTERS: { value: RewardFilter; label: string }[] = [
    { value: 'all', label: 'Any' },
    { value: 'stakers', label: 'Has stakers' },
    { value: 'paying', label: 'Paying now' },
    { value: 'mine', label: 'Created by you' },
]

const STATUSES: { value: SimpleStatus; label: string }[] = [
    { value: 'all', label: 'Any status' },
    { value: 'running', label: 'Running' },
    { value: 'finished', label: 'Finished' },
]

const SORTS: { value: RewardSort; label: string }[] = [
    { value: 'staked', label: 'Most staked (USD)' },
    { value: 'prizes', label: 'Most prize tokens' },
    { value: 'name', label: 'A–Z' },
]

/** A section's title: "Compounded · one per staked token · 3". */
function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
    return (
        <Text as="h2" fontSize="12px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">
            {children}{count !== undefined && ` · ${count}`}
        </Text>
    )
}

function SectionSkeleton({ testId }: { testId: string }) {
    return (
        <VStack align="stretch" gap="10px" data-testid={testId} aria-busy="true">
            <Shimmer h="120px" borderRadius="16px" />
            <Shimmer h="120px" borderRadius="16px" />
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

function Empty({ title, description, href, cta }: { title: string; description: string; href: string; cta: string }) {
    return (
        <HgCard p="16px">
            <PageState
                kind="empty"
                icon={<LuGift />}
                title={title}
                description={description}
                action={(
                    <Button asChild variant={hgVariant('primary')} size="lg">
                        <NextLink href={href}><LuPlus /> {cta}</NextLink>
                    </Button>
                )}
            />
        </HgCard>
    )
}

/** Every staking reward on the chain (they are permissionless), found by the token people stake. */
function RewardsDirectory() {
    const { getQueryParam, replace } = useNavigationWithParams()
    const view = parseRewardsView(getQueryParam)
    // The search box keeps its own text, so typing never waits for the URL to catch up.
    const [q, setQ] = useState(() => searchText(view))
    const [now] = useState(() => new Date())
    const { getAsset, denomTicker } = useAssets()
    const { usdPricesMap } = useAssetsContext()
    const { address } = useChain(getChainName())
    const { dayEpochInfo } = useEpochs()
    const compounded = useAllDenomRewards()
    const simple = useStakingRewards()
    const details = useDenomRewardDetails((compounded.list ?? []).map(dr => dr.staking_denom))

    const show = (next: Partial<RewardsView>) => replace(rewardsHref({ ...view, q, ...next }))
    const search = (value: string) => {
        setQ(value)
        // Typing replaces the deep-linked token: from here on it is an ordinary search.
        replace(rewardsHref({ ...view, q: value, denom: '' }))
    }

    const tokenOf = (denom: string) => {
        const asset = getAsset(denom)
        return { denom, ticker: asset?.ticker ?? denomTicker(denom), name: asset?.name, decimals: asset?.decimals ?? 0, logo: asset?.logo }
    }

    const holderRows: (HolderRow & { logo?: string })[] = sortHolderRows(filterHolderRows(
        (compounded.list ?? [])
            .map(dr => {
                const token = tokenOf(dr.staking_denom)
                const d = details[dr.staking_denom]
                return {
                    dr,
                    ticker: token.ticker,
                    name: token.name,
                    logo: token.logo,
                    stakedDisplay: uAmountToBigNumberAmount(dr.staked_amount, token.decimals),
                    usdPrice: usdPricesMap.get(dr.staking_denom),
                    counts: d === undefined ? undefined : d === null ? null : toCounts(d.prizes, d.schedules),
                }
            })
            .filter(row => matchesStakedToken({ denom: row.dr.staking_denom, ticker: row.ticker, name: row.name }, q, view.denom)),
        view.filter,
        address,
    ), view.sort)

    const simpleRows: SimpleRow[] = sortSimpleRows(filterSimpleRows(
        simple.rewards
            .map(reward => {
                const token = tokenOf(reward.staking_denom)
                const prize = tokenOf(reward.prize_denom)
                return {
                    reward,
                    ticker: token.ticker,
                    name: token.name,
                    stakedDisplay: uAmountToBigNumberAmount(reward.staked_amount || 0, token.decimals),
                    usdPrice: usdPricesMap.get(reward.staking_denom),
                    prizeDisplay: uAmountToBigNumberAmount(reward.prize_amount, prize.decimals),
                    prizeUsdPrice: usdPricesMap.get(reward.prize_denom),
                }
            })
            .filter(row => matchesStakedToken({ denom: row.reward.staking_denom, ticker: row.ticker, name: row.name }, q, view.denom)),
        view.filter,
        view.status,
        address,
    ), view.sort)

    // A deep link (`?denom=`) scrolls to that token's compounded reward once the cards are there.
    const scrolledTo = useRef('')
    const cardsReady = compounded.list !== undefined
    useEffect(() => {
        if (!view.denom || !cardsReady || scrolledTo.current === view.denom) return
        scrolledTo.current = view.denom
        document.getElementById(rewardCardId(view.denom))?.scrollIntoView({ block: 'start' })
    }, [view.denom, cardsReady])

    const showCompounded = view.kind !== 'simple'
    const showSimple = view.kind !== 'compounded'
    const searching = q.trim() !== ''
    const noMatch = searching ? `No reward stakes a token matching '${q.trim()}'.` : 'Nothing matches these filters.'

    let compoundedBody: React.ReactNode
    if (compounded.isLoading) {
        compoundedBody = <SectionSkeleton testId="compounded-loading" />
    } else if (compounded.hasError) {
        compoundedBody = <LoadError title="Couldn't load the compounded rewards." onRetry={compounded.retry} />
    } else if ((compounded.list ?? []).length === 0) {
        compoundedBody = (
            <Empty
                title="No compounded rewards yet."
                description="Make a token stakable: holders stake it and share daily prizes that anyone can add."
                href={compoundedNewHref()}
                cta="Make a token stakable"
            />
        )
    } else if (holderRows.length === 0) {
        compoundedBody = <Text fontSize="14px" color="fg.muted" data-testid="compounded-no-match">{noMatch}</Text>
    } else {
        compoundedBody = (
            <VStack align="stretch" gap="12px">
                {holderRows.map(row => (
                    <CompoundedRewardCard
                        key={row.dr.staking_denom}
                        row={row}
                        details={details[row.dr.staking_denom]}
                        mine={createdBy(row.dr.staking_denom, address)}
                        currentDayEpoch={dayEpochInfo?.current_epoch?.toString()}
                        now={now}
                    />
                ))}
            </VStack>
        )
    }

    let simpleBody: React.ReactNode
    if (simple.isLoading) {
        simpleBody = <SectionSkeleton testId="simple-loading" />
    } else if (simple.hasError) {
        simpleBody = <LoadError title="Couldn't load the simple rewards." onRetry={simple.refresh} />
    } else if (simple.rewards.length === 0) {
        simpleBody = (
            <Empty
                title="No simple rewards yet."
                description="People stake a token and earn a prize, day by day, for as long as it is paid for."
                href="/reward/new"
                cta="Create a simple reward"
            />
        )
    } else if (simpleRows.length === 0) {
        simpleBody = <Text fontSize="14px" color="fg.muted" data-testid="simple-no-match">{noMatch}</Text>
    } else {
        simpleBody = (
            <VStack align="stretch" gap="12px">
                {simpleRows.map(row => (
                    <SimpleRewardRow
                        key={row.reward.reward_id}
                        reward={row.reward}
                        mine={createdBy(row.reward.staking_denom, address)}
                        now={now}
                        onChanged={simple.refresh}
                    />
                ))}
            </VStack>
        )
    }

    const ready = (isLoading: boolean, hasError: boolean) => !isLoading && !hasError

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
                <VStack align="stretch" gap="28px">
                    <VStack align="stretch" gap="14px">
                        <HStack gap="12px" wrap="wrap" align="center">
                            <InputGroup flex="1 1 280px" startElement={<LuSearch size={18} aria-hidden />}>
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
                            <NativeSelect.Root size="sm" width="auto">
                                <NativeSelect.Field
                                    aria-label="Sort"
                                    h="46px"
                                    borderRadius="14px"
                                    bg="hg.card"
                                    borderColor="hg.lineStrong"
                                    fontSize="14px"
                                    value={view.sort}
                                    onChange={(e) => show({ sort: e.currentTarget.value as RewardSort })}
                                >
                                    {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </NativeSelect.Field>
                                <NativeSelect.Indicator />
                            </NativeSelect.Root>
                        </HStack>
                        <HStack gap="8px" wrap="wrap" role="group" aria-label="Kind">
                            {KINDS.map(k => (
                                <FilterChip key={k.value} pressed={view.kind === k.value} onClick={() => show({ kind: k.value })}>
                                    {k.label}
                                </FilterChip>
                            ))}
                        </HStack>
                        <HStack gap="8px" wrap="wrap" role="group" aria-label="Filter">
                            {FILTERS.filter(f => f.value !== 'paying' || showCompounded).map(f => (
                                <FilterChip key={f.value} pressed={view.filter === f.value} onClick={() => show({ filter: f.value })}>
                                    {f.label}
                                </FilterChip>
                            ))}
                        </HStack>
                        {showSimple && (
                            <HStack gap="8px" wrap="wrap" role="group" aria-label="Simple reward status">
                                {STATUSES.map(s => (
                                    <FilterChip key={s.value} pressed={view.status === s.value} onClick={() => show({ status: s.value })}>
                                        {s.label}
                                    </FilterChip>
                                ))}
                            </HStack>
                        )}
                    </VStack>

                    {showCompounded && (
                        <VStack as="section" aria-label="Compounded rewards" align="stretch" gap="12px">
                            <SectionTitle count={ready(compounded.isLoading, compounded.hasError) ? holderRows.length : undefined}>
                                Compounded · one per staked token
                            </SectionTitle>
                            {compoundedBody}
                        </VStack>
                    )}

                    {showSimple && (
                        <VStack as="section" aria-label="Simple rewards" align="stretch" gap="12px">
                            <SectionTitle count={ready(simple.isLoading, simple.hasError) ? simpleRows.length : undefined}>
                                Simple · fixed budget, end date
                            </SectionTitle>
                            {simpleBody}
                        </VStack>
                    )}
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
