import type {Dao} from '@bze/bze-ui-kit';
import {MEMBERS_ID} from '../actions/members';
import {shortAddress} from '../format';
import type {Draft} from './draft';

/** The two shortcuts of the composer: "Request to join" and "Leave" fill the proposal with the one members action. */
export type Shortcut = 'join' | 'leave';

export const SHORTCUT_PARAM = 'shortcut';

/** The shortcut a page's query string names; anything else (or no value) is none. */
export function shortcutOf(search: string): Shortcut | null {
    const value = new URLSearchParams(search).get(SHORTCUT_PARAM);
    return value === 'join' || value === 'leave' ? value : null;
}

export const shortcutHref = (daoId: string, shortcut: Shortcut): string => `/dao/${daoId}/propose?${SHORTCUT_PARAM}=${shortcut}`;

type ShortcutDao = Pick<Dao, 'type' | 'members' | 'address' | 'config'>;

/**
 * Whether a shortcut is offered to this wallet, only ever when the proposal it prepares could be submitted:
 * - "Request to join": a member list that anyone may submit to (`open_submission`), and a wallet that is
 *   not a member (nor the DAO's own account);
 * - "Leave": a member of a member list (its members may always submit), and not the last member, since a
 *   DAO must keep at least one.
 * A stake DAO and a wallet that is not connected get neither.
 */
export function shortcutApplies(shortcut: Shortcut, dao: ShortcutDao, wallet: string | null): boolean {
    if (!wallet || dao.type !== 'DAO_TYPE_STATIC_LIST') return false;
    const me = wallet.toLowerCase();
    const member = dao.members.some((m) => m.toLowerCase() === me);
    if (shortcut === 'join') return !member && me !== dao.address.toLowerCase() && dao.config.open_submission;
    return member && dao.members.length > 1;
}

/**
 * The draft a shortcut opens. The address is the connected wallet's, never read from the link, so a link
 * cannot put anyone else's address in the proposal. Null when the shortcut does not apply (`shortcutApplies`).
 */
export function shortcutDraft(
    shortcut: Shortcut,
    dao: ShortcutDao,
    wallet: string | null,
    newKey: () => string,
): Draft | null {
    if (!wallet || !shortcutApplies(shortcut, dao, wallet)) return null;
    const me = wallet.toLowerCase();
    const short = shortAddress(wallet);
    return {
        title: shortcut === 'join' ? `Add ${short} as a member` : `Remove ${short} as a member`,
        summary: '',
        expedited: false,
        actions: [{key: newKey(), type: MEMBERS_ID, fields: shortcut === 'join' ? {add: me, remove: ''} : {add: '', remove: me}}],
    };
}

/** The button text of a shortcut, with the DAO's name. */
export const shortcutLabel = (shortcut: Shortcut, daoName: string): string => (shortcut === 'join' ? `Request to join ${daoName}` : `Leave ${daoName}`);
