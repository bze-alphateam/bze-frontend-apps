// The DAO list shapes the home page works with: the card every list renders,
// and BZE Scan's answers it is built from (Scan's /api/v1/daos, BFE-353 / BFE-368 / BFE-423).

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
    /** The DAOs the filters match across every page; null when the answer has none (a Scan without BFE-423, or a request without `page`). */
    total: number | null;
}

export type Reason = 'Admin' | 'Nominated' | 'Member' | 'Staker';

export interface MyDaoRow {
    dao: DaoCard;
    /** Why the DAO is in the list: every reason that applies, in a fixed order. */
    reasons: Reason[];
}

// ---- the DAO page (BFE-372) ----

/** Scan's name for an address it knows. */
export interface ScanLabel {
    name: string;
    kind: string;
}

/** What Scan adds to the chain's own DAO on GET /api/v1/daos/{id}: who created it and when, and names for addresses. */
export interface ScanDaoDetail {
    id: number;
    created_time: string | null;
    created_tx_hash: string | null;
    creator: string | null;
    creator_label: ScanLabel | null;
    admin: string;
    admin_label: ScanLabel | null;
    pending_admin: string | null;
    address_label: ScanLabel | null;
    controller: {address: string; label: ScanLabel | null; end_reason: string; path: string[]} | null;
    /** Proposals in voting or with failed actions; missing on an older Scan. */
    proposals_open?: number;
    /** Every proposal Scan has indexed for the DAO, cleaned-up ones included; missing on an older Scan. */
    proposals_total?: number;
}

/** An item of GET /api/v1/daos/{id}/history. `attrs` are the event's attributes as the chain emitted them. */
export interface ScanDaoEvent {
    height: number;
    tx_index: number;
    msg_index: number;
    seq: number;
    type: string;
    attrs: unknown;
    tx_hash: string | null;
    time: string;
}

export interface ScanDaoEventList {
    items: ScanDaoEvent[];
    next_cursor: string | null;
}

/** An item of GET /api/v1/dao-votes?voter=. */
export interface ScanVoterBallot {
    proposal: {id: number; title: string | null; status: string | null; voting_end: string | null};
    dao: {id: number; name: string} | null;
    option: string;
    weight: string;
    effective_weight: string;
    height: number;
    tx_hash: string | null;
    time: string;
}

export interface ScanVoterBallotList {
    items: ScanVoterBallot[];
    next_cursor: string | null;
    supported: boolean;
}
