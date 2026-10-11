'use client';

import {useCallback, useEffect, useMemo, useState} from "react";
import {usePathname, useSearchParams} from "next/navigation";
import {Box, Button, Container, Flex, SimpleGrid, Skeleton, Text, VStack} from "@chakra-ui/react";
import {LuInbox, LuSearch} from "react-icons/lu";
import {getChainNativeAssetDenom, getUSDCDenom} from "@bze/bze-ui-kit";

import {useCommunitiesContext} from "@/hooks/useCommunitiesContext";
import {useDirectoryData} from "@/hooks/useDirectoryData";
import {buildDirectoryFacts, tokenMarket} from "@/lib/directory-facts";
import {
    type DirectoryState,
    clampPage,
    directoryQueryString,
    filterAndSortFactoryTokens,
    filterSortTokens,
    getTotalPages,
    pageSlice,
    parseDirectoryQuery,
    showingLine,
} from "@/lib/token-directory";

import {DirectoryCard} from "./directory-card";
import {DirectoryFilters} from "./directory-filters";
import {DirectoryPagination} from "./directory-pagination";
import {DirectorySearch} from "./directory-search";
import {DirectorySort} from "./directory-sort";

const CARD_GRID = {base: "minmax(0, 1fr)", md: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))"};

/** The page heading, shared with the Suspense fallback. */
export function DirectoryHeading() {
    return (
        <VStack gap="3" align="center" textAlign="center">
            <Text as="h1" fontSize={{base: "3xl", md: "4xl"}} fontWeight="bold" letterSpacing="tight">
                Token directory
            </Text>
            <Text fontSize={{base: "md", md: "lg"}} color="fg.muted" maxW="2xl">
                Every token created on BeeZee&apos;s Token Factory. Open one to see its community page:
                staking rewards, trading, burns and more.
            </Text>
        </VStack>
    );
}

export function DirectorySkeleton() {
    return (
        <SimpleGrid templateColumns={CARD_GRID} gap="4">
            {Array.from({length: 6}).map((_, i) => (
                <Skeleton key={i} height="180px" borderRadius="xl"/>
            ))}
        </SimpleGrid>
    );
}

export function DirectoryLayout({children}: { children: React.ReactNode }) {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="7xl" px={{base: "4", md: "8"}} py={{base: "7", md: "14"}}>
                <VStack align="stretch" gap={{base: "5", md: "8"}}>
                    <DirectoryHeading/>
                    {children}
                </VStack>
            </Container>
        </Box>
    );
}

/**
 * The token directory (Business Logic R14): search, filters, sort and pages, all kept in the URL
 * (`?q=&filter=&sort=&page=`) so a reload or a shared link shows the same list. Reads
 * `useSearchParams`, so it must render under `<Suspense>`.
 */
export function Directory() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const urlState = useMemo(() => parseDirectoryQuery(searchParams), [searchParams]);

    // The search box keeps its own text so typing never waits for the URL; it follows the URL
    // when the URL changes on its own (e.g. history navigation).
    const [query, setQuery] = useState(urlState.q);
    const [syncedQuery, setSyncedQuery] = useState(urlState.q);
    if (urlState.q !== syncedQuery) {
        setSyncedQuery(urlState.q);
        if (urlState.q.trim() !== query.trim()) setQuery(urlState.q);
    }

    const state: DirectoryState = useMemo(() => ({...urlState, q: query}), [urlState, query]);

    // The native History API, which Next syncs into useSearchParams without a server round trip.
    // router.replace fetched the page's server payload on every change, and in the e2e run a
    // Clear search left the old query in the URL while those fetches were in flight.
    const write = useCallback((next: DirectoryState) => {
        const search = directoryQueryString(next);
        window.history.replaceState(null, "", search ? `${pathname}?${search}` : pathname);
    }, [pathname]);

    // Changing the search, filter or sort starts again from page 1.
    const update = (patch: Partial<Omit<DirectoryState, "page">>) => write({...state, ...patch, page: 1});

    const onSearch = (value: string) => {
        setQuery(value);
        update({q: value});
    };
    const clearSearch = () => onSearch("");

    const {assetsMap, isLoading, poolsMap, poolsDataMap, usdPricesMap, marketsDataMap} = useCommunitiesContext();
    const {kits, denomRewards, stakingRewards} = useDirectoryData();
    const quotes = useMemo(() => ({usdc: getUSDCDenom(), native: getChainNativeAssetDenom()}), []);

    const tokens = useMemo(() => filterAndSortFactoryTokens(Array.from(assetsMap.values())), [assetsMap]);
    const facts = useMemo(() => buildDirectoryFacts({
        tokens,
        denomRewards,
        stakingRewards,
        pools: poolsMap.values(),
        poolsData: poolsDataMap.values(),
        prices: usdPricesMap,
        quotes,
    }), [tokens, denomRewards, stakingRewards, poolsMap, poolsDataMap, usdPricesMap, quotes]);

    const matches = useMemo(() => filterSortTokens(tokens, state, facts), [tokens, state, facts]);
    const totalPages = getTotalPages(matches.length);
    const page = clampPage(urlState.page, totalPages);
    const pageTokens = useMemo(() => pageSlice(matches, page), [matches, page]);

    // A page past the end (old link, fewer tokens now) is shown clamped; put that in the URL too.
    useEffect(() => {
        if (!isLoading && page !== urlState.page) write({...urlState, q: query, page});
    }, [isLoading, page, urlState, query, write]);

    return (
        <DirectoryLayout>
            <VStack align="stretch" gap="3.5">
                <Flex wrap="wrap" gap="3">
                    <DirectorySearch value={query} onChange={onSearch} onClear={clearSearch}/>
                    <DirectorySort value={state.sort} onChange={(sort) => update({sort})}/>
                </Flex>
                <Flex wrap="wrap" justify="space-between" align="center" gap="3">
                    <DirectoryFilters value={state.filter} onChange={(filter) => update({filter})}/>
                    {!isLoading && (
                        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums" data-testid="directory-count">
                            {showingLine(matches.length, page)}
                        </Text>
                    )}
                </Flex>
            </VStack>

            {isLoading ? (
                <DirectorySkeleton/>
            ) : tokens.length === 0 ? (
                <VStack gap="3" align="center" py="16" color="fg.muted">
                    <LuInbox size={40}/>
                    <Text fontSize="lg" fontWeight="medium">No tokens yet</Text>
                    <Text fontSize="sm" maxW="md" textAlign="center">
                        No tokens have been created on the Token Factory yet. Check back soon.
                    </Text>
                </VStack>
            ) : matches.length === 0 ? (
                <VStack gap="3" align="center" py="16" px="4" textAlign="center" data-testid="directory-empty">
                    <Box color="fg.muted"><LuSearch size={40}/></Box>
                    {query.trim() !== "" ? (
                        <>
                            <Text fontSize="lg" fontWeight="semibold">No tokens match “{query.trim()}”</Text>
                            <Text color="fg.muted">Try a different name or ticker, or paste the full denom.</Text>
                            <Button variant="outline" onClick={clearSearch}>Clear search</Button>
                        </>
                    ) : (
                        <>
                            <Text fontSize="lg" fontWeight="semibold">No tokens match this filter</Text>
                            <Button variant="outline" onClick={() => update({filter: "all"})}>Show all tokens</Button>
                        </>
                    )}
                </VStack>
            ) : (
                <>
                    <SimpleGrid templateColumns={CARD_GRID} gap={{base: "3", md: "4"}}>
                        {pageTokens.map((asset) => {
                            const {price, change} = tokenMarket(asset.denom, usdPricesMap, marketsDataMap, quotes);
                            return (
                                <DirectoryCard
                                    key={asset.denom}
                                    asset={asset}
                                    kit={kits.get(asset.denom)}
                                    price={price}
                                    change={change}
                                    holdersPool={facts.holdersPool.has(asset.denom)}
                                    rewardPrograms={facts.rewardPrograms.has(asset.denom)}
                                    tradable={facts.tradable.has(asset.denom)}
                                />
                            );
                        })}
                    </SimpleGrid>
                    <DirectoryPagination page={page} totalPages={totalPages} onChange={(p) => write({...state, page: p})}/>
                </>
            )}
        </DirectoryLayout>
    );
}
