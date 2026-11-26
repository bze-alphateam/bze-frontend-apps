import type {Dao, DaoCoin} from '@bze/bze-ui-kit';
import {ScanUnavailableError, type ScanGetter} from '../dao-scan';
import type {ElectorateOption, IncomingNomination, SubDao} from '../actions/types';

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
    daosNominating(address: string): Promise<{id: string}[]>;
}

export interface RelationDeps {
    chain: RelationChain;
    scan: RelationScan;
}

export interface Relations {
    subDaos: SubDao[] | null;
    incoming: IncomingNomination[] | null;
    sources: ElectorateOption[] | null;
}

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
            })));
        }
        key = result.nextKey;
    }
    // more sub-DAOs than the page limit reads: an incomplete list is not offered as the whole list
    return null;
}

/** Scan finds the candidates; the chain's own `pending_admin` decides, so a Scan that ignores the filter cannot offer a wrong one. */
async function loadIncoming(deps: RelationDeps, dao: Pick<Dao, 'address'>): Promise<IncomingNomination[] | null> {
    let candidates: {id: string}[];
    try {
        candidates = await deps.scan.daosNominating(dao.address);
    } catch (e) {
        if (e instanceof ScanUnavailableError) return null;
        throw e;
    }
    const read = await Promise.all(candidates.map((c) => deps.chain.getDao(c.id)));
    return read.flatMap((d) => (d && d.pending_admin === dao.address ? [{id: d.id, name: d.name, address: d.address}] : []));
}

/**
 * What the composer knows about this DAO's relations, each part read on its own: one that fails is
 * `null` (unreadable, never "none"), and the actions that need it say so. The nominations are the only
 * part that may be skipped when BZE Scan is down.
 */
export async function loadRelations(deps: RelationDeps, dao: Pick<Dao, 'address' | 'type'>): Promise<Relations> {
    const [subDaos, incoming] = await Promise.all([
        attempt(() => loadSubDaos(deps.chain, dao)),
        attempt(() => loadIncoming(deps, dao)),
    ]);
    // the sources are for the electorate form: this DAO's, or a sub-DAO that votes with stake
    const needSources = dao.type === 'DAO_TYPE_STAKE' || (subDaos ?? []).some((s) => s.dao.type === 'DAO_TYPE_STAKE');
    const sources = needSources ? await attempt(() => deps.chain.getStakeOptions(dao.address)) : [];
    return {subDaos, incoming, sources};
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Scan's `GET /api/v1/daos?pending_admin=<address>`, read through the app's own proxy. */
export function createRelationScan(get: ScanGetter): RelationScan {
    return {
        async daosNominating(address) {
            let answer;
            try {
                answer = await get('daos', [['pending_admin', address], ['limit', '20']]);
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
