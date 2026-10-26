import {Asset} from "../types/asset";
import {DenomTrace} from "../types/ibc";
import {isIbcDenom} from "./denom";

// Where an IBC token on BZE comes from, and over how many hops it got here.
export interface IbcOrigin {
    chainName: string;
    baseDenom: string;
    hops: number;
}

// Minimal shape of a chain-registry ibcData entry (npm package, camelCase).
export interface IbcConnectionEntry {
    chain1: { chainName: string };
    chain2: { chainName: string };
    channels: Array<{
        chain1: { channelId: string; portId: string };
        chain2: { channelId: string; portId: string };
    }>;
}

// Minimal shape of a chain-registry asset list (npm package, camelCase).
export interface RegistryAssetList {
    chainName: string;
    assets: Array<{
        base: string;
        traces?: Array<{
            type: string;
            counterparty: { chainName?: string; baseDenom?: string };
        }>;
    }>;
}

// Longest route we try to follow through the registry before giving up.
const MAX_HOPS = 4

/**
 * Walk a denom trace hop by hop through the chain registry's IBC connections,
 * starting at `startChain`, and return where the token comes from.
 * Returns undefined when a hop is not in the registry.
 */
export const ibcOriginFromTrace = (trace: DenomTrace, startChain: string, connections: IbcConnectionEntry[]): IbcOrigin | undefined => {
    const parts = trace.path.split('/').filter(Boolean)
    if (parts.length < 2 || parts.length % 2 !== 0) {
        return undefined
    }

    let current = startChain
    for (let i = 0; i < parts.length; i += 2) {
        const [portId, channelId] = [parts[i], parts[i + 1]]
        let next: string | undefined
        for (const entry of connections) {
            const sides = entry.chain1.chainName === current ? ['chain1', 'chain2'] as const
                : entry.chain2.chainName === current ? ['chain2', 'chain1'] as const
                : undefined
            if (!sides) continue

            if (entry.channels.some(c => c[sides[0]].channelId === channelId && c[sides[0]].portId === portId)) {
                next = entry[sides[1]].chainName
                break
            }
        }
        if (!next) return undefined
        current = next
    }

    return {chainName: current, baseDenom: trace.base_denom, hops: parts.length / 2}
}

/**
 * Resolve the origin of a token that BZE received from `chainName`, where it
 * is known as `baseDenom`. When that denom is itself an IBC voucher on the
 * counterparty, follow that chain's registry asset list back one hop at a time.
 * Returns undefined when a step is not in the registry.
 */
export const ibcOriginFromRegistry = (chainName: string, baseDenom: string, assetLists: RegistryAssetList[]): IbcOrigin | undefined => {
    let chain = chainName
    let denom = baseDenom
    let hops = 1
    while (isIbcDenom(denom)) {
        if (hops >= MAX_HOPS) return undefined

        const registryAsset = assetLists.find(l => l.chainName === chain)?.assets.find(a => a.base === denom)
        // The last ibc trace is the hop that brought the token to `chain`.
        const lastHop = registryAsset?.traces?.filter(t => t.type === 'ibc').pop()
        if (!lastHop?.counterparty.chainName || !lastHop.counterparty.baseDenom) return undefined

        chain = lastHop.counterparty.chainName
        denom = lastHop.counterparty.baseDenom
        hops++
    }

    return {chainName: chain, baseDenom: denom, hops}
}

/**
 * A token that reached BZE by more than one hop (e.g. AtomOne through Osmosis)
 * while the same token also arrives over its own direct channel is a duplicate
 * voucher: the direct one is the liquid one. Mark the multi-hop one as not
 * verified so it sorts and filters below its direct twin.
 *
 * `origins` maps an IBC denom on BZE to its resolved origin. Multi-hop assets
 * with no direct twin keep their verified flag.
 */
export const unverifyIndirectIbcDuplicates = (assets: Map<string, Asset>, origins: Map<string, IbcOrigin>): void => {
    const originKey = (o: IbcOrigin) => `${o.chainName}|${o.baseDenom}`
    const direct = new Set<string>()
    for (const origin of origins.values()) {
        if (origin.hops === 1) direct.add(originKey(origin))
    }

    for (const [denom, origin] of origins) {
        if (origin.hops < 2 || !direct.has(originKey(origin))) continue

        const asset = assets.get(denom)
        if (asset) asset.verified = false
    }
}
