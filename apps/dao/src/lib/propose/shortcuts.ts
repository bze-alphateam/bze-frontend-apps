import type {Dao} from '@bze/bze-ui-kit';
import {MEMBERS_ID} from '../actions/members';
import {shortAddress} from '../format';
import type {Draft} from './draft';

/** The two shortcuts on the DAO page: "Request to join" and "Leave" open the composer with the one action filled in. */
export type Shortcut = 'join' | 'leave';

export const SHORTCUT_PARAM = 'shortcut';

/** The shortcut a page's query string names; anything else (or no value) is none. */
export function shortcutOf(search: string): Shortcut | null {
    const value = new URLSearchParams(search).get(SHORTCUT_PARAM);
    return value === 'join' || value === 'leave' ? value : null;
}

export const shortcutHref = (daoId: string, shortcut: Shortcut): string => `/dao/${daoId}/propose?${SHORTCUT_PARAM}=${shortcut}`;

/**
 * The draft a shortcut opens. The address is the connected wallet's, never read from the link, so a link
 * cannot put anyone else's address in the proposal. Null when the shortcut does not apply to this wallet
 * and DAO: a member asking to join, a DAO that is not open to submissions, the only member leaving, a stake DAO, a wallet that is not connected.
 */
export function shortcutDraft(
    shortcut: Shortcut,
    dao: Pick<Dao, 'type' | 'members' | 'address' | 'config'>,
    wallet: string | null,
    newKey: () => string,
): Draft | null {
    if (!wallet || dao.type !== 'DAO_TYPE_STATIC_LIST') return null;
    const me = wallet.toLowerCase();
    const member = dao.members.some((m) => m.toLowerCase() === me);
    if (shortcut === 'join' && (member || me === dao.address.toLowerCase() || !dao.config.open_submission)) return null;
    if (shortcut === 'leave' && (!member || dao.members.length <= 1)) return null;

    const short = shortAddress(wallet);
    return {
        title: shortcut === 'join' ? `Add ${short} as a member` : `Remove ${short} as a member`,
        summary: '',
        expedited: false,
        actions: [{key: newKey(), type: MEMBERS_ID, fields: shortcut === 'join' ? {add: me, remove: ''} : {add: '', remove: me}}],
    };
}
