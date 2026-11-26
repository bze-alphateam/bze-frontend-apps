import {buildAcceptAdminNominationMsg, buildNominateAdminMsg, buildWithdrawAdminNominationMsg, canonicalAddress} from '@bze/bze-ui-kit';
import type {ActionContext, ActionEntry, ActionFields} from './types';

export const NOMINATE_ID = 'nominate-admin';
export const WITHDRAW_ID = 'withdraw-nomination';
export const ACCEPT_ID = 'accept-nomination';

/** A self-owned DAO is its own admin: the only DAO whose admin handover is signed by the DAO itself. */
export const isSelfOwned = (dao: Pick<ActionContext['dao'], 'admin' | 'address'>): boolean => dao.admin === dao.address;

const EXTERNAL_ADMIN_POWER = 'An external admin can run any message as the DAO, including spending the whole treasury, and the DAO\'s voters can no longer overrule it.';

const nomineeCheck = (nominee: string, dao: Pick<ActionContext['dao'], 'address' | 'admin'>): string | undefined => {
    if (nominee === '') return 'Enter the address of the new admin.';
    const canonical = canonicalAddress(nominee);
    if (!canonical) return 'The new admin is not a valid BeeZee address (it starts with bze1).';
    if (canonical === dao.address.toLowerCase()) return 'The DAO cannot nominate itself: it is already its own admin.';
    if (canonical === dao.admin.toLowerCase()) return 'This address is already the admin.';
    return undefined;
};

/** Nominate an admin for a self-owned DAO. The DAO stays self-owned until the nominee accepts. */
export const nominateEntry: ActionEntry = {
    id: NOMINATE_ID,
    label: 'Nominate an admin',
    description: 'Hand the DAO to a person or another DAO once they accept.',
    available: (dao) => isSelfOwned(dao),
    initialFields: () => ({nominee: ''}),
    validate: (fields, ctx) => (isSelfOwned(ctx.dao)
        ? nomineeCheck((fields.nominee ?? '').trim(), ctx.dao)
        : 'Only a DAO that owns itself nominates its admin this way. This DAO has an admin: the admin hands it over.'),
    warnings(fields, ctx) {
        const warnings = [`The DAO stays self-owned until the nominee accepts. ${EXTERNAL_ADMIN_POWER}`];
        if (ctx.dao.pending_admin !== '') {
            warnings.push('A nomination is already pending: the chain accepts one at a time (error 1112). Put a "Withdraw the admin nomination" action before this one, or this one fails.');
        }
        return warnings;
    },
    build(fields, ctx) {
        const problem = nominateEntry.validate(fields, ctx);
        if (problem) throw new Error(problem);
        return buildNominateAdminMsg({authority: ctx.dao.address, daoId: ctx.dao.id, nominee: (fields.nominee ?? '').trim().toLowerCase()});
    },
};

/** Withdraw the pending nomination of a self-owned DAO. */
export const withdrawEntry: ActionEntry = {
    id: WITHDRAW_ID,
    label: 'Withdraw the admin nomination',
    description: 'Cancel the pending nomination before the nominee accepts it.',
    available: (dao) => isSelfOwned(dao) && dao.pending_admin !== '',
    initialFields: () => ({}),
    validate: (_fields, ctx) => (!isSelfOwned(ctx.dao)
        ? 'Only a DAO that owns itself withdraws its nomination this way.'
        : ctx.dao.pending_admin === '' ? 'There is no pending nomination to withdraw.' : undefined),
    build(fields, ctx) {
        const problem = withdrawEntry.validate(fields, ctx);
        if (problem) throw new Error(problem);
        return buildWithdrawAdminNominationMsg({authority: ctx.dao.address, daoId: ctx.dao.id});
    },
};

const incomingOf = (fields: ActionFields, ctx: ActionContext) => ctx.incoming?.find((d) => d.id === (fields.daoId ?? ''));

/** Accept another DAO's nomination as this DAO: this DAO then administers it as its parent. */
export const acceptEntry: ActionEntry = {
    id: ACCEPT_ID,
    label: 'Accept a nomination as this DAO',
    description: 'Another DAO nominated this DAO as its admin: accept, and this DAO becomes its parent.',
    // BZE Scan finds the nominations; when it did not answer (null) the entry is not offered at all
    available: (_dao, ctx) => !!ctx && (ctx.incoming?.length ?? 0) > 0,
    initialFields: (ctx) => ({daoId: ctx.incoming?.[0]?.id ?? ''}),
    validate(fields, ctx) {
        if (ctx.incoming === null) return 'The nominations could not be looked up right now. Try again in a moment.';
        return incomingOf(fields, ctx) ? undefined : 'Choose a DAO that nominated this DAO.';
    },
    warnings: () => [
        `This DAO then administers the other one and can run any message as it, including spending its treasury. The chain refuses a nomination that went stale: if control of any DAO on the other DAO's admin chain changed after the nomination was made, it fails (error 1135).`,
    ],
    build(fields, ctx) {
        const nominating = incomingOf(fields, ctx);
        if (!nominating) throw new Error('Choose a DAO that nominated this DAO.');
        return buildAcceptAdminNominationMsg({nominee: ctx.dao.address, daoId: nominating.id});
    },
};
