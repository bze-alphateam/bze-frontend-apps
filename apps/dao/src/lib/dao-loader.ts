import type {Dao, DaoPage, DaoPageRequest} from '@bze/bze-ui-kit';
import {cardFromChain, cardFromScan, matchesFilter} from './dao-cards';
import {SOURCES_PER_REQUEST, type DaoScanClient} from './dao-scan';
import type {DaoCard, DaoKind, MyDaoRow, ScanOpenProposal} from './dao-types';
import {buildMyDaos} from './my-daos';
import {stakerSources, type DenomRewardParticipation, type StakingRewardParticipation} from './staker-sources';

/** What the loaders read besides Scan: the chain's x/dao and x/rewards queries, injected so tests need no network. */
export interface DaoChain {
    /** Whether the node runs x/dao (v8.3.0). Throws on a network failure. */
    isSupported(): Promise<boolean>;
    getDaos(page?: DaoPageRequest): Promise<DaoPage<Dao>>;
    getDaosByAdmin(admin: string, page?: DaoPageRequest): Promise<DaoPage<Dao>>;
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

export type DaoListResult =
    | {state: 'unsupported'}
    | {
        state: 'ok';
        items: DaoCard[];
        /** Pass back to read the next page; null on the last. */
        next: string | null;
        /** Where the page came from: the chain fallback has no filters on its side and no open counts. */
        source: 'scan' | 'chain';
    };

const searchTerm = (search: string): string => {
    const q = search.trim();
    return q.length >= 2 ? q : '';
};

/**
 * One page of the All DAOs list. Scan first; with Scan down the chain's own list (paginated, no
 * filters, so the filter runs here). A v8.2.x node, told by Scan's `supported: false` or by the
 * chain itself, is the "unsupported" state; when neither answers, the error is thrown.
 */
export async function loadDaoPage(deps: DaoDeps, filter: DaoFilter, cursor: string | null, source?: 'scan' | 'chain'): Promise<DaoListResult> {
    if (source !== 'chain') {
        try {
            const withFilters = (await deps.scan.filtersSupported()) === 'yes';
            const q = withFilters ? searchTerm(filter.search) : '';
            const list = await deps.scan.listDaos({type: filter.kind || undefined, q: q || undefined, cursor, limit: PAGE_SIZE});
            if (!list.supported) return {state: 'unsupported'};
            // A Scan without BFE-368 ignores `q`: the search runs on the page here.
            const items = list.items.map(cardFromScan).filter((c) => withFilters || matchesFilter(c, '', filter.search));
            return {state: 'ok', items, next: list.next_cursor, source: 'scan'};
        } catch (scanError) {
            if (cursor) throw scanError; // a later page never switches source mid-list
            return loadChainPage(deps, filter, null);
        }
    }
    return loadChainPage(deps, filter, cursor);
}

async function loadChainPage(deps: DaoDeps, filter: DaoFilter, key: string | null): Promise<DaoListResult> {
    if (!(await deps.chain.isSupported())) return {state: 'unsupported'};
    const page = await deps.chain.getDaos({key: key ?? undefined, limit: CHAIN_PAGE_LIMIT, reverse: true});
    const items = page.items.map(cardFromChain).filter((c) => matchesFilter(c, filter.kind, filter.search));
    return {state: 'ok', items, next: page.nextKey, source: 'chain'};
}

/** The open proposals of all DAOs, soonest end first. Empty when Scan lacks the route (before BFE-368) or is down. */
export async function loadOpenProposals(deps: DaoDeps): Promise<ScanOpenProposal[]> {
    try {
        if ((await deps.scan.filtersSupported()) !== 'yes') return [];
        const list = await deps.scan.openProposals(null, 10);
        return list.supported ? list.items : [];
    } catch {
        return [];
    }
}

export interface MyDaosResult {
    rows: MyDaoRow[];
    /** The wallet's admin DAOs could not be read: the list may be missing some. */
    adminFailed: boolean;
    /** Scan runs without the member / staker filters (before BFE-368): only the admin DAOs can be listed. */
    onlyAdmin: boolean;
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
    const stakerPromise = support === 'yes'
        ? settle(() => loadStakerDaos(deps, address))
        : Promise.resolve({cards: [] as DaoCard[], failed: support === 'unknown'});

    const [admin, member, staker] = await Promise.all([adminPromise, memberPromise, stakerPromise]);
    return {
        rows: buildMyDaos({admin: admin.cards, member: member.cards, staker: staker.cards}),
        adminFailed: admin.failed,
        onlyAdmin: support === 'no',
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
