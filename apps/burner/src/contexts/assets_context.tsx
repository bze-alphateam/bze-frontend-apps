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
    NextBurn,
    getAllBurnedCoins, getNextBurning,
    checkAddressWonRaffle, getRaffles, getRaffleWinners,
    useToast,
    getHardcodedLockAddress,
} from "@bze/bze-ui-kit";
import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {EpochInfoSDKType} from "@bze/bzejs/bze/epochs/epoch";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {BurnedCoinsSDKType} from "@bze/bzejs/bze/burner/burned_coins";
import {RaffleSDKType, RaffleWinnerSDKType} from "@bze/bzejs/bze/burner/raffle";

export interface TicketResult {
    hasWon: boolean;
    amount: string;
    ticketIndex: number; // 0-based
}

export interface PendingRaffleContribution {
    blockHeight: number;
    tickets: number;
    denom: string;
    wasClosed: boolean;
    currentTicket: number; // 0-based index of next ticket to check
    results: TicketResult[]; // Results for tickets that have been checked
    isComplete: boolean; // All tickets have been checked
}

import type { AssetsContextType as BaseAssetsContextType } from "@bze/bze-ui-kit";

export interface AssetsContextType extends BaseAssetsContextType {
    lockBalance: Map<string, Balance>;
    updateLockBalance: () => void;

    nextBurn: NextBurn | undefined;
    updateNextBurn: () => Promise<void>;

    burnHistory: BurnedCoinsSDKType[];
    updateBurnHistory: () => Promise<void>;

    raffles: Map<string, RaffleSDKType>;
    updateRaffles: () => Promise<void>;

    raffleWinners: Map<string, RaffleWinnerSDKType[]>;

    pendingRaffleContributions: Map<string, PendingRaffleContribution>;
    addPendingRaffleContribution: (denom: string, blockHeight: number, tickets: number, wasClosed: boolean) => void;
    removePendingRaffleContribution: (denom: string) => void;
    markRaffleContributionAsClosed: (denom: string) => void;
    processPendingRaffleContributions: () => Promise<void>;

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
        usdVolume: toBigNumber(0), //TODO: get volume from Aggregator
        baseVolume: toBigNumber(0),
        quoteVolume: toBigNumber(0),
        isComplete: isComplete,
        apr: '0', //TODO: calculate APR
        usdFees: toBigNumber(0) //calculate fees
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
    const [nextBurn, setNextBurn] = useState<NextBurn | undefined>(undefined)
    const [burnHistory, setBurnHistory] = useState<BurnedCoinsSDKType[]>([]);
    const [raffles, setRaffles] = useState<Map<string, RaffleSDKType>>(new Map())
    const [raffleWinners, setRaffleWinners] = useState<Map<string, RaffleWinnerSDKType[]>>(new Map())
    const [pendingRaffleContributions, setPendingRaffleContributions] = useState<Map<string, PendingRaffleContribution>>(new Map())
    const [lockBalance, setLockBalance] = useState<Map<string, Balance>>(new Map())
    const [settingsVersion, setSettingsVersion] = useState(0);

    const {address} = useChain(getChainName());
    const {toast} = useToast();

    const doUpdateNextBurn = useCallback((next?: NextBurn) => {
        // if (!next) return;
        setNextBurn(next)
    }, [setNextBurn])
    const doUpdateBurnHistory = useCallback((history: BurnedCoinsSDKType[]) => {
        if (history.length === 0) {
            return;
        }
        setBurnHistory(history)
    }, [])
    const doUpdateRaffles = useCallback(async (newRaffles: RaffleSDKType[]) => {
        //filter out raffles that are already in the context and not modified
        const modified = newRaffles.filter((r) => {
            const existing = raffles.get(r.denom)
            if (!existing) {
                return true
            }

            return r.winners === existing.winners && r.total_won === existing.total_won
        })

        setRaffles(new Map(newRaffles.map(r => [r.denom, r])));
        const newWinners = new Map(raffleWinners)
        for (const raffle of modified) {
            const winners = await getRaffleWinners(raffle.denom);
            newWinners.set(raffle.denom, winners)
        }

        setRaffleWinners(newWinners)
    }, [raffleWinners, raffles])

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

    const doUpdateLockBalance = useCallback((newBalances: Coin[]) => {
        const newMap = new Map<string, Balance>();
        newBalances.forEach(balance => {
            newMap.set(balance.denom, {denom: balance.denom, amount: new BigNumber(balance.amount)});
        })

        setLockBalance(newMap);
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
    const doUpdateLiquidityPools = useCallback((newPools: LiquidityPoolSDKType[]) => {
        const poolsData = new Map<string, LiquidityPoolData>()
        const poolsMap = new Map<string, LiquidityPoolSDKType>()

        newPools.map(pool => {
            poolsData.set(pool.id, getPoolData(pool, usdPricesMap, assetsMap.get(pool.base), assetsMap.get(pool.quote)))
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

    const updateLockBalance = useCallback(async () => {
        const lockAddress = getHardcodedLockAddress();
        if (!lockAddress) return;

        const newBalances = await getAddressBalances(lockAddress)
        doUpdateLockBalance(newBalances)
    }, [doUpdateLockBalance]);
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
    const updateNextBurn = useCallback(async () => {
        try {
            const data = await getNextBurning();
            doUpdateNextBurn(data)
        } catch (error) {
            console.error('Failed to fetch next burning:', error);
            setNextBurn(undefined);
        }
    }, [doUpdateNextBurn])
    const updateBurnHistory = useCallback(async () => {
        const response = await getAllBurnedCoins();
        doUpdateBurnHistory(response.burnedCoins)
    }, [doUpdateBurnHistory])
    const updateRaffles = useCallback(async () => {
        const raffles = await getRaffles();
        doUpdateRaffles(raffles);
    }, [doUpdateRaffles])

    const addPendingRaffleContribution = useCallback((denom: string, blockHeight: number, tickets: number, wasClosed: boolean) => {
        setPendingRaffleContributions(prev => {
            const newMap = new Map(prev);
            newMap.set(denom, {
                blockHeight,
                tickets,
                denom,
                wasClosed,
                currentTicket: 0,
                results: [],
                isComplete: false,
            });
            return newMap;
        });
    }, []);

    const removePendingRaffleContribution = useCallback((denom: string) => {
        setPendingRaffleContributions(prev => {
            const newMap = new Map(prev);
            newMap.delete(denom);
            return newMap;
        });
    }, []);

    const markRaffleContributionAsClosed = useCallback((denom: string) => {
        setPendingRaffleContributions(prev => {
            const existing = prev.get(denom);
            if (!existing) return prev;

            const newMap = new Map(prev);
            newMap.set(denom, { ...existing, wasClosed: true });
            return newMap;
        });
    }, []);

    const processPendingRaffleContributions = useCallback(async () => {
        if (!address) return;

        const contributions = Array.from(pendingRaffleContributions.values());
        const updates: Map<string, PendingRaffleContribution> = new Map();
        const toRemove: string[] = [];

        for (const contribution of contributions) {
            // Skip if already complete
            if (contribution.isComplete) {
                // If complete AND closed, remove it
                if (contribution.wasClosed) {
                    toRemove.push(contribution.denom);
                }
                continue;
            }

            // Calculate which block to check: submission block + 2 + current ticket index
            const checkBlock = contribution.blockHeight + 2 + contribution.currentTicket;

            // Try to check if this ticket won
            const result = await checkAddressWonRaffle(address, contribution.denom, checkBlock);

            // If result is undefined, the block hasn't been processed yet, skip for now
            if (!result) continue;

            // Add result to the results array
            const newResults = [...contribution.results, {
                hasWon: result.hasWon,
                amount: result.amount,
                ticketIndex: contribution.currentTicket,
            }];

            // Move to next ticket
            const nextTicket = contribution.currentTicket + 1;
            const isComplete = nextTicket >= contribution.tickets;

            // If contribution was closed by user, show toast for this result
            if (contribution.wasClosed) {
                const asset = assetsMap.get(contribution.denom);
                const ticker = asset?.ticker || contribution.denom;
                const contributionNumber = contribution.currentTicket + 1;

                if (result.hasWon) {
                    const decimals = asset?.decimals || 6;
                    const amountBN = uAmountToBigNumberAmount(result.amount, decimals);
                    toast.success(`${ticker} Raffle Contribution #${contributionNumber}`,
                        `🎉 You won ${amountBN.toFixed(2)} ${ticker}!`,
                    );
                } else {
                    toast.warning(
                    `${ticker} Raffle Contribution #${contributionNumber}`,
                     `Better luck next time! 🍀`,
                    );
                }

                // If this was the last ticket, show summary and mark for removal
                if (isComplete) {
                    // Calculate summary stats
                    let totalWon = BigNumber(0);
                    let winnersCount = 0;

                    [...newResults].forEach(r => {
                        if (r.hasWon) {
                            winnersCount++;
                            const decimals = asset?.decimals || 6;
                            const amount = uAmountToBigNumberAmount(r.amount, decimals);
                            totalWon = totalWon.plus(amount);
                        }
                    });

                    // Show summary toast
                    if (winnersCount > 0) {
                        toast.success(
                            `${ticker} Raffle Complete! 🎊`,
                           `Won ${winnersCount}/${contribution.tickets} contributions • Total: ${totalWon.toFixed(2)} ${ticker}`,
                            10 * 1000
                        );
                    } else {
                        toast.info(
                            `${ticker} Raffle Complete`,
                           `All ${contribution.tickets} ${contribution.tickets === 1 ? 'contribution' : 'contributions'} processed. Better luck next time! 🍀`,
                            10 * 1000
                        );
                    }

                    toRemove.push(contribution.denom);
                    continue; // Don't add to updates
                }
            }

            updates.set(contribution.denom, {
                ...contribution,
                currentTicket: nextTicket,
                results: newResults,
                isComplete,
            });
        }

        // Apply all updates and removals at once
        if (updates.size > 0 || toRemove.length > 0) {
            setPendingRaffleContributions(prev => {
                const newMap = new Map(prev);
                updates.forEach((value, key) => {
                    newMap.set(key, value);
                });
                toRemove.forEach(denom => {
                    newMap.delete(denom);
                });
                return newMap;
            });
        }
    }, [address, pendingRaffleContributions, assetsMap, toast]);

    useEffect(() => {
        setIsLoading(true)
        //initial context loading
        const init = async () => {
            const [
                assets,
                markets,
                tickers,
                epochsInfo,
                pools,
                nextBurn,
                burnHistory,
                raffles,
            ] = await Promise.all([
                getChainAssets(),
                getMarkets(),
                getAllTickers(),
                getEpochsInfo(),
                getLiquidityPools(),
                getNextBurning(),
                getAllBurnedCoins(),
                getRaffles(),
            ])
            doUpdateAssets(assets)
            doUpdateMarkets(markets)
            doUpdateMarketsData(tickers)
            doUpdateEpochs(epochsInfo.epochs)
            doUpdateLiquidityPools(pools)
            doUpdateNextBurn(nextBurn)
            doUpdateBurnHistory(burnHistory.burnedCoins)
            doUpdateRaffles(raffles)

            // Load lock balance
            const lockAddress = getHardcodedLockAddress();
            if (lockAddress) {
                const lockBalances = await getAddressBalances(lockAddress);
                doUpdateLockBalance(lockBalances);
            }

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
            lockBalance,
            updateLockBalance,
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
            nextBurn,
            updateNextBurn,
            burnHistory,
            updateBurnHistory,
            raffles,
            updateRaffles,
            raffleWinners,
            pendingRaffleContributions,
            addPendingRaffleContribution,
            removePendingRaffleContribution,
            markRaffleContributionAsClosed,
            processPendingRaffleContributions,
            settingsVersion,
            setSettingsVersion,
        } as AssetsContextType}>
            {children}
        </AssetsContext.Provider>
    );
}