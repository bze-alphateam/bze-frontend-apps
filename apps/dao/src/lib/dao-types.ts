// The DAO list shapes the home page works with: the card every list renders,
// and BZE Scan's answers it is built from (Scan's /api/v1/daos and
// /api/v1/dao-proposals, BFE-353 / BFE-354 / BFE-368).

export type DaoKind = 'static_list' | 'stake';

/** One DAO as the list shows it, whether it came from Scan or from the chain. */
export interface DaoCard {
    id: string;
    name: string;
    kind: DaoKind;
    /** The DAO's own account. */
    address: string;
    admin: string;
    /** The DAO owns itself (no outside admin). */
    selfOwned: boolean;
    /** ISO time; null when unknown. */
    createdAt: string | null;
    /** Proposals in voting; null when the source cannot tell (the chain fallback). */
    proposalsOpen: number | null;
}

/** An item of Scan's GET /api/v1/daos. */
export interface ScanDao {
    id: number;
    name: string;
    type: string;
    address: string;
    admin: string;
    self_governed: boolean;
    created_time: string | null;
    proposals_open: number;
}

export interface ScanDaoList {
    items: ScanDao[];
    next_cursor: string | null;
    /** False on a node that has not upgraded to chain v8.3.0. */
    supported: boolean;
}

/** An item of Scan's GET /api/v1/dao-proposals (BFE-368): a proposal with its DAO. */
export interface ScanOpenProposal {
    id: number;
    dao_id: number | null;
    title: string | null;
    status: string | null;
    voting_end: string | null;
    dao: {id: number; name: string; type: string} | null;
}

export interface ScanProposalList {
    items: ScanOpenProposal[];
    next_cursor: string | null;
    supported: boolean;
}

export type Reason = 'Admin' | 'Member' | 'Staker';

export interface MyDaoRow {
    dao: DaoCard;
    /** Why the DAO is in the list: every reason that applies, in a fixed order. */
    reasons: Reason[];
}
