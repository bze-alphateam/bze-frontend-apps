'use client';

import {Suspense, useCallback, useEffect, useState} from 'react';
import {Box, Button, chakra, Flex} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {Eyebrow, GradientText, getChainName, HeroGlow, PageContainer, PageState} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {useDaoList} from '@/hooks/useDaoList';
import {useHomeUrl} from '@/hooks/useHomeUrl';
import {liveDaoDeps} from '@/lib/dao-chain';
import {loadMyDaos, PAGE_SIZE, type DaoDeps} from '@/lib/dao-loader';
import {matchesFilter} from '@/lib/dao-cards';
import {mineCount, numberedCount} from '@/lib/home-list';
import {searchTerm} from '@/lib/home-query';
import {clampPage, cursorCount, pageCount, slicePage} from '@/lib/pagination';
import {Pagination, PrevNext} from '@/components/ui/pagination';
import {DaoCards, DaoTable, type DaoRow} from './dao-list';
import {MineSwitch, SearchBox, TypeFilter} from './home-filters';
import {MineNotices, ReducedListNotice} from './home-notices';
import {Unsupported} from './unsupported';

const SEARCH_DELAY_MS = 300;
const NO_FILTER = {kind: '', search: ''} as const;

/**
 * The search box's text. It follows the URL's `q`; what is typed is held until the delay has
 * passed, then `commit` writes it to the URL (never at mount, and not when only blanks differ).
 */
function useDebouncedSearch(committed: string, commit: (q: string) => void) {
    const [draft, setDraft] = useState<{base: string; text: string} | null>(null);
    const text = draft && draft.base === committed ? draft.text : committed;

    useEffect(() => {
        if (!draft || draft.base !== committed || draft.text.trim() === committed.trim()) return;
        const timer = setTimeout(() => commit(draft.text), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [draft, committed, commit]);

    return [text, (value: string) => setDraft({base: committed, text: value})] as const;
}

const HeroBand = () => (
    <Box position="relative" overflow="hidden">
        <HeroGlow strength="home" />
        <PageContainer position="relative" zIndex="1" pt={{base: '24px', md: '52px'}} pb={{base: '8px', md: '12px'}}>
            <Flex direction="column" gap={{base: '16px', md: '18px'}} data-testid="page-hero">
                <Eyebrow app="dao" iconSize={22}>BeeZee DAO</Eyebrow>
                <chakra.h1 m="0" textStyle="hero" fontSize={{base: '28px', md: '52px'}}>
                    Decide together, <GradientText>on chain</GradientText>.
                </chakra.h1>
                <chakra.p m="0" display={{base: 'none', md: 'block'}} fontSize="18px" lineHeight="1.55" color="fg.muted" maxW="560px">
                    Run a group on BeeZee: vote, hold a treasury, and let the chain carry out what you decide.
                </chakra.p>
            </Flex>
        </PageContainer>
    </Box>
);

/** The DAOs card: the filter row, the notices, the list (table or cards) and the footer. */
const DaosSection = ({deps}: {deps: DaoDeps}) => {
    const {address} = useChain(getChainName());
    const wallet = !!address;
    const {query, pushPage, replacePage, setFilters} = useHomeUrl(wallet);
    const mine = query.mine;
    const term = searchTerm(query.q);
    const filterActive = !!query.kind || !!term;

    const commitSearch = useCallback((q: string) => setFilters({q}), [setFilters]);
    const [typed, setTyped] = useDebouncedSearch(query.q, commitSearch);

    // While My DAOs is on the table is the wallet's own list, so the all-DAOs list only has to say what the node and Scan are doing.
    const list = useDaoList(deps, mine ? NO_FILTER : {kind: query.kind, search: query.q}, mine ? 1 : query.page);
    const mineDaos = useAsync(address ?? null, () => loadMyDaos(deps, address as string));

    const lastPage = list.pastEnd;
    useEffect(() => {
        if (lastPage !== null && !mine) replacePage(lastPage);
    }, [lastPage, mine, replacePage]);

    if (list.unsupported) return <Unsupported />;

    const mineResult = mineDaos.data;
    const roles = new Map((mineResult?.rows ?? []).map((row) => [row.dao.id, row.reasons]));
    // The chain's list is unfiltered: the type control and the search are no use for it, but they still filter the wallet's own list.
    const reduced = list.source === 'chain';
    const filtersHidden = reduced && !mine;

    // The rows of the table, whichever list they come from.
    const mineRows = (mineResult?.rows ?? []).filter((row) => matchesFilter(row.dao, query.kind, term));
    const minePages = pageCount(mineRows.length, PAGE_SIZE);
    const minePage = clampPage(query.page, minePages);
    const rows: DaoRow[] = mine
        ? slicePage(mineRows, minePage, PAGE_SIZE).map((row) => ({dao: row.dao, reasons: row.reasons}))
        : list.items.map((dao) => ({dao, reasons: roles.get(dao.id) ?? []}));
    const loading = mine ? mineDaos.loading : list.loading || list.pastEnd !== null;
    const failed = mine ? !!mineDaos.error : !!list.error;
    const empty = !loading && !failed && rows.length === 0;

    const emptyState = () => {
        if (mine && mineResult && mineResult.rows.length === 0 && !filterActive) {
            return (
                <PageState
                    kind="empty"
                    title="You're not in any DAO yet"
                    description="Join one by staking in its rewards or by asking its members."
                    action={<Button variant="outline" onClick={() => setFilters({mine: false})}>Show all DAOs</Button>}
                />
            );
        }
        if (mine || filterActive) {
            return (
                <PageState kind="empty" title="No DAO matches" description={mine ? 'Try another type, or turn off My DAOs.' : 'Try another name or type.'} />
            );
        }
        return <PageState kind="empty" title="No DAOs yet" description="DAOs created on BeeZee are listed here." />;
    };

    const footer = () => {
        if (empty || failed) return null;
        if (mine) {
            if (mineDaos.loading) return null;
            return <Pagination page={minePage} pages={minePages} onPage={pushPage} count={mineCount(mineRows.length)} />;
        }
        const count = (text: string) => (list.loading ? ' ' : text);
        if (list.mode === 'pages' && list.pages !== null) {
            const page = clampPage(query.page, list.pages);
            return (
                <Pagination
                    page={page}
                    pages={list.pages}
                    onPage={pushPage}
                    busy={list.loading}
                    count={count(numberedCount({page, pageSize: PAGE_SIZE, rows: list.items.length, total: list.total ?? 0}))}
                />
            );
        }
        if (list.mode === 'cursor') {
            return <PrevNext hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.goPrev} onNext={list.goNext} busy={list.loading} count={count(cursorCount(list.page))} />;
        }
        return null;
    };

    return (
        // a card from md up; on a phone the heading, the filters and the DAO cards sit on the page itself
        <Box
            as="section"
            aria-labelledby="daos-title"
            bg={{base: 'transparent', md: 'hg.card'}}
            borderWidth={{base: '0', md: '1px'}}
            borderColor="hg.hairline"
            borderRadius="hg.lg"
            boxShadow={{base: 'none', md: 'hg.card'}}
            p={{base: '0', md: '22px 24px'}}
            data-testid="daos-section"
        >
            <Flex direction="column" gap="16px">
                <Flex wrap="wrap" align="center" gap={{base: '10px', md: '12px 12px'}}>
                    <chakra.h2 id="daos-title" m="0" fontSize="17px" fontWeight="700" flex="1 1 0" minW="max-content">DAOs</chakra.h2>
                    {wallet && <MineSwitch checked={mine} onChange={(checked) => setFilters({mine: checked})} />}
                    {!filtersHidden && (
                        <>
                            <Box flexBasis={{base: '100%', md: 'auto'}}>
                                <TypeFilter value={query.kind} onChange={(kind) => setFilters({kind})} />
                            </Box>
                            <Box flexBasis={{base: '100%', md: 'auto'}}>
                                <SearchBox value={typed} onChange={setTyped} />
                            </Box>
                        </>
                    )}
                </Flex>

                {reduced && <ReducedListNotice onRetry={list.retry} />}
                {mine && mineResult && <MineNotices result={mineResult} />}

                {failed && (
                    mine ? (
                        <PageState
                            kind="error"
                            title="Your DAOs did not load"
                            description="Reload the page to try again."
                            action={<Button variant="outline" onClick={() => setFilters({mine: false})}>Show all DAOs</Button>}
                        />
                    ) : (
                        <PageState kind="error" title="The DAOs did not load" description="BZE Scan and the chain did not answer." action={<Button variant="outline" onClick={list.retry}>Retry</Button>} />
                    )
                )}

                {empty && emptyState()}

                {!empty && !failed && (
                    <>
                        <DaoTable rows={rows} loading={loading} showRoles={wallet} />
                        <DaoCards rows={rows} loading={loading} />
                    </>
                )}

                {footer()}
            </Flex>
        </Box>
    );
};

/** The home page: the hero, and the DAOs (a table; cards on a phone). */
export const Home = ({deps = liveDaoDeps}: {deps?: DaoDeps}) => (
    <>
        <HeroBand />
        <PageContainer pt={{base: '16px', md: '24px'}} pb={{base: '40px', md: '64px'}}>
            <Suspense fallback={<Box h="240px" aria-hidden />}>
                <DaosSection deps={deps} />
            </Suspense>
        </PageContainer>
    </>
);
