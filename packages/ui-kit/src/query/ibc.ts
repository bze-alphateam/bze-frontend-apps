import {getSettings} from "../storage/settings";
import {CounterpartyChainForChannel, DenomTrace} from "../types/ibc";
import {sha256, stringToBytes} from "viem";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";

const TRACES_CACHE_KEY = "ibc:traces";
const TRACES_CACHE_TTL = 5 * 60;
const HASH_TRACE_CACHE_TTL = 0;
const IBC_COUNTERPARTY_CACHE_TTL = 0;
const DEFAULT_LIMIT = 1000;

const MAX_LIST_PAGES = 10;

const getRestEndpoint = (): string => getSettings().endpoints.restEndpoint;

const getDenomTracesUrl = (limit: number): string => {
    return `${getRestEndpoint()}/ibc/apps/transfer/v1/denom_traces?pagination.limit=${limit}`;
}

const getHashDenomTracesUrl = (hash: string): string => {
    return `${getRestEndpoint()}/ibc/apps/transfer/v1/denom_traces/${hash}`;
}

// ibc-go v10 (chain v8.3.0) routes. The old denom_traces routes answer 501 there, and the
// v10 ones answer 501 on v8.2.0 nodes, so the HTTP status decides which one is used.
const getDenomsUrl = (limit: number, nextKey?: string): string => {
    const key = nextKey ? `&pagination.key=${encodeURIComponent(nextKey)}` : "";
    return `${getRestEndpoint()}/ibc/apps/transfer/v1/denoms?pagination.limit=${limit}${key}`;
}

const getHashDenomUrl = (hash: string): string => {
    return `${getRestEndpoint()}/ibc/apps/transfer/v1/denoms/${hash}`;
}

// Raw ibc-go v10 shapes; only used here, everything outside sees DenomTrace.
interface Hop {
    port_id: string;
    channel_id: string;
}

interface DenomV10 {
    base: string;
    trace?: Hop[];
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v !== "";

// An ibc denom always has at least one hop, so a missing trace is a malformed answer, not path "".
const denomV10ToTrace = (denom: DenomV10 | undefined | null): DenomTrace | undefined => {
    if (!denom || !isNonEmptyString(denom.base) || !Array.isArray(denom.trace) || denom.trace.length === 0) {
        return undefined;
    }
    if (!denom.trace.every(h => h && isNonEmptyString(h.port_id) && isNonEmptyString(h.channel_id))) {
        return undefined;
    }

    return {
        base_denom: denom.base,
        path: denom.trace.map(h => `${h.port_id}/${h.channel_id}`).join("/"),
    };
}

// ibc/ + upper(sha256(path/base_denom)) is the denom, so an answer is only good for the hash it hashes to.
const traceMatchesHash = (trace: DenomTrace, hash: string): boolean => {
    const computed = sha256(stringToBytes(`${trace.path}/${trace.base_denom}`)).slice(2).toUpperCase();
    return computed === hash.toUpperCase();
}

const stripIbcPrefix = (hash: string): string => hash.replace(/^ibc\//, "");

const getIBCTracesV10 = async (): Promise<{ traces: DenomTrace[]; complete: boolean } | undefined> => {
    const traces: DenomTrace[] = [];
    let nextKey: string | undefined;
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
        const resp = await fetch(getDenomsUrl(DEFAULT_LIMIT, nextKey));
        if (resp.status !== 200) {
            return undefined;
        }

        const responseJson = await resp.json();
        if (!Array.isArray(responseJson.denoms)) {
            return undefined;
        }

        for (const denom of responseJson.denoms as DenomV10[]) {
            const trace = denomV10ToTrace(denom);
            if (trace) {
                traces.push(trace);
            }
        }
        nextKey = responseJson.pagination?.next_key ?? undefined;
        if (!nextKey) {
            return {traces, complete: true};
        }
    }

    console.error("[IBC] denoms list not complete after", MAX_LIST_PAGES, "pages");
    return {traces, complete: false};
}

const getIBCTracesV1 = async (): Promise<DenomTrace[] | undefined> => {
    const resp = await fetch(getDenomTracesUrl(DEFAULT_LIMIT));
    if (resp.status !== 200) {
        console.error("failed to fetch denom traces. status: ", resp.status);
        return undefined;
    }

    const responseJson = await resp.json();
    return responseJson.denom_traces ?? undefined;
}

export const getIBCTraces = async (): Promise<DenomTrace[]> => {
    const cached = getFromLocalStorage(TRACES_CACHE_KEY);
    if (cached) {
        return JSON.parse(cached);
    }

    let traces: DenomTrace[] | undefined;
    try {
        const v10 = await getIBCTracesV10();
        if (v10 && !v10.complete) {
            // A partial list is returned for this call only; caching it would hide the rest.
            return v10.traces;
        }
        traces = v10?.traces;
    } catch (e) {
        console.error("[IBC] failed to fetch denoms", e);
    }

    if (!traces) {
        try {
            traces = await getIBCTracesV1();
        } catch (e) {
            console.error("[IBC] failed to fetch denom traces", e);
        }
    }

    if (!traces) {
        return [];
    }

    setInLocalStorage(TRACES_CACHE_KEY, JSON.stringify(traces), TRACES_CACHE_TTL);

    return traces;
}

const createHashTraceCacheKey = (hash: string): string => {
    return `${TRACES_CACHE_KEY}:${hash}`
}

type HashTraceResult = { trace?: DenomTrace; unknown?: boolean };

// 200 -> the trace; 404 -> the denom does not exist (no fallback); anything else -> failed.
const fetchHashTraceV10 = async (hash: string): Promise<HashTraceResult | undefined> => {
    const resp = await fetch(getHashDenomUrl(hash));
    if (resp.status === 404) {
        return {unknown: true};
    }
    if (resp.status !== 200) {
        return undefined;
    }

    const responseJson = await resp.json();
    const trace = denomV10ToTrace(responseJson.denom);
    if (!trace || !traceMatchesHash(trace, hash)) {
        return undefined;
    }

    return {trace};
}

const fetchHashTraceV1 = async (hash: string): Promise<DenomTrace | undefined> => {
    const resp = await fetch(getHashDenomTracesUrl(hash));
    if (resp.status !== 200) {
        console.error("failed to fetch hash denom trace. status: ", resp.status);
        return undefined;
    }

    const responseJson = await resp.json();
    const trace = responseJson.denom_trace;
    if (!trace || !isNonEmptyString(trace.path) || !isNonEmptyString(trace.base_denom) || !traceMatchesHash(trace, hash)) {
        return undefined;
    }

    return trace;
}

export const getHashIBCTrace = async (rawHash: string): Promise<DenomTrace|undefined> => {
    const hash = stripIbcPrefix(rawHash);
    const cacheKey = createHashTraceCacheKey(hash);
    const cached = getFromLocalStorage(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    let trace: DenomTrace | undefined;
    try {
        const v10 = await fetchHashTraceV10(hash);
        if (v10?.unknown) {
            return;
        }
        trace = v10?.trace;
    } catch (e) {
        console.error("[IBC] failed to fetch denom", e);
    }

    if (!trace) {
        try {
            trace = await fetchHashTraceV1(hash);
        } catch (e) {
            console.error("[IBC] failed to fetch denom trace", e);
        }
    }

    if (!trace) {
        return;
    }

    setInLocalStorage(cacheKey, JSON.stringify(trace), HASH_TRACE_CACHE_TTL);

    return trace;
}

const getChannelIdUrl = (channelId: string, portId: string) => {
    const settings = getSettings()
    return `${settings.endpoints.restEndpoint}/ibc/core/channel/v1/channels/${channelId}/ports/${portId}`;
}

const getConnectionIdUrl = (connectionId: string) => {
    const settings = getSettings()
    return `${settings.endpoints.restEndpoint}/ibc/core/connection/v1/connections/${connectionId}`;
}

const getClientStateUrl = (clientId: string) => {
    const settings = getSettings()
    return `${settings.endpoints.restEndpoint}/ibc/core/client/v1/client_states/${clientId}`;
}

const getIbcCounterpartyChainIdCacheKey = (channelId: string, portId: string) => {
    return `ibc:counterparty:${channelId}:${portId}`;
}

export const counterpartyChainForChannel = async (channelId: string, portId: string = "transfer"): Promise<CounterpartyChainForChannel | undefined> => {
    const cacheKey = getIbcCounterpartyChainIdCacheKey(channelId, portId);
    const cached = getFromLocalStorage(cacheKey);
    if (cached) {
        return JSON.parse(cached) as CounterpartyChainForChannel;
    }

    const result: CounterpartyChainForChannel = {
        chainId: "",
        channelId: "",
    }

    try {
        const chRes = await fetch(getChannelIdUrl(channelId, portId));
        if (!chRes.ok) {
            console.error(`[counterpartyChainForChannel] channel fetch failed: ${chRes.status} ${chRes.statusText}`);
            return undefined;
        }

        const chJson = await chRes.json();
        const connectionId: string | undefined = chJson?.channel?.connection_hops?.[0];
        result.channelId = chJson?.channel?.counterparty?.channel_id;
        if (!connectionId || !result.channelId) {
            console.error(`[counterpartyChainForChannel] no connection_hops for ${channelId}/${portId}`);
            return undefined;
        }

        const connRes = await fetch(getConnectionIdUrl(connectionId));
        if (!connRes.ok) {
            console.error(`[counterpartyChainForChannel] connection fetch failed: ${connRes.status} ${connRes.statusText}`);
            return undefined;
        }
        const connJson = await connRes.json();
        const clientId: string | undefined = connJson?.connection?.client_id;
        if (!clientId) {
            console.error(`[counterpartyChainForChannel] no client_id on ${connectionId}`);
            return undefined;
        }

        const csRes = await fetch(getClientStateUrl(clientId));
        if (!csRes.ok) {
            console.error(`[counterpartyChainForChannel] client_state fetch failed: ${csRes.status} ${csRes.statusText}`);
            return undefined;
        }
        const csJson = await csRes.json();
        const clientState = csJson?.client_state?.value ?? csJson?.client_state;
        const chainId: string | undefined = clientState?.chain_id ?? clientState?.chainId;

        if (!chainId) {
            console.error(`[counterpartyChainForChannel] chain_id missing in client_state for ${clientId}`);
            return undefined;
        }

        result.chainId = chainId;

        setInLocalStorage(cacheKey, JSON.stringify(result), IBC_COUNTERPARTY_CACHE_TTL);

        return result;
    } catch (err) {
        console.error("[counterpartyChainForChannel] unexpected error:", err);
        return undefined;
    }
}
