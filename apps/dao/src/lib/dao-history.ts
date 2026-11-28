import type {ScanDaoEvent} from './dao-types';
import {shortAddress} from './format';

export interface DescribedEvent {
    /** The event in one sentence. */
    title: string;
    /** Extra lines: the members added, the fields changed. */
    details: string[];
}

export interface HistoryContext {
    /** The DAO's own account: an admin handed over to it means "its voters". */
    daoAddress: string;
    /** A name for an address (a Scan label), when there is one. */
    nameOf?: (address: string) => string | undefined;
}

/** The proto names of a config's fields, as people say them. */
const CONFIG_FIELDS: Record<string, string> = {
    min_quorum: 'quorum',
    threshold: 'pass threshold',
    voting_period: 'voting period',
    allow_expedite: 'expedited voting',
    expedited_period: 'expedited voting period',
    expedite_quorum: 'expedited quorum',
    expedite_threshold: 'expedited threshold',
    open_submission: 'who can propose',
    proposal_cost: 'proposal cost',
    proposal_deposit: 'proposal deposit',
    deposit_refund_policy: 'deposit refund policy',
    cost_destination: 'where the proposal cost goes',
    kept_deposit_destination: 'where a kept deposit goes',
};

export const fieldName = (field: string): string => CONFIG_FIELDS[field] ?? field.replace(/_/g, ' ');

/** The event type without the package prefix: "bze.dao.EventDaoCreated" and "EventDaoCreated" are the same. */
export const eventKind = (type: string): string => type.slice(type.lastIndexOf('.') + 1);

/** An attribute as text: the chain's attributes are JSON, so a string may come quoted. */
const text = (value: unknown): string => {
    if (typeof value === 'string') {
        const quoted = /^"(.*)"$/.exec(value);
        return quoted ? quoted[1] : value;
    }
    return value === null || value === undefined ? '' : String(value);
};

const list = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(text).filter(Boolean);
    if (typeof value === 'string' && value.trim().startsWith('[')) {
        try {
            const parsed: unknown = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean);
        } catch {
            // not JSON: read it as one value below
        }
    }
    const single = text(value);
    return single ? [single] : [];
};

const attrsOf = (attrs: unknown): Record<string, unknown> =>
    typeof attrs === 'object' && attrs !== null && !Array.isArray(attrs) ? (attrs as Record<string, unknown>) : {};

const SHOWN_ADDRESSES = 5;

const people = (addresses: string[], name: (a: string) => string): string => {
    const shown = addresses.slice(0, SHOWN_ADDRESSES).map(name).join(', ');
    return addresses.length > SHOWN_ADDRESSES ? `${shown} and ${addresses.length - SHOWN_ADDRESSES} more` : shown;
};

/**
 * Who runs a DAO in the decided words: "No admin" (it is its own admin), the admin's name when there is one
 * (another DAO, or a labelled account), else "Admin is an account" with its short address. Never "DAO #n".
 */
function adminLine(admin: string, self: boolean, context: HistoryContext): string {
    if (self) return 'No admin';
    const named = context.nameOf?.(admin);
    return named ? `Admin: ${named}` : `Admin is an account (${shortAddress(admin)})`;
}

/** One history item in plain words. An event type this app does not know still gets a readable line. */
export function describeDaoEvent(event: Pick<ScanDaoEvent, 'type' | 'attrs'>, context: HistoryContext): DescribedEvent {
    const described = describe(event, context);
    return {...described, title: described.title.charAt(0).toUpperCase() + described.title.slice(1)};
}

function describe(event: Pick<ScanDaoEvent, 'type' | 'attrs'>, context: HistoryContext): DescribedEvent {
    const a = attrsOf(event.attrs);
    const name = (address: string): string => context.nameOf?.(address) ?? shortAddress(address);
    const who = (address: string): string => (address === context.daoAddress ? "the DAO's own voters" : name(address));
    const details: string[] = [];

    switch (eventKind(event.type)) {
        case 'EventDaoCreated': {
            const admin = text(a.admin);
            const type = text(a.type);
            if (type === 'DAO_TYPE_STAKE') details.push('Governed by stakers');
            else if (type === 'DAO_TYPE_STATIC_LIST') details.push('Governed by a member list');
            if (admin) details.push(adminLine(admin, admin === context.daoAddress || admin === text(a.address), context));
            return {title: 'The DAO was created', details};
        }
        case 'EventAdminNominated':
            return {title: `${who(text(a.admin))} nominated ${name(text(a.nominee))} as the new admin`, details};
        case 'EventAdminChanged': {
            const next = text(a.new_admin);
            const before = text(a.old_admin);
            if (next === context.daoAddress) return {title: 'The admin handed the DAO to its own voters', details: ['No admin']};
            return {title: `New admin: ${who(next)}`, details: before ? [`Before: ${who(before)}`] : []};
        }
        case 'EventAdminNominationWithdrawn':
            return {title: `The nomination of ${who(text(a.nominee))} as admin was withdrawn`, details};
        case 'EventDaoConfigUpdated': {
            const fields = list(a.fields);
            return {
                title: 'The voting rules were updated',
                details: fields.length > 0 ? [`Changed: ${fields.map(fieldName).join(', ')}`] : [],
            };
        }
        case 'EventDaoMetadataUpdated':
            return {title: 'The name or description was updated', details};
        case 'EventDaoElectorateUpdated': {
            const rewards = list(a.sr_ids);
            const denom = text(a.dr_denom);
            if (rewards.length > 0) details.push(`Staking rewards: ${rewards.map((id) => Number(id) || id).join(', ')}`);
            if (denom) details.push(`Denom Reward of ${denom}`);
            return {
                title: details.length > 0 ? 'The voting sources were replaced' : 'The voting sources were cleared: no one can vote until new ones are set',
                details,
            };
        }
        case 'EventDaoMembersUpdated': {
            const added = list(a.added);
            const removed = list(a.removed);
            if (added.length > 0) details.push(`Added: ${people(added, name)}`);
            if (removed.length > 0) details.push(`Removed: ${people(removed, name)}`);
            return {title: 'The member list was updated', details};
        }
        case 'EventAdminExecuted': {
            const count = Number(text(a.msg_count));
            return {
                title: `${who(text(a.admin))} ran ${count === 1 ? 'a message' : Number.isFinite(count) && count > 0 ? `${count} messages` : 'messages'} as the DAO`,
                details,
            };
        }
        default: {
            const kind = eventKind(event.type).replace(/^Event/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
            return {title: kind ? `Change: ${kind}` : 'The DAO changed', details};
        }
    }
}
