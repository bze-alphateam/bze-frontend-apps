import {useCallback} from 'react';
import BigNumber from 'bignumber.js';
import {prettyAmount, uAmountToAmount, useAssets, useAssetsValue} from '@bze/bze-ui-kit';

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

    /** The USD value of a coin as "$12.50"; empty when the price is unknown. */
    const usd = useCallback((coin: {denom: string; amount: string}): string => {
        const value = denomUsdValue(coin.denom, new BigNumber(coin.amount));
        return value.gt(0) ? `$${value.toFormat(2)}` : '';
    }, [denomUsdValue]);

    return {format, usd, amountOf, ticker: denomTicker};
}
