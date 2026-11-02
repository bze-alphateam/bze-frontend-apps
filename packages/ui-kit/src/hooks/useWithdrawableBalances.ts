'use client'

import {useMemo} from "react";
import type {AssetBalance} from "./useBalances";
import {useBalances} from "./useBalances";
import {useAssetsContext} from "./useAssets";
import {getChainName, getChains} from "../constants/chain";
import {isAssetDenied, isChainDenied} from "../constants/cross_chain";
import {isFactoryDenom, isIbcDenom, isLpDenom} from "../utils/denom";
import {WITHDRAW_EXCLUDED_ASSETS} from "../constants/assets";
import type {ScanChainInfo, ScanRoute} from "../types/asset";

/**
 * A chain the user can pick as an IBC destination. Resolved against
 * chain-registry so we have displayName / logo / chainId / bech32Prefix
 * available for the UI and Keplr wallet connect.
 */
export interface WithdrawDestinationChain {
    chainName: string;
    chainId: string;
    displayName: string;
    logo: string;
    addressPrefix: string;
    /** BZE-side channel we send through to reach this chain. */
    bzeSideChannelId: string;
    /** Scan's REST endpoints for the chain, tried before chain-registry's. */
    restUrls?: string[];
}

export type WithdrawableAssetKind = 'ibc' | 'native' | 'factory';

export interface WithdrawableAsset {
    /** Live balance entry from the AssetsProvider — amount, denom, ticker, logo, decimals, etc. */
    balance: AssetBalance;
    /** What category this balance falls into. Affects destination resolution. */
    kind: WithdrawableAssetKind;
    /**
     * Where the user is allowed to send this asset.
     *   • `ibc`: exactly one entry — the chain the voucher came from. Even for
     *     multi-hop vouchers we keep the direct IBC counterparty, so the user
     *     can always send funds back where they came from.
     *   • `native` / `factory`: every chain BZE has an IBC channel with.
     */
    destinations: WithdrawDestinationChain[];
    /**
     * Pre-selected destination.
     *   • `ibc` → the single entry in `destinations`
     *   • `native` / `factory` → Osmosis if available, else the first entry
     */
    defaultDestination?: WithdrawDestinationChain;
    /** True when the UI should lock the destination picker. */
    isDestinationLocked: boolean;
}

export interface UseWithdrawableBalancesResult {
    assets: WithdrawableAsset[];
    isLoading: boolean;
}

// ─── chain-registry lookup helpers ────────────────────────────────────────

type RegistryChain = {
    chainName?: string;
    prettyName?: string;
    chainId?: string;
    bech32Prefix?: string;
    logoURIs?: { png?: string; svg?: string };
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

/**
 * Build a WithdrawDestinationChain from the counterparty info in an IBCData
 * trace. Requires chain-registry to know about the chain so we can surface
 * chainId / prefix to Keplr — returns undefined otherwise.
 */
const resolveDestination = (
    counterpartyChainName: string,
    bzeSideChannelId: string,
): WithdrawDestinationChain | undefined => {
    const registry = registryChainFor(counterpartyChainName);
    if (!registry) return undefined;
    const chainId = registry.chainId || '';
    const addressPrefix = registry.bech32Prefix || '';
    if (!chainId || !addressPrefix) return undefined;
    return {
        chainName: counterpartyChainName,
        chainId,
        displayName: registry.prettyName || counterpartyChainName,
        logo: pickLogo(registry),
        addressPrefix,
        bzeSideChannelId,
    };
};

/**
 * A destination from Scan's chain data (asset came from BZE Scan's list). The chain must
 * still be one chain-registry knows, as for the registry path; an unknown chain (no name or
 * prefix) is never offered.
 */
const destinationFromScan = (
    info: ScanChainInfo | undefined,
    bzeSideChannelId: string,
): WithdrawDestinationChain | undefined => {
    if (!info || !info.chainName || !info.chainId || !info.bech32Prefix || !bzeSideChannelId) return undefined;
    if (!registryChainFor(info.chainName)) return undefined;
    return {
        chainName: info.chainName,
        chainId: info.chainId,
        displayName: info.prettyName || info.chainName,
        logo: info.logo,
        addressPrefix: info.bech32Prefix,
        bzeSideChannelId,
        restUrls: info.rest.length > 0 ? info.rest : undefined,
    };
};

const scanRouteDestinations = (routes: ScanRoute[]): WithdrawDestinationChain[] => {
    const seen = new Set<string>();
    const out: WithdrawDestinationChain[] = [];
    for (const route of routes) {
        if (seen.has(route.chain.chainName) || isChainDenied(route.chain.chainName)) continue;
        const dest = destinationFromScan(route.chain, route.channelId);
        if (!dest) continue;
        seen.add(dest.chainName);
        out.push(dest);
    }
    out.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return out;
};

const OSMOSIS_CHAIN_NAME = 'osmosis';

/**
 * Lists everything the user currently holds on BZE that can be withdrawn.
 *
 * Rules:
 *   • LP shares are always excluded.
 *   • Zero-balance assets are excluded (no UI noise for things the user doesn't own).
 *   • IBC vouchers lock the destination to their direct counterparty from the
 *     IBC trace. Users cannot redirect an IBC voucher elsewhere — doing so
 *     would strand the asset on a chain that doesn't know how to redeem it.
 *   • BZE-native + factory tokens can be sent anywhere BZE has an IBC channel;
 *     Osmosis is pre-selected because that's the overwhelming common case
 *     (the user wants to trade the token there).
 *
 * When the asset came from BZE Scan's list (`asset.scan`), Scan's `withdraw_allowed` replaces
 * `WITHDRAW_EXCLUDED_ASSETS`, the destination's chain data comes from Scan, and a BZE coin's
 * destinations are its Scan `routes`.
 *
 * Denylist (`NEXT_PUBLIC_BRIDGE_DENY_CHAINS` / `…_DENY_ASSETS`) still applies.
 */
export function useWithdrawableBalances(): UseWithdrawableBalancesResult {
    const {assetsBalances, isLoading} = useBalances();
    const {ibcChains} = useAssetsContext();

    // The full set of chains the user can reach from BZE via IBC — used as the
    // destination pool for native + factory tokens. Built once per ibcChains
    // snapshot so the picker rows don't recompute on every render.
    const openDestinations = useMemo<WithdrawDestinationChain[]>(() => {
        const bzeName = getChainName();
        const seen = new Set<string>();
        const out: WithdrawDestinationChain[] = [];
        for (const entry of ibcChains) {
            const cpName = entry.counterparty.chainName;
            if (!cpName || cpName === bzeName) continue;
            if (seen.has(cpName)) continue;
            if (isChainDenied(cpName)) continue;
            const dest = resolveDestination(cpName, entry.chain.channelId);
            if (!dest) continue;
            seen.add(cpName);
            out.push(dest);
        }
        out.sort((a, b) => a.displayName.localeCompare(b.displayName));
        return out;
    }, [ibcChains]);

    const osmosisDestination = useMemo(
        () => openDestinations.find(d => d.chainName === OSMOSIS_CHAIN_NAME),
        [openDestinations],
    );

    const assets = useMemo<WithdrawableAsset[]>(() => {
        const result: WithdrawableAsset[] = [];

        for (const bal of assetsBalances) {
            if (!bal.denom) continue;
            if (isLpDenom(bal.denom)) continue;
            if (isAssetDenied(bal.denom)) continue;
            if (bal.scan ? !bal.scan.withdrawAllowed : WITHDRAW_EXCLUDED_ASSETS[bal.denom]) continue;
            if (!bal.amount || bal.amount.isZero() || bal.amount.isNegative()) continue;

            // Case 1: IBC voucher — destination is locked to the trace counterparty.
            if (isIbcDenom(bal.denom)) {
                const ibcData = bal.IBCData;
                if (!ibcData || !ibcData.counterparty?.chainName || !ibcData.chain?.channelId) {
                    // No usable trace → we can't safely route it back → hide it from
                    // withdraw. (User can still hold it, just can't use our UI to move it.)
                    continue;
                }
                const dest = bal.scan
                    ? destinationFromScan(bal.scan.counterparty, ibcData.chain.channelId)
                    : resolveDestination(ibcData.counterparty.chainName, ibcData.chain.channelId);
                if (!dest) continue;
                result.push({
                    balance: bal,
                    kind: 'ibc',
                    destinations: [dest],
                    defaultDestination: dest,
                    isDestinationLocked: true,
                });
                continue;
            }

            // Case 2: native or factory — destination is user's choice, so it needs at least
            // one reachable chain (none on a network whose IBC counterparties the registry lacks).
            const destinations = bal.scan ? scanRouteDestinations(bal.scan.routes) : openDestinations;
            if (destinations.length === 0) continue;
            const kind: WithdrawableAssetKind = isFactoryDenom(bal.denom) ? 'factory' : 'native';
            const osmosis = bal.scan
                ? destinations.find(d => d.chainName === OSMOSIS_CHAIN_NAME)
                : osmosisDestination;
            result.push({
                balance: bal,
                kind,
                destinations,
                defaultDestination: osmosis ?? destinations[0],
                isDestinationLocked: false,
            });
        }

        // Sort: highest USD value first, then ticker. Users most want to move
        // the assets they have the most of.
        result.sort((a, b) => {
            const av = a.balance.USDValue?.toNumber?.() ?? 0;
            const bv = b.balance.USDValue?.toNumber?.() ?? 0;
            if (av !== bv) return bv - av;
            return (a.balance.ticker || '').localeCompare(b.balance.ticker || '');
        });

        return result;
    }, [assetsBalances, openDestinations, osmosisDestination]);

    return {assets, isLoading};
}
