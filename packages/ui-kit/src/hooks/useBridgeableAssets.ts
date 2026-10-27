'use client'

import {useMemo} from "react";
import type {Asset, IBCData} from "../types/asset";
import {useAssetsContext} from "./useAssets";
import {isAssetDenied, isChainDenied} from "../constants/cross_chain";
import {isFactoryDenom, isIbcDenom, isLpDenom} from "../utils/denom";
import {ibcVoucherDenom} from "../utils/ibc";
import {DEPOSIT_EXCLUDED_ASSETS} from "../constants/assets";
import {getChains, getChainName, getAssetLists} from "../constants/chain";
import {ibcData as registryIbcData} from "chain-registry";
import {useBlockedIbcInbound} from "./useBlockedIbcInbound";
import {isIbcInboundBlocked} from "../utils/ibc_inbound";

export type BridgeableAssetKind = 'ibc' | 'native' | 'factory';

/**
 * A single asset that can be bridged between BZE and a Cosmos counterparty
 * chain via pure IBC. Built from the user's already-hydrated `Asset` plus
 * the chain-registry metadata for the counterparty chain.
 *
 * Everything the bridge form, balance lookup, and MsgTransfer builder need
 * lives on this one object.
 *
 * An IBC voucher has exactly one entry (the chain it came from). A BZE coin
 * (native or factory) can come back from any chain BZE has a channel with, so
 * it has one entry per such chain, all sharing the same `bzeAsset`.
 */
export interface BridgeableAsset {
    /** The full Asset record from BZE's assets map (has the voucher denom, ticker, logo, decimals, etc). */
    bzeAsset: Asset;
    kind: BridgeableAssetKind;
    /**
     * Channels of the route — guaranteed to have both sides populated. For a
     * BZE coin the trace is the one its voucher has on the counterparty, so
     * `counterparty.baseDenom` is the BZE denom, not what the user holds there.
     */
    ibcData: IBCData;
    /** The denom the user holds and sends on the counterparty chain. */
    sourceDenom: string;
    /** Counterparty chain metadata pulled from chain-registry (pretty name, logo, bech32 prefix). */
    counterparty: {
        chainName: string;
        chainId: string;
        displayName: string;
        logo: string;
        addressPrefix: string;
    };
}

/** A group of bridgeable assets that all sit on the same counterparty chain. */
export interface BridgeableChain {
    chainName: string;
    chainId: string;
    displayName: string;
    logo: string;
    addressPrefix: string;
    assets: BridgeableAsset[];
}

// ─── chain-registry lookup helpers ────────────────────────────────────────
// chain-registry npm exposes camelCase fields. We go through `getChains()`
// (from constants/chain) rather than importing the package directly because
// it also handles testnet mode by merging in the testnet registry.

type RegistryChain = {
    chainName?: string;
    prettyName?: string;
    chainId?: string;
    bech32Prefix?: string;
    logoURIs?: { png?: string; svg?: string };
    apis?: { rest?: Array<{ address: string }> };
};

const registryChainFor = (chainName: string): RegistryChain | undefined => {
    const norm = chainName.toLowerCase();
    const all = getChains() as unknown as RegistryChain[];
    return all.find(c => (c.chainName || '').toLowerCase() === norm);
};

const pickLogo = (c: RegistryChain | undefined): string => {
    const logos = c?.logoURIs;
    return logos?.svg || logos?.png || '';
};

// ─── 2-hop detection ─────────────────────────────────────────────────────
// An asset arriving on BZE through an intermediary chain (e.g. ATONE coming
// via Osmosis instead of directly from AtomOne) is a "2-hop" asset. We
// detect this by checking two conditions:
//
//   1. The base denom on the direct counterparty starts with "ibc/" — meaning
//      it's already a voucher on that chain, not native to it.
//   2. BZE has a direct IBC channel to the asset's TRUE origin chain.
//
// If both are true, the 2-hop path is redundant (the user should use the
// direct channel). We exclude it from the deposit picker but ALWAYS keep it
// withdrawable so holders aren't stranded.
//
// If condition 1 is true but 2 is false (e.g. PHMN from Juno arriving via
// Osmosis, and BZE has no Juno channel), the intermediary path is the ONLY
// way this asset can reach BZE → we allow it.

type RegistryAssetList = {
    chainName?: string;
    assets?: Array<{
        base?: string;
        traces?: Array<{
            type?: string;
            counterparty?: {
                chainName?: string;
                baseDenom?: string;
            };
        }>;
    }>;
};

/**
 * Build a Set of all chain names that BZE has a direct IBC channel with.
 * Computed once at module scope from chain-registry's ibcData.
 */
const buildBzeDirectCounterparties = (): Set<string> => {
    const bzeName = getChainName();
    const names = new Set<string>();
    try {
        for (const entry of registryIbcData as unknown as Array<{
            chain1?: { chainName?: string };
            chain2?: { chainName?: string };
        }>) {
            const a = entry.chain1?.chainName;
            const b = entry.chain2?.chainName;
            if (!a || !b) continue;
            if (a === bzeName) names.add(b);
            else if (b === bzeName) names.add(a);
        }
    } catch {
        // fail quiet
    }
    return names;
};

/** Cached set of BZE's direct IBC counterparties. */
let bzeDirectCounterpartiesCache: Set<string> | undefined;

const getBzeDirectCounterparties = (): Set<string> => {
    if (!bzeDirectCounterpartiesCache) {
        bzeDirectCounterpartiesCache = buildBzeDirectCounterparties();
    }
    return bzeDirectCounterpartiesCache;
};

/**
 * Given a denom that's an IBC voucher on a foreign chain (e.g. `ibc/BC26A7...`
 * on Osmosis), resolve its true origin chain by looking up the denom in the
 * foreign chain's assetlist and walking its traces.
 *
 * Returns the origin chain name (e.g. "atomone") or undefined if we can't
 * determine it (missing from chain-registry).
 */
const resolveOriginChain = (foreignChainName: string, denomOnForeignChain: string): string | undefined => {
    const lists = getAssetLists() as unknown as RegistryAssetList[];
    const chainList = lists.find(
        l => (l.chainName || '').toLowerCase() === foreignChainName.toLowerCase(),
    );
    if (!chainList?.assets) return undefined;

    const assetEntry = chainList.assets.find(a => a.base === denomOnForeignChain);
    if (!assetEntry?.traces?.length) return undefined;

    // Walk traces — the deepest IBC trace's counterparty.chainName is the
    // true origin. Most assets have a single trace entry, but wrapped or
    // multi-hop tokens can have several. We take the last "ibc" trace.
    for (let i = assetEntry.traces.length - 1; i >= 0; i--) {
        const trace = assetEntry.traces[i];
        if (trace.type === 'ibc' && trace.counterparty?.chainName) {
            return trace.counterparty.chainName;
        }
    }

    return undefined;
};

/**
 * Determine whether a 2-hop asset should be auto-excluded from the deposit
 * picker. A 2-hop asset is one whose base denom on the counterparty chain
 * is itself an IBC voucher (starts with "ibc/").
 *
 * We exclude it only if BZE has a direct IBC channel to the asset's true
 * origin chain — in that case the direct path should be used instead.
 *
 * If BZE has no direct channel to the origin (e.g. PHMN from Juno via
 * Osmosis, no BZE↔Juno channel), or we can't resolve the origin at all,
 * we let it through — it's the only viable path.
 */
const is2HopWithDirectAlternative = (counterpartyChainName: string, baseDenomOnCounterparty: string): boolean => {
    // Not a 2-hop asset if the base denom on the counterparty isn't a voucher.
    if (!baseDenomOnCounterparty.startsWith('ibc/')) return false;

    // Try to find the true origin chain from chain-registry's assetlists.
    const originChain = resolveOriginChain(counterpartyChainName, baseDenomOnCounterparty);

    // If we can't determine the origin, give benefit of the doubt → allow.
    if (!originChain) return false;

    // If BZE has a direct channel to the origin → this 2-hop path is redundant.
    return getBzeDirectCounterparties().has(originChain);
};

// ─── Completeness check ───────────────────────────────────────────────────

/** Every field we need to build a MsgTransfer against this asset. */
const isBridgeable = (asset: Asset): boolean => {
    // Use the existing denom-based check rather than asset.type, which uses
    // capitalized ASSET_TYPE_* constants and is easy to mis-compare. Any voucher
    // with an `ibc/...` denom qualifies as long as the trace is complete.
    if (!asset.denom || !isIbcDenom(asset.denom)) return false;
    if (!asset.IBCData) return false;
    if (!asset.IBCData.chain?.channelId) return false;
    if (!asset.IBCData.counterparty?.channelId) return false;
    if (!asset.IBCData.counterparty?.chainName) return false;
    if (!asset.IBCData.counterparty?.baseDenom) return false;
    if (!asset.decimals || asset.decimals <= 0) return false;
    return true;
};

// ─── BZE coins coming back ─────────────────────────────────────────────

const OSMOSIS_CHAIN_NAME = 'osmosis';

/** BZE's own coins (native + factory) that can be sent back from a counterparty. */
const isReturnable = (asset: Asset): boolean => {
    if (!asset.denom || isIbcDenom(asset.denom) || isLpDenom(asset.denom)) return false;
    return !!asset.decimals && asset.decimals > 0;
};

/**
 * One route per counterparty chain, from the channels BZE's IBC vouchers came
 * through (the same pool the withdraw form offers BZE coins). Osmosis first:
 * it's where BZE coins are traded, so it's the usual way back.
 */
const returnRoutes = (ibcChains: IBCData[]): IBCData[] => {
    const bzeName = getChainName();
    const seen = new Set<string>();
    const out: IBCData[] = [];
    for (const entry of ibcChains) {
        const cpName = entry.counterparty?.chainName;
        if (!cpName || cpName === bzeName || seen.has(cpName)) continue;
        if (!entry.chain?.channelId || !entry.counterparty.channelId) continue;
        seen.add(cpName);
        out.push(entry);
    }
    const rank = (c: string) => (c === OSMOSIS_CHAIN_NAME ? 0 : 1);
    out.sort((a, b) =>
        rank(a.counterparty.chainName) - rank(b.counterparty.chainName)
        || a.counterparty.chainName.localeCompare(b.counterparty.chainName),
    );
    return out;
};

// ─── Public hook ──────────────────────────────────────────────────────────

export interface UseBridgeableAssetsResult {
    assets: BridgeableAsset[];
    chains: BridgeableChain[];
    /**
     * Assets left out only because the chain refuses their deposits right now
     * (txfeecollector `blocked_ibc_inbound`), so the form can explain why they are gone.
     */
    blockedAssets: Asset[];
    isLoading: boolean;
}

/**
 * Derives depositable assets straight from the user's BZE asset list. An
 * asset appears in the deposit picker if ALL of these hold:
 *
 *   1. It's an IBC voucher with a complete trace (both sides, base denom,
 *      decimals, etc).
 *   2. Its counterparty chain is present in chain-registry (so we have a
 *      chainId / prefix / display metadata to pass to Keplr).
 *   3. Neither the chain nor the asset is in the env denylist.
 *   4. It's not in the hardcoded `DEPOSIT_EXCLUDED_ASSETS` map.
 *   5. It's not a 2-hop asset whose origin chain BZE already has a direct
 *      channel to. For example, ATONE arriving via Osmosis is excluded
 *      because BZE↔AtomOne is a direct connection and users should use
 *      that instead. However, PHMN arriving via Osmosis from Juno is
 *      allowed because BZE has no direct Juno channel — the Osmosis hop
 *      is the only viable path.
 *   6. The chain does not refuse it: no entry of the txfeecollector
 *      `blocked_ibc_inbound` param matches its BZE-side channel + base
 *      denom. While that param is loading or unavailable nothing is
 *      filtered (fail open). Withdrawals are never affected.
 *
 * BZE's own coins (BZE + factory tokens, not LP shares) are added too, once
 * per counterparty chain BZE has a channel with: holders bring them back
 * from Osmosis and co. The denylist and `DEPOSIT_EXCLUDED_ASSETS` apply.
 * Order: BZE, then IBC vouchers, then factory tokens (verified first).
 *
 * Grouped by counterparty chain for convenience, though the deposit form
 * currently uses the flat `assets` list as an asset-first picker.
 */
export function useBridgeableAssets(): UseBridgeableAssetsResult {
    const {assetsMap, ibcChains, isLoading} = useAssetsContext();
    const blockedIbcInbound = useBlockedIbcInbound();

    const {assets, chains, blockedAssets} = useMemo(() => {
        const ibcAssets: BridgeableAsset[] = [];
        const nativeAssets: BridgeableAsset[] = [];
        const factoryAssets: BridgeableAsset[] = [];
        const blocked: Asset[] = [];
        const byChain = new Map<string, BridgeableChain>();

        const toCounterparty = (cpName: string, fallbackDisplayName: string) => {
            const registryChain = registryChainFor(cpName);
            if (!registryChain) return undefined;
            const chainId = registryChain.chainId || '';
            const addressPrefix = registryChain.bech32Prefix || '';
            if (!chainId || !addressPrefix) return undefined;
            return {
                chainName: cpName,
                chainId,
                displayName: registryChain.prettyName || fallbackDisplayName || cpName,
                logo: pickLogo(registryChain),
                addressPrefix,
            };
        };

        const addToChain = (bridgeable: BridgeableAsset) => {
            const cp = bridgeable.counterparty;
            const existing = byChain.get(cp.chainName);
            if (existing) {
                existing.assets.push(bridgeable);
            } else {
                byChain.set(cp.chainName, {...cp, assets: [bridgeable]});
            }
        };

        const routes = returnRoutes(ibcChains ?? [])
            .filter(r => !isChainDenied(r.counterparty.chainName));

        for (const asset of assetsMap.values()) {
            if (isReturnable(asset)) {
                if (isAssetDenied(asset.denom) || DEPOSIT_EXCLUDED_ASSETS[asset.denom]) continue;
                const kind: BridgeableAssetKind = isFactoryDenom(asset.denom) ? 'factory' : 'native';
                for (const route of routes) {
                    const counterparty = toCounterparty(route.counterparty.chainName, route.counterparty.chainPrettyName);
                    if (!counterparty) continue;
                    const bridgeable: BridgeableAsset = {
                        bzeAsset: asset,
                        kind,
                        ibcData: {
                            chain: {channelId: route.chain.channelId},
                            counterparty: {
                                chainName: route.counterparty.chainName,
                                chainPrettyName: route.counterparty.chainPrettyName,
                                channelId: route.counterparty.channelId,
                                baseDenom: asset.denom,
                            },
                        },
                        sourceDenom: ibcVoucherDenom(route.counterparty.channelId, asset.denom),
                        counterparty,
                    };
                    (kind === 'factory' ? factoryAssets : nativeAssets).push(bridgeable);
                    addToChain(bridgeable);
                }
                continue;
            }

            if (!isBridgeable(asset)) continue;
            if (isAssetDenied(asset.denom)) continue;
            if (DEPOSIT_EXCLUDED_ASSETS[asset.denom]) continue;

            // The chain answers these deposits with an error ack and the sender
            // is refunded on the source chain — never offer them.
            if (isIbcInboundBlocked(asset, blockedIbcInbound)) {
                blocked.push(asset);
                continue;
            }

            const cpName = asset.IBCData!.counterparty.chainName;
            if (isChainDenied(cpName)) continue;

            // Auto-exclude 2-hop assets when BZE has a direct channel to
            // the true origin chain. See the "2-hop detection" block above
            // for the full rationale.
            const cpBaseDenom = asset.IBCData!.counterparty.baseDenom;
            if (is2HopWithDirectAlternative(cpName, cpBaseDenom)) continue;

            const counterparty = toCounterparty(cpName, asset.IBCData!.counterparty.chainPrettyName);
            if (!counterparty) continue;

            const bridgeable: BridgeableAsset = {
                bzeAsset: asset,
                kind: 'ibc',
                ibcData: asset.IBCData!,
                sourceDenom: cpBaseDenom,
                counterparty,
            };

            ibcAssets.push(bridgeable);
            addToChain(bridgeable);
        }

        // Verified factory tokens first; Array.sort is stable, so each token's
        // routes keep their Osmosis-first order.
        factoryAssets.sort((a, b) =>
            Number(b.bzeAsset.verified) - Number(a.bzeAsset.verified)
            || (a.bzeAsset.ticker || '').localeCompare(b.bzeAsset.ticker || ''),
        );
        const allAssets = [...nativeAssets, ...ibcAssets, ...factoryAssets];

        // Stable, deterministic order: chains by displayName, assets by ticker.
        const sortedChains = Array.from(byChain.values()).sort((a, b) =>
            a.displayName.localeCompare(b.displayName),
        );
        for (const c of sortedChains) {
            c.assets.sort((a, b) => (a.bzeAsset.ticker || '').localeCompare(b.bzeAsset.ticker || ''));
        }

        return {assets: allAssets, chains: sortedChains, blockedAssets: blocked};
    }, [assetsMap, ibcChains, blockedIbcInbound]);

    return {assets, chains, blockedAssets, isLoading};
}
