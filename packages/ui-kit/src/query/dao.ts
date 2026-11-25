import {getSettings} from "../storage/settings";
import {
    Dao,
    DaoBallot,
    DaoControllerResponse,
    DaoPage,
    DaoPageRequest,
    DaoParams,
    DaoProposal,
    DaoProposalResponse,
    DaoProposalStatus,
    DaoVotingPowerResponse,
} from "../types/dao";

// x/dao queries (chain v8.3.0) over the REST gateway with a raw fetch: the
// gateway wants repeated `statuses=` parameters and the join-record source
// (`sr/1`) in the query string, both of which this file builds itself.
//
// Like the gov queries these throw on a network or HTTP failure, so a page
// can show its error state. The chain's "not found" (HTTP 404) becomes null
// where a missing object is a normal answer, and a node that does not run
// x/dao yet (v8.2.x answers HTTP 501) throws DaoModuleNotSupportedError.

const GRPC_INVALID_ARGUMENT = 3;
const GRPC_NOT_FOUND = 5;
const GRPC_UNIMPLEMENTED = 12;

/** The chain refused the request (an invalid address, an unknown status…) or failed. */
export class DaoQueryError extends Error {
    readonly httpStatus: number;
    /** The gRPC code the gateway sent, 0 when the body had none. */
    readonly grpcCode: number;

    constructor(httpStatus: number, grpcCode: number, message: string) {
        super(message);
        this.name = 'DaoQueryError';
        this.httpStatus = httpStatus;
        this.grpcCode = grpcCode;
    }

    /** InvalidArgument: an invalid address or an unknown status. */
    get isInvalidArgument(): boolean {
        return this.grpcCode === GRPC_INVALID_ARGUMENT;
    }
}

/** The node does not run x/dao (a v8.2.x node answers its routes with HTTP 501). */
export class DaoModuleNotSupportedError extends DaoQueryError {
    constructor(message: string) {
        super(501, GRPC_UNIMPLEMENTED, message);
        this.name = 'DaoModuleNotSupportedError';
    }
}

type Query = [string, string][];

const restEndpoint = (): string => getSettings().endpoints.restEndpoint;

const buildUrl = (path: string, query: Query = []): string => {
    const search = query.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return `${restEndpoint()}/bze/dao/${path}${search ? `?${search}` : ''}`;
}

const pageQuery = (page?: DaoPageRequest): Query => {
    const query: Query = [];
    if (!page) return query;
    if (page.key) query.push(['pagination.key', page.key]);
    if (page.limit !== undefined) query.push(['pagination.limit', String(page.limit)]);
    if (page.reverse) query.push(['pagination.reverse', 'true']);
    if (page.countTotal) query.push(['pagination.count_total', 'true']);
    return query;
}

const readBody = async (resp: Response): Promise<{code?: number; message?: string} & Record<string, unknown>> => {
    try {
        return await resp.json();
    } catch {
        return {};
    }
}

/**
 * GET one route. `nullOnNotFound` turns the chain's NotFound into null; every
 * other non-200 answer throws.
 */
async function getJson<T>(path: string, query: Query, nullOnNotFound: true): Promise<T | null>;
async function getJson<T>(path: string, query?: Query, nullOnNotFound?: false): Promise<T>;
async function getJson<T>(path: string, query: Query = [], nullOnNotFound = false): Promise<T | null> {
    const resp = await fetch(buildUrl(path, query));
    const body = await readBody(resp);
    if (resp.status === 200) {
        return body as T;
    }

    const message = typeof body.message === 'string' ? body.message : `HTTP ${resp.status}`;
    const grpcCode = typeof body.code === 'number' ? body.code : 0;
    if (resp.status === 501 || grpcCode === GRPC_UNIMPLEMENTED) {
        throw new DaoModuleNotSupportedError(message);
    }
    if (nullOnNotFound && resp.status === 404 && grpcCode === GRPC_NOT_FOUND) {
        return null;
    }

    throw new DaoQueryError(resp.status, grpcCode, message);
}

const page = <T>(items: T[] | undefined, pagination?: {next_key?: string | null; total?: string}, countTotal?: boolean): DaoPage<T> => ({
    items: items ?? [],
    nextKey: pagination?.next_key || null,
    ...(countTotal ? {total: pagination?.total ?? '0'} : {}),
});

const idPath = (id: string | number | bigint): string => encodeURIComponent(String(id));

export const getDaoParams = async (): Promise<DaoParams> =>
    (await getJson<{params: DaoParams}>('params')).params;

/** One DAO; null when the chain doesn't have it. */
export const getDao = async (id: string | number | bigint): Promise<Dao | null> =>
    (await getJson<{dao: Dao}>(`dao/${idPath(id)}`, [], true))?.dao ?? null;

/** The DAO that owns an account; null when the address is no DAO's. Throws on an invalid address. */
export const getDaoByAddress = async (address: string): Promise<Dao | null> =>
    (await getJson<{dao: Dao}>(`dao_by_address/${encodeURIComponent(address)}`, [], true))?.dao ?? null;

/** Who ultimately controls a DAO, following its admin chain; null for an unknown DAO. */
export const getDaoController = async (daoId: string | number | bigint): Promise<DaoControllerResponse | null> =>
    getJson<DaoControllerResponse>(`dao_controller/${idPath(daoId)}`, [], true);

/** Every DAO, by id. */
export const getDaos = async (pageRequest?: DaoPageRequest): Promise<DaoPage<Dao>> => {
    const resp = await getJson<{daos: Dao[]; pagination?: {next_key?: string | null; total?: string}}>('daos', pageQuery(pageRequest));
    return page(resp.daos, resp.pagination, pageRequest?.countTotal);
}

/** The DAOs an address is the admin of (a self-owned DAO is listed under its own address). */
export const getDaosByAdmin = async (admin: string, pageRequest?: DaoPageRequest): Promise<DaoPage<Dao>> => {
    const resp = await getJson<{daos: Dao[]; pagination?: {next_key?: string | null; total?: string}}>(
        `daos_by_admin/${encodeURIComponent(admin)}`,
        pageQuery(pageRequest),
    );
    return page(resp.daos, resp.pagination, pageRequest?.countTotal);
}

/** A proposal with its live status; null when unknown, including a cleaned-up one. */
export const getDaoProposal = async (id: string | number | bigint): Promise<DaoProposalResponse | null> =>
    getJson<DaoProposalResponse>(`proposal/${idPath(id)}`, [], true);

/**
 * A DAO's proposals, by id. With `statuses` only those (the stored status: a
 * proposal past its voting end stays VOTING until settled).
 */
export const getDaoProposals = async (
    daoId: string | number | bigint,
    statuses: DaoProposalStatus[] = [],
    pageRequest?: DaoPageRequest,
): Promise<DaoPage<DaoProposal>> => {
    const query: Query = [...new Set(statuses)].map(s => ['statuses', s]);
    const resp = await getJson<{proposals: DaoProposal[]; pagination?: {next_key?: string | null; total?: string}}>(
        `proposals/${idPath(daoId)}`,
        [...query, ...pageQuery(pageRequest)],
    );
    return page(resp.proposals, resp.pagination, pageRequest?.countTotal);
}

/** A voter's ballot; null when they have none. Throws on an invalid voter address. */
export const getDaoBallot = async (proposalId: string | number | bigint, voter: string): Promise<DaoBallot | null> =>
    (await getJson<{ballot: DaoBallot}>(`ballot/${idPath(proposalId)}/${encodeURIComponent(voter)}`, [], true))?.ballot ?? null;

/** A proposal's ballots, by voter key. */
export const getDaoBallots = async (proposalId: string | number | bigint, pageRequest?: DaoPageRequest): Promise<DaoPage<DaoBallot>> => {
    const resp = await getJson<{ballots: DaoBallot[]; pagination?: {next_key?: string | null; total?: string}}>(
        `ballots/${idPath(proposalId)}`,
        pageQuery(pageRequest),
    );
    return page(resp.ballots, resp.pagination, pageRequest?.countTotal);
}

/** An address's voting power in a DAO, now and per open proposal; null for an unknown DAO. */
export const getDaoVotingPower = async (daoId: string | number | bigint, address: string): Promise<DaoVotingPowerResponse | null> =>
    getJson<DaoVotingPowerResponse>(`voting_power/${idPath(daoId)}/${encodeURIComponent(address)}`, [], true);

/** The source key of a staking reward (`sr/{id}`) or a Denom Reward (`dr/{staking denom}`). */
export const daoStakingRewardSource = (rewardId: string): string => `sr/${rewardId}`;
export const daoDenomRewardSource = (stakingDenom: string): string => `dr/${stakingDenom}`;

/**
 * The height an address joined a source at (`sr/{reward_id}` or
 * `dr/{staking_denom}`); null when there is no record.
 */
export const getDaoJoinRecord = async (source: string, address: string): Promise<string | null> =>
    (await getJson<{height: string}>('join_record', [['source', source], ['address', address]], true))?.height ?? null;

const supportByEndpoint = new Map<string, Promise<boolean>>();

/**
 * Whether the node runs x/dao (chain v8.3.0), from `/bze/dao/params`. Kept in
 * memory per REST endpoint for the session. A v8.2.x node's 501 reads as
 * unsupported; a network failure or another error is not remembered and is
 * thrown, so the next call asks again.
 */
export const isDaoModuleSupported = async (): Promise<boolean> => {
    const endpoint = restEndpoint();
    let pending = supportByEndpoint.get(endpoint);
    if (!pending) {
        pending = getDaoParams().then(
            () => true,
            (e) => {
                if (e instanceof DaoModuleNotSupportedError) return false;
                throw e;
            },
        );
        supportByEndpoint.set(endpoint, pending);
        pending.catch(() => supportByEndpoint.delete(endpoint));
    }
    return pending;
}

/** Forget the remembered module support (tests, or after a chain upgrade without a reload). */
export const resetDaoModuleSupportCache = (): void => {
    supportByEndpoint.clear();
}
