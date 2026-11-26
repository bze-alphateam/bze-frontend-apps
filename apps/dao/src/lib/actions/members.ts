import {buildUpdateDaoMembersMsg, canonicalAddress, parseMemberTokens, validateDaoMemberChanges} from '@bze/bze-ui-kit';
import type {ActionContext, ActionEntry, ActionFields} from './types';

export const MEMBERS_ID = 'update-members';

/** The two address lists of the form, one address per entry (lines, commas, spaces), in their canonical lowercase form. */
export const memberLists = (fields: ActionFields): {add: string[]; remove: string[]} => {
    const canonical = (text: string) => parseMemberTokens(text).map((t) => canonicalAddress(t) ?? t);
    return {add: canonical(fields.add ?? ''), remove: canonical(fields.remove ?? '')};
};

const check = (fields: ActionFields, ctx: ActionContext): string | undefined =>
    validateDaoMemberChanges(memberLists(fields), {members: ctx.dao.members, daoAddress: ctx.dao.address}, ctx.params);

const validate = (fields: ActionFields, ctx: ActionContext): string | undefined =>
    ctx.dao.type === 'DAO_TYPE_STATIC_LIST' ? check(fields, ctx) : 'Only a member-list DAO has members: this DAO votes with stake.';

/** Add and remove members of a member-list DAO. A stake DAO has no member list (the chain refuses it, error 1101). */
export const membersEntry: ActionEntry = {
    id: MEMBERS_ID,
    label: 'Add or remove members',
    description: 'Change who is on the member list: one address per line.',
    available: (dao) => dao.type === 'DAO_TYPE_STATIC_LIST',
    initialFields: () => ({add: '', remove: ''}),
    validate,
    warnings(fields) {
        const {add, remove} = memberLists(fields);
        const warnings: string[] = [];
        if (remove.length > 0) warnings.push('Removed members stop counting at once: their votes on proposals still in voting drop to 0 and they cannot vote on those again.');
        if (add.length > 0) warnings.push('Added members vote only on proposals submitted after the block they are added in.');
        return warnings;
    },
    build(fields, ctx) {
        const problem = validate(fields, ctx);
        if (problem) throw new Error(problem);
        const {add, remove} = memberLists(fields);
        return buildUpdateDaoMembersMsg({daoAddress: ctx.dao.address, daoId: ctx.dao.id, add, remove});
    },
};
