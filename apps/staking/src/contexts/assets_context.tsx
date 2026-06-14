'use client';

import {useState, ReactNode, useEffect, useCallback} from 'react';
import {
    AssetsContext,
    Asset, ChainAssets, IBCData, LP_ASSETS_DECIMALS,
    getChainAssets,
    Market, MarketData,
    createMarketId,
    getMarketHistory, getMarkets,
    getAllTickers,
    getAddressBalances,
    Balance,
    getChainName, getChainNativeAssetDenom, getUSDCDenom,
    getBZEUSDPrice,
    getEpochsInfo,
    CONNECTION_TYPE_NONE, ConnectionType,
    toBigNumber, uAmountToAmount, uAmountToBigNumberAmount, uPriceToBigNumberPrice,
    isLpDenom,
    addDebounce,
    LiquidityPoolData,
    getLiquidityPools,
    calculatePoolPrice, createPoolId, poolIdFromPoolDenom,
    EXCLUDED_MARKETS,
} from "@bze/bze-ui-kit";
import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {EpochInfoSDKType} from "@bze/bzejs/bze/epochs/epoch";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";

import type { AssetsContextType as BaseAssetsContextType } from "@bze/bze-ui-kit";

export interface AssetsContextType extends BaseAssetsContextType {
    settingsVersion: number;
    setSettingsVersion: (version: number) => void;
}

interface AssetsProviderProps {
    children: ReactNode;
}

const getPoolData = (pool: LiquidityPoolSDKType, prices: Map<string, BigNumber>, baseAsset?: Asset, quoteAsset?: Asset): LiquidityPoolData => {
    const basePrice = prices.get(pool.base) || toBigNumber(0)
    const quotePrice = prices.get(pool.quote) || toBigNumber(0)
    const isComplete = basePrice.gt(0) && quotePrice.gt(0)

    return {
        poolId: pool.id,
        base: pool.base,
        quote: pool.quote,
        usdValue: basePrice.multipliedBy(uAmountToAmount(pool.reserve_base, baseAsset?.decimals || 0)).plus(quotePrice.multipliedBy(uAmountToAmount(pool.reserve_quote, quoteAsset?.decimals || 0))),
        usdVolume: toBigNumber(0),
        baseVolume: toBigNumber(0),
        quoteVolume: toBigNumber(0),
        isComplete: isComplete,
        apr: '0',
        usdFees: toBigNumber(0)
    }
}

export function AssetsProvider({ children }: AssetsProviderProps) {
    const [assetsMap, setAssetsMap] = useState<Map<string, Asset>>(new Map());
    const [marketsMap, setMarketsMap] = useState<Map<string, Market>>(new Map());
    const [marketsDataMap, setMarketsDataMap] = useState<Map<string, MarketData>>(new Map());
    const [balancesMap, setBalancesMap] = useState<Map<string, Balance>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [ibcChains, setIbcChains] = useState<IBCData[]>([]);
    const [usdPricesMap, setUsdPricesMap] = useState<Map<string, BigNumber>>(new Map());
    const [isLoadingPrices, setIsLoadingPrices] = useState(true);
    const [epochs, setEpochs] = useState<Map<string, EpochInfoSDKType>>(new Map());
    const [connectionType, setConnectionType] = useState<ConnectionType>(CONNECTION_TYPE_NONE);
    const [poolsMap, setPoolsMap] = useState<Map<string, LiquidityPoolSDKType>>(new Map())
    const [poolsDataMap, setPoolsDataMap] = useState<Map<string, LiquidityPoolData>>(new Map())
    const [settingsVersion, setSettingsVersion] = useState(0);

    const {address} = useChain(getChainName());

    const doUpdateAssets = useCallback((newAssets: ChainAssets) => {
        setAssetsMap(newAssets.assets);
        setIbcChains(Array.from(newAssets.ibcData.values()));
        return newAssets.assets
    }, []);
    const doUpdateMarkets = useCallback((newMarkets: Market[]) => {
        const newMap = new Map<string, Market>();
        newMarkets.forEach(market => {
            const marketId = createMarketId(market.base, market.quote);
            if (EXCLUDED_MARKETS[marketId]) return
            newMap.set(marketId, market);
        })
        setMarketsMap(newMap);
    }, []);
    const doUpdateMarketsData = useCallback((newMarkets: MarketData[]) => {
        const newMap = new Map<string, MarketData>();
        newMarkets.forEach(market => {
            if (EXCLUDED_MARKETS[market.market_id]) return
            newMap.set(market.market_id, market);
        })
        setMarketsDataMap(newMap);
        return newMap
    }, []);
    const doUpdateBalances = useCallback((newBalances: Coin[]) => {
        const newMap = new Map<string, Balance>();
        newBalances.forEach(balance => {
            newMap.set(balance.denom, {denom: balance.denom, amount: new BigNumber(balance.amount)});
        })
        setBalancesMap(newMap);
    }, []);

    const doUpdatePrices = useCallback(async () => {
        if (assetsMap.size === 0 || marketsMap.size === 0 || !marketsDataMap) return;
        setIsLoadingPrices(true)
        const getLastPrice = async (base: Asset, quote: Asset, fallback?: () => Promise<number>): Promise<BigNumber> => {
            const lpId = createPoolId(base.denom, quote.denom)
            const lp = poolsMap.get(lpId)
            if (lp) {
                const lpPrice = calculatePoolPrice(base.denom, lp)
                if (lpPrice) {
                    return uPriceToBigNumberPrice(lpPrice, quote.decimals, base.decimals)
                }
            }
            const marketId = createMarketId(base.denom, quote.denom)
            const mData = marketsDataMap.get(marketId)
            if (mData && mData.last_price > 0) {
                return toBigNumber(mData.last_price)
            }
            const market = marketsMap.get(marketId)
            if (market) {
                const tradeHistory = await getMarketHistory(marketId)
                if (tradeHistory.list.length > 0) {
                    return uPriceToBigNumberPrice(tradeHistory.list[0].price, quote.decimals, base.decimals)
                }
            }
            if (fallback) {
                return toBigNumber(await fallback())
            }
            return new BigNumber(0)
        }

        const bzeDenom = getChainNativeAssetDenom()
        const bzeAsset = assetsMap.get(bzeDenom)
        const usdcDenom = getUSDCDenom()
        const usdcAsset = assetsMap.get(usdcDenom)
        if (!bzeAsset || !usdcAsset) {
            console.error("Failed to find BZE or USDC asset in assets map")
            setIsLoadingPrices(false)
            return toBigNumber(0)
        }

        const bzeUsdPrice = await getLastPrice(bzeAsset, usdcAsset, getBZEUSDPrice)
        const pricesMap = new Map<string, BigNumber>();
        pricesMap.set(bzeDenom, bzeUsdPrice)
        pricesMap.set(usdcDenom, toBigNumber(1))

        const existingAssets = Array.from(assetsMap.values())
        const lpDenoms = [];
        for (const asset of existingAssets) {
            if (asset.denom === bzeDenom || asset.denom === usdcDenom) continue
            if (isLpDenom(asset.denom)) {
                lpDenoms.push(asset.denom)
                continue
            }
            const [priceInUsd, priceInBze] = await Promise.all([getLastPrice(asset, usdcAsset), getLastPrice(asset, bzeAsset)])
            if (!priceInBze.gt(0)) {
                pricesMap.set(asset.denom, priceInUsd)
                continue
            }
            const priceInUsdFromBze = priceInBze.multipliedBy(bzeUsdPrice)
            if (!priceInUsd.gt(0)) {
                pricesMap.set(asset.denom, priceInUsdFromBze)
                continue
            }
            pricesMap.set(asset.denom, priceInUsd.plus(priceInUsdFromBze).dividedBy(2))
        }

        if (lpDenoms.length > 0 && poolsMap.size > 0) {
            lpDenoms.forEach(denom => {
                const denomAsset = assetsMap.get(denom)
                if (!denomAsset) return;
                const pool = poolsMap.get(poolIdFromPoolDenom(denom))
                if (!pool) return;
                const basePrice = pricesMap.get(pool.base) || toBigNumber(0)
                const quotePrice = pricesMap.get(pool.quote) || toBigNumber(0)
                if (basePrice.lte(0) || quotePrice.lte(0)) return;
                const baseAsset = assetsMap.get(pool.base)
                const quoteAsset = assetsMap.get(pool.quote)
                if (!baseAsset || !quoteAsset) return;
                const baseUsdValue = basePrice.multipliedBy(uAmountToBigNumberAmount(pool.reserve_base, baseAsset.decimals))
                const quoteUsdValue = quotePrice.multipliedBy(uAmountToBigNumberAmount(pool.reserve_quote, quoteAsset.decimals))
                const shareValue = baseUsdValue.plus(quoteUsdValue).dividedBy(uAmountToBigNumberAmount(denomAsset.supply, LP_ASSETS_DECIMALS))
                pricesMap.set(denom, shareValue)
            })
        }

        setUsdPricesMap(pricesMap)
        setIsLoadingPrices(false)
    }, [marketsDataMap, assetsMap, marketsMap, poolsMap]);
    const doUpdateEpochs = useCallback((newEpochs: EpochInfoSDKType[]) => {
        const newMap = new Map<string, EpochInfoSDKType>();
        newEpochs.forEach(epoch => {
            newMap.set(epoch.identifier, epoch);
        })
        setEpochs(newMap);
    }, []);
    const doUpdateLiquidityPools = useCallback((newPools: LiquidityPoolSDKType[]) => {
        const poolsData = new Map<string, LiquidityPoolData>()
        const newPoolsMap = new Map<string, LiquidityPoolSDKType>()
        newPools.map(pool => {
            poolsData.set(pool.id, getPoolData(pool, usdPricesMap, assetsMap.get(pool.base), assetsMap.get(pool.quote)))
            newPoolsMap.set(pool.id, pool)
        })
        setPoolsDataMap(poolsData)
        setPoolsMap(newPoolsMap)
    }, [assetsMap, usdPricesMap])

    const updateAssets = useCallback(async () => {
        const newAssets = await getChainAssets()
        return doUpdateAssets(newAssets)
    }, [doUpdateAssets]);
    const updateMarkets = useCallback(async () => {
        const newMarkets = await getMarkets()
        doUpdateMarkets(newMarkets)
    }, [doUpdateMarkets]);
    const updateMarketsData = useCallback(async () => {
        const newMarkets = await getAllTickers()
        return doUpdateMarketsData(newMarkets)
    }, [doUpdateMarketsData]);
    const updateBalances = useCallback(async () => {
        if (!address) return;
        const newBalances = await getAddressBalances(address)
        doUpdateBalances(newBalances)
    }, [doUpdateBalances, address]);
    const updateEpochs = useCallback(async () => {
        const newEpochs = await getEpochsInfo()
        doUpdateEpochs(newEpochs.epochs)
    }, [doUpdateEpochs]);
    const updateConnectionType = useCallback((conn: ConnectionType) => {
        setConnectionType(conn)
    }, [])
    const updateLiquidityPools = useCallback(async () => {
        const [pools] = await Promise.all([getLiquidityPools()])
        doUpdateLiquidityPools(pools)
    }, [doUpdateLiquidityPools])

    useEffect(() => {
        setIsLoading(true)
        const init = async () => {
            const [assets, markets, tickers, epochsInfo, pools] = await Promise.all([
                getChainAssets(),
                getMarkets(),
                getAllTickers(),
                getEpochsInfo(),
                getLiquidityPools(),
            ])
            doUpdateAssets(assets)
            doUpdateMarkets(markets)
            doUpdateMarketsData(tickers)
            doUpdateEpochs(epochsInfo.epochs)
            doUpdateLiquidityPools(pools)
            setIsLoading(false)
        }
        init();
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        addDebounce('do-update-prices', 200, doUpdatePrices)
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketsMap, marketsDataMap, assetsMap]);

    useEffect(() => {
        addDebounce('do-update-lps', 200, () => {updateLiquidityPools()})
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usdPricesMap, assetsMap]);

    useEffect(() => {
        if (!address) {
            doUpdateBalances([]);
            return
        }
        const fetchBalances = async () => {
            setIsLoading(true)
            const balances = await getAddressBalances(address);
            doUpdateBalances(balances);
            setIsLoading(false);
        }
        fetchBalances()
    }, [address, doUpdateBalances]);

    return (
        <AssetsContext.Provider value={{
            assetsMap,
            updateAssets,
            marketsMap,
            updateMarkets,
            isLoading,
            marketsDataMap,
            updateMarketsData,
            balancesMap,
            updateBalances,
            ibcChains,
            usdPricesMap,
            isLoadingPrices,
            epochs,
            updateEpochs,
            connectionType,
            updateConnectionType,
            updateLiquidityPools,
            poolsMap,
            poolsDataMap,
            settingsVersion,
            setSettingsVersion,
        } as AssetsContextType}>
            {children}
        </AssetsContext.Provider>
    );
}
