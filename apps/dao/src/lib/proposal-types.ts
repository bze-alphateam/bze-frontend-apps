// BZE Scan's answers for DAO proposals (GET /api/v1/daos/{id}/proposals, /dao-proposals/{id} and
// /dao-proposals/{id}/votes, BFE-354). Times are ISO strings, statuses lower-case chain names, and every
// field but the id can be null on a placeholder row (a deposit release or a cleanup indexed without the
// submission).

export interface ScanLabelRef {
    name: string;
    kind: string;
}

export interface ScanProposalSummary {
    id: number;
    dao_id: number | null;
    title: string | null;
    status: string | null;
    proposer: string | null;
    proposer_label: ScanLabelRef | null;
    expedited: boolean | null;
    submit_time: string | null;
    voting_end: string | null;
    yes: string | null;
    no: string | null;
    abstain: string | null;
    denominator: string | null;
    settled_height: number | null;
    message_types: string[];
}

export interface ScanWeightDenom {
    denom: string;
    symbol: string | null;
    exponent: number | null;
}

export interface ScanProposalChecks {
    regular: {quorum_met: boolean; threshold_met: boolean; passes: boolean};
    expedite: {quorum_met: boolean; yes_met: boolean; passes: boolean} | null;
}

export interface ScanProposalDetail extends ScanProposalSummary {
    dao: {id: number; name: string; type: string} | null;
    summary: string | null;
    msgs: unknown;
    submit_height: number | null;
    submit_tx_hash: string | null;
    pinned_config: unknown;
    voting_ended: boolean;
    expedite_settleable: boolean;
    retry_deadline: string | null;
    settled_tx_hash: string | null;
    expedited_early: boolean | null;
    executed: boolean | null;
    execution_error: string | null;
    deposit_refunded: boolean | null;
    deposit_destination: string | null;
    deposit_amount: string | null;
    cancelled_height: number | null;
    cleaned_height: number | null;
    votes_count: number;
    weight_denom: ScanWeightDenom | null;
    checks: ScanProposalChecks | null;
}

export interface ScanVote {
    voter: string;
    voter_label: ScanLabelRef | null;
    option: string;
    weight: string;
    effective_weight: string;
    height: number;
    tx_hash: string | null;
    time: string;
}

export interface ScanVoteList {
    items: ScanVote[];
    next_cursor: string | null;
    weight_denom: ScanWeightDenom | null;
}

/** Proposals per status (lower-case chain name), over the whole DAO: answered with `page` only. */
export type ScanStatusCounts = Partial<Record<string, number>>;

export interface ScanProposalPage {
    items: ScanProposalSummary[];
    next_cursor: string | null;
    /** The proposals the filter matches; only a Scan with numbered pages answers it, and only with `page`. */
    total?: number | null;
    status_counts?: ScanStatusCounts | null;
}
