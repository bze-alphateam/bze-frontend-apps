// x/dao objects (chain v8.3.0) as the chain's REST gateway answers them. The
// bzejs `*SDKType` interfaces describe the decoded protobuf (bigint ids, numeric
// enums, Duration objects); the REST gateway returns JSON instead, so these
// types follow the wire: snake_case proto field names, every default present,
// enums as their names, ids, amounts and int64 values (unix seconds, heights)
// as strings, `cosmos.Dec` ratios as 18-decimal strings ("0.400000000000000000")
// and durations as "259200s".
//
// Optional sub-messages (`electorate`, the config coins, `pinned_electorate`,
// `pinned_deposit`) are typed nullable: the gateway may send them as null or
// leave them out.

export type DaoType = 'DAO_TYPE_STATIC_LIST' | 'DAO_TYPE_STAKE';

export type DaoDepositRefundPolicy = 'ALWAYS' | 'ONLY_PASSED' | 'NEVER';

export type DaoFundsDestination = 'BURN' | 'TREASURY';

export type DaoVoteOption = 'VOTE_OPTION_UNSPECIFIED' | 'YES' | 'NO' | 'ABSTAIN';

export type DaoProposalStatus =
    | 'VOTING'
    | 'REJECTED'
    | 'EXECUTED'
    | 'EXECUTION_FAILED'
    | 'EXPIRED'
    | 'CANCELLED';

export type DaoControllerEndReason = 'ACCOUNT' | 'SELF_OWNED' | 'CYCLE' | 'DEPTH_CAP';

export interface DaoCoin {
    denom: string;
    amount: string;
}

export interface DaoConfig {
    min_quorum: string;
    threshold: string;
    voting_period: string;
    allow_expedite: boolean;
    expedited_period: string;
    expedite_quorum: string;
    expedite_threshold: string;
    open_submission: boolean;
    proposal_cost?: DaoCoin | null;
    proposal_deposit?: DaoCoin | null;
    deposit_refund_policy: DaoDepositRefundPolicy;
    cost_destination: DaoFundsDestination;
    kept_deposit_destination: DaoFundsDestination;
}

/** The sources of a stake DAO: staking reward ids and an optional Denom Reward (its staking denom). */
export interface DaoStakeElectorate {
    sr_ids: string[];
    dr_denom: string;
}

export interface Dao {
    id: string;
    /** The DAO's own account, its treasury. */
    address: string;
    /** The external admin, or the DAO's own address when it owns itself. */
    admin: string;
    /** The nominee of a pending handover, empty when none. */
    pending_admin: string;
    type: DaoType;
    name: string;
    description: string;
    config: DaoConfig;
    /** The members of a static-list DAO; empty for a stake DAO. */
    members: string[];
    electorate?: DaoStakeElectorate | null;
    /** Unix seconds. */
    created_at: string;
    admin_seq: string;
    pending_admin_seq: string;
}

/** A message a proposal runs: its type URL plus the message's own fields. */
export interface DaoProposalMessage {
    '@type': string;
    [key: string]: unknown;
}

export interface DaoProposal {
    id: string;
    dao_id: string;
    proposer: string;
    title: string;
    summary: string;
    msgs: DaoProposalMessage[];
    expedited: boolean;
    status: DaoProposalStatus;
    submit_height: string;
    /** Unix seconds. */
    submit_time: string;
    /** Unix seconds. */
    voting_end: string;
    pinned_config: DaoConfig;
    pinned_electorate?: DaoStakeElectorate | null;
    /** The total voting power the proposal is decided against. */
    pinned_denominator: string;
    pinned_deposit?: DaoCoin | null;
    yes: string;
    no: string;
    abstain: string;
    cleanup_cursor: string;
}

/** One source's part of a stake ballot. `source` is `sr/{reward_id}` or `dr/{staking_denom}`. */
export interface DaoBallotShare {
    source: string;
    amount: string;
}

export interface DaoBallot {
    proposal_id: string;
    voter: string;
    option: DaoVoteOption;
    weight: string;
    shares: DaoBallotShare[];
}

export interface DaoParams {
    max_sr_per_dao: string;
    max_static_members: string;
    max_open_proposals: string;
    max_msgs_per_proposal: string;
    max_proposal_bytes: string;
    max_title_len: string;
    max_summary_len: string;
    min_voting_period: string;
    max_voting_period: string;
    execution_window: string;
    cleanup_batch_size: string;
    dao_creation_fee: DaoCoin;
    /** `burner` or `community_pool`. */
    dao_creation_fee_destination: string;
    /** A uint32, so the gateway sends a JSON number. */
    min_electorate_lock_days: number;
    min_expedite_delay: string;
}

export interface DaoProposalResponse {
    proposal: DaoProposal;
    /** In VOTING and the block time reached `voting_end`: it can be settled. */
    voting_ended: boolean;
    /** For EXECUTION_FAILED, unix seconds until a retry is accepted; "0" otherwise. */
    retry_deadline: string;
    /** An expedited proposal whose tally already meets the expedite bars, past the delay. */
    expedite_settleable: boolean;
}

export interface DaoProposalVotingPower {
    proposal_id: string;
    /** The weight a vote on this proposal would count now. */
    eligible_weight: string;
    shares: DaoBallotShare[];
}

export interface DaoVotingPowerResponse {
    /** Weight now: 1 or 0 in a static-list DAO, the stake in its current sources in a stake DAO. */
    current: string;
    /** One entry per proposal of the DAO in VOTING. */
    proposals: DaoProposalVotingPower[];
}

export interface DaoControllerResponse {
    controller: string;
    end_reason: DaoControllerEndReason;
    /** The DAO addresses walked, starting with the queried one. */
    path: string[];
}

/** One page of a listing. Pass `nextKey` back to read the next page; null on the last one. */
export interface DaoPage<T> {
    items: T[];
    nextKey: string | null;
    /** Set only when the request asked for the total. */
    total?: string;
}

/** Pagination options of the listing queries (the gateway's `pagination.*` parameters). */
export interface DaoPageRequest {
    /** The `nextKey` of the previous page (base64, as the chain sent it). */
    key?: string;
    limit?: number;
    reverse?: boolean;
    countTotal?: boolean;
}
