import type {Dao, DaoControllerResponse} from '@bze/bze-ui-kit';

/** The chain reads the staleness of a nomination needs, injected so the check is tested without a network. */
export interface NominationChain {
    /** The DAOs on a DAO's admin chain; null only for the chain's "not found". Every other failure throws. */
    getController(daoId: string): Promise<DaoControllerResponse | null>;
    /** The DAO that owns an account; null when it is no DAO's. Every failure throws. */
    getDaoByAddress(address: string): Promise<Dao | null>;
}

export type NominationCheck =
    /** No DAO on the admin chain changed its admin since the nomination: accepting works. */
    | {state: 'fresh'}
    /** A DAO on the chain changed control after the nomination (the chain refuses with 1135). */
    | {state: 'stale'; by: {id: string; name: string}}
    /** It could not be checked: never read as fresh. */
    | {state: 'unreadable'; reason: string};

const SEQ = /^\d+$/;

/**
 * The chain refuses an acceptance (1135) when any DAO on the nominated DAO's admin chain, the DAO itself
 * included, changed its admin after the nomination was made: its `admin_seq` is above the nomination's
 * `pending_admin_seq`. The same walk, from `dao_controller`'s `path`. A read that fails, a DAO the walk
 * cannot find or a sequence that is not a number is `unreadable`, so the acceptance is not offered on a guess.
 */
export async function checkNomination(chain: NominationChain, dao: Pick<Dao, 'id' | 'address' | 'name' | 'admin_seq' | 'pending_admin_seq'>): Promise<NominationCheck> {
    const unreadable = (reason: string): NominationCheck => ({state: 'unreadable', reason});
    if (!SEQ.test(dao.pending_admin_seq)) return unreadable('The nomination could not be read.');
    const pendingSeq = BigInt(dao.pending_admin_seq);

    let controller: DaoControllerResponse | null;
    try {
        controller = await chain.getController(dao.id);
    } catch {
        return unreadable('The chain did not answer who controls this DAO.');
    }
    if (!controller || controller.path.length === 0) return unreadable('The chain did not say who controls this DAO.');

    const path = controller.path.includes(dao.address) ? controller.path : [dao.address, ...controller.path];
    for (const address of path) {
        let link: Pick<Dao, 'id' | 'name' | 'admin_seq'> | null;
        if (address === dao.address) {
            link = dao;
        } else {
            try {
                link = await chain.getDaoByAddress(address);
            } catch {
                return unreadable('A DAO that controls this one could not be read from the chain.');
            }
        }
        if (!link || !SEQ.test(link.admin_seq)) return unreadable('A DAO that controls this one could not be read from the chain.');
        if (BigInt(link.admin_seq) > pendingSeq) return {state: 'stale', by: {id: link.id, name: link.name}};
    }
    return {state: 'fresh'};
}

/** What the accept page says instead of the button when the nomination is out of date. */
export const STALE_NOMINATION_TEXT = 'This nomination is out of date; the current admin must withdraw it and nominate again.';
