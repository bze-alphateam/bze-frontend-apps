import type {DaoCoin, DaoConfig, DaoDepositRefundPolicy, DaoFundsDestination, DaoProposalMessage, DaoProposalResponse, DaoProposalStatus, DaoStakeElectorate} from '@bze/bze-ui-kit';
import {isoFromUnix} from './format';
import type {ScanProposalDetail, ScanProposalSummary, ScanWeightDenom} from './proposal-types';

// One proposal for the pages, whichever side it was read from. While the proposal is on chain the chain is
// the truth (status, tally, pinned rules, the settle flags) and Scan only adds what the chain does not keep
// (how the settle went, where the deposit went, when it was cleaned up). After the chain's cleanup (404)
// Scan alone is the source and the proposal is marked archived.

export const PROPOSAL_STATUSES: readonly DaoProposalStatus[] = ['VOTING', 'REJECTED', 'EXECUTED', 'EXECUTION_FAILED', 'EXPIRED', 'CANCELLED'];

/** Scan's lower-case status as the chain's name; null for a placeholder row or a status this app does not know. */
export function statusFromScan(status: string | null | undefined): DaoProposalStatus | null {
    const upper = (status ?? '').toUpperCase();
    return PROPOSAL_STATUSES.find((s) => s === upper) ?? null;
}

/**
 * The rules pinned at submission as far as they are known. The money rules (refund policy, where a cost
 * or a kept deposit goes) are null when Scan's JSON does not carry a value this app knows: never guessed.
 * A chain `DaoConfig` is always a `PinnedConfig`.
 */
export type PinnedConfig = Omit<DaoConfig, 'deposit_refund_policy' | 'cost_destination' | 'kept_deposit_destination'> & {
    deposit_refund_policy: DaoDepositRefundPolicy | null;
    cost_destination: DaoFundsDestination | null;
    kept_deposit_destination: DaoFundsDestination | null;
};

export interface ProposalTally {
    denominator: string;
    yes: string;
    no: string;
    abstain: string;
}

/** What only Scan knows about a proposal. */
export interface ScanOutcome {
    settledHeight: number | null;
    settledTxHash: string | null;
    executed: boolean | null;
    executionError: string | null;
    expeditedEarly: boolean | null;
    depositRefunded: boolean | null;
    depositDestination: string | null;
    cancelledHeight: number | null;
    cleanedHeight: number | null;
    votesCount: number;
    weightDenom: ScanWeightDenom | null;
    submitTxHash: string | null;
}

export interface ProposalModel {
    id: string;
    daoId: string | null;
    daoName: string | null;
    daoType: string | null;
    title: string;
    summary: string;
    proposer: string;
    expedited: boolean;
    status: DaoProposalStatus;
    /** Read from Scan because the chain no longer has it. */
    archived: boolean;
    /** VOTING and the block time reached `voting_end`: anyone can settle it. */
    votingEnded: boolean;
    /** An expedited proposal whose tally already meets the expedite bars, past the delay. */
    expediteSettleable: boolean;
    /** ISO time a retry of a failed execution is accepted until; null otherwise. */
    retryDeadline: string | null;
    submitTime: string | null;
    submitHeight: string | null;
    votingEnd: string | null;
    msgs: DaoProposalMessage[];
    /** The rules pinned at submission; null when unknown (Scan never saw the proposal on chain). */
    config: PinnedConfig | null;
    electorate: DaoStakeElectorate | null;
    tally: ProposalTally | null;
    /** The deposit escrowed at submission (the pinned deposit). */
    deposit: DaoCoin | null;
    outcome: ScanOutcome | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const snake = (key: string): string => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** A proto JSON object with its top-level keys in snake_case (Scan may send either spelling). */
export const snakeKeys = (value: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(value).map(([k, v]) => [snake(k), v]));

const coinOf = (value: unknown): DaoCoin | null => {
    if (!isObject(value) || typeof value.denom !== 'string') return null;
    const amount = typeof value.amount === 'string' || typeof value.amount === 'number' ? String(value.amount) : '';
    return amount && /^\d+$/.test(amount) ? {denom: value.denom, amount} : null;
};

const destinationOf = (v: unknown): DaoFundsDestination | null => (v === 'BURN' || v === 'TREASURY' ? v : null);

/** A pinned config from Scan's raw JSON; null unless it carries the four ratios the bars need. */
export function configFromScan(raw: unknown): PinnedConfig | null {
    if (!isObject(raw)) return null;
    const c = snakeKeys(raw);
    const text = (k: string, fallback: string) => (typeof c[k] === 'string' ? (c[k] as string) : fallback);
    if (typeof c.min_quorum !== 'string' || typeof c.threshold !== 'string') return null;
    return {
        min_quorum: c.min_quorum,
        threshold: c.threshold,
        voting_period: text('voting_period', '0s'),
        allow_expedite: c.allow_expedite === true,
        expedited_period: text('expedited_period', '0s'),
        expedite_quorum: text('expedite_quorum', '0'),
        expedite_threshold: text('expedite_threshold', '0'),
        open_submission: c.open_submission === true,
        proposal_cost: coinOf(c.proposal_cost),
        proposal_deposit: coinOf(c.proposal_deposit),
        deposit_refund_policy: (['ALWAYS', 'ONLY_PASSED', 'NEVER'] as const).find((p) => p === c.deposit_refund_policy) ?? null,
        cost_destination: destinationOf(c.cost_destination),
        kept_deposit_destination: destinationOf(c.kept_deposit_destination),
    };
}

const messagesOf = (raw: unknown): DaoProposalMessage[] =>
    Array.isArray(raw) ? raw.filter((m): m is DaoProposalMessage => isObject(m) && typeof m['@type'] === 'string') : [];

const tallyOf = (denominator: string | null, yes: string | null, no: string | null, abstain: string | null): ProposalTally | null =>
    denominator !== null && yes !== null && no !== null && abstain !== null && [denominator, yes, no, abstain].every((v) => /^\d+$/.test(v))
        ? {denominator, yes, no, abstain}
        : null;

/** What Scan adds to a proposal that is still on chain. */
export const outcomeOf = (d: ScanProposalDetail): ScanOutcome => ({
    settledHeight: d.settled_height ?? null,
    settledTxHash: d.settled_tx_hash ?? null,
    executed: d.executed ?? null,
    executionError: d.execution_error ?? null,
    expeditedEarly: d.expedited_early ?? null,
    depositRefunded: d.deposit_refunded ?? null,
    depositDestination: d.deposit_destination ?? null,
    cancelledHeight: d.cancelled_height ?? null,
    cleanedHeight: d.cleaned_height ?? null,
    votesCount: d.votes_count ?? 0,
    weightDenom: d.weight_denom ?? null,
    submitTxHash: d.submit_tx_hash ?? null,
});

/** The proposal as the chain answers it, with Scan's extras when Scan answered. */
export function modelFromChain(resp: DaoProposalResponse, scan: ScanProposalDetail | null, daoName: string | null, daoType: string | null): ProposalModel {
    const p = resp.proposal;
    const retry = Number(resp.retry_deadline);
    return {
        id: p.id,
        daoId: p.dao_id,
        daoName: daoName ?? scan?.dao?.name ?? null,
        daoType,
        title: p.title,
        summary: p.summary,
        proposer: p.proposer,
        expedited: p.expedited,
        status: p.status,
        archived: false,
        votingEnded: resp.voting_ended,
        expediteSettleable: resp.expedite_settleable,
        retryDeadline: p.status === 'EXECUTION_FAILED' && retry > 0 ? isoFromUnix(retry) : null,
        submitTime: isoFromUnix(p.submit_time),
        submitHeight: p.submit_height || null,
        votingEnd: isoFromUnix(p.voting_end),
        msgs: p.msgs ?? [],
        config: p.pinned_config ?? null,
        electorate: p.pinned_electorate ?? null,
        tally: tallyOf(p.pinned_denominator, p.yes, p.no, p.abstain),
        deposit: p.pinned_deposit ?? null,
        outcome: scan ? outcomeOf(scan) : null,
    };
}

/** A proposal the chain no longer has, from Scan alone; null for a placeholder row (no status or no submission indexed). */
export function modelFromScan(d: ScanProposalDetail): ProposalModel | null {
    const status = statusFromScan(d.status);
    if (!status || d.title === null || d.proposer === null) return null;
    const config = configFromScan(d.pinned_config);
    return {
        id: String(d.id),
        daoId: d.dao_id === null ? null : String(d.dao_id),
        daoName: d.dao?.name ?? null,
        daoType: d.dao ? (d.dao.type === 'stake' ? 'DAO_TYPE_STAKE' : 'DAO_TYPE_STATIC_LIST') : null,
        title: d.title,
        summary: d.summary ?? '',
        proposer: d.proposer,
        expedited: d.expedited === true,
        status,
        archived: true,
        votingEnded: false,
        expediteSettleable: false,
        retryDeadline: null,
        submitTime: d.submit_time,
        submitHeight: d.submit_height === null ? null : String(d.submit_height),
        votingEnd: d.voting_end,
        msgs: messagesOf(d.msgs),
        config,
        electorate: null,
        tally: tallyOf(d.denominator, d.yes, d.no, d.abstain),
        deposit: config?.proposal_deposit && /[1-9]/.test(config.proposal_deposit.amount) ? config.proposal_deposit : null,
        outcome: outcomeOf(d),
    };
}

/** An item of a proposals list, from either side. */
export interface ProposalRow {
    id: string;
    title: string;
    status: DaoProposalStatus;
    proposer: string;
    votingEnd: string | null;
    expedited: boolean;
    tally: ProposalTally | null;
}

/** A Scan list item as a row; null for a placeholder (no status or title). */
export function rowFromScan(s: ScanProposalSummary): ProposalRow | null {
    const status = statusFromScan(s.status);
    if (!status || s.title === null) return null;
    return {
        id: String(s.id),
        title: s.title,
        status,
        proposer: s.proposer ?? '',
        votingEnd: s.voting_end,
        expedited: s.expedited === true,
        tally: tallyOf(s.denominator, s.yes, s.no, s.abstain),
    };
}

/** A chain proposal as a row. */
export function rowFromChain(p: {id: string; title: string; status: DaoProposalStatus; proposer: string; voting_end: string; expedited: boolean; pinned_denominator: string; yes: string; no: string; abstain: string}): ProposalRow {
    return {
        id: p.id,
        title: p.title,
        status: p.status,
        proposer: p.proposer,
        votingEnd: isoFromUnix(p.voting_end),
        expedited: p.expedited,
        tally: tallyOf(p.pinned_denominator, p.yes, p.no, p.abstain),
    };
}
