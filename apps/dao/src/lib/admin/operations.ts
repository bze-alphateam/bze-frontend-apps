import type {Dao} from '@bze/bze-ui-kit';
import {nomineeProblem} from '../actions/admin';
import {handOverProblem} from '../actions/electorate';
import type {ElectorateOption} from '../actions/types';

/** Why an operation cannot be signed now, as a sentence, or undefined when it can. */
export type Blocked = string | undefined;

type AdminOps = Pick<Dao, 'name' | 'address' | 'admin' | 'pending_admin'>;

const PENDING = 'A nomination is already pending: the chain accepts one at a time (error 1112). Withdraw it first.';

/** Nominating a successor: one at a time (1112), a valid nominee that is neither the admin nor the DAO (1114). */
export function nominateBlocked(dao: AdminOps, nominee: string): Blocked {
    if (dao.pending_admin !== '') return PENDING;
    return nomineeProblem(nominee.trim(), {
        daoAddress: dao.address,
        adminAddress: dao.admin,
        isDao: `${dao.name} cannot be its own nominee: hand it to its voters to make it self-owned.`,
        isAdmin: 'You are already the admin.',
    });
}

/** Withdrawing needs a pending nomination (1115). */
export const withdrawBlocked = (dao: Pick<Dao, 'pending_admin'>): Blocked =>
    (dao.pending_admin === '' ? 'There is no pending nomination to withdraw.' : undefined);

/**
 * Handing the DAO to its voters: refused while a nomination is pending, whatever the nominee (1112, the
 * chain looks at it first), and it needs a live electorate (1113). `sources` are the staking sources with the
 * DAO's own stake; null when they could not be read, which blocks it rather than guessing.
 */
export function handOverBlocked(dao: Pick<Dao, 'name' | 'type' | 'members' | 'electorate' | 'pending_admin'>, sources: ElectorateOption[] | null): Blocked {
    if (dao.pending_admin !== '') return PENDING;
    return handOverProblem(dao, sources);
}

/**
 * What it takes to hand the DAO to its voters: the box ticked and the DAO's name typed (as it is, spaces at the
 * ends aside), so it cannot be a stray click.
 */
export const handOverConfirmed = (dao: Pick<Dao, 'name'>, typedName: string, understood: boolean): boolean =>
    understood && typedName.trim() !== '' && typedName.trim() === dao.name.trim();
