import type {Dao, DaoCoin} from '@bze/bze-ui-kit';
import {ScanUnavailableError, type ScanGetter} from '../dao-scan';
import type {ElectorateOption, IncomingNomination, SubDao} from '../actions/types';
import {isNominationStale, type NominationChain, type NominationDaoRef} from '../admin/nomination';

/** The chain reads that tell the composer how this DAO relates to others. Injected, so the loader needs no network. */
export interface RelationChain {
    /** One DAO; null only for the chain's "not found". Every other failure throws. */
    getDao(id: string): Promise<Dao | null>;
    /** One page of the DAOs an address administers (a self-owned DAO is listed under its own address). */
    getDaosByAdmin(admin: string, pageKey: string | null): Promise<{items: Dao[]; nextKey: string | null}>;
    getBalances(address: string): Promise<DaoCoin[]>;
    /** Every staking source with what the account has staked in it. */
    getStakeOptions(address: string): Promise<ElectorateOption[]>;
}

/** BZE Scan's side: which DAOs say they nominated an account. Throws `ScanUnavailableError` when Scan does not answer. */
export interface RelationScan {
    /** At most `NOMINATION_LIMIT` ids; a full answer means there may be more. */
    daosNominating(address: string): Promise<{id: string}[]>;
}

export interface RelationDeps {
    chain: RelationChain;
    scan: RelationScan;
}

/**
 * A DAO that nominated this DAO, and whether accepting would be refused as stale (error 1135): `stale` is set
 * only when the check was asked for and found it stale. A check that could not be done leaves it unset, so the
 * acceptance stays offered and the chain's own refusal covers it.
 */
export interface CheckedNomination extends IncomingNomination {
    stale?: {parent: NominationDaoRef; changed: NominationDaoRef};
}

export interface Relations {
    subDaos: SubDao[] | null;
    incoming: CheckedNomination[] | null;
    sources: ElectorateOption[] | null;
}

/** What one Scan read of nominations holds; an answer this full may be cut. */
export const NOMINATION_LIMIT = 20;
const MAX_SUB_PAGES = 10;
/** The sub-DAOs whose treasury is read up front (the treasuries are what a payment from a sub-DAO chooses from). */
const MAX_TREASURIES = 50;

const attempt = <T,>(read: () => Promise<T>): Promise<T | null> => read().then((value) => value, () => null);

async function loadSubDaos(chain: RelationChain, dao: Pick<Dao, 'address'>): Promise<SubDao[] | null> {
    const found: Dao[] = [];
    let key: string | null = null;
    for (let page = 0; page < MAX_SUB_PAGES; page++) {
        const result: {items: Dao[]; nextKey: string | null} = await chain.getDaosByAdmin(dao.address, key);
        found.push(...result.items);
        if (!result.nextKey) {
            const subs = found.filter((d) => d.address !== dao.address && d.admin === dao.address);
            return Promise.all(subs.map(async (sub, i): Promise<SubDao> => ({
                dao: sub,
                treasury: i < MAX_TREASURIES ? await attempt(() => chain.getBalances(sub.address)) : null,
                // a stake sub-DAO's electorate checks need its own stake, not this DAO's
                sources: sub.type === 'DAO_TYPE_STAKE' ? await attempt(() => chain.getStakeOptions(sub.address)) : [],
            })));
        }
        key = result.nextKey;
    }
    // more sub-DAOs than the page limit reads: an incomplete list is not offered as the whole list
    return null;
}

/** Scan finds the candidates; the chain's own `pending_admin` decides, so a Scan that ignores the filter cannot offer a wrong one. */
async function loadIncoming(deps: RelationDeps, dao: Pick<Dao, 'address'>, nominations?: NominationChain): Promise<CheckedNomination[] | null> {
    let candidates: {id: string}[];
    try {
        candidates = await deps.scan.daosNominating(dao.address);
    } catch (e) {
        if (e instanceof ScanUnavailableError) return null;
        throw e;
    }
    // a full answer may be cut: an incomplete list is not offered as the whole one
    if (candidates.length >= NOMINATION_LIMIT) return null;
    const read = await Promise.all(candidates.map((c) => deps.chain.getDao(c.id)));
    const confirmed = read.flatMap((d) => (d && d.pending_admin === dao.address ? [d] : []));
    return Promise.all(confirmed.map(async (d): Promise<CheckedNomination> => {
        const item: CheckedNomination = {id: d.id, name: d.name, address: d.address};
        if (!nominations) return item;
        // never throws: a check that cannot be done is "not stale", and the entry stays offered
        const staleness = await isNominationStale(nominations, d);
        return staleness.stale ? {...item, stale: {parent: staleness.parent, changed: staleness.changed}} : item;
    }));
}

/**
 * What the composer knows about this DAO's relations, each part read on its own: one that fails is
 * `null` (unreadable, never "none"), and the actions that need it say so. The nominations are the only
 * part that may be skipped when BZE Scan is down. With `nominations`, each nomination is also checked for
 * staleness (`isNominationStale`) before the composer offers to accept it.
 */
export async function loadRelations(deps: RelationDeps, dao: Pick<Dao, 'address' | 'type'>, nominations?: NominationChain): Promise<Relations> {
    const [subDaos, incoming] = await Promise.all([
        attempt(() => loadSubDaos(deps.chain, dao)),
        attempt(() => loadIncoming(deps, dao, nominations)),
    ]);
    // the sources are for this DAO's electorate form; a stake sub-DAO carries its own
    const sources = dao.type === 'DAO_TYPE_STAKE' ? await attempt(() => deps.chain.getStakeOptions(dao.address)) : [];
    return {subDaos, incoming, sources};
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Scan's `GET /api/v1/daos?pending_admin=<address>`, read through the app's own proxy. */
export function createRelationScan(get: ScanGetter): RelationScan {
    return {
        async daosNominating(address) {
            let answer;
            try {
                answer = await get('daos', [['pending_admin', address], ['limit', String(NOMINATION_LIMIT)]]);
            } catch (e) {
                throw new ScanUnavailableError(e instanceof Error ? e.message : 'BZE Scan is unreachable');
            }
            if (answer.status !== 200 || !isObject(answer.body) || !Array.isArray(answer.body.items)) {
                throw new ScanUnavailableError(`BZE Scan answered HTTP ${answer.status}`);
            }
            return answer.body.items.flatMap((item): {id: string}[] => (isObject(item) && (typeof item.id === 'number' || typeof item.id === 'string') ? [{id: String(item.id)}] : []));
        },
    };
}

/** A nomination that can no longer be accepted: who nominated, and the DAOs the stale text names. */
export interface StaleNomination {
    dao: IncomingNomination;
    parent: NominationDaoRef;
    changed: NominationDaoRef;
}

/**
 * The relations the actions work with, without the stale nominations (so neither the picker, the accept
 * form nor a restored draft can pick one), and the stale ones apart, for the picker to show greyed out.
 */
export function splitStaleNominations(relations: Relations): {relations: Relations; stale: StaleNomination[]} {
    if (relations.incoming === null) return {relations, stale: []};
    const stale = relations.incoming.flatMap((n): StaleNomination[] => (n.stale ? [{dao: {id: n.id, name: n.name, address: n.address}, ...n.stale}] : []));
    if (stale.length === 0) return {relations, stale};
    return {relations: {...relations, incoming: relations.incoming.filter((n) => !n.stale)}, stale};
}

/**
 * Why a nomination is out of date, in the words of the nominee's stale card: the DAO whose admin changed (the
 * parent that runs the nominating DAO, or one above it) and the parent, which has to nominate again.
 */
export function staleNominationText(stale: StaleNomination, nominee: string): string {
    const who = stale.changed.id === stale.parent.id
        ? `${stale.parent.name}, the DAO that runs ${stale.dao.name},`
        : `${stale.changed.name}, which controls ${stale.parent.name},`;
    return `Out of date: ${who} changed its admin after ${nominee} was nominated. ${stale.parent.name} has to nominate it again.`;
}
