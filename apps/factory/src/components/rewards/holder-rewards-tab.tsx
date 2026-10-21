"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Grid, HStack, NativeSelect, Table, Text, VStack } from '@chakra-ui/react'
import { LuChevronRight, LuGift, LuPlus, LuRefreshCw } from 'react-icons/lu'
import {
    DenomReward,
    HgCard,
    Shimmer,
    TokenLogo,
    getDenomRewardPrizes,
    getDenomRewardSchedules,
    hgVariant,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    useAssetsContext,
} from '@bze/bze-ui-kit'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigation } from '@/hooks/useNavigation'
import { AssetPicker } from '@/components/ui/asset-picker'
import { InfoBox } from '@/components/ui/info-box'
import { FilterChip } from '@/components/ui/filter-chip'
import { softButton } from '@/components/ui/soft-button'
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
    counts === undefined ? <Shimmer h="14px" w="24px" display="inline-block" verticalAlign="middle" /> : counts === null ? '—' : render(counts)

/** How many daily prizes are running, as the directory showed them before the redesign. */
const payingText = (c: DenomRewardCounts) => (c.schedules > 0 ? `${c.schedules} daily prize${c.schedules === 1 ? '' : 's'}` : 'No')

const stop = (e: React.MouseEvent) => e.stopPropagation()

/** A row's Airdrop / Add prize button: the soft app button, small. */
const rowButton = (size: 'xs' | 'sm') => ({ ...softButton, size, h: size === 'xs' ? '30px' : '32px', fontSize: '12px', borderRadius: '8px' })

/** Header and body cells of the directory table. */
const headerCell = { px: '20px', py: '10px', fontSize: '12px', fontWeight: '600', color: 'hg.text.faint', borderColor: 'hg.divider' }
const bodyCell = { px: '20px', py: '14px', fontSize: '14px', borderColor: 'hg.divider' }

function RowActions({ dr, size = 'xs' }: { dr: DenomReward; size?: 'xs' | 'sm' }) {
    const { navigate } = useNavigation()
    const reason = airdropDisabledReason(dr)

    return (
        <VStack align={{ base: 'stretch', md: 'end' }} gap="4px" onClick={stop}>
            <HStack gap="6px" justify={{ base: 'start', md: 'end' }} wrap="wrap">
                <Button {...rowButton(size)} disabled={reason !== ''} onClick={() => navigate(airdropFormHref(dr.staking_denom))}>
                    <LuGift /> Airdrop
                </Button>
                <Button {...rowButton(size)} onClick={() => navigate(scheduleFormHref(dr.staking_denom))}>
                    <LuPlus /> Add prize
                </Button>
            </HStack>
            {reason && <Text fontSize="12px" color="hg.text.faint">{reason}</Text>}
        </VStack>
    )
}

function TokenName({ denom, ticker, name, logo }: { denom: string; ticker: string; name?: string; logo?: string }) {
    return (
        <HStack gap="10px" minW={0} title={denom}>
            <TokenLogo src={logo} symbol={ticker} size="8" circular={true} />
            <VStack align="start" gap={0} minW={0}>
                <Text fontWeight="700" fontSize="14px" truncate>{ticker}</Text>
                {name && <Text fontSize="12px" color="fg.muted" truncate>{name}</Text>}
            </VStack>
        </HStack>
    )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <VStack align="stretch" gap="2px" bg="hg.inset" borderRadius="10px" px="12px" py="8px" minW={0}>
            <Text fontSize="11px" color="fg.muted">{label}</Text>
            <Box fontSize="13px" fontWeight="700">{value}</Box>
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
        <Table.ScrollArea borderWidth="1px" borderColor="hg.hairline" borderRadius="hg.lg" hideBelow="md" bg="hg.card">
            <Table.Root size="sm" aria-label="Compounded rewards" bg="transparent">
                <Table.Header>
                    <Table.Row bg="hg.cardHeader">
                        <Table.ColumnHeader {...headerCell}>Token</Table.ColumnHeader>
                        <Table.ColumnHeader {...headerCell} textAlign="end">Staked</Table.ColumnHeader>
                        <Table.ColumnHeader {...headerCell} textAlign="end">Prize tokens</Table.ColumnHeader>
                        <Table.ColumnHeader {...headerCell} textAlign="end">Paying</Table.ColumnHeader>
                        <Table.ColumnHeader {...headerCell} textAlign="end">Unstaking wait</Table.ColumnHeader>
                        <Table.ColumnHeader {...headerCell} />
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {rows.map(r => (
                        <Table.Row
                            key={r.dr.staking_denom}
                            cursor="pointer"
                            bg="transparent"
                            _hover={{ bg: 'hg.hoverFill' }}
                            onClick={() => onOpen(r.dr.staking_denom)}
                            data-testid="denom-reward-row"
                        >
                            <Table.Cell {...bodyCell}><TokenName denom={r.dr.staking_denom} ticker={r.ticker} name={r.name} logo={r.logo} /></Table.Cell>
                            <Table.Cell {...bodyCell} textAlign="end">{`${prettyAmount(r.stakedDisplay)} ${r.ticker}`}</Table.Cell>
                            <Table.Cell {...bodyCell} textAlign="end">{countCell(r.counts, c => c.prizes)}</Table.Cell>
                            <Table.Cell {...bodyCell} textAlign="end">{countCell(r.counts, payingText)}</Table.Cell>
                            <Table.Cell {...bodyCell} textAlign="end">{formatDays(r.dr.lock)}</Table.Cell>
                            <Table.Cell {...bodyCell}><RowActions dr={r.dr} /></Table.Cell>
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
        <VStack align="stretch" gap="12px" hideFrom="md">
            {rows.map(r => (
                <HgCard
                    key={r.dr.staking_denom}
                    interactive
                    p="16px"
                    cursor="pointer"
                    onClick={() => onOpen(r.dr.staking_denom)}
                    data-testid="denom-reward-card"
                >
                    <VStack align="stretch" gap="12px">
                        <HStack justify="space-between" gap="8px">
                            <TokenName denom={r.dr.staking_denom} ticker={r.ticker} name={r.name} logo={r.logo} />
                            <Box color="hg.text.faint" aria-hidden><LuChevronRight /></Box>
                        </HStack>
                        <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="8px">
                            <Stat label="Staked" value={`${prettyAmount(r.stakedDisplay)} ${r.ticker}`} />
                            <Stat label="Prize tokens" value={countCell(r.counts, c => c.prizes)} />
                            <Stat label="Paying" value={countCell(r.counts, payingText)} />
                            <Stat label="Unstaking wait" value={formatDays(r.dr.lock)} />
                        </Grid>
                        <RowActions dr={r.dr} size="sm" />
                    </VStack>
                </HgCard>
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
        <VStack as="section" aria-label="Your tokens" align="stretch" gap="12px">
            <Text as="h2" fontSize="18px" fontWeight="700">Your tokens</Text>
            <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px">
            {tokens.map(({ asset }) => {
                const dr = list.find(d => d.staking_denom === asset.denom)
                if (!dr) {
                    return (
                        <HgCard key={asset.denom} p="18px" data-testid="your-token">
                            <VStack align="stretch" gap="12px">
                                <TokenName denom={asset.denom} ticker={asset.ticker} name={asset.name} logo={asset.logo} />
                                <Text fontSize="14px" color="fg.muted">Not stakable yet. Holders have no reason to stake it.</Text>
                                <Button variant={hgVariant('primary')} size="md" alignSelf="start" onClick={() => navigate(denomRewardHref(asset.denom))}>
                                    {`Make ${asset.ticker} stakable`}
                                </Button>
                            </VStack>
                        </HgCard>
                    )
                }
                const c = counts[dr.staking_denom]
                const staked = `${prettyAmount(uAmountToBigNumberAmount(dr.staked_amount, asset.decimals))} ${asset.ticker} staked`
                const paying = c === undefined
                    ? <Shimmer h="14px" w="96px" display="inline-block" verticalAlign="middle" />
                    : c === null
                        ? '—'
                        : [
                            `${c.payingDenoms.length} prize${c.payingDenoms.length === 1 ? '' : 's'} paying`,
                            ...(c.payingDenoms.length ? [c.payingDenoms.map(denomTicker).join(', ')] : []),
                        ].join(' · ')

                return (
                    <HgCard key={asset.denom} p="18px" data-testid="your-token">
                        <VStack align="stretch" gap="12px">
                            <TokenName denom={asset.denom} ticker={asset.ticker} name={asset.name} logo={asset.logo} />
                            <Text fontSize="14px" color="fg.muted">{staked} · {paying}</Text>
                            <HStack gap="8px" wrap="wrap">
                                <Button {...softButton} size="sm" disabled={airdropDisabledReason(dr) !== ''} onClick={() => navigate(airdropFormHref(dr.staking_denom))}>
                                    <LuGift /> Airdrop
                                </Button>
                                <Button {...softButton} size="sm" onClick={() => navigate(scheduleFormHref(dr.staking_denom))}>
                                    <LuPlus /> Add daily prize
                                </Button>
                                <Button size="sm" variant="ghost" color="hg.link" fontWeight="600" onClick={() => navigate(denomRewardHref(dr.staking_denom))}>
                                    Open <LuChevronRight />
                                </Button>
                            </HStack>
                            {airdropDisabledReason(dr) && <Text fontSize="12px" color="hg.text.faint">{airdropDisabledReason(dr)}</Text>}
                        </VStack>
                    </HgCard>
                )
            })}
            </Grid>
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

/** Every token's compounded reward (denom rewards), the wallet's own tokens first. No wallet needed. */
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
        <VStack align="stretch" gap="28px">
            <Text fontSize="14px" color="fg.muted">
                Holders stake a token and earn prizes that anyone can fund, every day or all at once.
            </Text>

            <HgCard px="18px" py="16px">
                <AssetPicker
                    label="Open the compounded reward of any token"
                    includeLP={true}
                    onSelect={(asset) => navigate(denomRewardHref(asset.denom))}
                />
            </HgCard>

            {state.status === 'loading' ? (
                <VStack align="stretch" gap="12px" data-testid="denom-reward-loading">
                    <Shimmer h="64px" borderRadius="16px" />
                    <Shimmer h="64px" borderRadius="16px" />
                </VStack>
            ) : state.status === 'error' ? (
                <VStack align="stretch" gap="12px">
                    <InfoBox title="Couldn't load the compounded rewards">
                        The chain query failed. The node may be down, or not run chain v8.2.0 yet.
                    </InfoBox>
                    <Box>
                        <Button {...softButton} size="sm" onClick={onRetry}>
                            <LuRefreshCw /> Retry
                        </Button>
                    </Box>
                </VStack>
            ) : (
                <>
                    <YourTokens list={list} counts={counts} />

                    <VStack as="section" aria-label="Every token" align="stretch" gap="14px">
                        <Text as="h2" fontSize="18px" fontWeight="700">Every token</Text>
                        {list.length === 0 ? (
                            <Text fontSize="14px" color="fg.muted" data-testid="denom-reward-empty">
                                No token has a compounded reward yet. Pick a token above to make it stakable.
                            </Text>
                        ) : (
                            <>
                                <HStack justify="space-between" gap="12px" wrap="wrap">
                                    <HStack gap="8px" wrap="wrap" role="group" aria-label="Filter">
                                        {FILTERS.map(f => (
                                            <FilterChip
                                                key={f.value}
                                                pressed={filter === f.value}
                                                onClick={() => onFilter(f.value)}
                                            >
                                                {f.label}
                                            </FilterChip>
                                        ))}
                                    </HStack>
                                    <NativeSelect.Root size="xs" width="auto">
                                        <NativeSelect.Field
                                            aria-label="Sort"
                                            h="32px"
                                            borderRadius="10px"
                                            bg="hg.card"
                                            borderColor="hg.lineStrong"
                                            fontSize="13px"
                                            value={sort}
                                            onChange={(e) => onSort(e.currentTarget.value as HolderSort)}
                                        >
                                            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </NativeSelect.Field>
                                        <NativeSelect.Indicator />
                                    </NativeSelect.Root>
                                </HStack>

                                {rows.length === 0 ? (
                                    <Text fontSize="14px" color="fg.muted" data-testid="denom-reward-filtered-empty">
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
