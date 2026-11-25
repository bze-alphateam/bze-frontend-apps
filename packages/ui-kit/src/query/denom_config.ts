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

const parseRatio = (value: unknown): BigNumber => {
    if (value === undefined || value === null || value === "") {
        return new BigNumber(0);
    }
    const parsed = new BigNumber(value as BigNumber.Value);
    if (!parsed.isFinite() || parsed.isNegative()) {
        throw new Error(`invalid ratio: ${String(value)}`);
    }
    return parsed;
}

/**
 * The tokenfactory config of a denom (v8.3.0). Only factory denoms have one; any other denom
 * returns zeros without a request. A v8.2.0 node answers 501 and a failing node cannot be
 * priced against, so both read as zeros, like an unparseable answer. Cached for 5 minutes.
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
            return {gasSurcharge: parseRatio(parsed.gasSurcharge), transferFee: parseRatio(parsed.transferFee)};
        } catch (e) {
            console.error("[DenomConfig] ignoring unreadable cache entry", e);
        }
    }

    try {
        const url = `${getSettings().endpoints.restEndpoint}/bze/tokenfactory/denom_config?denom=${encodeURIComponent(denom)}`;
        const resp = await fetch(url);
        if (resp.status !== 200) {
            // 501 on v8.2.0 nodes: no denom config yet
            return zeroRatios();
        }

        const body = await resp.json();
        const ratios = {
            gasSurcharge: parseRatio(body?.config?.gas_surcharge),
            transferFee: parseRatio(body?.config?.transfer_fee),
        };
        setInLocalStorage(
            cacheKey,
            JSON.stringify({gasSurcharge: ratios.gasSurcharge.toFixed(), transferFee: ratios.transferFee.toFixed()}),
            DENOM_CONFIG_CACHE_TTL,
        );
        return ratios;
    } catch (e) {
        console.error("[DenomConfig] failed to fetch denom config", denom, e);
        return zeroRatios();
    }
}
