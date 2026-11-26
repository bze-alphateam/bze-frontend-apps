import BigNumber from "bignumber.js";
import {getSettings} from "../storage/settings";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";

const DENOM_CONFIG_CACHE_KEY = "tokenfactory:denom_config";
// storage TTLs are in seconds
const DENOM_CONFIG_CACHE_TTL = 5 * 60;
const FACTORY_PREFIX = "factory/";

/** The tokenfactory `DenomConfig` ratios the dapps need. Both are zero when the token has no config. */
export interface DenomConfigRatios {
    /** Extra share of the chain's minimum gas price charged when a tx fee is paid in this token (0-2). */
    gasSurcharge: BigNumber;
    /** Share of a protocol fee the chain takes on top when it is paid in this token (0-0.05). */
    transferFee: BigNumber;
}

const zeroRatios = (): DenomConfigRatios => ({gasSurcharge: new BigNumber(0), transferFee: new BigNumber(0)});

// Chain bounds of DenomConfig: gas_surcharge 0-2, transfer_fee 0-0.05
const MAX_GAS_SURCHARGE = new BigNumber(2);
const MAX_TRANSFER_FEE = new BigNumber("0.05");
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/** A plain non-negative decimal string, clamped to `max`. Anything else (hex, exponent, sign, text) throws. */
const parseRatio = (value: unknown, max: BigNumber): BigNumber => {
    if (typeof value !== "string" || !PLAIN_DECIMAL.test(value)) {
        throw new Error(`invalid ratio: ${String(value)}`);
    }
    return BigNumber.minimum(new BigNumber(value), max);
}

const parseRatios = (gasSurcharge: unknown, transferFee: unknown): DenomConfigRatios => ({
    gasSurcharge: parseRatio(gasSurcharge, MAX_GAS_SURCHARGE),
    transferFee: parseRatio(transferFee, MAX_TRANSFER_FEE),
});

/** The whole tokenfactory `DenomConfig` of a denom, as the settings UI needs it. */
export interface DenomConfigInfo {
    /**
     * `ok`: the node answered with a config. `unsupported`: a v8.2.0 node (HTTP 501), the feature does
     * not exist there. `error`: any other failure, nothing known (never cached, ratios read as zero).
     */
    status: 'ok' | 'unsupported' | 'error';
    /** The address that receives the token's fee coins, '' when none. */
    communityPool: string;
    gasSurcharge: BigNumber;
    transferFee: BigNumber;
}

export interface DenomConfigInfoOptions {
    /** Skip the 5-minute cache and ask the node (after the admin changed the config). */
    fresh?: boolean;
}

const DENOM_CONFIG_INFO_CACHE_KEY = "tokenfactory:denom_config_info";
const unsupportedInfo = (): DenomConfigInfo => ({status: 'unsupported', communityPool: '', ...zeroRatios()});
const errorInfo = (): DenomConfigInfo => ({status: 'error', communityPool: '', ...zeroRatios()});

const inFlight = new Map<string, Promise<DenomConfigInfo>>();

const cacheInfo = (denom: string, info: DenomConfigInfo) => {
    setInLocalStorage(
        `${DENOM_CONFIG_CACHE_KEY}:${denom}`,
        JSON.stringify({gasSurcharge: info.gasSurcharge.toFixed(), transferFee: info.transferFee.toFixed()}),
        DENOM_CONFIG_CACHE_TTL,
    );
    setInLocalStorage(
        `${DENOM_CONFIG_INFO_CACHE_KEY}:${denom}`,
        JSON.stringify({
            status: info.status,
            communityPool: info.communityPool,
            gasSurcharge: info.gasSurcharge.toFixed(),
            transferFee: info.transferFee.toFixed(),
        }),
        DENOM_CONFIG_CACHE_TTL,
    );
}

const fetchDenomConfig = async (denom: string): Promise<DenomConfigInfo> => {
    try {
        const url = `${getSettings().endpoints.restEndpoint}/bze/tokenfactory/denom_config?denom=${encodeURIComponent(denom)}`;
        const resp = await fetch(url);
        if (resp.status !== 200) {
            if (resp.status === 501) {
                // v8.2.0 nodes: no denom config yet. Remember it so every tx does not ask again.
                const info = unsupportedInfo();
                cacheInfo(denom, info);
                return info;
            }
            // any other status is a failing node: not cached, the next call asks again
            console.error("[DenomConfig] denom config request answered", resp.status, denom);
            return errorInfo();
        }

        const body = await resp.json();
        if (!body?.config) {
            throw new Error("missing config");
        }
        const communityPool = typeof body.config.community_pool === "string" ? body.config.community_pool : "";
        const ratios = parseRatios(body.config.gas_surcharge, body.config.transfer_fee);
        const info: DenomConfigInfo = {status: 'ok', communityPool, ...ratios};
        cacheInfo(denom, info);
        return info;
    } catch (e) {
        // not cached: a failing node may answer on the next call
        console.error("[DenomConfig] failed to fetch denom config", denom, e);
        return errorInfo();
    }
}

const requestDenomConfig = (denom: string, fresh = false): Promise<DenomConfigInfo> => {
    // A fresh read never joins a request that started earlier: it could carry the config from
    // before the change the caller just made. Its answer is cached like any other.
    if (fresh) {
        return fetchDenomConfig(denom);
    }
    let pending = inFlight.get(denom);
    if (!pending) {
        pending = fetchDenomConfig(denom).finally(() => {
            inFlight.delete(denom);
        });
        inFlight.set(denom, pending);
    }
    return pending;
}

/**
 * The tokenfactory config of a denom (v8.3.0). Only factory denoms have one; any other denom
 * returns zeros without a request. A 501 answer (v8.2.0 nodes) reads as zeros and is cached; any
 * other failure (another status, a network error, an invalid answer) reads as zeros and is not
 * cached. Ratios are plain
 * decimals clamped to the chain bounds (gas surcharge 2, transfer fee 0.05). Cached 5 minutes;
 * concurrent callers share one request.
 */
export const getDenomConfig = async (denom: string): Promise<DenomConfigRatios> => {
    if (!denom || !denom.startsWith(FACTORY_PREFIX)) {
        return zeroRatios();
    }

    const cached = getFromLocalStorage(`${DENOM_CONFIG_CACHE_KEY}:${denom}`);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            return parseRatios(parsed.gasSurcharge, parsed.transferFee);
        } catch (e) {
            console.error("[DenomConfig] ignoring unreadable cache entry", e);
        }
    }

    const {gasSurcharge, transferFee} = await requestDenomConfig(denom);
    return {gasSurcharge, transferFee};
}

/**
 * The whole config of a denom, community pool included, with the "not supported" case
 * (`unsupported`, HTTP 501 on v8.2.0 nodes) told apart from a failed read (`error`). Same cache
 * and shared request as `getDenomConfig`; `{fresh: true}` skips the cache. A non-factory denom is
 * `unsupported` (it has no config), without a request.
 */
export const getDenomConfigInfo = async (denom: string, options: DenomConfigInfoOptions = {}): Promise<DenomConfigInfo> => {
    if (!denom || !denom.startsWith(FACTORY_PREFIX)) {
        return unsupportedInfo();
    }

    if (!options.fresh) {
        const cached = getFromLocalStorage(`${DENOM_CONFIG_INFO_CACHE_KEY}:${denom}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const ratios = parseRatios(parsed.gasSurcharge, parsed.transferFee);
                if ((parsed.status === 'ok' || parsed.status === 'unsupported') && typeof parsed.communityPool === 'string') {
                    return {status: parsed.status, communityPool: parsed.communityPool, ...ratios};
                }
            } catch (e) {
                console.error("[DenomConfig] ignoring unreadable cache entry", e);
            }
        }
    }

    return requestDenomConfig(denom, options.fresh);
}
