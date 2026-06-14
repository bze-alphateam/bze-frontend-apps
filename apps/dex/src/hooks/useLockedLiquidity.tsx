import {useCallback, useEffect, useMemo, useState} from 'react';
import {getLockedBalances, toBigNumber, uAmountToAmount, LP_ASSETS_DECIMALS, useAssetPrice} from "@bze/bze-ui-kit";
import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";

export function useLockedLiquidity(lpDenom: string) {
    const [lockedBalances, setLockedBalances] = useState<Coin[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { price: lpTokenPrice } = useAssetPrice(lpDenom);

    const fetchBalances = useCallback(async () => {
        setIsLoading(true);
        const data = await getLockedBalances();
        setLockedBalances(data);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (lpDenom) {
            fetchBalances();
        }
    }, [lpDenom, fetchBalances]);

    // Find the locked amount for this specific LP token
    const lockedForeverAmount = useMemo(() => {
        const coin = lockedBalances.find(c => c.denom === lpDenom);
        if (!coin) return '0';
        return uAmountToAmount(coin.amount, LP_ASSETS_DECIMALS);
    }, [lockedBalances, lpDenom]);

    // Calculate USD value
    const lockedForeverUsdValue = useMemo(() => {
        if (!lpTokenPrice || lpTokenPrice.lte(0)) return null;
        return toBigNumber(lockedForeverAmount).multipliedBy(lpTokenPrice);
    }, [lockedForeverAmount, lpTokenPrice]);

    return {
        lockedForeverAmount,
        lockedForeverUsdValue,
        isLoading,
        refetch: fetchBalances
    };
}
