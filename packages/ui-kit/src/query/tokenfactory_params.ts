import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";
import { FeeCoin } from "../types/fees";

const CACHE_KEY = "tokenfactory_params";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface TokenFactoryParamsCache {
    createDenomFee: FeeCoin;
}

export const getTokenFactoryParams = async (): Promise<TokenFactoryParamsCache | undefined> => {
    const cached = getFromLocalStorage(CACHE_KEY);
    if (cached) {
        try {
            return JSON.parse(cached) as TokenFactoryParamsCache;
        } catch {
            // ignore parse error, refetch
        }
    }

    try {
        const client = await getRestClient();
        const response = await client.bze.tokenfactory.params();
        // The proto jsontag is snake_case, so the wire key is `create_denom_fee`.
        const fee = response?.params?.create_denom_fee;
        if (fee?.denom && fee?.amount) {
            const params: TokenFactoryParamsCache = {
                createDenomFee: { denom: fee.denom, amount: fee.amount },
            };
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_MS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch tokenfactory params:", e);
    }

    return undefined;
}
