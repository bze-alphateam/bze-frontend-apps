import {useMemo} from "react";
import {useBridgeableAssets} from "./useBridgeableAssets";
import {useWithdrawableBalances} from "./useWithdrawableBalances";
import {isCrossChainEnabled, isSkipEnabled} from "../constants/cross_chain";

export interface BridgeAvailability {
    /** At least one asset has a deposit route onto BeeZee. */
    canDeposit: boolean;
    /** The wallet holds at least one asset that can leave BeeZee. */
    canWithdraw: boolean;
    /** Skip.go can bring coins in (mainnet only: Skip has no BZE testnet). */
    canUseSkip: boolean;
    /** The wallet's Deposit / Withdraw entry is worth showing. */
    isAvailable: boolean;
    isLoading: boolean;
}

/**
 * Which cross-chain transfers the wallet can offer right now. Both lists come from the asset
 * list and balances the app already holds, so this adds no requests.
 */
export function useBridgeAvailability(): BridgeAvailability {
    const {assets: depositable, isLoading: depositLoading} = useBridgeableAssets();
    const {assets: withdrawable, isLoading: withdrawLoading} = useWithdrawableBalances();

    return useMemo(() => {
        const enabled = isCrossChainEnabled();
        const canDeposit = enabled && depositable.length > 0;
        const canWithdraw = enabled && withdrawable.length > 0;
        const canUseSkip = enabled && isSkipEnabled();

        return {
            canDeposit,
            canWithdraw,
            canUseSkip,
            isAvailable: canDeposit || canWithdraw || canUseSkip,
            isLoading: depositLoading || withdrawLoading,
        };
    }, [depositable, withdrawable, depositLoading, withdrawLoading]);
}
