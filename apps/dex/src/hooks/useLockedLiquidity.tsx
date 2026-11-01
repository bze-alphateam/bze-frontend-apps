import {useCallback, useEffect, useMemo, useState} from 'react';
import {
    getLockedBalances, toBigNumber, uAmountToAmount, LP_ASSETS_DECIMALS, useAssetPrice,
    addDebounce, blockchainEventManager, LOCK_CHANGED_EVENT,
} from "@bze/bze-ui-kit";
import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";

export function useLockedLiquidity(lpDenom: string) {
    const [lockedBalances, setLockedBalances] = useState<Coin[]>([]);
    // The LP denom the balances were last loaded for; loading is derived from it, not set in an effect.
    const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined);
    const { price: lpTokenPrice } = useAssetPrice(lpDenom);

    const loadBalances = useCallback(async () => {
        setLockedBalances(await getLockedBalances());
    }, []);

    useEffect(() => {
        if (!lpDenom) return;

        let cancelled = false;
        getLockedBalances().then(data => {
            if (cancelled) return;
            setLockedBalances(data);
            setLoadedFor(lpDenom);
        });

        return () => { cancelled = true; };
    }, [lpDenom]);

    const isLoading = !!lpDenom && loadedFor !== lpDenom;

    // Coins locked (or moved out of the lock address) in a new block refresh the amount in place,
    // without the loading state.
    useEffect(() => {
        if (!lpDenom) return;

        return blockchainEventManager.subscribe(LOCK_CHANGED_EVENT, () => {
            addDebounce('refresh-locked-liquidity', 500, loadBalances);
        });
    }, [lpDenom, loadBalances]);

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
        refetch: loadBalances
    };
}
