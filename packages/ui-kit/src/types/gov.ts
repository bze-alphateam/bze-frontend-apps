// Gov v1 objects as the chain's REST answers them. The bzejs `*SDKType`
// interfaces describe the decoded protobuf (bigint ids, Date times, numeric
// enums); the LCD client returns the raw JSON instead, so these types follow
// the wire: ids and amounts are strings, times are RFC 3339 strings, statuses
// are enum names and durations are `"432000s"`.

export type GovProposalStatus =
    | 'PROPOSAL_STATUS_UNSPECIFIED'
    | 'PROPOSAL_STATUS_DEPOSIT_PERIOD'
    | 'PROPOSAL_STATUS_VOTING_PERIOD'
    | 'PROPOSAL_STATUS_PASSED'
    | 'PROPOSAL_STATUS_REJECTED'
    | 'PROPOSAL_STATUS_FAILED';

export type GovVoteOption =
    | 'VOTE_OPTION_UNSPECIFIED'
    | 'VOTE_OPTION_YES'
    | 'VOTE_OPTION_ABSTAIN'
    | 'VOTE_OPTION_NO'
    | 'VOTE_OPTION_NO_WITH_VETO';

export interface GovCoin {
    denom: string;
    amount: string;
}

/** A proposal message: its type URL plus the message's own fields. */
export interface GovProposalMessage {
    '@type': string;
    /** Set on `/cosmos.gov.v1.MsgExecLegacyContent`: the v1beta1 content it carries. */
    content?: {
        '@type': string;
        title?: string;
        description?: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface GovTally {
    yes_count: string;
    abstain_count: string;
    no_count: string;
    no_with_veto_count: string;
}

export interface GovProposal {
    id: string;
    messages: GovProposalMessage[];
    status: GovProposalStatus;
    final_tally_result?: GovTally | null;
    submit_time?: string | null;
    deposit_end_time?: string | null;
    total_deposit: GovCoin[];
    voting_start_time?: string | null;
    voting_end_time?: string | null;
    metadata: string;
    title: string;
    summary: string;
    proposer: string;
    expedited: boolean;
    failed_reason: string;
}

export interface GovWeightedVoteOption {
    option: GovVoteOption;
    weight: string;
}

export interface GovVote {
    proposal_id: string;
    voter: string;
    options: GovWeightedVoteOption[];
    metadata: string;
}

export interface GovParams {
    min_deposit: GovCoin[];
    max_deposit_period?: string | null;
    voting_period?: string | null;
    quorum: string;
    threshold: string;
    veto_threshold: string;
    min_initial_deposit_ratio: string;
    proposal_cancel_ratio: string;
    proposal_cancel_dest: string;
    expedited_voting_period?: string | null;
    expedited_threshold: string;
    expedited_min_deposit: GovCoin[];
    burn_vote_quorum: boolean;
    burn_proposal_deposit_prevote: boolean;
    burn_vote_veto: boolean;
    min_deposit_ratio: string;
}

/** One page of finished proposals; `nextKey` is null on the last page. */
export interface GovProposalsPage {
    proposals: GovProposal[];
    nextKey: Uint8Array | null;
}
