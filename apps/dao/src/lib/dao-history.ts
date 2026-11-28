import type {ScanDaoEvent} from './dao-types';
import {boardAddress} from './dao-shell';

/** The icon of a history row (the board's 36 px tile). */
export type EventIcon = 'execute' | 'rules' | 'voters' | 'admin' | 'nominate' | 'withdraw' | 'metadata' | 'created' | 'members' | 'other';

export interface DescribedEvent {
    /** The event in one sentence. */
    title: string;
    /** Extra lines: the members added, the fields changed. The tab joins them with " · ". */
    details: string[];
    icon: EventIcon;
    /** The faint third line: the event's name and its raw fields ("EventAdminExecuted · 1 message"). */
    meta: string;
}

export interface HistoryContext {
    /** The DAO's own account: an admin handed over to it means "its voters". */
    daoAddress: string;
    /** A name for an address (a Scan label), when there is one. */
    nameOf?: (address: string) => string | undefined;
    /** Who created the DAO (Scan's detail): the created event names it. */
    creator?: string | null;
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

/** One history item in plain words. An event type this app does not know still gets a readable line. */
export function describeDaoEvent(event: Pick<ScanDaoEvent, 'type' | 'attrs'>, context: HistoryContext): DescribedEvent {
    const described = describe(event, context);
    // a sentence starts with a capital, unless it starts with an address ("bze1…"), which stays as it is
    const capital = (line: string) => (/^bze1/i.test(line) ? line : line.charAt(0).toUpperCase() + line.slice(1));
    return {...described, title: capital(described.title), details: described.details.map(capital), meta: metaLine(event)};
}

const sourcesLine = (rewards: string[], denom: string): string =>
    [...(denom ? ['Compounded reward'] : []), ...rewards.map((id) => `Simple reward #${Number(id) || id}`)].join(' + ');

/** The event's name and its raw fields, as the board's faint third line writes them. */
function metaLine(event: Pick<ScanDaoEvent, 'type' | 'attrs'>): string {
    const a = attrsOf(event.attrs);
    const kind = eventKind(event.type);
    const extra: string[] = [];
    if (kind === 'EventAdminExecuted') {
        const count = Number(text(a.msg_count));
        if (Number.isFinite(count) && count > 0) extra.push(`${count} ${count === 1 ? 'message' : 'messages'}`);
    }
    if (kind === 'EventDaoConfigUpdated') {
        const fields = list(a.fields);
        if (fields.length > 0) extra.push(fields.join(', '));
    }
    return [kind, ...extra].join(' · ');
}

function describe(event: Pick<ScanDaoEvent, 'type' | 'attrs'>, context: HistoryContext): Omit<DescribedEvent, 'meta'> {
    const a = attrsOf(event.attrs);
    const name = (address: string): string => context.nameOf?.(address) ?? boardAddress(address);
    const who = (address: string): string => (address === context.daoAddress ? "the DAO's own voters" : name(address));
    const details: string[] = [];

    switch (eventKind(event.type)) {
        case 'EventDaoCreated': {
            // D4: "Stakers · admin bze1…k9f2 (the creator) · Compounded reward", from what the event and Scan give
            const admin = text(a.admin);
            const type = text(a.type);
            const creator = context.creator || text(a.creator);
            const parts: string[] = [];
            if (type === 'DAO_TYPE_STAKE') parts.push('Stakers');
            else if (type === 'DAO_TYPE_STATIC_LIST') parts.push('Member list');
            if (admin) {
                const self = admin === context.daoAddress || admin === text(a.address);
                parts.push(self ? 'no admin' : `admin ${name(admin)}${creator && admin === creator ? ' (the creator)' : ''}`);
            }
            const members = list(a.members);
            if (members.length > 0) parts.push(`${members.length} ${members.length === 1 ? 'member' : 'members'}`);
            const sources = sourcesLine(list(a.sr_ids), text(a.dr_denom));
            if (sources) parts.push(sources);
            if (parts.length > 0) details.push(parts.join(' · '));
            return {title: creator ? `DAO created by ${name(creator)}` : 'DAO created', details, icon: 'created'};
        }
        case 'EventAdminNominated':
            return {title: `${who(text(a.admin))} nominated ${name(text(a.nominee))} as admin`, details, icon: 'nominate'};
        case 'EventAdminChanged': {
            const next = text(a.new_admin);
            const before = text(a.old_admin);
            if (next === context.daoAddress) return {title: 'No admin: the DAO is run by its own voters', details: before ? [`${who(before)} handed the DAO to its own voters`] : [], icon: 'admin'};
            return {title: `New admin: ${who(next)}`, details: before ? [`${who(before)} handed the DAO to ${who(next)}, which accepted`] : [], icon: 'admin'};
        }
        case 'EventAdminNominationWithdrawn': {
            const admin = text(a.admin);
            return {
                title: admin ? `${who(admin)} withdrew the nomination of ${who(text(a.nominee))}` : `The nomination of ${who(text(a.nominee))} as admin was withdrawn`,
                details,
                icon: 'withdraw',
            };
        }
        case 'EventDaoConfigUpdated': {
            const fields = list(a.fields);
            return {title: 'Rules changed', details: fields.length > 0 ? [`Changed: ${fields.map(fieldName).join(', ')}`] : [], icon: 'rules'};
        }
        case 'EventDaoMetadataUpdated':
            return {title: 'Name and description changed', details, icon: 'metadata'};
        case 'EventDaoElectorateUpdated': {
            const sources = sourcesLine(list(a.sr_ids), text(a.dr_denom));
            return {
                title: 'Voters changed',
                details: [sources ? `Sources: ${sources}` : 'No sources left: nobody can vote until new ones are set'],
                icon: 'voters',
            };
        }
        case 'EventDaoMembersUpdated': {
            const added = list(a.added);
            const removed = list(a.removed);
            if (added.length > 0) details.push(`Added ${people(added, name)}`);
            if (removed.length > 0) details.push(`Removed ${people(removed, name)}`);
            return {title: 'Members changed', details, icon: 'members'};
        }
        case 'EventAdminExecuted': {
            const count = Number(text(a.msg_count));
            const actions = count === 1 ? 'an action' : Number.isFinite(count) && count > 0 ? `${count} actions` : 'actions';
            return {title: `${who(text(a.admin))} ran ${actions} as this DAO`, details, icon: 'execute'};
        }
        default: {
            const kind = eventKind(event.type).replace(/^Event/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
            return {title: kind ? `Change: ${kind}` : 'The DAO changed', details, icon: 'other'};
        }
    }
}

const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * The time column of a history row, in UTC like the rest of the app: "Today 09:12", "18 Nov 14:40", and the
 * year too when it is not this year ("18 Nov 2025 14:40"); empty when the time is missing or unreadable.
 */
export function historyTime(iso: string | null | undefined, nowMs: number): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date(nowMs);
    const time = date.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', timeZone: 'UTC'});
    if (utcDay(date) === utcDay(now)) return `Today ${time}`;
    const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
    const day = date.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', ...(sameYear ? {} : {year: 'numeric'}), timeZone: 'UTC'});
    return `${day} ${time}`;
}
