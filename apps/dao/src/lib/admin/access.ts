import type {Dao} from '@bze/bze-ui-kit';

/** What a connected wallet is to a DAO, as far as the admin console goes. */
export type ConsoleRole = 'admin' | 'nominee' | 'none';

const same = (a: string, b: string): boolean => a !== '' && a.toLowerCase() === b.toLowerCase();

/**
 * Who gets the console of a DAO: its external admin (a person; a self-owned DAO has no admin console, its
 * voters decide) and the account nominated to take over. Anyone else, and a wallet that is not connected, gets
 * nothing. The one gate for the page, its link and the shortcut to it: it reads the DAO from the chain, never
 * the URL.
 */
export function consoleRole(dao: Pick<Dao, 'address' | 'admin' | 'pending_admin'>, wallet: string | null): ConsoleRole {
    if (!wallet) return 'none';
    if (dao.admin !== dao.address && same(dao.admin, wallet)) return 'admin';
    if (same(dao.pending_admin, wallet)) return 'nominee';
    return 'none';
}

/**
 * A short text of who controls the DAO now (admin, nomination and their sequence numbers). Compared before and
 * after a transaction to see that a handover landed; a payment changes none of it, so it is judged by its hash.
 */
export const controlFingerprint = (dao: Pick<Dao, 'admin' | 'pending_admin' | 'admin_seq' | 'pending_admin_seq'>): string =>
    [dao.admin, dao.pending_admin, dao.admin_seq, dao.pending_admin_seq].join('|');
