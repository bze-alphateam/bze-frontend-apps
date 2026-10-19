'use client';

import {useCallback, useEffect, useMemo, useState} from "react";
import {usePathname, useSearchParams} from "next/navigation";
import {Box, Button, Flex, SimpleGrid, Text} from "@chakra-ui/react";
import {LuFilter, LuSearch} from "react-icons/lu";
import {
    Eyebrow,
    getChainNativeAssetDenom,
    getUSDCDenom,
    GradientText,
    HeroGlow,
    HgCard,
    HomeHero,
    PageContainer,
    PageState,
    Shimmer,
} from "@bze/bze-ui-kit";

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

/** The hero, shared with the Suspense fallback; `controls` are the search and sort under it. */
export function DirectoryHeading({controls}: { controls?: React.ReactNode }) {
    return (
        <HomeHero
            align="center"
            eyebrow={<Eyebrow app="communities">BeeZee Communities · Token directory</Eyebrow>}
            title={<>Every token has a <GradientText>home</GradientText></>}
            subtitle={
                "A home for every community token. Every token created on BeeZee's Token Factory gets a page: "
                + "staking rewards, trading, burns and more."
            }
        >
            {controls && <Flex wrap="wrap" gap="10px" w="100%" maxW="760px" mx="auto">{controls}</Flex>}
        </HomeHero>
    );
}

export function DirectorySkeleton() {
    return (
        <SimpleGrid templateColumns={CARD_GRID} gap="16px" aria-busy="true">
            {Array.from({length: 6}).map((_, i) => (
                <Shimmer key={i} h="196px" borderRadius="hg.lg"/>
            ))}
        </SimpleGrid>
    );
}

export function DirectoryLayout({controls, children}: { controls?: React.ReactNode; children: React.ReactNode }) {
    return (
        <Box position="relative" minH="100vh">
            <HeroGlow/>
            <PageContainer as="main" position="relative" pt={{base: "32px", md: "72px"}} pb={{base: "40px", md: "96px"}}>
                <Flex direction="column" gap={{base: "28px", md: "40px"}}>
                    <DirectoryHeading controls={controls}/>
                    {children}
                </Flex>
            </PageContainer>
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

    const controls = (
        <>
            <DirectorySearch value={query} onChange={onSearch} onClear={clearSearch}/>
            <DirectorySort value={state.sort} onChange={(sort) => update({sort})}/>
        </>
    );

    return (
        <DirectoryLayout controls={controls}>
            <Flex wrap="wrap" justify="space-between" align="center" gap="12px">
                <DirectoryFilters value={state.filter} onChange={(filter) => update({filter})}/>
                {!isLoading && (
                    <Text fontSize="13px" color="hg.text.faint" fontVariantNumeric="tabular-nums" data-testid="directory-count">
                        {showingLine(matches.length, page)}
                    </Text>
                )}
            </Flex>

            {isLoading ? (
                <DirectorySkeleton/>
            ) : tokens.length === 0 ? (
                <HgCard>
                    <PageState
                        kind="empty"
                        title="No tokens yet"
                        description="No tokens have been created on the Token Factory yet. Check back soon."
                    />
                </HgCard>
            ) : matches.length === 0 ? (
                <HgCard data-testid="directory-empty">
                    {query.trim() !== "" ? (
                        <PageState
                            kind="not-found"
                            icon={<LuSearch/>}
                            title={`No tokens match “${query.trim()}”`}
                            description="Try a different name or ticker, or paste the full denom."
                            action={<Button variant="secondary" size="md" onClick={clearSearch}>Clear search</Button>}
                        />
                    ) : (
                        <PageState
                            kind="empty"
                            icon={<LuFilter/>}
                            title="No tokens match this filter"
                            action={<Button variant="secondary" size="md" onClick={() => update({filter: "all"})}>Show all tokens</Button>}
                        />
                    )}
                </HgCard>
            ) : (
                <>
                    <SimpleGrid templateColumns={CARD_GRID} gap={{base: "12px", md: "16px"}}>
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
