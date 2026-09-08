import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";
import { FeeCoin } from "../types/fees";

const CACHE_KEY = "tradebin_params";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface TradebinParamsCache {
    minNativeLiquidityForModuleSwap: string;
    // Fee charged for MsgCreateMarket AND MsgCreateLiquidityPool (chain uses the same param).
    createMarketFee?: FeeCoin;
    // Trading fee charged when an order rests in the order book and is filled later.
    marketMakerFee?: FeeCoin;
    // Trading fee charged when an order (or an AMM swap) executes immediately.
    marketTakerFee?: FeeCoin;
}

// Telescope types the fee params as `string`, but the LCD wire format is a Coin
// ({denom, amount}) — same typing mismatch as txfeecollector params. Accept both a
// Coin object and a "100000ubze" string so a wire-format change can't break us.
type RawFee = { denom?: string; amount?: string } | string | undefined;

const parseFeeCoin = (raw: RawFee): FeeCoin | undefined => {
    if (!raw) {
        return undefined;
    }
    if (typeof raw === "string") {
        const match = raw.match(/^(\d+)([a-zA-Z/][\w/.-]*)$/);
        return match ? { amount: match[1], denom: match[2] } : undefined;
    }
    if (raw.denom && raw.amount) {
        return { denom: raw.denom, amount: raw.amount };
    }
    return undefined;
};

export const getTradebinParams = async (): Promise<TradebinParamsCache | undefined> => {
    // Check local cache first
    const cached = getFromLocalStorage(CACHE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached) as TradebinParamsCache;
            // Entries cached before the fee fields existed lack them — refetch those.
            if (parsed.createMarketFee && parsed.marketMakerFee && parsed.marketTakerFee) {
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
            const rawParams = response.params as unknown as {
                createMarketFee?: RawFee;
                marketMakerFee?: RawFee;
                marketTakerFee?: RawFee;
            };

            const params: TradebinParamsCache = {
                minNativeLiquidityForModuleSwap: response.params.minNativeLiquidityForModuleSwap,
            };
            const createMarketFee = parseFeeCoin(rawParams.createMarketFee);
            if (createMarketFee) {
                params.createMarketFee = createMarketFee;
            }
            const marketMakerFee = parseFeeCoin(rawParams.marketMakerFee);
            if (marketMakerFee) {
                params.marketMakerFee = marketMakerFee;
            }
            const marketTakerFee = parseFeeCoin(rawParams.marketTakerFee);
            if (marketTakerFee) {
                params.marketTakerFee = marketTakerFee;
            }
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_MS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch tradebin params:", e);
    }

    return undefined;
}
