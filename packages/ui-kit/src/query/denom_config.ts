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

const inFlight = new Map<string, Promise<DenomConfigRatios>>();

const cacheRatios = (cacheKey: string, ratios: DenomConfigRatios) => {
    setInLocalStorage(
        cacheKey,
        JSON.stringify({gasSurcharge: ratios.gasSurcharge.toFixed(), transferFee: ratios.transferFee.toFixed()}),
        DENOM_CONFIG_CACHE_TTL,
    );
}

const fetchDenomConfig = async (denom: string, cacheKey: string): Promise<DenomConfigRatios> => {
    try {
        const url = `${getSettings().endpoints.restEndpoint}/bze/tokenfactory/denom_config?denom=${encodeURIComponent(denom)}`;
        const resp = await fetch(url);
        if (resp.status !== 200) {
            // 501 on v8.2.0 nodes: no denom config yet. Remember it so every tx does not ask again.
            const zeros = zeroRatios();
            cacheRatios(cacheKey, zeros);
            return zeros;
        }

        const body = await resp.json();
        if (!body?.config) {
            throw new Error("missing config");
        }
        const ratios = parseRatios(body.config.gas_surcharge, body.config.transfer_fee);
        cacheRatios(cacheKey, ratios);
        return ratios;
    } catch (e) {
        // not cached: a failing node may answer on the next call
        console.error("[DenomConfig] failed to fetch denom config", denom, e);
        return zeroRatios();
    }
}

/**
 * The tokenfactory config of a denom (v8.3.0). Only factory denoms have one; any other denom
 * returns zeros without a request. A non-200 answer (501 on v8.2.0 nodes) reads as zeros and is
 * cached; a network error or an invalid answer reads as zeros and is not. Ratios are plain
 * decimals clamped to the chain bounds (gas surcharge 2, transfer fee 0.05). Cached 5 minutes;
 * concurrent callers share one request.
 */
export const getDenomConfig = async (denom: string): Promise<DenomConfigRatios> => {
    if (!denom || !denom.startsWith(FACTORY_PREFIX)) {
        return zeroRatios();
    }

    const cacheKey = `${DENOM_CONFIG_CACHE_KEY}:${denom}`;
    const cached = getFromLocalStorage(cacheKey);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            return parseRatios(parsed.gasSurcharge, parsed.transferFee);
        } catch (e) {
            console.error("[DenomConfig] ignoring unreadable cache entry", e);
        }
    }

    let pending = inFlight.get(denom);
    if (!pending) {
        pending = fetchDenomConfig(denom, cacheKey).finally(() => {
            inFlight.delete(denom);
        });
        inFlight.set(denom, pending);
    }
    return pending;
}
