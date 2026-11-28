import type {
    Dao, DaoCoin, DaoControllerResponse, DaoParams, DaoProposal, DaoStakeElectorate, DaoVotingPowerResponse,
} from '@bze/bze-ui-kit';
import type {KnownDao} from './dao-control';
import type {DaoPageScan} from './dao-page-scan';
import {createPagingMemory, readScanPage, type PagedPage, type PagePosition} from './paged-list';
import type {ScanDaoDetail, ScanDaoEvent, ScanVoterBallot} from './dao-types';
import type {StakeSource} from './dao-voters';

/** The chain node does not run x/dao (v8.2.x). The composition root maps ui-kit's error to this one. */
export class DaoModuleUnsupported extends Error {
    constructor() {
        super('the node does not run x/dao');
        this.name = 'DaoModuleUnsupported';
    }
}

/** What the DAO page reads from the chain, injected so tests need no network. */
export interface DaoViewChain {
    /** One DAO; null when the chain does not have it. Throws DaoModuleUnsupported on a v8.2.x node. */
    getDao(id: string): Promise<Dao | null>;
    getParams(): Promise<DaoParams>;
    getController(id: string): Promise<DaoControllerResponse | null>;
    /** The DAO that owns an account; null when it is no DAO's. */
    getDaoByAddress(address: string): Promise<Dao | null>;
    /** The account's balances (the treasury, for a DAO's address). */
    getBalances(address: string): Promise<DaoCoin[]>;
    /** The proposals in VOTING. */
    getOpenProposals(id: string): Promise<DaoProposal[]>;
    /** The sources of a stake electorate, with what is staked in each. */
    getStakeSources(electorate: DaoStakeElectorate, daoAddress: string): Promise<StakeSource[]>;
    getVotingPower(id: string, address: string): Promise<DaoVotingPowerResponse | null>;
}

export interface DaoViewDeps {
    chain: DaoViewChain;
    scan: DaoPageScan;
}

/** A part of the page that can fail without taking the rest down. */
export type Part<T> = {ok: true; value: T} | {ok: false};

const settle = <T,>(read: () => Promise<T>): Promise<Part<T>> =>
    read().then((value): Part<T> => ({ok: true, value}), (): Part<T> => ({ok: false}));

/** A DAO id from the URL: a positive integer, else null (the page is "not found", not an error). */
export function parseDaoId(raw: string): string | null {
    return /^[0-9]{1,18}$/.test(raw) && /[1-9]/.test(raw) ? raw.replace(/^0+/, '') : null;
}

export interface DaoView {
    dao: Dao;
    params: Part<DaoParams>;
    controller: Part<DaoControllerResponse | null>;
    /** The DAOs among the addresses of the admin chain (this DAO included), by account address. */
    knownDaos: Map<string, KnownDao>;
    /** Addresses whose by-address lookup failed: not known to be a DAO or not. */
    unresolved: Set<string>;
    treasury: Part<DaoCoin[]>;
    openProposals: Part<DaoProposal[]>;
    /** Null for a static-list DAO and for a stake DAO without sources. */
    sources: Part<StakeSource[]>;
}

export type DaoViewResult =
    | {state: 'unsupported'}
    | {state: 'not-found'}
    | {state: 'ok'; view: DaoView};

/**
 * The live part of a DAO's page: always from the chain. A secondary read that fails leaves its
 * part unavailable and the rest renders. An id that is not a number, or one the chain does not
 * have, is "not found"; a node without x/dao is "unsupported"; any other failure of the DAO read
 * itself is thrown.
 */
export async function loadDaoView(deps: DaoViewDeps, rawId: string): Promise<DaoViewResult> {
    const id = parseDaoId(rawId);
    if (!id) return {state: 'not-found'};

    let dao: Dao | null;
    try {
        dao = await deps.chain.getDao(id);
    } catch (e) {
        if (e instanceof DaoModuleUnsupported) return {state: 'unsupported'};
        throw e;
    }
    if (!dao) return {state: 'not-found'};

    const {chain} = deps;
    const [params, controller, treasury, openProposals] = await Promise.all([
        settle(() => chain.getParams()),
        settle(() => chain.getController(id)),
        settle(() => chain.getBalances(dao.address)),
        settle(() => chain.getOpenProposals(id)),
    ]);
    const sources: Part<StakeSource[]> = dao.electorate
        ? await settle(() => chain.getStakeSources(dao.electorate!, dao.address))
        : {ok: true, value: []};

    const knownDaos = new Map<string, KnownDao>([[dao.address, {id: dao.id, name: dao.name}]]);
    const unresolved = new Set<string>();
    const others = new Set<string>();
    if (dao.admin && dao.admin !== dao.address) others.add(dao.admin);
    if (dao.pending_admin) others.add(dao.pending_admin);
    if (controller.ok && controller.value) controller.value.path.forEach((a) => a !== dao.address && others.add(a));
    await Promise.all([...others].map(async (address) => {
        const found = await settle(() => chain.getDaoByAddress(address));
        if (!found.ok) unresolved.add(address);
        else if (found.value) knownDaos.set(address, {id: found.value.id, name: found.value.name});
    }));

    return {state: 'ok', view: {dao, params, controller, knownDaos, unresolved, treasury, openProposals, sources}};
}

/** What Scan adds: who created the DAO. Null when Scan does not know the DAO (yet). */
export const loadDaoExtras = (deps: DaoViewDeps, id: string): Promise<ScanDaoDetail | null> => deps.scan.daoDetail(id);

export const HISTORY_PAGE = 20;

/** A page of a DAO's history: numbered while Scan answers totals, else by cursor. Scan is its only source. */
export type HistoryPage = PagedPage<ScanDaoEvent, 'scan'>;

// Scan clients whose history answered a `page` request without a total (a Scan before numbered pages).
const historyPaging = createPagingMemory();

/**
 * One page of the DAO's history, newest first: by page number with Scan's `total`; an older Scan, which
 * ignores `page` and answers without a total, is read by cursor from then on (Prev / Next). Throws when
 * Scan does not answer (there is no chain fallback for the history).
 */
export async function loadHistoryPage(deps: DaoViewDeps, id: string, position: PagePosition<'scan'>): Promise<HistoryPage> {
    const read = await readScanPage(historyPaging, deps.scan, position, (at) => deps.scan.history(id, at, HISTORY_PAGE));
    const items = read.answer.items;
    return {state: 'ok', items, returned: items.length, source: 'scan', mode: read.mode, total: read.total, next: read.next};
}

/** The wallet's voting power in the DAO (chain). */
export const loadVotingPower = (deps: DaoViewDeps, id: string, address: string): Promise<DaoVotingPowerResponse | null> =>
    deps.chain.getVotingPower(id, address);

const VOTES_PAGE = 100;
const MAX_VOTE_PAGES = 5;

export interface MyVotes {
    /** The wallet's votes in this DAO, newest first. */
    items: ScanVoterBallot[];
    /** Older votes were not read: the wallet voted in many DAOs. */
    truncated: boolean;
}

/**
 * The wallet's votes in one DAO. Scan lists a voter's votes across all DAOs (no DAO filter), so
 * its pages are read, up to a cap, and filtered here.
 */
export async function loadMyVotes(deps: DaoViewDeps, daoId: string, voter: string): Promise<MyVotes> {
    const items: ScanVoterBallot[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < MAX_VOTE_PAGES; i++) {
        const page = await deps.scan.votesByVoter(voter, cursor, VOTES_PAGE);
        items.push(...page.items.filter((v) => v.dao !== null && String(v.dao.id) === daoId));
        if (!page.next_cursor) return {items, truncated: false};
        cursor = page.next_cursor;
    }
    return {items, truncated: true};
}
