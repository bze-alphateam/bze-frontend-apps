'use client';

import {useState, ReactNode, useEffect, useCallback} from 'react';
import {
    Asset, ChainAssets, IBCData, LP_ASSETS_DECIMALS,
    getChainAssets,
    AssetsContext,
    Market, MarketData,
    createMarketId,
    getMarketHistory, getMarkets,
    getAllTickers,
    Balance,
    getChainName,
    getAddressBalances,
    getChainNativeAssetDenom, getUSDCDenom,
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
    EXCLUDED_ASSETS,
    calculateRewardsStakingApr,
} from "@bze/bze-ui-kit";
import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {EpochInfoSDKType} from "@bze/bzejs/bze/epochs/epoch";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";

export interface AssetsContextType {
    //assets
    assetsMap: Map<string, Asset>;
    updateAssets: () => Promise<Map<string, Asset>>;

    marketsMap: Map<string, Market>;
    updateMarkets: () => void;

    marketsDataMap: Map<string, MarketData>;
    updateMarketsData: () => Promise<Map<string, MarketData>>;

    poolsMap: Map<string, LiquidityPoolSDKType>;
    poolsDataMap: Map<string, LiquidityPoolData>;
    updateLiquidityPools: () => Promise<void>;

    balancesMap: Map<string, Balance>;
    updateBalances: () => void;

    // holds a map denom => USD price
    // assets with price 0 will be in this map
    // assets that are not in this map their USD value should not be displayed (example: USDC coin)
    usdPricesMap: Map<string, BigNumber>;

    //others
    isLoading: boolean;
    isLoadingPrices: boolean;


    // holds a list of blockchains IBC details. It is populated from assets details.
    // WARNING: it can hold IBC details that are incomplete (missing chain.channelId or missing chain.counterparty.channelId)
    ibcChains: IBCData[]

    epochs: Map<string, EpochInfoSDKType>
    updateEpochs: () => void;

    connectionType: ConnectionType;
    updateConnectionType: (conn: ConnectionType) => void;
}

// AssetsContext is imported from @bze/bze-ui-kit

interface AssetsProviderProps {
    children: ReactNode;
}

const getPoolData = (pool: LiquidityPoolSDKType, prices: Map<string, BigNumber>, baseAsset?: Asset, quoteAsset?: Asset, marketData?: MarketData): LiquidityPoolData => {
    const basePrice = prices.get(pool.base) || toBigNumber(0)
    const quotePrice = prices.get(pool.quote) || toBigNumber(0)
    const isComplete = basePrice.gt(0) && quotePrice.gt(0)
    const usdValue = basePrice.multipliedBy(uAmountToAmount(pool.reserve_base, baseAsset?.decimals || 0)).plus(quotePrice.multipliedBy(uAmountToAmount(pool.reserve_quote, quoteAsset?.decimals || 0)))
    const baseVolume = toBigNumber(marketData?.base_volume || 0)
    const quoteVolume = toBigNumber(marketData?.quote_volume || 0)
    let usdVolume = basePrice.multipliedBy(baseVolume)
    if (!usdVolume.isPositive()) {
       usdVolume = quotePrice.multipliedBy(quoteVolume)
    }

    let usdFees = toBigNumber(marketData?.base_volume || 0).multipliedBy(pool.fee).multipliedBy(basePrice)
    if (!usdFees.isPositive()) {
        usdFees = toBigNumber(marketData?.quote_volume || 0).multipliedBy(pool.fee).multipliedBy(quotePrice)
    }

    const feeToLp = usdFees.multipliedBy(pool.fee_dest?.providers || 0)
    let apr = calculateRewardsStakingApr(feeToLp.dividedBy(usdVolume), usdValue)
    if (apr.isNaN()) apr = toBigNumber(0)

    return {
        usdValue: usdValue,
        usdVolume: usdVolume,
        isComplete: isComplete,
        apr: apr.toFixed(2),
        usdFees: usdFees,
        poolId: pool.id,
        base: pool.base,
        quote: pool.quote,
        baseVolume: baseVolume,
        quoteVolume: quoteVolume,
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
            if (EXCLUDED_MARKETS[marketId]) {
                return
            }
            // Automatically exclude any market whose base or quote is an excluded asset.
            // This prevents a market from appearing with a missing asset name/ticker when
            // one side has been excluded from the asset list but the market wasn't manually
            // added to EXCLUDED_MARKETS.
            if (EXCLUDED_ASSETS[market.base] || EXCLUDED_ASSETS[market.quote]) {
                return
            }
            newMap.set(marketId, market);
        })

        setMarketsMap(newMap);
    }, []);
    const doUpdateMarketsData = useCallback((newMarkets: MarketData[]) => {
        const newMap = new Map<string, MarketData>();
        newMarkets.forEach(market => {
            if (EXCLUDED_MARKETS[market.market_id]) {
                return
            }
            if (EXCLUDED_ASSETS[market.base] || EXCLUDED_ASSETS[market.quote]) {
                return
            }
            const marketId = createMarketId(market.base, market.quote);
            if (marketId !== market.market_id) {
                //this is the case for liquidity pools. They are returned on the same endpoint as market data (tickers endpoint in aggregator).
                //the market_id of a liquidity pool is {base}_{quote}
                //the market id of an order book market is {base}/{quote}
                return;
            }

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
                //this should never be null but just in case
                const lpPrice = calculatePoolPrice(base.denom, lp)
                if (lpPrice) {
                    return uPriceToBigNumberPrice(lpPrice, quote.decimals, base.decimals)
                }
            }

            const marketId = createMarketId(base.denom, quote.denom)
            //try to get price from the market data, using the last_price field (it only shows last 24h price)
            const mData = marketsDataMap.get(marketId)
            if (mData && mData.last_price > 0) {
                return toBigNumber(mData.last_price)
            }

            const market = marketsMap.get(marketId)
            if (market) {
                //if we couldn't find the last price in the market data, we'll try to get it from the trade history
                const tradeHistory = await getMarketHistory(marketId)
                if (tradeHistory.list.length > 0) {
                    return uPriceToBigNumberPrice(tradeHistory.list[0].price, quote.decimals, base.decimals)
                }
            }

            //if we couldn't find the last price in the market data or trade history, we'll try to get it from the ticker
            if (fallback) {
                return toBigNumber(await fallback())
            }

            //if we couldn't find the last price in the market data, trade history or ticker, we'll return 0
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

        //1. get the USD price for BZE
        const bzeUsdPrice = await getLastPrice(bzeAsset, usdcAsset, getBZEUSDPrice)
        //2. get the USD price for each asset
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
                //we dont have a price in BZE on the BZE market -> use the USD price (might be 0)
                pricesMap.set(asset.denom, priceInUsd)
                continue
            }

            const priceInUsdFromBze = priceInBze.multipliedBy(bzeUsdPrice)
            if (!priceInUsd.gt(0)) {
                //we dont have a USD price -> use the BZE price which surely is > 0
                pricesMap.set(asset.denom, priceInUsdFromBze)
                continue
            }

            //we have a USD market and a BZE market -> return the average of the two prices
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
    const doUpdateLiquidityPools = useCallback((newPools: LiquidityPoolSDKType[], allTickers: MarketData[]) => {
        const poolsData = new Map<string, LiquidityPoolData>()
        const poolsMap = new Map<string, LiquidityPoolSDKType>()

        //filter only LPs from ticker
        const tickers = new Map<string, MarketData>
        allTickers.forEach(ticker => {
            //create a order book market id from the ticker
            const marketId = createMarketId(ticker.base, ticker.quote)
            // if the order book market id is equal to the ticker market id, it means it's an order book market,
            // not a liquidity pool
            if (marketId === ticker.market_id) {
                //this is an order book market, not a liquidity pool
                return
            }

            tickers.set(ticker.market_id, ticker)
        })


        newPools.map(pool => {
            poolsData.set(pool.id, getPoolData(pool, usdPricesMap, assetsMap.get(pool.base), assetsMap.get(pool.quote), tickers.get(pool.id)))
            poolsMap.set(pool.id, pool)
        })

        setPoolsDataMap(poolsData)
        setPoolsMap(poolsMap)
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
        const [pools, tickers] = await Promise.all([getLiquidityPools(), getAllTickers()])

        doUpdateLiquidityPools(pools, tickers)
    }, [doUpdateLiquidityPools])

    useEffect(() => {
        setIsLoading(true)
        //initial context loading
        const init = async () => {
            const [assets, markets, tickers, epochsInfo, pools] = await Promise.all([getChainAssets(), getMarkets(), getAllTickers(), getEpochsInfo(), getLiquidityPools()])
            doUpdateAssets(assets)
            doUpdateMarkets(markets)
            doUpdateMarketsData(tickers)
            doUpdateEpochs(epochsInfo.epochs)
            doUpdateLiquidityPools(pools, tickers)

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
        }}>
            {children}
        </AssetsContext.Provider>
    );
}