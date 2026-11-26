import BigNumber from 'bignumber.js';
import {buildUpdateDaoElectorateMsg, daoSourceKey, validateDaoElectorate, type DaoStakeElectorate} from '@bze/bze-ui-kit';
import type {ActionContext, ActionEntry, ActionFields, ElectorateOption} from './types';

export const ELECTORATE_ID = 'update-electorate';

/** The electorate the form holds: staking reward ids (comma separated) and at most one Denom Reward denom. */
export const electorateOf = (fields: ActionFields): DaoStakeElectorate => ({
    sr_ids: (fields.srIds ?? '').split(',').map((id) => id.trim()).filter((id) => id !== ''),
    dr_denom: (fields.drDenom ?? '').trim(),
});

export const electorateToFields = (electorate: DaoStakeElectorate | null | undefined): ActionFields => ({
    srIds: (electorate?.sr_ids ?? []).join(','),
    drDenom: electorate?.dr_denom ?? '',
});

const keysOf = (electorate: DaoStakeElectorate | null | undefined): Set<string> =>
    new Set([...(electorate?.sr_ids ?? []).map((id) => `sr/${id}`), ...(electorate?.dr_denom ? [`dr/${electorate.dr_denom}`] : [])]);

const nameOf = (option: Pick<ElectorateOption, 'kind' | 'id'>): string =>
    option.kind === 'dr' ? 'The Compounded reward' : `Simple reward #${Number(option.id) || option.id}`;

/** The options the electorate names, in order, or the first name that is not a known source. */
const picked = (electorate: DaoStakeElectorate, options: ElectorateOption[]): {found: ElectorateOption[]} | {missing: string} => {
    const found: ElectorateOption[] = [];
    for (const id of electorate.sr_ids) {
        const option = options.find((o) => o.kind === 'sr' && o.id === id);
        if (!option) return {missing: nameOf({kind: 'sr', id})};
        found.push(option);
    }
    if (electorate.dr_denom !== '') {
        const option = options.find((o) => o.kind === 'dr' && o.id === electorate.dr_denom);
        if (!option) return {missing: nameOf({kind: 'dr', id: electorate.dr_denom})};
        found.push(option);
    }
    return {found};
};

/** What can vote through these sources: their stake without the DAO's own, which never votes (the chain's `voterStake`). */
export const votingStake = (found: ElectorateOption[]): BigNumber =>
    found.reduce((sum, o) => sum.plus(BigNumber.maximum(new BigNumber(o.staked || 0), 0)).minus(new BigNumber(o.own || 0)), new BigNumber(0));

/** The stake that can vote through the electorate's sources (without the account's own); null when a source is not in `options`. */
export const electorateVoterStake = (electorate: DaoStakeElectorate, options: ElectorateOption[]): BigNumber | null => {
    const read = picked(electorate, options);
    return 'found' in read ? votingStake(read.found) : null;
};

/**
 * Why a DAO cannot be handed to its own voters (the chain's live-electorate check, error 1113), or undefined
 * when it can: a member list needs a member; a stake DAO needs voting stake in its sources, without its own.
 * `sources` are the staking sources with the DAO's own stake in each; null when they could not be read, which
 * is never read as "no voters".
 */
export function handOverProblem(dao: Pick<ActionContext['dao'], 'name' | 'type' | 'members' | 'electorate'>, sources: ElectorateOption[] | null): string | undefined {
    const none = `${dao.name} has no voters to hand it to: set up its voters first (the chain refuses it, error 1113).`;
    if (dao.type === 'DAO_TYPE_STATIC_LIST') return dao.members.length > 0 ? undefined : none;
    const unreadable = `The stake of ${dao.name} could not be read, so it cannot be checked that it has voters. Try again in a moment.`;
    if (!dao.electorate || sources === null) return dao.electorate ? unreadable : none;
    const stake = electorateVoterStake(dao.electorate, sources);
    if (stake === null) return unreadable;
    return stake.isGreaterThan(0) ? undefined : none;
}

const check = (fields: ActionFields, ctx: ActionContext): string | undefined => {
    if (ctx.dao.type !== 'DAO_TYPE_STAKE') return 'Only a stakers DAO has an electorate: this DAO has a member list.';
    if (ctx.sources === null) return 'The staking rewards could not be read, so the voters cannot be changed right now. Try again in a moment.';

    const electorate = electorateOf(fields);
    const shape = validateDaoElectorate(electorate, ctx.params);
    if (shape) return shape;

    const read = picked(electorate, ctx.sources);
    if ('missing' in read) return `${read.missing} was not found. Pick the voters again.`;

    const kept = keysOf(ctx.dao.electorate);
    let denom: string | undefined;
    for (const option of read.found) {
        denom ??= option.stakingDenom;
        if (option.stakingDenom !== denom) {
            return `${nameOf(option)} stakes ${ctx.ticker(option.stakingDenom)}, not ${ctx.ticker(denom)}. All sources of a DAO must stake the same token.`;
        }
        // a source the DAO already has stays valid whatever its lock; only an added one must reach the minimum
        if (!kept.has(daoSourceKey(option)) && option.lock < ctx.params.min_electorate_lock_days) {
            return `${nameOf(option)} has a ${option.lock}-day unstaking lock: at least ${ctx.params.min_electorate_lock_days} days are required for a source that is added.`;
        }
    }

    const same = keysOf(electorate);
    const current = keysOf(ctx.dao.electorate);
    if (same.size === current.size && [...same].every((k) => current.has(k))) return 'These are the same voters the DAO has today: pick different sources.';

    if (ctx.dao.admin === ctx.dao.address && !votingStake(read.found).isGreaterThan(0)) {
        return 'A DAO that has no admin must keep voters: pick at least one source that someone other than the DAO itself has staked in (the chain refuses it otherwise, error 1113).';
    }
    return undefined;
};

/** Replace the sources a stake DAO votes with. The whole electorate is sent, not a change. */
export const electorateEntry: ActionEntry = {
    id: ELECTORATE_ID,
    label: 'Change who votes (the staking sources)',
    description: 'Pick the staking rewards and the Denom Reward whose stakers can vote.',
    available: (dao) => dao.type === 'DAO_TYPE_STAKE',
    initialFields: (ctx) => electorateToFields(ctx.dao.electorate),
    validate: check,
    warnings(fields, ctx) {
        if (check(fields, ctx) !== undefined) return [];
        const warnings = ["Proposals that are open now keep the voters they started with. The DAO's own stake in its sources never votes."];
        const electorate = electorateOf(fields);
        if (electorate.sr_ids.length === 0 && electorate.dr_denom === '') warnings.push('No source is picked: nobody can vote, so only the admin can set the voters up again.');
        return warnings;
    },
    build(fields, ctx) {
        const problem = check(fields, ctx);
        if (problem) throw new Error(problem);
        return buildUpdateDaoElectorateMsg({daoAddress: ctx.dao.address, daoId: ctx.dao.id, electorate: electorateOf(fields)});
    },
};
