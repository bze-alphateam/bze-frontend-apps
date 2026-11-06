import type {
    ScanAccount,
    ScanActivityPage,
    ScanHolder,
    ScanModule,
    ScanPage,
    ScanToken,
    ScanTokenEvent,
    ScanTransfer,
    ScanTx,
} from "./types";

// Browser client of BZE Scan's `/api/v1` for Token Activity. Scan sends no CORS headers for
// this app, so it goes through the app's own `/api/scan/*` route (see scan-proxy.ts), which
// forwards the same paths and query.

/** The base the browser calls: the app's Scan route. */
export const SCAN_PROXY_BASE = "/api/scan";

export type ScanFetcher = (url: string, init?: {signal?: AbortSignal}) => Promise<Response>;

/** Scan's error answer (`{"error": {"code", "message"}}`), or the network failing. */
export class ScanError extends Error {
    constructor(
        message: string,
        /** The HTTP status; 0 when Scan could not be reached. */
        readonly status: number,
    ) {
        super(message);
        this.name = "ScanError";
    }

    /** Scan answered 404: not indexed (a transaction) or unknown (a denom). */
    get isNotFound(): boolean {
        return this.status === 404;
    }
}

export interface PageParams {
    cursor?: string | null;
    limit?: number;
}

export interface ActivityParams extends PageParams {
    denom?: string;
    category?: string;
    /** Numbered page (from 1); adds `total`. Not with `cursor`. */
    page?: number;
}

export interface ScanClient {
    token(denom: string, signal?: AbortSignal): Promise<ScanToken>;
    tokenTransfers(denom: string, params?: PageParams, signal?: AbortSignal): Promise<ScanPage<ScanTransfer>>;
    tokenEvents(denom: string, params?: PageParams, signal?: AbortSignal): Promise<ScanPage<ScanTokenEvent>>;
    tokenHolders(denom: string, params?: PageParams, signal?: AbortSignal): Promise<ScanPage<ScanHolder>>;
    account(address: string, signal?: AbortSignal): Promise<ScanAccount>;
    accountActivity(address: string, params?: ActivityParams, signal?: AbortSignal): Promise<ScanActivityPage>;
    tx(hash: string, signal?: AbortSignal): Promise<ScanTx>;
    modules(signal?: AbortSignal): Promise<{items: ScanModule[]}>;
}

export interface ScanClientOptions {
    /** Where `/api/v1` paths are served; defaults to the app's Scan route. */
    baseUrl?: string;
    fetcher?: ScanFetcher;
}

type Query = Record<string, string | number | null | undefined>;

const queryString = (query: Query): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    }
    const text = search.toString();
    return text ? `?${text}` : "";
};

const errorMessage = (body: unknown, status: number): string => {
    const error = (body as {error?: {message?: unknown}} | null)?.error;
    return typeof error?.message === "string" ? error.message : `BZE Scan answered ${status}`;
};

export function createScanClient(options: ScanClientOptions = {}): ScanClient {
    const baseUrl = (options.baseUrl ?? SCAN_PROXY_BASE).replace(/\/+$/, "");
    const fetcher: ScanFetcher = options.fetcher ?? ((url, init) => fetch(url, init));

    const get = async <T>(path: string, query: Query = {}, signal?: AbortSignal): Promise<T> => {
        let response: Response;
        try {
            response = await fetcher(`${baseUrl}/${path}${queryString(query)}`, {signal});
        } catch (e) {
            if ((e as Error)?.name === "AbortError") throw e;
            throw new ScanError("BZE Scan unreachable", 0);
        }

        let body: unknown;
        try {
            body = await response.json();
        } catch {
            throw new ScanError(`BZE Scan answered ${response.status} without JSON`, response.status || 0);
        }
        if (!response.ok) throw new ScanError(errorMessage(body, response.status), response.status);

        return body as T;
    };

    const page = (params: PageParams = {}): Query => ({cursor: params.cursor, limit: params.limit});

    return {
        token: (denom, signal) => get("token", {denom}, signal),
        tokenTransfers: (denom, params, signal) => get("token/transfers", {denom, ...page(params)}, signal),
        tokenEvents: (denom, params, signal) => get("token/events", {denom, ...page(params)}, signal),
        tokenHolders: (denom, params, signal) => get("token/holders", {denom, ...page(params)}, signal),
        account: (address, signal) => get(`accounts/${encodeURIComponent(address)}`, {}, signal),
        accountActivity: (address, params = {}, signal) => get(
            `accounts/${encodeURIComponent(address)}/activity`,
            {denom: params.denom, category: params.category, page: params.page, ...page(params)},
            signal,
        ),
        tx: (hash, signal) => get(`txs/${encodeURIComponent(hash)}`, {}, signal),
        modules: (signal) => get("modules", {}, signal),
    };
}
