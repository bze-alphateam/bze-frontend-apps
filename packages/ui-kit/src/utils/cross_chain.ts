import type {
    SkipChain,
    SkipMsg,
} from "../types/cross_chain";
import {getChainByChainId, getWalletChainsNames} from "../constants/chain";

/**
 * Builds a lookup from a Skip chain to its wallet kit name, undefined when the kit does not have
 * that chain. The kit's chains are fixed when ChainProvider mounts, and `useChain` throws for any
 * other, so only a chain this finds may be handed to `useChain` or `useSDKTx`.
 */
export const createRegisteredChainLookup = () => {
    const registered = new Set(getWalletChainsNames().map(c => c.chainName.toLowerCase()));
    return (chain: Pick<SkipChain, 'chain_id' | 'chain_name'>): string | undefined => {
        const name = getChainByChainId(chain.chain_id)?.chainName ?? chain.chain_name ?? '';
        return registered.has(name.toLowerCase()) ? name : undefined;
    };
};

/**
 * Format a duration in seconds to a human-readable string.
 */
export const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `~${seconds}s`;
    if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
    return `~${Math.ceil(seconds / 3600)}h`;
};

/**
 * Generate a unique ID for transaction history records.
 */
export const generateTxRecordId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

// ─── Skip helpers (reserved for Phase 2) ─────────────────────────────────
// Kept here so the Skip transfer hook can import them unchanged once we
// re-enable Skip routing. Not used in the IBC-only Phase 1 flow.

/**
 * Convert a Skip API message (JSON string with snake_case) to an EncodeObject
 * compatible with the signing client's signAndBroadcast().
 */
export const convertSkipMsgToEncodeObject = (skipMsg: SkipMsg): { typeUrl: string; value: unknown } => {
    const parsed = JSON.parse(skipMsg.msg);

    switch (skipMsg.msg_type_url) {
        case '/ibc.applications.transfer.v1.MsgTransfer':
            return {
                typeUrl: skipMsg.msg_type_url,
                value: {
                    sourcePort: parsed.source_port,
                    sourceChannel: parsed.source_channel,
                    token: parsed.token,
                    sender: parsed.sender,
                    receiver: parsed.receiver,
                    timeoutHeight: parsed.timeout_height ? {
                        revisionNumber: BigInt(parsed.timeout_height.revision_number || '0'),
                        revisionHeight: BigInt(parsed.timeout_height.revision_height || '0'),
                    } : {revisionNumber: BigInt(0), revisionHeight: BigInt(0)},
                    timeoutTimestamp: parsed.timeout_timestamp
                        ? BigInt(parsed.timeout_timestamp)
                        : BigInt(0),
                    memo: parsed.memo || '',
                },
            };

        case '/cosmos.bank.v1beta1.MsgSend':
            return {
                typeUrl: skipMsg.msg_type_url,
                value: {
                    fromAddress: parsed.from_address,
                    toAddress: parsed.to_address,
                    amount: parsed.amount,
                },
            };

        default:
            console.warn(`[convertSkipMsg] Unknown type: ${skipMsg.msg_type_url}, attempting pass-through`);
            return {
                typeUrl: skipMsg.msg_type_url,
                value: parsed,
            };
    }
};

/**
 * Resolve addresses for all chains in a Skip route's required_chain_addresses.
 * Returns undefined if any chain's address is missing.
 */
export const resolveAddressesForRoute = (
    requiredChainAddresses: string[],
    getAddress: (chainId: string) => string | undefined,
): string[] | undefined => {
    const addresses: string[] = [];
    for (const chainId of requiredChainAddresses) {
        const addr = getAddress(chainId);
        if (!addr) {
            console.error(`[resolveAddressesForRoute] Missing address for chain: ${chainId}`);
            return undefined;
        }
        addresses.push(addr);
    }
    return addresses;
};

/**
 * Map a Skip chain_id to a chain-registry chainName.
 */
export const chainIdToChainName = (chainId: string): string | undefined => {
    const chain = getChainByChainId(chainId);
    return chain?.chainName;
};
