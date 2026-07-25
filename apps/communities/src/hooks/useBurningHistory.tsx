import {useCallback, useEffect, useState} from 'react';

import {
    getBlockTimeByHeight,
    useAssetsValue,
    uAmountToBigNumberAmount,
    formatDate,
    BurnHistoryItem,
    useAssets,
    parseCoins,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';

import {useCommunitiesContext} from './useCommunitiesContext';

/**
 * Processed burn history for a token, sourced from the burner module's full burn
 * history (there is no per-denom endpoint on chain — Business Logic §6). Pass a
 * denom to keep only that token's burns; each item carries amount, USD value at
 * display time, block height and timestamp.
 */
export function useBurningHistory(filterDenom?: string) {
    const [burnHistory, setBurnHistory] = useState<BurnHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const {denomDecimals, isLoading: isLoadingAssets} = useAssets();
    const {totalUsdValue, isLoading: isLoadingValues} = useAssetsValue();
    const {burnHistory: burnHistoryContext, isLoading: isLoadingContext} = useCommunitiesContext();

    const fetchBurnHistory = useCallback(async () => {
        if (burnHistoryContext.length === 0) {
            return [];
        }

        const historyPromises = burnHistoryContext.flatMap(async (burnedCoin) => {
            // A single burn entry can contain multiple coins ("1000ubze,2000ibc/hash").
            const coins = parseCoins(burnedCoin.burned);
            const validCoins = coins.filter(coin => coin.amount !== "0");
            if (validCoins.length === 0) {
                return [];
            }

            // Fetch the block time once for all coins in this burn.
            let timestamp = 'unknown';
            let date: Date | undefined;
            const blockTime = await getBlockTimeByHeight(BigNumber(burnedCoin.height));
            if (blockTime) {
                date = blockTime;
                timestamp = formatDate(new Date(blockTime));
            }

            return validCoins.map((coin) => {
                const {denom, amount} = coin;

                if (filterDenom && denom !== filterDenom) {
                    return null;
                }

                const decimals = denomDecimals(denom);
                const prettyAmount = uAmountToBigNumberAmount(amount, decimals);
                const usdValue = totalUsdValue([{denom, amount: prettyAmount}]);

                return {
                    denom,
                    amount: prettyAmount,
                    usdValue,
                    blockHeight: burnedCoin.height,
                    timestamp,
                    date,
                };
            }).filter((item) => item !== null);
        });

        const results = await Promise.all(historyPromises);
        const validResults = results.flat();

        // Newest first, by block height.
        validResults.sort((a, b) => {
            return BigNumber(b.blockHeight).comparedTo(BigNumber(a.blockHeight)) ?? 0;
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
        isLoading,
    };
}
