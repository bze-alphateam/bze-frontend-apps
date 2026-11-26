// Hand-written inputs for the composer's unit tests (the testnet has no DAO yet; written from the protos at
// v8.3.0-rc1). Not imported by the app.
import type {Dao, DaoConfig, DaoParams} from '@bze/bze-ui-kit';
import type {ActionContext, SubDao} from '@/lib/actions/types';

// valid bze1… addresses (BIP-173 over a 20-byte payload)
export const [DAO_ADDRESS, WALLET, OTHER, THIRD] = [
    'bze1qqq3kg3fxqmnu32v2ddxz6r0we7cfzujuzps7g',
    'bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw',
    'bze1qqppkg3fxqmnu32v2ddxz6r0we7cfzujwm0zsw',
    'bze1qqp3kg3fxqmnu32v2ddxz6r0we7cfzujwgtx3g',
];

// more valid addresses: a sub-DAO's account, another DAO's account, and two more people
export const [SUB_ADDRESS, OTHER_DAO_ADDRESS, FOURTH, FIFTH] = [
    'bze1qyqszqgpqyqszqgpqyqszqgpqyqszqgp0hd4lt',
    'bze1qgpqyqszqgpqyqszqgpqyqszqgpqyqsz7nts5a',
    'bze1qvpsxqcrqvpsxqcrqvpsxqcrqvpsxqcrlr237u',
    'bze1qszqgpqyqszqgpqyqszqgpqyqszqgpqylnd5eq',
];

export const CONFIG: DaoConfig = {
    min_quorum: '0.400000000000000000',
    threshold: '0.500000000000000000',
    voting_period: '259200s',
    allow_expedite: true,
    expedited_period: '86400s',
    expedite_quorum: '0.600000000000000000',
    expedite_threshold: '0.700000000000000000',
    open_submission: false,
    proposal_cost: {denom: 'ubze', amount: '5000000'},
    proposal_deposit: {denom: 'ubze', amount: '9000000'},
    deposit_refund_policy: 'ONLY_PASSED',
    cost_destination: 'TREASURY',
    kept_deposit_destination: 'BURN',
};

export const PARAMS: DaoParams = {
    max_sr_per_dao: '5',
    max_static_members: '128',
    max_open_proposals: '10',
    max_msgs_per_proposal: '16',
    max_proposal_bytes: '20000',
    max_title_len: '140',
    max_summary_len: '5000',
    min_voting_period: '3600s',
    max_voting_period: '2592000s',
    execution_window: '604800s',
    cleanup_batch_size: '100',
    dao_creation_fee: {denom: 'ubze', amount: '50000000000'},
    dao_creation_fee_destination: 'burner',
    min_electorate_lock_days: 5,
    min_expedite_delay: '43200s',
};

export const DAO: ActionContext['dao'] = {
    id: '4',
    address: DAO_ADDRESS,
    admin: DAO_ADDRESS,
    pending_admin: '',
    name: 'Founders',
    description: 'The founding members.',
    type: 'DAO_TYPE_STATIC_LIST',
    config: CONFIG,
    members: [WALLET, OTHER],
    electorate: null,
};

export const STAKE_DAO: ActionContext['dao'] = {...DAO, type: 'DAO_TYPE_STAKE', members: [], electorate: {sr_ids: ['000000000017'], dr_denom: ''}};

export const fullDao = (over: Partial<Dao> = {}): ActionContext['dao'] => ({...DAO, ...over});

export const ctxWith = (over: Partial<ActionContext> = {}): ActionContext => ({
    dao: DAO,
    params: PARAMS,
    nativeDenom: 'ubze',
    subDaos: [],
    incoming: [],
    sources: [],
    treasury: [{denom: 'ubze', amount: '250000000'}, {denom: 'factory/bze1x/ulmn', amount: '42'}],
    decimalsOf: (denom) => (denom === 'ubze' ? 6 : null),
    ticker: (denom) => (denom === 'ubze' ? 'BZE' : 'ULMN'),
    ...over,
});

/** A DAO this DAO (`DAO`) administers: a member list, with its own rules. */
export const SUB_DAO: SubDao = {
    dao: {
        id: '7',
        address: SUB_ADDRESS,
        admin: DAO_ADDRESS,
        pending_admin: '',
        name: 'Garden club',
        description: '',
        type: 'DAO_TYPE_STATIC_LIST',
        config: {...CONFIG, proposal_cost: null, proposal_deposit: null},
        members: [WALLET],
        electorate: null,
    },
    treasury: [{denom: 'ubze', amount: '90000000'}],
    sources: [],
};

/** A DAO with an external admin (not the DAO itself). */
export const ADMINISTERED_DAO: ActionContext['dao'] = {...DAO, admin: THIRD};
