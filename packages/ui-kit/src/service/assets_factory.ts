import {getAllSupply, getAllSupplyMetadata} from "../query/supply";
import {MetadataSDKType} from "@bze/bzejs/cosmos/bank/v1beta1/bank";
import {Asset, ChainAssets, IBCData, IbcTransitionMock, LP_ASSETS_DECIMALS, ScanAssetData, ScanChainInfo} from "../types/asset";
import type {RegistryAsset, RegistryAssetsResponse, RegistryChainInfo} from "../types/registry_asset";
import {fetchRegistryAssets, getCachedRegistryAssets} from "../query/registry_assets";
import {getDenomType, isFactoryDenom, isIbcDenom, isLpDenom, isNativeDenom, truncateDenom} from "../utils/denom";
import {BZE_CIRCLE_LOGO, TOKEN_LOGO_PLACEHOLDER} from "../constants/placeholders";
import {EXCLUDED_ASSETS, STABLE_COINS, VERIFIED_ASSETS} from "../constants/assets";
import {
    getAssetLists, getChainByChainId,
    getChainName,
    getChains,
    getIBCAssetList,
    getIBCConnections
} from "../constants/chain";
import {getExponentByDenomFromAsset} from "@chain-registry/utils";
import {counterpartyChainForChannel, getHashIBCTrace} from "../query/ibc";
import {Asset as ChainRegistryAsset} from "@chain-registry/types";
import {denomOnFirstHopChainFromTrace} from "../utils/ibc";
import {createLpDenomPoolsMap} from "../utils/liquidity_pool";
import {getLiquidityPools} from "../query/liquidity_pools";
import {getHaltedDenoms} from "../query/halted_denoms";
import {
    ibcOriginFromRegistry,
    ibcOriginFromTrace,
    IbcOrigin,
    RegistryAssetList,
    unverifyIndirectIbcDuplicates
} from "../utils/ibc_duplicates";

const ORIGIN_CHAIN_PLACEHOLDER = "Unknown chain"

// Appends origin chain to name/ticker for non-canonical IBC assets (resolved via denom trace, not chain registry)
const appendOriginChain = (asset: Asset): void => {
    const chainName = asset.IBCData?.counterparty?.chainName
    if (!chainName) return

    asset.ticker = `${asset.ticker}.${chainName}`
    asset.name = `${asset.name} (${asset.IBCData?.counterparty?.chainPrettyName || chainName})`
}

const getAssetLogo = (asset: ChainRegistryAsset): string => {
    return asset.logoURIs?.svg ?? asset.logoURIs?.png ?? asset.images?.[0]?.svg ?? asset.images?.[0]?.png ?? TOKEN_LOGO_PLACEHOLDER
}

interface ChainData {
    metadata: Record<string, MetadataSDKType>;
    supply: { denom: string; amount: string }[] | undefined;
    pools: Awaited<ReturnType<typeof getLiquidityPools>> | undefined;
    halted: Set<string>;
}

const getChainData = async (): Promise<ChainData> => {
    const [metadata, supply, pools, haltedList] = await Promise.all([getAllMetadataMap(), getAllSupply(), getLiquidityPools(), getHaltedDenoms()])
    return {metadata, supply, pools, halted: new Set(haltedList)}
}

const emptyChainAssets = (): ChainAssets => ({
    assets: new Map<string, Asset>(),
    ibcData: new Map<string, IBCData>()
})

// The version of the Scan list the last build used: the post-tx refetch waits for it to move.
let lastRegistryVersion: string | undefined

/**
 * The assets of BZE, keyed by denom. The list comes from BZE Scan (/api/v1/registry/assets),
 * which holds the curation (verified, excluded, stable, deposit/withdraw, notices) and the
 * registry data; the supply always comes from the chain. Denoms Scan does not list yet (a token
 * created seconds ago) are built from the chain and never verified. When Scan cannot be reached
 * the last list kept in localStorage is used, and without one the whole list is built from the
 * chain + the bundled chain-registry package + the hard-coded curation lists, as before Scan.
 */
export const getChainAssets = async (): Promise<ChainAssets> => {
    const [chain, fetched] = await Promise.all([getChainData(), fetchRegistryAssets()])
    return buildChainAssets(chain, fetched ?? getCachedRegistryAssets())
}

export const ASSETS_REFRESH_ATTEMPTS = 5
export const ASSETS_REFRESH_INTERVAL_MS = 3000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Refetches the asset list after the user's own transaction that adds or changes an asset
 * (token creation, metadata or branding update). Scan rebuilds its list a few seconds after the
 * block, so the list is refetched past the browser's HTTP cache (`cache: 'no-cache'`) up to
 * ASSETS_REFRESH_ATTEMPTS times, ASSETS_REFRESH_INTERVAL_MS apart. With a `denom` it stops once
 * Scan's entry for that denom has caught up with the chain; without one, once the version changes.
 * The version alone is not enough for a denom: it also moves for other people's changes.
 *
 * `onInterim` gets the list at once, with `denom` built from the chain (so the new token or its
 * new metadata shows while Scan catches up). When Scan never catches up, the newest list fetched
 * is returned with `denom` still built from the chain, or the interim build if no fetch worked.
 */
export const getChainAssetsAfterTx = async (denom?: string, onInterim?: (assets: ChainAssets) => void): Promise<ChainAssets> => {
    const previousVersion = lastRegistryVersion
    const chain = await getChainData()
    const current = getCachedRegistryAssets()
    const interim = await buildChainAssets(chain, current, denom)
    onInterim?.(interim)

    const wasListed = !!denom && !!current?.assets.some(a => a.denom === denom)
    const chainBuilt = denom ? interim.assets.get(denom) : undefined
    let newest: RegistryAssetsResponse | undefined
    for (let attempt = 0; attempt < ASSETS_REFRESH_ATTEMPTS; attempt++) {
        if (attempt > 0) {
            await sleep(ASSETS_REFRESH_INTERVAL_MS)
        }
        const list = await fetchRegistryAssets(true)
        if (!list) continue
        if (!denom) {
            if (list.version !== previousVersion) {
                return buildChainAssets(chain, list)
            }
            continue
        }
        newest = list
        if (registryCaughtUp(list, denom, wasListed, chainBuilt)) {
            return buildChainAssets(chain, list)
        }
    }

    return newest ? buildChainAssets(chain, newest, denom) : interim
}

// A new denom has caught up once Scan lists it; a changed one once Scan shows what the chain shows.
const registryCaughtUp = (list: RegistryAssetsResponse, denom: string, wasListed: boolean, chainBuilt: Asset | undefined): boolean => {
    const entry = list.assets.find(a => a.denom === denom)
    if (!entry) return false
    if (!wasListed || !chainBuilt) return true

    return entry.name === chainBuilt.name
        && entry.ticker.toUpperCase() === chainBuilt.ticker.toUpperCase()
        && entry.decimals === chainBuilt.decimals
        && (entry.description ?? '') === (chainBuilt.description ?? '')
}

const buildChainAssets = async (chain: ChainData, list: RegistryAssetsResponse | undefined, chainBuiltDenom?: string): Promise<ChainAssets> => {
    if (!chain.supply) {
        return emptyChainAssets()
    }
    if (!list) {
        return buildAssetsFromChain(chain.supply.filter(asset => !EXCLUDED_ASSETS[asset.denom]), chain)
    }
    lastRegistryVersion = list.version

    return buildAssetsFromRegistry(list, chain, chainBuiltDenom)
}

const buildAssetsFromRegistry = async (list: RegistryAssetsResponse, chain: ChainData, chainBuiltDenom?: string): Promise<ChainAssets> => {
    const result = emptyChainAssets()
    // Every listed denom, excluded ones too: an excluded denom is not "missing".
    const listed = new Map(list.assets.map(a => [a.denom, a]))
    const missing: { denom: string; amount: string }[] = []
    for (const entry of chain.supply ?? []) {
        const registryAsset = listed.get(entry.denom)
        if (registryAsset?.excluded) continue
        if (!registryAsset || entry.denom === chainBuiltDenom) {
            missing.push(entry)
            continue
        }
        const asset = assetFromRegistry(registryAsset, BigInt(entry.amount), chain.halted)
        result.assets.set(asset.denom, asset)
        if (asset.IBCData && asset.IBCData.chain.channelId !== '') {
            result.ibcData.set(asset.IBCData.chain.channelId, asset.IBCData)
        }
    }
    if (missing.length === 0) {
        return result
    }

    const fromChain = await buildAssetsFromChain(missing, chain, result.assets)
    for (const asset of fromChain.assets.values()) {
        const registryAsset = listed.get(asset.denom)
        if (registryAsset) {
            // The denom the user just changed: its display fields come from the chain while
            // Scan catches up, its curation stays Scan's.
            asset.verified = registryAsset.verified
            asset.stable = registryAsset.stable
            asset.scan = scanDataFromRegistry(registryAsset)
        } else {
            // Not in Scan's list yet: nothing vouches for it.
            asset.verified = false
        }
        result.assets.set(asset.denom, asset)
    }
    for (const [channelId, ibcData] of fromChain.ibcData) {
        if (!result.ibcData.has(channelId)) {
            result.ibcData.set(channelId, ibcData)
        }
    }

    return result
}

const chainInfoFromRegistry = (chain: RegistryChainInfo): ScanChainInfo => ({
    chainName: chain.chain_name ?? '',
    chainId: chain.chain_id,
    prettyName: chain.pretty_name,
    logo: chain.logo ?? '',
    bech32Prefix: chain.bech32_prefix ?? '',
    rest: chain.rest ?? [],
})

const scanDataFromRegistry = (registryAsset: RegistryAsset): ScanAssetData => ({
    depositAllowed: registryAsset.deposit_allowed,
    withdrawAllowed: registryAsset.withdraw_allowed,
    notice: registryAsset.notice ?? undefined,
    counterparty: registryAsset.ibc ? chainInfoFromRegistry(registryAsset.ibc.counterparty) : undefined,
    origin: registryAsset.ibc?.origin
        ? {chainName: registryAsset.ibc.origin.chain_name, baseDenom: registryAsset.ibc.origin.base_denom, hops: registryAsset.ibc.origin.hops}
        : undefined,
    routes: (registryAsset.routes ?? []).map(route => ({
        chain: chainInfoFromRegistry(route),
        channelId: route.channel_id,
        counterpartyChannelId: route.counterparty_channel_id,
        counterpartyDenom: route.counterparty_denom,
    })),
})

const assetFromRegistry = (registryAsset: RegistryAsset, supply: bigint, halted: Set<string>): Asset => {
    const lp = registryAsset.lp
    const asset: Asset = {
        denom: registryAsset.denom,
        type: getDenomType(registryAsset.denom),
        name: registryAsset.name,
        ticker: registryAsset.ticker,
        decimals: registryAsset.decimals,
        logo: registryAsset.logo || TOKEN_LOGO_PLACEHOLDER,
        stable: registryAsset.stable,
        verified: registryAsset.verified,
        // The chain's halted list is read live; Scan's copy may lag a block or two.
        halted: registryAsset.halted || halted.has(registryAsset.denom) || (!!lp && (halted.has(lp.base) || halted.has(lp.quote))),
        supply,
        scan: scanDataFromRegistry(registryAsset),
    }
    if (registryAsset.description) {
        asset.description = registryAsset.description
    }
    const ibc = registryAsset.ibc
    if (ibc) {
        asset.IBCData = {
            chain: {
                channelId: ibc.channel_id
            },
            counterparty: {
                chainName: ibc.counterparty.chain_name ?? '',
                chainPrettyName: ibc.counterparty.pretty_name,
                channelId: ibc.counterparty.channel_id,
                baseDenom: ibc.counterparty.base_denom,
            }
        }
    }

    return asset
}

// The pre-Scan build: the chain's bank metadata + the bundled chain-registry package + the
// hard-coded curation lists. Used for the whole list when Scan and its stored copy are both
// unavailable, and for the denoms Scan does not list yet. `known` holds the assets already
// built, so an LP share can name a pool whose assets came from Scan.
const buildAssetsFromChain = async (supply: { denom: string; amount: string }[], chain: ChainData, known?: Map<string, Asset>): Promise<ChainAssets> => {
    const {metadata, pools, halted} = chain
    const result = emptyChainAssets()

    const lpAssets = []
    const ibcOrigins = new Map<string, IbcOrigin>()
    for (const asset of supply) {
        const baseAsset = createAsset(asset.denom, BigInt(asset.amount));
        baseAsset.halted = halted.has(asset.denom)
        if (isLpDenom(asset.denom)) {
            lpAssets.push(baseAsset)
            continue
        }
        let finalAsset = await populateAssetFromChainRegistry(baseAsset, ibcOrigins);

        if (!finalAsset) {
            const metadataEntry = metadata[asset.denom]
            finalAsset = populateAssetFromBlockchainMetadata(baseAsset, metadataEntry)
        }

        result.assets.set(finalAsset.denom, finalAsset)
        if (isIbcDenom(finalAsset.denom) && finalAsset.IBCData && finalAsset.IBCData.chain.channelId !== '') {
            result.ibcData.set(finalAsset.IBCData.chain.channelId, finalAsset.IBCData)
        }
    }

    unverifyIndirectIbcDuplicates(result.assets, ibcOrigins)

    // Resolve each LP asset's base/quote from the pools list (works for both legacy
    // ulp_<base>_<quote> and hashed ulp/<hash> denoms). Fall back to parsing legacy
    // denoms in case the pools fetch failed.
    const poolsByLpDenom = createLpDenomPoolsMap(pools ?? [])
    const assetOf = (denom: string | undefined) => denom ? (result.assets.get(denom) ?? known?.get(denom)) : undefined
    for (const lpAsset of lpAssets) {
        const pool = poolsByLpDenom.get(lpAsset.denom)
        let baseDenom = pool?.base
        let quoteDenom = pool?.quote
        if (!baseDenom || !quoteDenom) {
            const split = lpAsset.denom.split('_')
            if (split.length === 3) {
                baseDenom = split[1]
                quoteDenom = split[2]
            }
        }

        const baseAsset = assetOf(baseDenom)
        const quoteAsset = assetOf(quoteDenom)
        if (!baseAsset || !quoteAsset) {
            result.assets.set(lpAsset.denom, lpAsset)
            continue;
        }

        lpAsset.name = `${baseAsset.ticker}/${quoteAsset.ticker} LP Shares`
        lpAsset.ticker = `${baseAsset.ticker}/${quoteAsset.ticker} LP`
        lpAsset.verified = true
        lpAsset.halted = halted.has(baseAsset.denom) || halted.has(quoteAsset.denom)
        lpAsset.decimals = LP_ASSETS_DECIMALS

        result.assets.set(lpAsset.denom, lpAsset)
    }

    return result
}

// ibcOrigins collects the origin of every IBC asset resolved here, so the
// caller can spot multi-hop duplicates of directly bridged tokens.
const populateIBCAsset = async (asset: Asset, ibcOrigins: Map<string, IbcOrigin>): Promise<Asset | undefined> => {
    const ibcList = getIBCAssetList()
    const ibcData = ibcList.find((item) => item.base === asset.denom)

    if (ibcData && ibcData.traces && ibcData.traces.length > 0) {
        const firstTrace = ibcData.traces.find((t) => t.type === "ibc") as unknown as IbcTransitionMock
        if (firstTrace) {
            const ibcAssetChain = getChains().find((c) => c.chainName === firstTrace.counterparty.chain_name)
            if (ibcAssetChain) {
                asset.name = ibcData.name
                asset.ticker = ibcData.symbol.toUpperCase()
                asset.decimals = getExponentByDenomFromAsset(ibcData, ibcData.display) ?? 0
                asset.logo = getAssetLogo(ibcData as unknown as ChainRegistryAsset)
                asset.verified = true
                const origin = ibcOriginFromRegistry(firstTrace.counterparty.chain_name, firstTrace.counterparty.base_denom, getAssetLists() as unknown as RegistryAssetList[])
                if (origin) {
                    ibcOrigins.set(asset.denom, origin)
                }
                asset.IBCData = {
                    chain: {
                        channelId: firstTrace.chain.channel_id
                    },
                    counterparty: {
                        chainName: firstTrace.counterparty.chain_name,
                        channelId: firstTrace.counterparty.channel_id,
                        baseDenom: firstTrace.counterparty.base_denom,
                        chainPrettyName: ibcAssetChain.prettyName ?? ibcAssetChain.chainName,
                    }
                }

                // If the counterparty base_denom is itself an IBC denom, this token
                // arrived via an indirect route (e.g. AtomOne through Osmosis).
                // Suffix with the intermediary chain name to distinguish from canonical assets.
                if (isIbcDenom(firstTrace.counterparty.base_denom)) {
                    appendOriginChain(asset)
                }

                return asset;
            }
        }
    }

    const ibcTrace = await getHashIBCTrace(asset.denom.replace('ibc/', ''))
    if (!ibcTrace) {
        return;
    }

    const splitPath = ibcTrace.path.split('/')
    if (splitPath.length < 2) {
        return
    }

    asset.IBCData = {
        chain: {
            channelId: splitPath[1]
        },
        counterparty: {
            chainName: "",
            channelId: "",
            baseDenom: "",
            chainPrettyName: ORIGIN_CHAIN_PLACEHOLDER,
        }
    }

    const denomOnCounterparty = await denomOnFirstHopChainFromTrace(ibcTrace)
    if (denomOnCounterparty) {
        asset.IBCData.counterparty.baseDenom = denomOnCounterparty
    }

    const counterPartyChain = await counterpartyChainForChannel(splitPath[1], splitPath[0])
    if (counterPartyChain) {
        asset.IBCData.counterparty.channelId = counterPartyChain.channelId
        const fullChain = getChainByChainId(counterPartyChain.chainId)
        if (fullChain) {
            asset.IBCData.counterparty.chainName = fullChain.chainName
            asset.IBCData.counterparty.chainPrettyName = fullChain.prettyName ?? fullChain.chainName
        }
    }

    // A direct channel missing from the registry still resolves through the
    // counterparty chain found above.
    const counterpartyChainName = asset.IBCData.counterparty.chainName
    const origin = ibcOriginFromTrace(ibcTrace, getChainName(), getIBCConnections())
        ?? (splitPath.length === 2 && counterpartyChainName ? {chainName: counterpartyChainName, baseDenom: ibcTrace.base_denom, hops: 1} : undefined)
    if (origin) {
        ibcOrigins.set(asset.denom, origin)
    }

    // The channel is not in the registry's IBC data, so anyone could have opened it
    // and sent a coin whose trace claims another chain's base denom (e.g. uosmo).
    // Only BZE's own registry list, keyed by the exact ibc/<hash>, may name it.
    const localAsset = await populateAssetFromBZEChainRegistryAssetList(asset)
    if (localAsset) {
        localAsset.verified = true
        if (isIbcDenom(ibcTrace.base_denom)) {
            appendOriginChain(localAsset)
        }
        return localAsset
    }

    if (!ibcTrace.base_denom.includes('/')) {
        let counterPartyDenom = ibcTrace.base_denom
        if (counterPartyDenom.length > 10) {
            counterPartyDenom = truncateDenom(counterPartyDenom)
        }
        asset.name = counterPartyDenom
    }

    asset.verified = false
    asset.decimals = 0
    if (isIbcDenom(ibcTrace.base_denom)) {
        appendOriginChain(asset)
    }

    return asset;
}

const populateAssetFromChainRegistry = async (asset: Asset, ibcOrigins: Map<string, IbcOrigin>): Promise<Asset | undefined> => {
    if (isIbcDenom(asset.denom)) {
        return populateIBCAsset(asset, ibcOrigins)
    }

    if (isNativeDenom(asset.denom) || isFactoryDenom(asset.denom)) {
        return populateAssetFromBZEChainRegistryAssetList(asset)
    }

    return undefined
}

const populateAssetFromBZEChainRegistryAssetList = async (asset: Asset): Promise<Asset | undefined> => {
    const data = getAssetLists().find((item) => item.chainName.toLowerCase() === getChainName().toLowerCase())
    if (!data) {
        return undefined;
    }

    const assetData = data.assets.find(item => item.base === asset.denom)
    if (!assetData) {
        return undefined;
    }

    asset.decimals = getExponentByDenomFromAsset(assetData, assetData.display) ?? 0
    asset.name = assetData.name
    asset.ticker = assetData.display.toUpperCase()
    asset.logo = isNativeDenom(asset.denom) ? BZE_CIRCLE_LOGO : getAssetLogo(assetData as unknown as ChainRegistryAsset)
    if (assetData.description) {
        asset.description = assetData.description
    }

    return asset
}

const populateAssetFromBlockchainMetadata = (asset: Asset,  meta: MetadataSDKType|undefined): Asset => {
    if (!meta || meta.base !== asset.denom) {
        return asset;
    }

    if (meta.name.length > 0) {
        asset.name = meta.name
    }
    if (meta.symbol.length > 0) {
        asset.ticker = meta.symbol.toUpperCase()
    }
    if (meta.description.length > 0) {
        asset.description = meta.description
    }

    if (meta.denom_units.length === 0) {
        return asset;
    }

    meta.denom_units.map(unit => {
        if (unit.denom === meta.display) {
            asset.decimals = unit.exponent
            asset.ticker = unit.denom.toUpperCase()
        }
    })

    return asset;
}

const createAsset = (denom: string, supply: bigint): Asset => {
    return {
        denom: denom,
        type: getDenomType(denom),
        name: truncateDenom(denom),
        ticker: truncateDenom(denom),
        decimals: 0,
        logo: TOKEN_LOGO_PLACEHOLDER,
        stable: STABLE_COINS[denom] ?? false,
        verified: VERIFIED_ASSETS[denom] ?? false,
        supply: supply,
    }
}

const getAllMetadataMap = async () => {
    const allMetadata = await getAllSupplyMetadata()
    if (!allMetadata) {
        return {};
    }

    return allMetadata.reduce<Record<string, MetadataSDKType>>((acc, asset: MetadataSDKType) => {
        acc[asset.base] = asset;
        return acc;
    }, {});
}
