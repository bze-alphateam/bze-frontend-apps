'use client';

import {useCallback} from "react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {getChainName} from "@bze/bze-ui-kit";

/**
 * Entry point of the token site's wallet (header button, "Get T", phone bar). Opens the
 * interchain-kit connect modal while disconnected.
 */
export function useTokenWallet() {
    const {status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;

    const open = useCallback(() => {
        if (!isConnected) {
            connect();
            return;
        }
        // TODO(BFE-127): open the wallet drawer (and its Get tab for "Get T", BFE-129).
    }, [isConnected, connect]);

    return {isConnected, open};
}
