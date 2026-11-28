import type {Dao, DaoControllerResponse} from '@bze/bze-ui-kit';

/** The chain reads the staleness of a nomination needs, injected so the check is tested without a network. */
export interface NominationChain {
    /** The DAOs on a DAO's admin chain; null only for the chain's "not found". Every other failure throws. */
    getController(daoId: string): Promise<DaoControllerResponse | null>;
    /** The DAO that owns an account; null when it is no DAO's. Every failure throws. */
    getDaoByAddress(address: string): Promise<Dao | null>;
}

/** A DAO on the admin chain, by its name. */
export interface NominationDaoRef {
    id: string;
    name: string;
}

export type NominationStaleness =
    /**
     * Accepting is not known to fail. `checked` is false when the chain could not be read (a failed read, a DAO
     * the walk cannot find, a sequence that is not a number): the acceptance is still offered, and the chain's
     * own refusal (1135) covers a nomination that turns out stale.
     */
    | {stale: false; checked: boolean}
    /**
     * A DAO on the admin chain changed its admin after the nomination, so the chain refuses the acceptance (1135).
     * `parent` is the DAO's admin, the DAO that runs it and has to nominate again; `changed` is the DAO whose admin
     * changed: the parent itself, or a DAO above it.
     */
    | {stale: true; parent: NominationDaoRef; changed: NominationDaoRef};

export type NominatedDao = Pick<Dao, 'id' | 'address' | 'admin' | 'pending_admin' | 'pending_admin_seq'>;

const SEQ = /^\d+$/;
const UNCHECKED: NominationStaleness = {stale: false, checked: false};
const FRESH: NominationStaleness = {stale: false, checked: true};

/**
 * Whether the chain would refuse to accept the DAO's pending nomination as stale (error 1135), worked out the
 * way the chain's `checkNominationControl` does: it walks the DAO's admin chain (`dao_controller`'s `path`) and
 * refuses when a DAO on it has an `admin_seq` above the nomination's `pending_admin_seq`.
 *
 * The walk starts at the DAO's admin. The chain compares the DAO itself too, but that can never fire: a change
 * of the DAO's own admin clears its nomination, and a nomination is stamped with the latest sequence. So only a
 * DAO run by another DAO can have a stale nomination; one run by an account, or self-owned, never has.
 *
 * Never throws: whatever cannot be read is `{stale: false, checked: false}`.
 */
export async function isNominationStale(chain: NominationChain, dao: NominatedDao): Promise<NominationStaleness> {
    if (dao.pending_admin === '' || dao.admin === dao.address) return FRESH;
    if (!SEQ.test(dao.pending_admin_seq)) return UNCHECKED;
    const pendingSeq = BigInt(dao.pending_admin_seq);

    let controller: DaoControllerResponse | null;
    try {
        controller = await chain.getController(dao.id);
    } catch {
        return UNCHECKED;
    }
    if (!controller || !Array.isArray(controller.path) || controller.path.length === 0) return UNCHECKED;

    // the chain's path starts with the DAO itself; an admin that is an account ends it there
    const above = controller.path.filter((address) => address !== dao.address);
    if (above.length === 0) return FRESH;

    let parent: NominationDaoRef | null = null;
    for (const address of above) {
        let link: Dao | null;
        try {
            link = await chain.getDaoByAddress(address);
        } catch {
            return UNCHECKED;
        }
        if (!link || !SEQ.test(link.admin_seq)) return UNCHECKED;
        const ref = {id: link.id, name: link.name};
        parent ??= ref;
        if (BigInt(link.admin_seq) > pendingSeq) return {stale: true, parent, changed: ref};
    }
    return FRESH;
}
