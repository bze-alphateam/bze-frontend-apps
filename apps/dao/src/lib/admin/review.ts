import type {Dao, DaoCoin} from '@bze/bze-ui-kit';
import type {MsgAction} from '../proposal-describe';

/** A piece of a sentence; `strong` pieces are bold. */
export interface Segment {
    text: string;
    strong?: boolean;
}

/** An address the way the boards shorten it in running text: "bze1bgf…k2rn". */
export const consoleAddress = (address: string): string =>
    (address.length > 14 ? `${address.slice(0, 7)}…${address.slice(-4)}` : address);

export interface ReviewContext {
    /** The DAO the actions run as: its name leads the sentence, its name and description tell a rename from an edit. */
    dao: Pick<Dao, 'id' | 'name' | 'description'>;
    formatCoin: (coin: DaoCoin) => string;
    /** A label for an address (the DAO's own name), if one is known. */
    nameOf: (address: string) => string | undefined;
    /** The name of a DAO a message names by number (a SubDAO, a nominating DAO); never a number. */
    daoName: (id: string) => string | undefined;
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;

function who(address: string, ctx: ReviewContext): string {
    return ctx.nameOf(address) ?? consoleAddress(address);
}

/** "it" for the DAO itself, else the other DAO's name ("another DAO" when it cannot be named). */
function target(id: string, ctx: ReviewContext): string {
    if (id === ctx.dao.id) return 'it';
    return ctx.daoName(id) ?? 'another DAO';
}

/** What one action does, as a lower-case phrase: "pay 8,000 BZE to bze1gr…a77k", "change its description". */
export function actionPhrase(action: MsgAction, ctx: ReviewContext): string {
    switch (action.type) {
        case 'send':
            return `pay ${action.amount.map(ctx.formatCoin).join(', ') || 'nothing'} to ${who(action.to, ctx)}`;
        case 'update_metadata': {
            const renamed = action.name.trim() !== ctx.dao.name.trim();
            const described = action.description !== ctx.dao.description;
            if (renamed && described) return `rename it to "${action.name}" and change its description`;
            if (renamed) return `rename it to "${action.name}"`;
            return described ? 'change its description' : 'keep its name and description';
        }
        case 'update_config':
            return action.changes.length === 0 ? 'keep its voting rules' : `change ${plural(action.changes.length, 'voting rule')}`;
        case 'update_members': {
            const parts = [
                ...(action.add.length > 0 ? [`add ${action.add.length === 1 ? who(action.add[0], ctx) : plural(action.add.length, 'member')}`] : []),
                ...(action.remove.length > 0 ? [`remove ${action.remove.length === 1 ? who(action.remove[0], ctx) : plural(action.remove.length, 'member')}`] : []),
            ];
            return parts.length === 0 ? 'keep its members' : parts.join(' and ');
        }
        case 'update_electorate':
            return 'change its voters';
        case 'nominate_admin': {
            const of = target(action.daoId, ctx);
            if (action.toVoters) return of === 'it' ? 'hand itself to its voters' : `hand ${of} to its voters`;
            return `nominate ${who(action.nominee, ctx)} to run ${of}`;
        }
        case 'withdraw_nomination': {
            const of = target(action.daoId, ctx);
            return of === 'it' ? 'withdraw its admin nomination' : `withdraw the admin nomination of ${of}`;
        }
        case 'accept_admin':
            return `become the admin of ${target(action.daoId, ctx)}`;
        case 'admin_execute':
            return `run ${plural(action.actions.length, 'action')} as ${target(action.daoId, ctx)}`;
        case 'other':
            return `send "${action.title}"`;
    }
}

/**
 * The admin console's review line (board G1), read from the messages that would be signed:
 * "Builders Grant Fund will: 1. pay 8,000 BZE to bze1gr…a77k, 2. change its description. If one fails, nothing happens."
 * The numbers are bold. Empty for no actions.
 */
export function reviewLine(actions: MsgAction[], ctx: ReviewContext): Segment[] {
    if (actions.length === 0) return [];
    const parts: Segment[] = [{text: `${ctx.dao.name} will: `}];
    actions.forEach((action, i) => {
        parts.push({text: `${i + 1}.`, strong: true}, {text: ` ${actionPhrase(action, ctx)}${i < actions.length - 1 ? ', ' : '.'}`});
    });
    parts.push({text: actions.length === 1 ? ' If it fails, nothing happens.' : ' If one fails, nothing happens.'});
    return parts;
}

/** The run button's words: "Run the action now", "Run 2 actions now", "Run now" with none. */
export const runLabel = (count: number): string =>
    (count === 0 ? 'Run now' : count === 1 ? 'Run the action now' : `Run ${count} actions now`);

/** Who votes in the DAO, for the console's sentences: "its 7 members", "its 1 member", "its stakers". */
export const votersPhrase = (dao: Pick<Dao, 'type' | 'members'>): string =>
    (dao.type === 'DAO_TYPE_STAKE' ? 'its stakers' : `its ${plural(dao.members.length, 'member')}`);

/** The verb after `votersPhrase`: one member votes, members and stakers vote. */
const votes = (dao: Pick<Dao, 'type' | 'members'>): string => (dao.type !== 'DAO_TYPE_STAKE' && dao.members.length === 1 ? 'votes' : 'vote');

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The admin hero's line (board G1). A member list with nobody on it has no voters to name. */
export function heroLine(dao: Pick<Dao, 'type' | 'members'>): string {
    const lead = 'You can run any action as the DAO without a vote, and hand it over.';
    if (dao.type !== 'DAO_TYPE_STAKE' && dao.members.length === 0) return `${lead} It has no members to vote on proposals.`;
    return `${lead} ${capital(votersPhrase(dao))} ${votes(dao)} on proposals as usual.`;
}

/** The handover card's line (board G1). */
export const handOverLine = (dao: Pick<Dao, 'type' | 'members'>): string =>
    `You stop being admin at once. From then on only proposals ${votersPhrase(dao)} ${votes(dao)} on can change the DAO. There's no accept step.`;
