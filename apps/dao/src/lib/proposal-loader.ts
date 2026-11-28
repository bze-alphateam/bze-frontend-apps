import type {
    Dao, DaoBallot, DaoPage, DaoPageRequest, DaoParams, DaoProposal, DaoProposalResponse, DaoProposalStatus,
    DaoStakeElectorate, DaoVoteOption, DaoVotingPowerResponse,
} from '@bze/bze-ui-kit';
import {ScanUnavailableError} from './dao-scan';
import type {DaoProposalScan} from './dao-proposal-scan';
import {createPagingMemory, isLaterPage, readScanPage, type PagedPage, type PagePosition} from './paged-list';
import {DaoModuleUnsupported, parseDaoId, type Part} from './dao-view-loader';
import {modelFromChain, modelFromScan, type ProposalModel} from './proposal-model';
import type {ScanOptionCounts, ScanProposalDetail, ScanVoteList} from './proposal-types';

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
    /** The address's stake now in every x/rewards position it holds, keyed as x/dao sources (`sr/{reward_id}`, `dr/{staking_denom}`). */
    getStakes(address: string): Promise<{source: string; amount: string}[]>;
    /** The height the address joined (or last added to) a source at; null when the chain has no join record. */
    getJoinHeight(source: string, address: string): Promise<string | null>;
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

/**
 * What the chain says of the DAOs a proposal's actions name by number: name and account. A DAO the chain does
 * not have, or that fails to read, is left out (the preview then shows its number).
 */
export async function loadDaoRefs(deps: ProposalDeps, ids: readonly string[]): Promise<Record<string, {name?: string; address?: string}>> {
    const reads = await Promise.all(ids.map((id) => settle(() => deps.chain.getDao(id))));
    const refs: Record<string, {name?: string; address?: string}> = {};
    reads.forEach((read, i) => {
        const dao = read.ok ? read.value : null;
        if (dao && (dao.name || dao.address)) refs[ids[i]] = {name: dao.name || undefined, address: dao.address || undefined};
    });
    return refs;
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

/** One page of a proposal's votes, with Scan's ballots per option when it gave them (numbered pages only). */
export type VotesPage = PagedPage<VoteRow, 'scan' | 'chain'> & {counts: ScanOptionCounts | null};

export const VOTES_PAGE = 20;
const MAX_CHAIN_PAGES = 5;

// Scan clients whose votes answered a `page` request without a total (a Scan before numbered pages).
const votesPaging = createPagingMemory();

const voteOption = (o: string): VoteFilter | null => {
    const upper = o.toUpperCase().replace(/^VOTE_OPTION_/, '');
    return upper === 'YES' || upper === 'NO' || upper === 'ABSTAIN' ? upper : null;
};

/** Scan does not know the proposal (yet): an empty answer that says nothing about Scan's paging. */
const UNKNOWN: ScanVoteList & {unknown: true} = {items: [], next_cursor: null, weight_denom: null, total: null, option_counts: null, unknown: true};

/** The chain's ballots by voter (key paged); it cannot filter, so it reads past pages the filter empties (a few requests at most). */
async function chainVotes(deps: ProposalDeps, proposalId: string, filter: VoteFilter | null, key: string | null): Promise<VotesPage> {
    const rows: VoteRow[] = [];
    let returned = 0;
    for (let i = 0; i < MAX_CHAIN_PAGES; i++) {
        const page = await deps.chain.getBallots(proposalId, {key: key ?? undefined, limit: VOTES_PAGE});
        returned += page.items.length;
        for (const b of page.items) {
            const option = voteOption(b.option);
            if (option && (!filter || option === filter)) rows.push({voter: b.voter, name: null, option, weight: b.weight, effectiveWeight: b.weight, time: null, txHash: null});
        }
        key = page.nextKey;
        if (!key || rows.length > 0) break;
    }
    return {state: 'ok', items: rows, returned, source: 'chain', mode: 'cursor', total: null, next: key, counts: null};
}

/**
 * One page of a proposal's votes. Scan by page number (heaviest effective weight first, with the option
 * filter, `total` and the ballots per option); an older Scan, which ignores `page` and answers without a
 * total, by cursor (remembered per client). With Scan down the first page falls back to the chain's
 * ballots (by voter, Prev / Next by key, no names); a later page never falls back, and a list that
 * started on the chain stays there.
 */
export async function loadVotesPage(deps: ProposalDeps, proposalId: string, filter: VoteFilter | null, position: PagePosition<'scan' | 'chain'>): Promise<VotesPage> {
    if (position.source === 'chain') return chainVotes(deps, proposalId, filter, position.cursor ?? null);
    try {
        const read = await readScanPage<ScanVoteList & {unknown?: true}>(
            votesPaging,
            deps.scan,
            position,
            async (at) => (await deps.scan.votes(proposalId, {option: filter ? filter.toLowerCase() : null, ...at, limit: VOTES_PAGE})) ?? UNKNOWN,
            (answer) => !answer.unknown,
        );
        const rows: VoteRow[] = [];
        for (const v of read.answer.items) {
            const option = voteOption(v.option);
            if (option) rows.push({voter: v.voter, name: v.voter_label?.name ?? null, option, weight: v.weight, effectiveWeight: v.effective_weight, time: v.time, txHash: v.tx_hash});
        }
        return {
            state: 'ok',
            items: rows,
            returned: read.answer.items.length,
            source: 'scan',
            mode: read.mode,
            total: read.total,
            next: read.next,
            counts: read.mode === 'pages' ? read.answer.option_counts ?? null : null,
        };
    } catch (e) {
        if (!(e instanceof ScanUnavailableError) || isLaterPage(position)) throw e;
        return chainVotes(deps, proposalId, filter, null);
    }
}

// ---- the wallet's vote ----

/** Stake of the wallet in one of the proposal's pinned sources that its vote does not count. */
export interface NotCounted {
    /** `sr/{reward_id}` or `dr/{staking_denom}`. */
    source: string;
    amount: string;
}

export interface MyVote {
    ballot: DaoBallot | null;
    /** The weight a vote would count now; null when it is not known (not voting, or the read failed). */
    eligibleWeight: string | null;
    /**
     * Stake DAOs while voting: the stake in a pinned source that does not count because the wallet joined or added
     * to it at or after the proposal's submit block. Empty when there is none or it could not be read.
     */
    notCounted: NotCounted[];
}

const big = (v: string | undefined): bigint => (v && /^\d+$/.test(v) ? BigInt(v) : BigInt(0));

const pinnedSources = (electorate: DaoStakeElectorate): string[] => [
    ...electorate.sr_ids.map((id) => `sr/${id}`),
    ...(electorate.dr_denom ? [`dr/${electorate.dr_denom}`] : []),
];

/**
 * What the wallet holds in each pinned source minus what the chain counted for it (`shares`), where the join
 * record says why: the chain leaves a source out when the wallet joined it, or added to it (a top-up moves the
 * join height), at or after the submit block. Any read that fails leaves the list empty: it never claims a reason.
 */
async function notCountedOf(
    deps: ProposalDeps,
    model: Pick<ProposalModel, 'electorate' | 'submitHeight'>,
    wallet: string,
    shares: {source: string; amount: string}[],
): Promise<NotCounted[]> {
    const {electorate, submitHeight} = model;
    if (!electorate || !submitHeight || !/^\d+$/.test(submitHeight)) return [];
    try {
        const stakes = await deps.chain.getStakes(wallet);
        const left = pinnedSources(electorate).flatMap((source): NotCounted[] => {
            const held = stakes.filter((s) => s.source === source).reduce((sum, s) => sum + big(s.amount), BigInt(0));
            const counted = shares.filter((s) => s.source === source).reduce((sum, s) => sum + big(s.amount), BigInt(0));
            return held > counted ? [{source, amount: (held - counted).toString()}] : [];
        });
        const joined = await Promise.all(left.map((n) => deps.chain.getJoinHeight(n.source, wallet)));
        return left.filter((_, i) => {
            const height = joined[i];
            return height !== null && /^\d+$/.test(height) && BigInt(height) >= BigInt(submitHeight);
        });
    } catch {
        return [];
    }
}

/**
 * The wallet's ballot (null only when the chain says there is none: a failed read throws, so the page
 * never claims "not voted" on a failure) and, while the proposal is voting, the weight a vote of it counts
 * and, in a stake DAO, the stake it holds that does not count.
 */
export async function loadMyVote(
    deps: ProposalDeps,
    model: Pick<ProposalModel, 'id' | 'daoId' | 'status' | 'daoType' | 'electorate' | 'submitHeight'>,
    wallet: string,
): Promise<MyVote> {
    const voting = model.status === 'VOTING' && model.daoId !== null;
    const [ballot, power] = await Promise.all([
        deps.chain.getBallot(model.id, wallet),
        voting ? settle(() => deps.chain.getVotingPower(model.daoId!, wallet)) : Promise.resolve<Part<DaoVotingPowerResponse | null>>({ok: false}),
    ]);
    const entry = power.ok ? power.value?.proposals.find((p) => p.proposal_id === model.id) : undefined;
    const notCounted = entry && model.daoType === 'DAO_TYPE_STAKE' ? await notCountedOf(deps, model, wallet, entry.shares) : [];
    return {ballot, eligibleWeight: entry ? entry.eligible_weight : null, notCounted};
}

/** The line under My vote for stake that does not count on this proposal. */
export const notCountedLine = (amount: string, source: string): string =>
    `${amount} in ${source} doesn't count: you joined or added to it after this proposal started.`;

/** Why a wallet cannot vote with weight 0, for the DAO's kind. */
export const noWeightReason = (daoType: string | null): string =>
    daoType === 'DAO_TYPE_STAKE'
        ? 'You joined or added to your stake after this proposal started, or it is not in one of the DAO\'s staking sources, so it does not count here.'
        : 'You were not a member of the DAO when this proposal started, so you cannot vote on it.';

export const optionLabel = (option: DaoVoteOption | VoteFilter): string =>
    ({YES: 'Yes', NO: 'No', ABSTAIN: 'Abstain', VOTE_OPTION_UNSPECIFIED: 'None'} as const)[option];
