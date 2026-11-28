import {useCallback} from 'react';
import BigNumber from 'bignumber.js';
import {prettyAmount, uAmountToAmount, useAssets, useAssetsValue} from '@bze/bze-ui-kit';
import {formatCoin} from '@/lib/format';

/** Coins for people, with the app's known assets: "100 BZE"; an unknown denom is shortened as the other apps do. */
export function useCoinFormat() {
    const {getAsset, denomTicker} = useAssets();
    const {denomUsdValue} = useAssetsValue();

    const amountOf = useCallback((denom: string, amount: string): string => {
        const asset = getAsset(denom);
        return asset ? prettyAmount(uAmountToAmount(amount, asset.decimals)) : amount;
    }, [getAsset]);

    const format = useCallback((coin: {denom: string; amount: string}): string =>
        `${amountOf(coin.denom, coin.amount)} ${denomTicker(coin.denom)}`, [amountOf, denomTicker]);

    /**
     * Every digit of the amount, never rounded: for money the user signs for or pays (`format` rounds to a
     * few decimals, as the lists do). An unknown token shows its raw amount and denom.
     */
    const exact = useCallback((coin: {denom: string; amount: string}): string => {
        const asset = getAsset(coin.denom);
        return formatCoin(coin, asset ? {decimals: asset.decimals, ticker: denomTicker(coin.denom)} : undefined);
    }, [getAsset, denomTicker]);

    /** The USD value of a coin as "$12.50"; empty when the price is unknown. */
    const usd = useCallback((coin: {denom: string; amount: string}): string => {
        const value = denomUsdValue(coin.denom, new BigNumber(coin.amount));
        return value.gt(0) ? `$${value.toFormat(2)}` : '';
    }, [denomUsdValue]);

    /** The USD value of a coin as a number; null when the price is unknown. */
    const usdValue = useCallback((coin: {denom: string; amount: string}): BigNumber | null => {
        const value = denomUsdValue(coin.denom, new BigNumber(coin.amount));
        return value.gt(0) ? value : null;
    }, [denomUsdValue]);

    return {format, exact, usd, usdValue, amountOf, ticker: denomTicker};
}
