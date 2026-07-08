import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";
import { FeeCoin } from "../types/fees";

const CACHE_KEY = "tradebin_params";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface TradebinParamsCache {
    minNativeLiquidityForModuleSwap: string;
    // Fee charged for MsgCreateMarket AND MsgCreateLiquidityPool (chain uses the same param).
    createMarketFee?: FeeCoin;
}

export const getTradebinParams = async (): Promise<TradebinParamsCache | undefined> => {
    // Check local cache first
    const cached = getFromLocalStorage(CACHE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached) as TradebinParamsCache;
            // Entries cached before createMarketFee existed lack the field — refetch those.
            if (parsed.createMarketFee) {
                return parsed;
            }
        } catch {
            // ignore parse error, refetch
        }
    }

    try {
        const client = await getRestClient();
        const response = await client.bze.tradebin.params();
        if (response.params) {
            // Telescope types createMarketFee as `string`, but the LCD wire format is a
            // Coin ({denom, amount}) — same typing mismatch as txfeecollector params.
            const rawFee = (response.params as unknown as {
                createMarketFee?: { denom?: string; amount?: string };
            }).createMarketFee;

            const params: TradebinParamsCache = {
                minNativeLiquidityForModuleSwap: response.params.minNativeLiquidityForModuleSwap,
            };
            if (rawFee?.denom && rawFee?.amount) {
                params.createMarketFee = { denom: rawFee.denom, amount: rawFee.amount };
            }
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_MS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch tradebin params:", e);
    }

    return undefined;
}
