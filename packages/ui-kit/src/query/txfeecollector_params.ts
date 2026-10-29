import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";

const CACHE_KEY = "txfeecollector_params";
// setInLocalStorage takes its TTL in seconds.
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

/**
 * One entry of the chain's `BlockedIbcInbound` param: ICS-20 packets arriving on
 * `channelId` (the BZE-side destination channel) carrying `baseDenom` are refused,
 * so nothing is minted on BZE and the sender gets a refund.
 */
export interface BlockedIbcInbound {
    channelId: string;
    baseDenom: string;
}

export interface TxFeeCollectorParamsCache {
    validatorMinGasFee: {
        denom: string;
        amount: string;
    };
    blockedIbcInbound: BlockedIbcInbound[];
}

// The LCD JSON as the chain sends it (verified on mainnet and testnet, 2026-10-29):
//
//   {"params":{"ValidatorMinGasFee":{"denom":"ubze","amount":"0.01..."},
//              "MaxBalanceIterations":"100",
//              "BlockedIbcInbound":[{"channel_id":"channel-3","base_denom":"uusdc"}]}}
//
// The params message carries no json tags, so its fields are serialised under their Go
// (PascalCase) names, while the nested messages (Coin, BlockedIbcInbound) do have snake_case
// tags. The snake_case top-level keys are accepted as a fallback in case the chain ever
// adds the tags; a payload matching neither is treated as a failed query.
interface RawMinGasFee {
    denom?: unknown;
    amount?: unknown;
}

interface RawTxFeeCollectorParams {
    ValidatorMinGasFee?: RawMinGasFee;
    BlockedIbcInbound?: unknown;
    validator_min_gas_fee?: RawMinGasFee;
    blocked_ibc_inbound?: unknown;
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v !== "";

// Malformed entries are dropped one by one; a missing or non-array value means
// "nothing blocked".
const parseBlockedIbcInbound = (raw: unknown): BlockedIbcInbound[] => {
    if (!Array.isArray(raw)) return [];

    const result: BlockedIbcInbound[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const {channel_id, base_denom} = entry as { channel_id?: unknown; base_denom?: unknown };
        if (!isNonEmptyString(channel_id) || !isNonEmptyString(base_denom)) continue;
        result.push({channelId: channel_id, baseDenom: base_denom});
    }

    return result;
};

// Entries written before `blockedIbcInbound` existed would hide the block until they
// expire, so anything not in today's shape counts as a cache miss.
const readCache = (): TxFeeCollectorParamsCache | undefined => {
    const cached = getFromLocalStorage(CACHE_KEY);
    if (!cached) return undefined;

    try {
        const parsed = JSON.parse(cached) as Partial<TxFeeCollectorParamsCache> | null;
        if (parsed?.validatorMinGasFee && Array.isArray(parsed.blockedIbcInbound)) {
            return parsed as TxFeeCollectorParamsCache;
        }
    } catch {
        // ignore parse error, refetch
    }

    return undefined;
};

export const getTxFeeCollectorParams = async (): Promise<TxFeeCollectorParamsCache | undefined> => {
    const cached = readCache();
    if (cached) return cached;

    try {
        const client = await getRestClient();
        const response = await client.bze.txfeecollector.params();
        const raw = response?.params as unknown as RawTxFeeCollectorParams | undefined;
        const minGasFee = raw?.ValidatorMinGasFee ?? raw?.validator_min_gas_fee;

        if (isNonEmptyString(minGasFee?.denom) && isNonEmptyString(minGasFee?.amount)) {
            const params: TxFeeCollectorParamsCache = {
                validatorMinGasFee: {
                    denom: minGasFee.denom,
                    amount: minGasFee.amount,
                },
                blockedIbcInbound: parseBlockedIbcInbound(raw?.BlockedIbcInbound ?? raw?.blocked_ibc_inbound),
            };
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_SECONDS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch txfeecollector params:", e);
    }

    return undefined;
}
