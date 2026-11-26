import type {Dao} from '@bze/bze-ui-kit';
import type {DaoCard, DaoKind, ScanDao} from './dao-types';

const kindOf = (type: string): DaoKind =>
    type === 'stake' || type === 'DAO_TYPE_STAKE' ? 'stake' : 'static_list';

/** A card from Scan's list item. */
export const cardFromScan = (d: ScanDao): DaoCard => ({
    id: String(d.id),
    name: d.name,
    kind: kindOf(d.type),
    address: d.address,
    admin: d.admin,
    selfOwned: d.self_governed,
    createdAt: d.created_time,
    proposalsOpen: typeof d.proposals_open === 'number' ? d.proposals_open : null,
});

/** A card from the chain's DAO (no open-proposal count: the chain has no such index). */
export const cardFromChain = (d: Dao): DaoCard => {
    const seconds = Number(d.created_at);
    return {
        id: d.id,
        name: d.name,
        kind: kindOf(d.type),
        address: d.address,
        admin: d.admin,
        selfOwned: d.admin === d.address,
        createdAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null,
        proposalsOpen: null,
    };
};

/** Whether a card passes the list's type filter and name search (the chain fallback filters here). */
export const matchesFilter = (card: DaoCard, kind: DaoKind | '', query: string): boolean => {
    if (kind && card.kind !== kind) return false;
    const q = query.trim().toLowerCase();
    return !q || card.name.toLowerCase().includes(q);
};
