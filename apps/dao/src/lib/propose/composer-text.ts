import type {Dao, DaoCoin} from '@bze/bze-ui-kit';
import type {MsgAction} from '../proposal-describe';
import {shortAddress} from '../format';

const n = (value: number): string => value.toLocaleString('en-US');

/** A byte counter under a field: "34 of 140 bytes", or what to do when the text is too long. */
export function bytesLine(used: number, max: number): {text: string; over: boolean} {
    return used > max
        ? {text: `${n(used)} of ${n(max)} bytes: shorten it. Emoji and accents count as 2–4 bytes.`, over: true}
        : {text: `${n(used)} of ${n(max)} bytes`, over: false};
}

/**
 * The summary's counter. The summary is plain text everywhere it is shown (line breaks kept, http(s)
 * links made links, nothing else), so the line says so instead of promising Markdown.
 */
export function summaryLine(used: number, max: number): {text: string; short: string; over: boolean} {
    const bytes = bytesLine(used, max);
    return bytes.over
        ? {...bytes, short: bytes.text}
        : {text: `Plain text. ${bytes.text}. Line breaks are kept and web links become links; no images or HTML.`, short: `Plain text · ${bytes.text}`, over: false};
}

/**
 * The size bar under the actions: the packed messages against `max_proposal_bytes` and the action count
 * against `max_msgs_per_proposal`. `percent` is the bar's fill (bytes), capped at 100.
 */
export function sizeLine(size: number, maxBytes: number, count: number, maxActions: number): {text: string; over: boolean; percent: number} {
    const percent = maxBytes > 0 ? Math.min(100, Math.round((size / maxBytes) * 100)) : 0;
    if (size > maxBytes) return {text: `${n(size)} of ${n(maxBytes)} bytes: remove an action or make one smaller`, over: true, percent};
    if (count > maxActions) return {text: `${n(count)} of ${n(maxActions)} actions: remove an action`, over: true, percent};
    return {text: `${n(size)} of ${n(maxBytes)} bytes · ${n(count)} of ${n(maxActions)} actions`, over: false, percent};
}

/** "2 of 10 proposal slots are in use." */
export const slotsLine = (open: number, max: number): string => `${n(open)} of ${n(max)} proposal slots are in use.`;

/** The picker's subtitle: "<DAO> · Member list · governs itself". */
export function pickerSubtitle(dao: Pick<Dao, 'name' | 'type' | 'admin' | 'address'>): string {
    const type = dao.type === 'DAO_TYPE_STAKE' ? 'Stakers' : 'Member list';
    return `${dao.name} · ${type} · ${dao.admin === dao.address ? 'governs itself' : 'has an admin'}`;
}

/** A piece of an action card's detail line; `strong` pieces are bold. */
export interface Segment {
    text: string;
    strong?: boolean;
}

export interface CardTextContext {
    formatCoin: (coin: DaoCoin) => string;
    /** The connected wallet: its address reads "(you)". */
    wallet: string | null;
    /** A label for an address (the DAO's own name), if one is known. */
    nameOf: (address: string) => string | undefined;
    /** The name of a DAO a message names by number. */
    daoName: (id: string) => string;
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;

/** An address in a card: its label, else the short address, with "(you)" for the wallet. */
function who(address: string, ctx: CardTextContext): Segment[] {
    const you = !!ctx.wallet && ctx.wallet.toLowerCase() === address.toLowerCase();
    return [{text: ctx.nameOf(address) ?? shortAddress(address), strong: true}, ...(you ? [{text: ' (you)'}] : [])];
}

function people(verb: string, list: string[], ctx: CardTextContext): Segment[] {
    if (list.length === 1) return [{text: `${verb} `}, ...who(list[0], ctx)];
    return [{text: `${verb} `}, {text: `${list.length} addresses`, strong: true}];
}

/**
 * The detail line of an action card, read from the built message (what is signed, not what was typed):
 * "<strong>50,000 HONEY</strong> to bze1mm…d3sk", "Add <strong>bze1…7xq4</strong> (you)".
 */
export function cardDetail(action: MsgAction, ctx: CardTextContext): Segment[] {
    switch (action.type) {
        case 'send':
            return [{text: action.amount.map(ctx.formatCoin).join(', ') || 'Nothing', strong: true}, {text: ' to '}, ...who(action.to, ctx)];
        case 'update_config':
            return action.changes.length === 0
                ? [{text: 'The same rules as today'}]
                : [{text: `${plural(action.changes.length, 'setting')} change: `}, {text: action.changes.map((c) => c.label).join(', '), strong: true}];
        case 'update_metadata':
            return [{text: 'Name: '}, {text: action.name, strong: true}, ...(action.description ? [] : [{text: ', no description'}])];
        case 'update_members': {
            const add = action.add.length > 0 ? people('Add', action.add, ctx) : [];
            const remove = action.remove.length > 0 ? people(add.length > 0 ? ', remove' : 'Remove', action.remove, ctx) : [];
            return [...add, ...remove];
        }
        case 'update_electorate': {
            const parts = [
                ...(action.srIds.length > 0 ? [plural(action.srIds.length, 'staking reward')] : []),
                ...(action.drDenom ? ['the Denom Reward'] : []),
            ];
            return parts.length === 0 ? [{text: 'No sources'}] : [{text: 'Votes with '}, {text: parts.join(' and '), strong: true}];
        }
        case 'nominate_admin':
            return action.toVoters ? [{text: 'Hand it to its own voters'}] : [{text: 'Nominate '}, ...who(action.nominee, ctx)];
        case 'withdraw_nomination':
            return [{text: 'Cancel the pending nomination'}];
        case 'accept_admin':
            return [{text: 'Become the admin of '}, {text: ctx.daoName(action.daoId), strong: true}];
        case 'admin_execute':
            return [{text: plural(action.actions.length, 'action'), strong: true}, {text: ` as ${ctx.daoName(action.daoId)}`}];
        case 'other':
            return [{text: action.title, strong: true}];
    }
}
