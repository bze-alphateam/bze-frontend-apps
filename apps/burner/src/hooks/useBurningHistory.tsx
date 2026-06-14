import {useCallback, useEffect, useState} from 'react';

import { getBlockTimeByHeight, useAssetsValue, uAmountToBigNumberAmount, formatDate, BurnHistoryItem, useAssets, parseCoins } from '@bze/bze-ui-kit';
import { useBurnerContext } from './useBurnerContext';
import BigNumber from 'bignumber.js';

export function useBurningHistory(filterDenom?: string) {
    const [burnHistory, setBurnHistory] = useState<BurnHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { denomDecimals, isLoading: isLoadingAssets } = useAssets();
    const { totalUsdValue, isLoading: isLoadingValues } = useAssetsValue();
    const {burnHistory: burnHistoryContext, isLoading: isLoadingContext} = useBurnerContext()

    const fetchBurnHistory = useCallback(async () => {
        if (burnHistoryContext.length === 0) {
            return [];
        }

        const historyPromises = burnHistoryContext.flatMap(async (burnedCoin) => {
            // Parse the burned coins string (can contain multiple coins like "1000ubze,2000ibc/hash")
            const coins = parseCoins(burnedCoin.burned);

            // Filter out coins with 0 amount immediately
            const validCoins = coins.filter(coin => coin.amount !== "0");

            if (validCoins.length === 0) {
                return [];
            }

            // Fetch block time once for all coins in this burn
            let timestamp = 'unknown';
            let date: Date | undefined;
            const blockTime = await getBlockTimeByHeight(BigNumber(burnedCoin.height));
            if (blockTime) {
                date = blockTime;
                timestamp = formatDate(new Date(blockTime));
            }

            // Create a history item for each coin in the burn
            return validCoins.map((coin) => {
                const { denom, amount } = coin;

                // Filter by denom if specified
                if (filterDenom && denom !== filterDenom) {
                    return null;
                }

                const decimals = denomDecimals(denom);
                const prettyAmount = uAmountToBigNumberAmount(amount, decimals);

                // Calculate USD value
                const usdValue = totalUsdValue([{ denom, amount: prettyAmount }]);

                return {
                    denom,
                    amount: prettyAmount,
                    usdValue: usdValue,
                    blockHeight: burnedCoin.height,
                    timestamp,
                    date,
                };
            }).filter((item) => item !== null);
        });

        const results = await Promise.all(historyPromises);
        const validResults = results.flat();

        // Sort by block height descending (newest first)
        validResults.sort((a, b) => {
            const heightA = BigNumber(a.blockHeight);
            const heightB = BigNumber(b.blockHeight);
            return heightB.comparedTo(heightA) ?? 0;
        });

        return validResults;
    }, [burnHistoryContext, filterDenom, denomDecimals, totalUsdValue]);

    useEffect(() => {
        if (isLoadingAssets || isLoadingValues || isLoadingContext) {
            return;
        }

        const load = async () => {
            const history = await fetchBurnHistory();
            setBurnHistory(history);
            setIsLoading(false);
        }

        load();
    }, [isLoadingAssets, isLoadingValues, isLoadingContext, fetchBurnHistory]);


    return {
        burnHistory,
        isLoading: isLoading,
    };
}
