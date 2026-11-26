import type {DaoCard, MyDaoRow, Reason} from './dao-types';

export interface MyDaoSources {
    /** DAOs the wallet administers, from the chain (self-owned ones left out here). */
    admin: DaoCard[];
    /** DAOs that nominated the wallet as their next admin (each confirmed on the chain). */
    nominated: DaoCard[];
    /** Static-list DAOs that list the wallet, from Scan. */
    member: DaoCard[];
    /** DAOs whose electorate uses a source the wallet stakes in, from Scan. */
    staker: DaoCard[];
}

const ORDER: Reason[] = ['Admin', 'Nominated', 'Member', 'Staker'];

/**
 * The union of the three lists, one row per DAO: a DAO that is both administered and joined
 * is listed once with both reasons. Self-owned DAOs are not administered by the wallet and
 * never get the Admin reason. Newest DAO first.
 */
export function buildMyDaos(sources: MyDaoSources): MyDaoRow[] {
    const rows = new Map<string, MyDaoRow>();
    const add = (cards: DaoCard[], reason: Reason) => {
        for (const dao of cards) {
            if (reason === 'Admin' && dao.selfOwned) continue;
            const row = rows.get(dao.id);
            if (!row) {
                rows.set(dao.id, {dao, reasons: [reason]});
            } else if (!row.reasons.includes(reason)) {
                row.reasons.push(reason);
                // Scan's card carries the open-proposal count the chain's does not
                if (row.dao.proposalsOpen === null && dao.proposalsOpen !== null) row.dao = dao;
            }
        }
    };
    add(sources.admin, 'Admin');
    add(sources.nominated, 'Nominated');
    add(sources.member, 'Member');
    add(sources.staker, 'Staker');

    for (const row of rows.values()) row.reasons.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return [...rows.values()].sort((a, b) => Number(BigInt(b.dao.id) - BigInt(a.dao.id)));
}
