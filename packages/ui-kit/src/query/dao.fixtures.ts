// x/dao REST answers for the query tests.
//
// RECORDED: answered by a bzetestnet-3 node running v8.3.0-rc1 on 2026-11-25
// (params, empty lists, every NotFound / InvalidArgument body), and by a mainnet
// v8.2.x node (the 501). Copied byte for byte.
//
// HAND-WRITTEN: the testnet had no DAO yet, so the populated DAO, proposal,
// ballot, voting-power and controller answers are written from the protos at
// v8.3.0-rc1 in the gateway's JSON form (snake_case, defaults present, enums as
// names, int64 as strings). Re-record them from a node once a DAO exists.

export const RECORDED_PARAMS = {"params":{"max_sr_per_dao":"5","max_static_members":"128","max_open_proposals":"10","max_msgs_per_proposal":"16","max_proposal_bytes":"20000","max_title_len":"140","max_summary_len":"5000","min_voting_period":"3600s","max_voting_period":"7776000s","execution_window":"1209600s","cleanup_batch_size":"100","dao_creation_fee":{"denom":"ubze","amount":"50000000000"},"dao_creation_fee_destination":"burner","min_electorate_lock_days":5,"min_expedite_delay":"86400s"}};

export const RECORDED_EMPTY_DAOS = {"daos":[],"pagination":{"next_key":null,"total":"0"}};
export const RECORDED_EMPTY_PROPOSALS = {"proposals":[],"pagination":{"next_key":null,"total":"0"}};
export const RECORDED_EMPTY_BALLOTS = {"ballots":[],"pagination":{"next_key":null,"total":"0"}};

export const RECORDED_DAO_NOT_FOUND = {"code":5, "message":"dao 1 not found", "details":[]};
export const RECORDED_NO_DAO_OWNS = {"code":5, "message":"no dao owns bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l", "details":[]};
export const RECORDED_INVALID_ADDRESS = {"code":3, "message":"invalid address: decoding bech32 failed: invalid separator index -1", "details":[]};
export const RECORDED_PROPOSAL_NOT_FOUND = {"code":5, "message":"proposal 1 not found", "details":[]};
export const RECORDED_NO_BALLOT = {"code":5, "message":"no ballot of bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l on proposal 1", "details":[]};
export const RECORDED_INVALID_VOTER = {"code":3, "message":"invalid voter address: decoding bech32 failed: invalid bech32 string length 3", "details":[]};
export const RECORDED_NO_JOIN_RECORD = {"code":5, "message":"no join record of bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l on sr/1", "details":[]};
export const RECORDED_INVALID_STATUS = {"code":3, "message":"BOGUS is not a valid types.ProposalStatus", "details":[]};
export const RECORDED_MAINNET_501 = {"code":12,"message":"Not Implemented","details":[]};

export const ADDRESS = 'bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l';
const DAO_ADDRESS = 'bze1daoaccountxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/** HAND-WRITTEN from store.proto (no DAO existed on testnet when recorded). */
export const HAND_DAO = {
    id: '1',
    address: DAO_ADDRESS,
    admin: DAO_ADDRESS,
    pending_admin: '',
    type: 'DAO_TYPE_STATIC_LIST',
    name: 'BZE builders',
    description: 'Funds BZE tooling',
    config: {
        min_quorum: '0.400000000000000000',
        threshold: '0.500000000000000000',
        voting_period: '259200s',
        allow_expedite: true,
        expedited_period: '86400s',
        expedite_quorum: '0.600000000000000000',
        expedite_threshold: '0.660000000000000000',
        open_submission: false,
        proposal_cost: null,
        proposal_deposit: {denom: 'ubze', amount: '1000000'},
        deposit_refund_policy: 'ONLY_PASSED',
        cost_destination: 'BURN',
        kept_deposit_destination: 'TREASURY',
    },
    members: [ADDRESS],
    electorate: null,
    created_at: '1764000000',
    admin_seq: '0',
    pending_admin_seq: '0',
};

/** HAND-WRITTEN from store.proto / query.proto. */
export const HAND_PROPOSAL_RESPONSE = {
    proposal: {
        id: '7',
        dao_id: '1',
        proposer: ADDRESS,
        title: 'Fund tooling',
        summary: 'Pays the tooling team',
        msgs: [{
            '@type': '/cosmos.bank.v1beta1.MsgSend',
            from_address: DAO_ADDRESS,
            to_address: ADDRESS,
            amount: [{denom: 'ubze', amount: '1000000'}],
        }],
        expedited: false,
        status: 'VOTING',
        submit_height: '4500000',
        submit_time: '1764000000',
        voting_end: '1764259200',
        pinned_config: HAND_DAO.config,
        pinned_electorate: null,
        pinned_denominator: '1',
        pinned_deposit: {denom: 'ubze', amount: '1000000'},
        yes: '1',
        no: '0',
        abstain: '0',
        cleanup_cursor: '',
    },
    voting_ended: false,
    retry_deadline: '0',
    expedite_settleable: true,
};

/** HAND-WRITTEN from store.proto. */
export const HAND_BALLOT = {
    ballot: {
        proposal_id: '7',
        voter: ADDRESS,
        option: 'YES',
        weight: '2500000',
        shares: [{source: 'sr/3', amount: '2000000'}, {source: 'dr/ubze', amount: '500000'}],
    },
};

/** HAND-WRITTEN from query.proto. */
export const HAND_VOTING_POWER = {
    current: '2500000',
    proposals: [{proposal_id: '7', eligible_weight: '2000000', shares: [{source: 'sr/3', amount: '2000000'}]}],
};

/** HAND-WRITTEN from query.proto. */
export const HAND_CONTROLLER = {controller: DAO_ADDRESS, end_reason: 'SELF_OWNED', path: [DAO_ADDRESS]};

/** HAND-WRITTEN from query.proto. */
export const HAND_JOIN_RECORD = {height: '4400000'};

/** HAND-WRITTEN: a first page of two DAOs with a next key. */
export const HAND_DAOS_PAGE = {daos: [HAND_DAO, {...HAND_DAO, id: '2'}], pagination: {next_key: 'AAAAAAAAAAI=', total: '0'}};
