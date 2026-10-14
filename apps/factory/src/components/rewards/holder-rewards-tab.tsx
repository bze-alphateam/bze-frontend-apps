"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Card, HStack, NativeSelect, Skeleton, Table, Text, VStack } from '@chakra-ui/react'
import { LuChevronRight, LuGift, LuPlus, LuRefreshCw } from 'react-icons/lu'
import {
    DenomReward,
    TokenLogo,
    getDenomRewardPrizes,
    getDenomRewardSchedules,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    useAssetsContext,
} from '@bze/bze-ui-kit'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigation } from '@/hooks/useNavigation'
import { AssetPicker } from '@/components/ui/asset-picker'
import { InfoBox } from '@/components/ui/info-box'
import { airdropFormHref, denomRewardHref, scheduleFormHref } from '@/lib/denom-reward'
import {
    DenomRewardCounts,
    HolderFilter,
    HolderRow,
    HolderSort,
    airdropDisabledReason,
    filterHolderRows,
    sortHolderRows,
    toCounts,
} from '@/lib/rewards-directory'

export type HolderListState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; list: DenomReward[] }

const formatDays = (days: number) => `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`

const FILTERS: { value: HolderFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'stakers', label: 'Has stakers' },
    { value: 'paying', label: 'Paying now' },
]

const SORTS: { value: HolderSort; label: string }[] = [
    { value: 'staked', label: 'Most staked' },
    { value: 'prizes', label: 'Most prize tokens' },
    { value: 'name', label: 'Name A–Z' },
]

type CountsMap = Record<string, DenomRewardCounts | null>

/**
 * Prize and running-schedule counts of every listed DR: one prizes + schedules query per DR, each
 * row filled in as its answer arrives. Missing = still loading, null = the queries failed.
 */
function useDenomRewardCounts(denoms: ReadonlyArray<string>): CountsMap {
    const key = denoms.join('\n')
    const [state, setState] = useState<{ key: string; map: CountsMap }>({ key: '', map: {} })

    useEffect(() => {
        let cancelled = false
        const list = key ? key.split('\n') : []
        list.forEach(denom => {
            Promise.all([getDenomRewardPrizes(denom), getDenomRewardSchedules(denom)])
                .then(([prizes, schedules]) => toCounts(prizes, schedules))
                .catch(e => {
                    console.error('failed to load the denom reward counts of', denom, e)
                    return null
                })
                .then(value => {
                    if (cancelled) return
                    setState(prev => ({ key, map: { ...(prev.key === key ? prev.map : {}), [denom]: value } }))
                })
        })
        return () => { cancelled = true }
    }, [key])

    return state.key === key ? state.map : {}
}

const countCell = (counts: DenomRewardCounts | null | undefined, render: (c: DenomRewardCounts) => React.ReactNode) =>
    counts === undefined ? <Skeleton height="4" width="6" display="inline-block" /> : counts === null ? '—' : render(counts)

const stop = (e: React.MouseEvent) => e.stopPropagation()

function RowActions({ dr, size = 'xs' }: { dr: DenomReward; size?: 'xs' | 'sm' }) {
    const { navigate } = useNavigation()
    const reason = airdropDisabledReason(dr)

    return (
        <VStack align={{ base: 'stretch', md: 'end' }} gap={1} onClick={stop}>
            <HStack gap={2} justify={{ base: 'start', md: 'end' }} wrap="wrap">
                <Button size={size} variant="outline" colorPalette="yellow" disabled={reason !== ''} onClick={() => navigate(airdropFormHref(dr.staking_denom))}>
                    <LuGift /> Airdrop
                </Button>
                <Button size={size} variant="outline" colorPalette="yellow" onClick={() => navigate(scheduleFormHref(dr.staking_denom))}>
                    <LuPlus /> Add prize
                </Button>
            </HStack>
            {reason && <Text fontSize="xs" color="fg.muted">{reason}</Text>}
        </VStack>
    )
}

function TokenName({ denom, ticker, name, logo }: { denom: string; ticker: string; name?: string; logo?: string }) {
    return (
        <HStack gap={3} minW={0} title={denom}>
            <TokenLogo src={logo} symbol={ticker} size="8" circular={true} />
            <VStack align="start" gap={0} minW={0}>
                <Text fontWeight="semibold" truncate>{ticker}</Text>
                {name && <Text fontSize="xs" color="fg.muted" truncate>{name}</Text>}
            </VStack>
        </HStack>
    )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <VStack align="start" gap={0}>
            <Text fontSize="xs" color="fg.muted">{label}</Text>
            <Box fontSize="sm" fontWeight="semibold">{value}</Box>
        </VStack>
    )
}

interface ViewRow extends HolderRow {
    name?: string;
    logo?: string;
}

/** Wide screens: one table row per DR, the whole row opens the token page. */
function HolderTable({ rows, onOpen }: { rows: ViewRow[]; onOpen: (denom: string) => void }) {
    return (
        <Table.ScrollArea borderWidth="1px" borderRadius="lg" hideBelow="md" bg="bg.panel">
            <Table.Root size="sm" interactive={true} aria-label="Holder rewards">
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeader>Token</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Staked</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Prize tokens</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Paying</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Unstaking wait</Table.ColumnHeader>
                        <Table.ColumnHeader />
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {rows.map(r => (
                        <Table.Row key={r.dr.staking_denom} cursor="pointer" onClick={() => onOpen(r.dr.staking_denom)} data-testid="denom-reward-row">
                            <Table.Cell><TokenName denom={r.dr.staking_denom} ticker={r.ticker} name={r.name} logo={r.logo} /></Table.Cell>
                            <Table.Cell textAlign="end">{`${prettyAmount(r.stakedDisplay)} ${r.ticker}`}</Table.Cell>
                            <Table.Cell textAlign="end">{countCell(r.counts, c => c.prizes)}</Table.Cell>
                            <Table.Cell textAlign="end">{countCell(r.counts, c => (c.schedules > 0 ? 'Yes' : 'No'))}</Table.Cell>
                            <Table.Cell textAlign="end">{formatDays(r.dr.lock)}</Table.Cell>
                            <Table.Cell><RowActions dr={r.dr} /></Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </Table.ScrollArea>
    )
}

/** Phones: the same rows as stacked cards. */
function HolderCards({ rows, onOpen }: { rows: ViewRow[]; onOpen: (denom: string) => void }) {
    return (
        <VStack align="stretch" gap={3} hideFrom="md">
            {rows.map(r => (
                <Card.Root
                    key={r.dr.staking_denom}
                    variant="outline"
                    p="4"
                    cursor="pointer"
                    _hover={{ borderColor: 'yellow.500/50' }}
                    onClick={() => onOpen(r.dr.staking_denom)}
                    data-testid="denom-reward-card"
                >
                    <VStack align="stretch" gap={3}>
                        <HStack justify="space-between" gap={2}>
                            <TokenName denom={r.dr.staking_denom} ticker={r.ticker} name={r.name} logo={r.logo} />
                            <Box color="fg.muted"><LuChevronRight /></Box>
                        </HStack>
                        <HStack gap={5} wrap="wrap">
                            <Stat label="Staked" value={`${prettyAmount(r.stakedDisplay)} ${r.ticker}`} />
                            <Stat label="Prize tokens" value={countCell(r.counts, c => c.prizes)} />
                            <Stat label="Paying" value={countCell(r.counts, c => (c.schedules > 0 ? 'Yes' : 'No'))} />
                            <Stat label="Unstaking wait" value={formatDays(r.dr.lock)} />
                        </HStack>
                        <RowActions dr={r.dr} size="sm" />
                    </VStack>
                </Card.Root>
            ))}
        </VStack>
    )
}

/** "Your tokens": the wallet's factory tokens, pinned above the directory. */
function YourTokens({ list, counts }: { list: DenomReward[]; counts: CountsMap }) {
    const { tokens } = useMyTokens()
    const { navigate } = useNavigation()
    const { denomTicker } = useAssets()
    if (tokens.length === 0) return null

    return (
        <VStack as="section" aria-label="Your tokens" align="stretch" gap={3}>
            <Text fontWeight="semibold">Your tokens</Text>
            {tokens.map(({ asset }) => {
                const dr = list.find(d => d.staking_denom === asset.denom)
                if (!dr) {
                    return (
                        <Card.Root key={asset.denom} variant="outline" p="4" data-testid="your-token">
                            <VStack align="stretch" gap={3}>
                                <TokenName denom={asset.denom} ticker={asset.ticker} name={asset.name} logo={asset.logo} />
                                <Text fontSize="sm" color="fg.muted">Not stakable yet. Holders have no reason to stake it.</Text>
                                <Button size="sm" colorPalette="yellow" alignSelf="start" onClick={() => navigate(denomRewardHref(asset.denom))}>
                                    {`Make ${asset.ticker} stakable`}
                                </Button>
                            </VStack>
                        </Card.Root>
                    )
                }
                const c = counts[dr.staking_denom]
                const staked = `${prettyAmount(uAmountToBigNumberAmount(dr.staked_amount, asset.decimals))} ${asset.ticker} staked`
                const paying = c === undefined
                    ? <Skeleton height="4" width="24" display="inline-block" />
                    : c === null
                        ? '—'
                        : [
                            `${c.payingDenoms.length} prize${c.payingDenoms.length === 1 ? '' : 's'} paying`,
                            ...(c.payingDenoms.length ? [c.payingDenoms.map(denomTicker).join(', ')] : []),
                        ].join(' · ')

                return (
                    <Card.Root key={asset.denom} variant="outline" p="4" data-testid="your-token">
                        <VStack align="stretch" gap={3}>
                            <TokenName denom={asset.denom} ticker={asset.ticker} name={asset.name} logo={asset.logo} />
                            <Text fontSize="sm" color="fg.muted">{staked} · {paying}</Text>
                            <HStack gap={2} wrap="wrap">
                                <Button size="sm" variant="outline" colorPalette="yellow" disabled={airdropDisabledReason(dr) !== ''} onClick={() => navigate(airdropFormHref(dr.staking_denom))}>
                                    <LuGift /> Airdrop
                                </Button>
                                <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => navigate(scheduleFormHref(dr.staking_denom))}>
                                    <LuPlus /> Add daily prize
                                </Button>
                                <Button size="sm" variant="ghost" colorPalette="yellow" onClick={() => navigate(denomRewardHref(dr.staking_denom))}>
                                    Open <LuChevronRight />
                                </Button>
                            </HStack>
                            {airdropDisabledReason(dr) && <Text fontSize="xs" color="fg.muted">{airdropDisabledReason(dr)}</Text>}
                        </VStack>
                    </Card.Root>
                )
            })}
        </VStack>
    )
}

export interface HolderRewardsTabProps {
    state: HolderListState;
    filter: HolderFilter;
    sort: HolderSort;
    onFilter: (filter: HolderFilter) => void;
    onSort: (sort: HolderSort) => void;
    onRetry: () => void;
}

/** Every token's holder rewards (denom rewards), the wallet's own tokens first. No wallet needed. */
export function HolderRewardsTab({ state, filter, sort, onFilter, onSort, onRetry }: HolderRewardsTabProps) {
    const { navigate } = useNavigation()
    const { getAsset, denomTicker } = useAssets()
    const { usdPricesMap } = useAssetsContext()
    const list = useMemo(() => (state.status === 'ready' ? state.list : []), [state])
    const counts = useDenomRewardCounts(useMemo(() => list.map(d => d.staking_denom), [list]))

    const rows: ViewRow[] = useMemo(() => {
        const all = list.map(dr => {
            const asset = getAsset(dr.staking_denom)
            return {
                dr,
                ticker: asset?.ticker ?? denomTicker(dr.staking_denom),
                name: asset?.name,
                logo: asset?.logo,
                stakedDisplay: uAmountToBigNumberAmount(dr.staked_amount, asset?.decimals ?? 0),
                usdPrice: usdPricesMap.get(dr.staking_denom),
                counts: counts[dr.staking_denom],
            }
        })
        return sortHolderRows(filterHolderRows(all, filter), sort) as ViewRow[]
    }, [list, getAsset, denomTicker, usdPricesMap, counts, filter, sort])

    const open = (denom: string) => navigate(denomRewardHref(denom))

    return (
        <VStack align="stretch" gap={6}>
            <Text fontSize="sm" color="fg.muted">
                Holders stake a token and earn prizes that anyone can fund, every day or all at once.
            </Text>

            <Card.Root variant="outline" p="4">
                <AssetPicker
                    label="Open the holder rewards of any token"
                    includeLP={true}
                    onSelect={(asset) => navigate(denomRewardHref(asset.denom))}
                />
            </Card.Root>

            {state.status === 'loading' ? (
                <VStack align="stretch" gap={3} data-testid="denom-reward-loading">
                    <Skeleton height="16" />
                    <Skeleton height="16" />
                </VStack>
            ) : state.status === 'error' ? (
                <VStack align="stretch" gap={3}>
                    <InfoBox title="Couldn't load the holder rewards">
                        The chain query failed. The node may be down, or not run chain v8.2.0 yet.
                    </InfoBox>
                    <Box>
                        <Button size="sm" variant="outline" colorPalette="yellow" onClick={onRetry}>
                            <LuRefreshCw /> Retry
                        </Button>
                    </Box>
                </VStack>
            ) : (
                <>
                    <YourTokens list={list} counts={counts} />

                    <VStack as="section" aria-label="Every token" align="stretch" gap={3}>
                        <Text fontWeight="semibold">Every token</Text>
                        {list.length === 0 ? (
                            <Text fontSize="sm" color="fg.muted" data-testid="denom-reward-empty">
                                No token has holder rewards yet. Pick a token above to make it stakable.
                            </Text>
                        ) : (
                            <>
                                <HStack justify="space-between" gap={3} wrap="wrap">
                                    <HStack gap={2} wrap="wrap" role="group" aria-label="Filter">
                                        {FILTERS.map(f => (
                                            <Button
                                                key={f.value}
                                                size="xs"
                                                colorPalette="yellow"
                                                variant={filter === f.value ? 'solid' : 'outline'}
                                                aria-pressed={filter === f.value}
                                                onClick={() => onFilter(f.value)}
                                            >
                                                {f.label}
                                            </Button>
                                        ))}
                                    </HStack>
                                    <NativeSelect.Root size="xs" width="auto">
                                        <NativeSelect.Field
                                            aria-label="Sort"
                                            value={sort}
                                            onChange={(e) => onSort(e.currentTarget.value as HolderSort)}
                                        >
                                            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </NativeSelect.Field>
                                        <NativeSelect.Indicator />
                                    </NativeSelect.Root>
                                </HStack>

                                {rows.length === 0 ? (
                                    <Text fontSize="sm" color="fg.muted" data-testid="denom-reward-filtered-empty">
                                        Nothing matches this filter.
                                    </Text>
                                ) : (
                                    <>
                                        <HolderTable rows={rows} onOpen={open} />
                                        <HolderCards rows={rows} onOpen={open} />
                                    </>
                                )}
                            </>
                        )}
                    </VStack>
                </>
            )}
        </VStack>
    )
}
