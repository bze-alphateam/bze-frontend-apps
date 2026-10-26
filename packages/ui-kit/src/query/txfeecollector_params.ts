import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";

const CACHE_KEY = "txfeecollector_params";
// setInLocalStorage takes its TTL in seconds.
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

/**
 * One entry of the chain's `blocked_ibc_inbound` param: ICS-20 packets arriving on
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

// The LCD JSON as the chain sends it. The proto sets gogoproto jsontags, so every
// key is snake_case: Telescope's PascalCase typing (`ValidatorMinGasFee`) does not
// match the wire format, and the bzejs version in use predates `blocked_ibc_inbound`.
// Read the snake_case keys directly.
interface RawTxFeeCollectorParams {
    validator_min_gas_fee?: { denom?: unknown; amount?: unknown };
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
        const minGasFee = raw?.validator_min_gas_fee;

        if (isNonEmptyString(minGasFee?.denom) && isNonEmptyString(minGasFee?.amount)) {
            const params: TxFeeCollectorParamsCache = {
                validatorMinGasFee: {
                    denom: minGasFee.denom,
                    amount: minGasFee.amount,
                },
                blockedIbcInbound: parseBlockedIbcInbound(raw?.blocked_ibc_inbound),
            };
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_SECONDS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch txfeecollector params:", e);
    }

    return undefined;
}
