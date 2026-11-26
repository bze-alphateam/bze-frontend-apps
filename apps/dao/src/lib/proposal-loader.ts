import type {
    Dao, DaoBallot, DaoPage, DaoPageRequest, DaoParams, DaoProposal, DaoProposalResponse, DaoProposalStatus,
    DaoStakeElectorate, DaoVoteOption, DaoVotingPowerResponse,
} from '@bze/bze-ui-kit';
import {ScanUnavailableError} from './dao-scan';
import type {DaoProposalScan} from './dao-proposal-scan';
import {DaoModuleUnsupported, parseDaoId, type Part} from './dao-view-loader';
import {
    modelFromChain, modelFromScan, rowFromChain, rowFromScan, statusFromScan,
    type ProposalModel, type ProposalRow,
} from './proposal-model';
import {isOpenStatus} from './proposal-status';
import type {ScanProposalDetail} from './proposal-types';

/** What the proposal pages read from the chain, injected so tests need no network. */
export interface ProposalChain {
    /** The proposal with its live flags; null when the chain does not have it (including after the cleanup). Throws DaoModuleUnsupported on a v8.2.x node. */
    getProposal(id: string): Promise<DaoProposalResponse | null>;
    getDao(id: string): Promise<Dao | null>;
    getParams(): Promise<DaoParams>;
    getBallot(proposalId: string, voter: string): Promise<DaoBallot | null>;
    getBallots(proposalId: string, page: DaoPageRequest): Promise<DaoPage<DaoBallot>>;
    getVotingPower(daoId: string, address: string): Promise<DaoVotingPowerResponse | null>;
    getDaoProposals(daoId: string, statuses: DaoProposalStatus[], page: DaoPageRequest): Promise<DaoPage<DaoProposal>>;
    /** The staking denom the weights of a stake electorate are counted in; null when it cannot be told. */
    getStakingDenom(electorate: DaoStakeElectorate): Promise<string | null>;
}

export interface ProposalDeps {
    chain: ProposalChain;
    scan: DaoProposalScan;
}

const settle = <T,>(read: () => Promise<T>): Promise<Part<T>> =>
    read().then((value): Part<T> => ({ok: true, value}), (): Part<T> => ({ok: false}));

export interface ProposalPageData {
    model: ProposalModel;
    dao: Part<Dao | null>;
    params: Part<DaoParams>;
    /** Scan's answer when it gave one; `scanFailed` when it was asked and did not answer. */
    scanDetail: ScanProposalDetail | null;
    scanFailed: boolean;
    /** The denom a stake DAO's weights are counted in; null for a static list or when unknown. */
    weightDenom: string | null;
}

export type ProposalLoad =
    | {state: 'unsupported'}
    | {state: 'not-found'}
    | {state: 'ok'; data: ProposalPageData};

const isStake = (model: ProposalModel, dao: Part<Dao | null>): boolean =>
    model.daoType === 'DAO_TYPE_STAKE' || (dao.ok && dao.value?.type === 'DAO_TYPE_STAKE');

async function weightDenomOf(deps: ProposalDeps, model: ProposalModel, dao: Part<Dao | null>, scan: ScanProposalDetail | null): Promise<string | null> {
    if (!isStake(model, dao)) return null;
    if (scan?.weight_denom?.denom) return scan.weight_denom.denom;
    const electorate = model.electorate ?? (dao.ok ? dao.value?.electorate : null) ?? null;
    if (!electorate) return null;
    const read = await settle(() => deps.chain.getStakingDenom(electorate));
    return read.ok ? read.value : null;
}

/**
 * The proposal page's reads. While the proposal is on chain the chain is the truth and Scan only adds
 * what the chain does not keep (a Scan that fails leaves `scanFailed` set and the page renders). A chain
 * miss is the cleanup: the proposal is then read from Scan alone and marked archived. Both missing, a
 * placeholder row, or an id that is not a number is "not found". A chain failure is thrown; so is a Scan
 * failure after a chain miss (the page cannot tell "cleaned up" from "never existed").
 */
export async function loadProposal(deps: ProposalDeps, rawId: string): Promise<ProposalLoad> {
    const id = parseDaoId(rawId);
    if (!id) return {state: 'not-found'};

    let onChain: DaoProposalResponse | null;
    try {
        onChain = await deps.chain.getProposal(id);
    } catch (e) {
        if (e instanceof DaoModuleUnsupported) return {state: 'unsupported'};
        throw e;
    }

    let scanDetail: ScanProposalDetail | null = null;
    let scanFailed = false;
    let model: ProposalModel;
    let dao: Part<Dao | null>;
    let params: Part<DaoParams>;

    if (onChain) {
        const daoId = onChain.proposal.dao_id;
        const [scan, daoRead, paramsRead] = await Promise.all([
            settle(() => deps.scan.detail(id)),
            settle(() => deps.chain.getDao(daoId)),
            settle(() => deps.chain.getParams()),
        ]);
        scanFailed = !scan.ok;
        scanDetail = scan.ok ? scan.value : null;
        dao = daoRead;
        params = paramsRead;
        model = modelFromChain(onChain, scanDetail, daoRead.ok ? daoRead.value?.name ?? null : null, daoRead.ok ? daoRead.value?.type ?? null : null);
    } else {
        const detail = await deps.scan.detail(id);
        const archived = detail ? modelFromScan(detail) : null;
        if (!detail || !archived) return {state: 'not-found'};
        scanDetail = detail;
        model = archived;
        [dao, params] = await Promise.all([
            archived.daoId ? settle(() => deps.chain.getDao(archived.daoId!)) : Promise.resolve<Part<Dao | null>>({ok: true, value: null}),
            settle(() => deps.chain.getParams()),
        ]);
        if (dao.ok && dao.value) model = {...model, daoName: dao.value.name, daoType: dao.value.type};
    }

    const weightDenom = await weightDenomOf(deps, model, dao, scanDetail);
    return {state: 'ok', data: {model, dao, params, scanDetail, scanFailed, weightDenom}};
}

/**
 * The poll while the proposal is voting: the chain's answer again, merged over what was loaded (Scan's
 * extras are kept). A failed read or a proposal the chain no longer has leaves the data as it was.
 */
export async function refreshProposal(deps: ProposalDeps, data: ProposalPageData): Promise<ProposalPageData> {
    if (data.model.archived) return data;
    let resp: DaoProposalResponse | null;
    try {
        resp = await deps.chain.getProposal(data.model.id);
    } catch {
        return data;
    }
    if (!resp) return data;
    return mergeChainAnswer(deps, data, resp);
}

/**
 * The re-read after a transaction. Unlike the poll it never hides a failure: a chain error is thrown, and
 * `null` (a chain 404 only) says the chain no longer has the proposal (it was cleaned up), so the caller
 * can switch to the archived view.
 */
export async function reloadProposalAfterTx(deps: ProposalDeps, data: ProposalPageData): Promise<ProposalPageData | null> {
    if (data.model.archived) return data;
    const resp = await deps.chain.getProposal(data.model.id);
    return resp ? mergeChainAnswer(deps, data, resp) : null;
}

async function mergeChainAnswer(deps: ProposalDeps, data: ProposalPageData, resp: DaoProposalResponse): Promise<ProposalPageData> {
    const dao = data.dao.ok ? data.dao.value : null;
    // a status change (settled, executed, cancelled…) brings facts only Scan has: read them again
    let {scanDetail, scanFailed} = data;
    if (resp.proposal.status !== data.model.status) {
        const fresh = await settle(() => deps.scan.detail(data.model.id));
        if (fresh.ok) {
            scanDetail = fresh.value;
            scanFailed = false;
        }
    }
    return {...data, scanDetail, scanFailed, model: modelFromChain(resp, scanDetail, dao?.name ?? null, dao?.type ?? data.model.daoType)};
}

// ---- votes ----

export type VoteFilter = 'YES' | 'NO' | 'ABSTAIN';

export interface VoteRow {
    voter: string;
    /** Scan's name for the voter, when it has one. */
    name: string | null;
    option: VoteFilter;
    /** The weight when cast. */
    weight: string;
    /** What is left of it after the reductions since (a voter leaving the stake, a member removed). */
    effectiveWeight: string;
    time: string | null;
    txHash: string | null;
}

export interface VotesCursor {
    source: 'scan' | 'chain';
    key: string;
}

export interface VotesPage {
    rows: VoteRow[];
    next: VotesCursor | null;
    source: 'scan' | 'chain';
}

export const VOTES_PAGE = 20;
const MAX_CHAIN_PAGES = 5;

const voteOption = (o: string): VoteFilter | null => {
    const upper = o.toUpperCase().replace(/^VOTE_OPTION_/, '');
    return upper === 'YES' || upper === 'NO' || upper === 'ABSTAIN' ? upper : null;
};

/**
 * One page of a proposal's votes: Scan (heaviest effective weight first, with the option filter), and
 * with Scan down the chain's ballots (by voter, the filter applied to the page). A cursor keeps its source.
 */
export async function loadVotes(deps: ProposalDeps, proposalId: string, filter: VoteFilter | null, cursor: VotesCursor | null): Promise<VotesPage> {
    if (!cursor || cursor.source === 'scan') {
        try {
            const page = await deps.scan.votes(proposalId, filter ? filter.toLowerCase() : null, cursor?.key ?? null, VOTES_PAGE);
            const rows: VoteRow[] = [];
            for (const v of page?.items ?? []) {
                const option = voteOption(v.option);
                if (option) rows.push({voter: v.voter, name: v.voter_label?.name ?? null, option, weight: v.weight, effectiveWeight: v.effective_weight, time: v.time, txHash: v.tx_hash});
            }
            return {rows, next: page?.next_cursor ? {source: 'scan', key: page.next_cursor} : null, source: 'scan'};
        } catch (e) {
            if (!(e instanceof ScanUnavailableError) || cursor) throw e;
        }
    }

    // the chain cannot filter: keep reading past pages the filter empties (a few requests at most)
    const rows: VoteRow[] = [];
    let key: string | null = cursor?.key ?? null;
    for (let i = 0; i < MAX_CHAIN_PAGES; i++) {
        const page = await deps.chain.getBallots(proposalId, {key: key ?? undefined, limit: VOTES_PAGE});
        for (const b of page.items) {
            const option = voteOption(b.option);
            if (option && (!filter || option === filter)) rows.push({voter: b.voter, name: null, option, weight: b.weight, effectiveWeight: b.weight, time: null, txHash: null});
        }
        key = page.nextKey;
        if (!key || rows.length > 0) break;
    }
    return {rows, next: key ? {source: 'chain', key} : null, source: 'chain'};
}

// ---- the wallet's vote ----

export interface MyVote {
    ballot: DaoBallot | null;
    /** The weight a vote would count now; null when it is not known (not voting, or the read failed). */
    eligibleWeight: string | null;
}

/**
 * The wallet's ballot (null only when the chain says there is none: a failed read throws, so the page
 * never claims "not voted" on a failure) and, while the proposal is voting, the weight a vote of it counts.
 */
export async function loadMyVote(deps: ProposalDeps, model: Pick<ProposalModel, 'id' | 'daoId' | 'status'>, wallet: string): Promise<MyVote> {
    const voting = model.status === 'VOTING' && model.daoId !== null;
    const [ballot, power] = await Promise.all([
        deps.chain.getBallot(model.id, wallet),
        voting ? settle(() => deps.chain.getVotingPower(model.daoId!, wallet)) : Promise.resolve<Part<DaoVotingPowerResponse | null>>({ok: false}),
    ]);
    const entry = power.ok ? power.value?.proposals.find((p) => p.proposal_id === model.id) : undefined;
    return {ballot, eligibleWeight: entry ? entry.eligible_weight : null};
}

/** Why a wallet cannot vote with weight 0, for the DAO's kind. */
export const noWeightReason = (daoType: string | null): string =>
    daoType === 'DAO_TYPE_STAKE'
        ? 'Your stake joined after this proposal started, or it is not in one of the DAO\'s staking sources, so it does not count here.'
        : 'You were not a member of the DAO when this proposal started, so you cannot vote on it.';

export const optionLabel = (option: DaoVoteOption | VoteFilter): string =>
    ({YES: 'Yes', NO: 'No', ABSTAIN: 'Abstain', VOTE_OPTION_UNSPECIFIED: 'None'} as const)[option];

// ---- a DAO's proposals ----

export const PROPOSALS_PAGE = 20;
const MAX_READS = 5;

const byIdDesc = (a: ProposalRow, b: ProposalRow): number => Number(BigInt(b.id) - BigInt(a.id));

export interface ActiveProposals {
    rows: ProposalRow[];
    source: 'scan' | 'chain';
}

/**
 * The proposals still moving: in voting, or passed with a failed execution. Scan lists one status per
 * request, so both are read and merged newest first; with Scan down the chain lists both at once.
 */
export async function loadActiveProposals(deps: ProposalDeps, daoId: string): Promise<ActiveProposals> {
    try {
        const read = async (status: string): Promise<ProposalRow[]> => {
            const rows: ProposalRow[] = [];
            let cursor: string | null = null;
            for (let i = 0; i < MAX_READS; i++) {
                const page = await deps.scan.listForDao(daoId, status, cursor, 50);
                for (const item of page.items) {
                    const row = rowFromScan(item);
                    if (row) rows.push(row);
                }
                if (!page.next_cursor) break;
                cursor = page.next_cursor;
            }
            return rows;
        };
        const [voting, failed] = await Promise.all([read('voting'), read('execution_failed')]);
        return {rows: [...voting, ...failed].sort(byIdDesc), source: 'scan'};
    } catch (e) {
        if (!(e instanceof ScanUnavailableError)) throw e;
    }

    const page = await deps.chain.getDaoProposals(daoId, ['VOTING', 'EXECUTION_FAILED'], {limit: 50, reverse: true});
    return {rows: page.items.map(rowFromChain).sort(byIdDesc), source: 'chain'};
}

export interface FinishedProposals {
    rows: ProposalRow[];
    next: string | null;
}

/**
 * A page of the finished proposals (every status but voting and a failed execution), newest first. Scan
 * cannot filter "the rest", so it lists everything and the moving ones are left out here; a page that
 * filters down to little keeps reading (up to a few requests). Throws when Scan does not answer.
 */
export async function loadFinishedProposals(deps: ProposalDeps, daoId: string, cursor: string | null): Promise<FinishedProposals> {
    const rows: ProposalRow[] = [];
    let next = cursor;
    for (let i = 0; i < MAX_READS; i++) {
        const page = await deps.scan.listForDao(daoId, null, next, PROPOSALS_PAGE);
        for (const item of page.items) {
            const status = statusFromScan(item.status);
            if (!status || isOpenStatus(status)) continue;
            const row = rowFromScan(item);
            if (row) rows.push(row);
        }
        next = page.next_cursor;
        if (!next || rows.length >= PROPOSALS_PAGE / 2) break;
    }
    return {rows, next};
}
