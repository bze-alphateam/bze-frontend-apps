"use client"

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { Box, Button, chakra, HStack, Input, InputGroup, Text, VStack } from '@chakra-ui/react'
import { LuCoins, LuPlus, LuRefreshCw, LuSearch } from 'react-icons/lu'
import {
    DenomReward,
    HgCard,
    PageContainer,
    PageState,
    Shimmer,
    getAllDenomRewards,
    getChainName,
    hgVariant,
    useAssets,
    useAssetsContext,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { InnerHero } from '@/components/ui/inner-hero'
import { FilterChip } from '@/components/ui/filter-chip'
import { TokenDirectoryRow } from '@/components/tokens/token-directory-row'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import {
    TOKENS_PAGE_SIZE,
    TokenFilter,
    TokensView,
    adminBadge,
    clampPage,
    filterTokenRows,
    isFactoryToken,
    matchesSearch,
    pageCount,
    pageLinks,
    parseTokensView,
    sortTokenRows,
    toTokenRow,
    tokensHref,
} from '@/lib/tokens-directory'

type DenomRewardsState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; byDenom: Map<string, DenomReward> }

const NO_DENOM_REWARDS = new Map<string, DenomReward>()

const FILTERS: { value: TokenFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Created by you' },
    { value: 'stakable', label: 'Stakable' },
]

/** Every denom reward, by staking denom; one query for the whole directory. */
function useDenomRewardsByDenom() {
    const [state, setState] = useState<DenomRewardsState>({ status: 'loading' })

    useEffect(() => {
        let cancelled = false
        getAllDenomRewards()
            .then((list): DenomRewardsState => ({ status: 'ready', byDenom: new Map(list.map(dr => [dr.staking_denom, dr])) }))
            .catch((e): DenomRewardsState => {
                console.error('failed to load the denom rewards', e)
                return { status: 'error' }
            })
            .then(next => {
                if (!cancelled) setState(next)
            })
        return () => { cancelled = true }
    }, [])

    return state
}

/** A group's title: "Created by you · 2". */
function GroupTitle({ children, count }: { children: React.ReactNode; count: number }) {
    return (
        <Text as="h2" fontSize="12px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">
            {children} · {count}
        </Text>
    )
}

function ListSkeleton() {
    return (
        <VStack align="stretch" gap="10px" data-testid="tokens-loading" aria-busy="true">
            <Shimmer h="72px" borderRadius="16px" />
            <Shimmer h="72px" borderRadius="16px" />
            <Shimmer h="72px" borderRadius="16px" />
        </VStack>
    )
}

function Pager({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
    if (count <= 1) return null
    return (
        <chakra.nav aria-label="Pages" hideBelow="md" display="flex" justifyContent="center" gap="6px" pt="6px">
            {pageLinks(page, count).map((p, i) => p === '…' ? (
                <Text key={`gap-${i}`} as="span" px="6px" alignSelf="center" color="hg.text.faint" aria-hidden>…</Text>
            ) : (
                <Button
                    key={p}
                    size="sm"
                    minW="36px"
                    h="36px"
                    px="10px"
                    borderRadius="10px"
                    variant="ghost"
                    fontWeight="600"
                    aria-label={`Page ${p}`}
                    aria-current={p === page ? 'page' : undefined}
                    color={p === page ? 'hg.link' : 'hg.text.secondary'}
                    bg={p === page ? 'app.subtle' : 'transparent'}
                    onClick={() => onPage(p)}
                >
                    {p}
                </Button>
            ))}
        </chakra.nav>
    )
}

/** Every token made with Factory; the wallet's own tokens pinned on top with their admin checked live. */
function TokensDirectory() {
    const { getQueryParam, replace, navigate } = useNavigationWithParams()
    const view = parseTokensView(getQueryParam)
    // The search box keeps its own text, so typing never waits for the URL to catch up.
    const [q, setQ] = useState(view.q)
    const { assets, isLoading: isAssetsLoading, nativeAsset } = useAssets()
    const { usdPricesMap, updateAssets } = useAssetsContext()
    const { address } = useChain(getChainName())
    const { tokens: myTokens, isLoading: isMineLoading, refreshAdmins } = useMyTokens()
    const denomRewards = useDenomRewardsByDenom()
    const drs = denomRewards.status === 'ready' ? denomRewards.byDenom : NO_DENOM_REWARDS

    const show = (next: Partial<TokensView>) => replace(tokensHref({ ...view, q, page: 1, ...next }))
    const search = (value: string) => {
        setQ(value)
        replace(tokensHref({ ...view, q: value, page: 1 }))
    }

    const factoryAssets = useMemo(() => assets.filter(isFactoryToken), [assets])
    const myDenoms = useMemo(() => new Set(myTokens.map(t => t.asset.denom)), [myTokens])

    const mineRows = useMemo(() => sortTokenRows(filterTokenRows(
        myTokens
            .filter(t => matchesSearch(t.asset, q))
            .map(t => ({ ...toTokenRow(t.asset, drs.get(t.asset.denom), usdPricesMap.get(t.asset.denom)), admin: t.admin })),
        view.filter,
    )), [myTokens, q, view.filter, drs, usdPricesMap])

    const allRows = useMemo(() => sortTokenRows(filterTokenRows(
        factoryAssets
            .filter(a => !myDenoms.has(a.denom) && matchesSearch(a, q))
            .map(a => toTokenRow(a, drs.get(a.denom), usdPricesMap.get(a.denom))),
        view.filter,
    )), [factoryAssets, myDenoms, q, view.filter, drs, usdPricesMap])

    const page = clampPage(view.page, allRows.length)
    const pages = pageCount(allRows.length)
    // Phones keep every row up to this page (they grow the list); desktop shows this page alone.
    const shownRows = allRows.slice(0, page * TOKENS_PAGE_SIZE)
    const firstOfPage = (page - 1) * TOKENS_PAGE_SIZE

    // The native asset is always in a loaded list, so its absence means the asset query failed.
    const assetsFailed = !isAssetsLoading && !nativeAsset
    const isLoading = isAssetsLoading || denomRewards.status === 'loading'
    const showAll = view.filter !== 'mine'

    let body: React.ReactNode
    if (assetsFailed) {
        body = (
            <HgCard p="16px">
                <PageState
                    kind="error"
                    title="Couldn't load the tokens."
                    description="The chain query failed. The node may be down; try again in a moment."
                    action={(
                        <Button variant="outline" size="md" onClick={() => void updateAssets()}>
                            <LuRefreshCw /> Retry
                        </Button>
                    )}
                />
            </HgCard>
        )
    } else if (isLoading) {
        body = <ListSkeleton />
    } else if (factoryAssets.length === 0) {
        body = (
            <HgCard p="16px">
                <PageState
                    kind="empty"
                    icon={<LuCoins />}
                    title="No tokens yet."
                    description="Nobody has made a token with Factory on this network yet."
                    action={(
                        <Button variant={hgVariant('primary')} size="lg" onClick={() => navigate('/token/new')}>
                            <LuPlus /> Create a token
                        </Button>
                    )}
                />
            </HgCard>
        )
    } else if (mineRows.length === 0 && (!showAll || allRows.length === 0)) {
        body = (
            <Text fontSize="14px" color="fg.muted" data-testid="tokens-no-match">
                {q.trim() !== ''
                    ? `No token matches '${q.trim()}'.`
                    : view.filter === 'mine'
                        ? (address ? "You haven't created a token yet." : 'Connect your wallet to see the tokens you created.')
                        : 'No token is stakable yet.'}
            </Text>
        )
    } else {
        body = (
            <VStack align="stretch" gap="32px">
                {address && mineRows.length > 0 && (
                    <VStack as="section" aria-label="Created by you" align="stretch" gap="10px">
                        <GroupTitle count={mineRows.length}>Created by you</GroupTitle>
                        <chakra.ul display="flex" flexDirection="column" gap="10px" m="0" p="0">
                            {mineRows.map(row => (
                                <TokenDirectoryRow
                                    key={row.asset.denom}
                                    row={row}
                                    admin={{ badge: adminBadge(row.admin, address, isMineLoading), onRetry: () => void refreshAdmins() }}
                                />
                            ))}
                        </chakra.ul>
                    </VStack>
                )}

                {showAll && allRows.length > 0 && (
                    <VStack as="section" aria-label="All tokens" align="stretch" gap="10px">
                        <GroupTitle count={allRows.length}>All tokens</GroupTitle>
                        <chakra.ul display="flex" flexDirection="column" gap="10px" m="0" p="0">
                            {shownRows.map((row, i) => (
                                <TokenDirectoryRow key={row.asset.denom} row={row} phoneOnly={i < firstOfPage} />
                            ))}
                        </chakra.ul>
                        <Pager page={page} count={pages} onPage={(p) => show({ page: p })} />
                        {page < pages && (
                            <Button
                                hideFrom="md"
                                size="lg"
                                variant="outline"
                                borderColor="app.border"
                                bg="app.subtle"
                                color="fg"
                                borderRadius="hg.md"
                                _hover={{ bg: 'app.muted' }}
                                onClick={() => show({ page: page + 1 })}
                            >
                                {`Show ${Math.min(TOKENS_PAGE_SIZE, allRows.length - shownRows.length)} more`}
                            </Button>
                        )}
                    </VStack>
                )}
            </VStack>
        )
    }

    return (
        <>
            <InnerHero
                title="Tokens"
                subtitle="Every token made with Factory. Open one to see what you can do with it. Admin rights are checked on the chain when you open it."
            />
            <PageContainer as="main" pt="28px" pb="64px">
                <VStack align="stretch" gap="24px">
                    <HStack gap="12px" wrap="wrap" align="center">
                        <InputGroup flex="1 1 320px" startElement={<LuSearch size={18} aria-hidden />}>
                            <Input
                                aria-label="Search tokens"
                                placeholder="Name, ticker or denom"
                                h="46px"
                                borderRadius="14px"
                                bg="hg.card"
                                borderColor="hg.lineStrong"
                                value={q}
                                onChange={(e) => search(e.currentTarget.value)}
                            />
                        </InputGroup>
                        <HStack gap="8px" wrap="wrap" role="group" aria-label="Filter">
                            {FILTERS.map(f => (
                                <FilterChip key={f.value} pressed={view.filter === f.value} onClick={() => show({ filter: f.value })}>
                                    {f.label}
                                </FilterChip>
                            ))}
                        </HStack>
                    </HStack>
                    {denomRewards.status === 'error' && !isLoading && (
                        <Text fontSize="13px" color="hg.text.faint" data-testid="tokens-stake-unknown">
                            {"Couldn't check which tokens are stakable, so they show as not stakable yet and sort A–Z."}
                        </Text>
                    )}
                    {body}
                </VStack>
            </PageContainer>
        </>
    )
}

export default function TokensPage() {
    return (
        <Box minH="100vh">
            <Suspense fallback={<PageContainer pt="28px"><Shimmer h="192px" borderRadius="16px" /></PageContainer>}>
                <TokensDirectory />
            </Suspense>
        </Box>
    )
}
