import type {Dao, DaoPage, DaoPageRequest} from '@bze/bze-ui-kit';
import {cardFromChain, cardFromScan, matchesFilter} from './dao-cards';
import {SOURCES_PER_REQUEST, type DaoScanClient} from './dao-scan';
import type {DaoCard, DaoKind, MyDaoRow} from './dao-types';
import {searchTerm} from './home-query';
import {buildMyDaos} from './my-daos';
import {stakerSources, type DenomRewardParticipation, type StakingRewardParticipation} from './staker-sources';

/** What the loaders read besides Scan: the chain's x/dao and x/rewards queries, injected so tests need no network. */
export interface DaoChain {
    /** Whether the node runs x/dao (v8.3.0). Throws on a network failure. */
    isSupported(): Promise<boolean>;
    getDaos(page?: DaoPageRequest): Promise<DaoPage<Dao>>;
    getDaosByAdmin(admin: string, page?: DaoPageRequest): Promise<DaoPage<Dao>>;
    /** One DAO; null only for the chain's "not found". Every other failure throws. */
    getDao(id: string): Promise<Dao | null>;
    stakingRewardParticipations(address: string): Promise<StakingRewardParticipation[]>;
    denomRewardParticipations(address: string): Promise<DenomRewardParticipation[]>;
}

export interface DaoDeps {
    scan: DaoScanClient;
    chain: DaoChain;
}

export const PAGE_SIZE = 20;
const CHAIN_PAGE_LIMIT = 50;
const MAX_ADMIN_PAGES = 10;

export interface DaoFilter {
    kind: DaoKind | '';
    /** Name search as typed. */
    search: string;
}

/** Where a page is read from: a numbered page (Scan with BFE-423), or the cursor / key after the page before it. */
export interface DaoPagePosition {
    /** 1-based; used while Scan answers numbered pages. */
    page: number;
    /** The cursor (Scan) or key (chain) of the page after the one before; null for the first. */
    cursor?: string | null;
    /** Where the list started, once it has: a later page never switches source. */
    source?: 'scan' | 'chain';
}

export type DaoListResult =
    | {state: 'unsupported'}
    | {
        state: 'ok';
        items: DaoCard[];
        /** How many rows the source returned, before the search ran on the page (an older Scan): 0 on a page past the end. */
        returned: number;
        /** Where the page came from: the chain fallback has no filters on its side and no open counts. */
        source: 'scan' | 'chain';
        /** `pages`: numbered, `total` known. `cursor`: only the page after this one (an older Scan, the chain). */
        mode: 'pages' | 'cursor';
        /** The DAOs the filters match across every page; set in `pages` mode only. */
        total: number | null;
        /** Pass back as the cursor to read the page after this one; null on the last (`cursor` mode). */
        next: string | null;
    };

// Scan clients that answered a `page` request without a total (a Scan before BFE-423): their lists are
// read by cursor from then on, without asking again. Kept per client, like the filters probe.
const withoutTotals = new WeakSet<DaoScanClient>();

/**
 * One page of the All DAOs list. Scan first, by page number, with its total. A Scan that answers a
 * `page` request without a total ignores `page` and answers the first cursor page: the list is then
 * read by cursor (remembered), and the page in the URL does not count. With Scan down the chain's
 * own list is read (paged by key, no filters, no total). A v8.2.x node, told by Scan's
 * `supported: false` or by the chain itself, is the "unsupported" state; when neither answers, the
 * error is thrown.
 */
export async function loadDaoPage(deps: DaoDeps, filter: DaoFilter, position: DaoPagePosition): Promise<DaoListResult> {
    const cursor = position.cursor ?? null;
    if (position.source === 'chain') return loadChainPage(deps, cursor);

    try {
        const withFilters = (await deps.scan.filtersSupported()) === 'yes';
        const q = withFilters ? searchTerm(filter.search) : '';
        const numbered = !withoutTotals.has(deps.scan);
        const list = await deps.scan.listDaos({
            type: filter.kind || undefined,
            q: q || undefined,
            ...(numbered ? {page: position.page} : {cursor}),
            limit: PAGE_SIZE,
        });
        if (!list.supported) return {state: 'unsupported'};
        // A Scan without BFE-368 ignores `q`: the search runs on the page here.
        const items = list.items.map(cardFromScan).filter((c) => withFilters || matchesFilter(c, '', searchTerm(filter.search)));
        if (numbered && list.total !== null) {
            return {state: 'ok', items, returned: list.items.length, source: 'scan', mode: 'pages', total: list.total, next: null};
        }
        if (numbered) withoutTotals.add(deps.scan);
        return {state: 'ok', items, returned: list.items.length, source: 'scan', mode: 'cursor', total: null, next: list.next_cursor};
    } catch (scanError) {
        if (cursor) throw scanError; // a later page never switches source mid-list
        return loadChainPage(deps, null);
    }
}

async function loadChainPage(deps: DaoDeps, key: string | null): Promise<DaoListResult> {
    if (!(await deps.chain.isSupported())) return {state: 'unsupported'};
    const page = await deps.chain.getDaos({key: key ?? undefined, limit: CHAIN_PAGE_LIMIT, reverse: true});
    // The chain cannot filter and filtering 50-row pages here would give uneven pages: the list is unfiltered.
    return {state: 'ok', items: page.items.map(cardFromChain), returned: page.items.length, source: 'chain', mode: 'cursor', total: null, next: page.nextKey};
}

export interface MyDaosResult {
    rows: MyDaoRow[];
    /** The wallet's admin DAOs could not be read: the list may be missing some. */
    adminFailed: boolean;
    /** Scan runs without the member / staker filters (before BFE-368): only the admin DAOs can be listed. */
    onlyAdmin: boolean;
    /** The DAOs that nominated the wallet could not be read (Scan, or the chain confirming them). */
    nominatedFailed: boolean;
    /** The DAOs the wallet joined could not be read (Scan unreachable or failing). */
    memberFailed: boolean;
    /** The DAOs the wallet stakes in could not be read (Scan, or the x/rewards queries). */
    stakerFailed: boolean;
}

async function adminDaos(chain: DaoChain, address: string): Promise<DaoCard[]> {
    const cards: DaoCard[] = [];
    let key: string | undefined;
    for (let i = 0; i < MAX_ADMIN_PAGES; i++) {
        const page = await chain.getDaosByAdmin(address, {key, limit: CHAIN_PAGE_LIMIT});
        cards.push(...page.items.map(cardFromChain));
        if (!page.nextKey) break;
        key = page.nextKey;
    }
    return cards;
}

/** Every page of a Scan list; a list that is still going after the page cap is an error, never a short list. */
async function everyScanPage(read: (cursor: string | null) => Promise<{items: DaoCard[]; next: string | null}>): Promise<DaoCard[]> {
    const cards: DaoCard[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < MAX_ADMIN_PAGES; i++) {
        const page = await read(cursor);
        cards.push(...page.items);
        if (!page.next) return cards;
        cursor = page.next;
    }
    throw new Error('the list is longer than the pages that are read');
}

/** The DAOs that nominated the wallet: Scan names the candidates, the chain's own `pending_admin` decides. */
async function nominatedDaos(deps: DaoDeps, address: string): Promise<DaoCard[]> {
    const candidates = await everyScanPage(async (cursor) => {
        const list = await deps.scan.listDaos({pendingAdmin: address, cursor, limit: 100});
        return {items: list.items.map(cardFromScan), next: list.next_cursor};
    });
    const read = await Promise.all(candidates.map((card) => deps.chain.getDao(card.id)));
    return read.flatMap((dao) => (dao && dao.pending_admin.toLowerCase() === address.toLowerCase() ? [cardFromChain(dao)] : []));
}

async function allScanPages(read: (cursor: string | null) => Promise<{items: DaoCard[]; next: string | null}>): Promise<DaoCard[]> {
    const cards: DaoCard[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < MAX_ADMIN_PAGES; i++) {
        const page = await read(cursor);
        cards.push(...page.items);
        if (!page.next) break;
        cursor = page.next;
    }
    return cards;
}

/**
 * The DAOs of a wallet: administered (chain), joined (Scan `member`) and staked in (Scan
 * `source`, from the wallet's x/rewards positions). Without the Scan filters, or with Scan or
 * x/rewards failing, the rest still lists.
 */
export async function loadMyDaos(deps: DaoDeps, address: string): Promise<MyDaosResult> {
    const settle = (read: () => Promise<DaoCard[]>) => read().then((cards) => ({cards, failed: false}), () => ({cards: [] as DaoCard[], failed: true}));

    const adminPromise = settle(() => adminDaos(deps.chain, address));
    const support = await deps.scan.filtersSupported();
    const memberPromise = support === 'yes'
        ? settle(() => allScanPages(async (cursor) => {
            const list = await deps.scan.listDaos({member: address, cursor, limit: 100});
            return {items: list.items.map(cardFromScan), next: list.next_cursor};
        }))
        : Promise.resolve({cards: [] as DaoCard[], failed: support === 'unknown'});
    const nominatedPromise = support === 'yes'
        ? settle(() => nominatedDaos(deps, address))
        : Promise.resolve({cards: [] as DaoCard[], failed: support === 'unknown'});
    const stakerPromise = support === 'yes'
        ? settle(() => loadStakerDaos(deps, address))
        : Promise.resolve({cards: [] as DaoCard[], failed: support === 'unknown'});

    const [admin, nominated, member, staker] = await Promise.all([adminPromise, nominatedPromise, memberPromise, stakerPromise]);
    return {
        rows: buildMyDaos({admin: admin.cards, nominated: nominated.cards, member: member.cards, staker: staker.cards}),
        adminFailed: admin.failed,
        onlyAdmin: support === 'no',
        nominatedFailed: nominated.failed,
        memberFailed: member.failed,
        stakerFailed: staker.failed,
    };
}

async function loadStakerDaos(deps: DaoDeps, address: string): Promise<DaoCard[]> {
    const [sr, dr] = await Promise.all([deps.chain.stakingRewardParticipations(address), deps.chain.denomRewardParticipations(address)]);
    const sources = stakerSources(sr, dr);
    const found = new Map<string, DaoCard>();
    for (let i = 0; i < sources.length; i += SOURCES_PER_REQUEST) {
        const chunk = sources.slice(i, i + SOURCES_PER_REQUEST);
        const cards = await allScanPages(async (cursor) => {
            const list = await deps.scan.listDaos({sources: chunk, cursor, limit: 100});
            return {items: list.items.map(cardFromScan), next: list.next_cursor};
        });
        for (const card of cards) found.set(card.id, card);
    }
    return [...found.values()];
}
