// Hand-written inputs for the DAO page's component tests (shell, Who controls it box, the page). Not imported by the app.
import type {Dao} from '@bze/bze-ui-kit';
import type {DaoView} from '@/lib/dao-view-loader';
import {CONFIG, DAO_ADDRESS, OTHER, PARAMS, WALLET} from './composer-fixtures';

/** A self-owned member list with the wallet and one other member, created 26 Oct 2026. */
export const pageDao = (over: Partial<Dao> = {}): Dao => ({
    id: '4',
    address: DAO_ADDRESS,
    admin: DAO_ADDRESS,
    pending_admin: '',
    type: 'DAO_TYPE_STATIC_LIST',
    name: 'Founders',
    description: 'The founding members.',
    config: {...CONFIG, proposal_cost: null, proposal_deposit: null, deposit_refund_policy: 'ALWAYS'},
    members: [WALLET, OTHER],
    electorate: null,
    created_at: '1793000000',
    admin_seq: '0',
    pending_admin_seq: '0',
    ...over,
}) as Dao;

export const pageView = (dao: Dao = pageDao(), over: Partial<DaoView> = {}): DaoView => ({
    dao,
    params: {ok: true, value: PARAMS},
    controller: {ok: true, value: null},
    knownDaos: new Map([[dao.address, {id: dao.id, name: dao.name}]]),
    unresolved: new Set(),
    treasury: {ok: true, value: [{denom: 'ubze', amount: '250000000'}]},
    openProposals: {ok: true, value: []},
    sources: {ok: true, value: []},
    ...over,
});
