import { useEffect, useRef, useState } from 'react';
import {
    getSettings, getChainName, blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT, LOCK_CHANGED_EVENT, ORDER_BOOK_CHANGED_EVENT, ORDER_EXECUTED_EVENT,
    SUPPLY_CHANGED_EVENT, SWAP_EXECUTED_EVENT,
    TendermintEvent, getChainNativeAssetDenom,
    getChainFeed, getNewBlockEvents, blockHasAddressTransfer, getHardcodedLockAddress,
    isAddressTransfer, isOrderBookEvent, isOrderExecutedEvent, isSwapEvent,
    isCoinbaseEvent, isBurnEvent, getMintedAmount, getEventMarketId,
} from "@bze/bze-ui-kit";
import {useChain} from "@interchain-kit/react";

const dispatchEvents = (events: TendermintEvent[]) => {
    if (!events) return;

    for (const event of events) {
        // Coins sent to (or moved out of) the burner's lock address change the pools' "locked forever" amounts.
        if (isAddressTransfer(getHardcodedLockAddress(), event)) {
            blockchainEventManager.emit(LOCK_CHANGED_EVENT);
        }

        if (isBurnEvent(event)) {
            blockchainEventManager.emit(SUPPLY_CHANGED_EVENT);
            continue;
        }

        if (isCoinbaseEvent(event)) {
            const mintedAmount = getMintedAmount(event);
            for (const coin of mintedAmount) {
                if (coin.denom !== getChainNativeAssetDenom()) {
                    blockchainEventManager.emit(SUPPLY_CHANGED_EVENT);
                    break;
                }
            }
            continue;
        }

        if (isSwapEvent(event)) {
            blockchainEventManager.emit(SWAP_EXECUTED_EVENT);
            continue;
        }

        const marketId = getEventMarketId(event);
        if (!marketId) continue;

        if (isOrderBookEvent(event)) {
            blockchainEventManager.emit(ORDER_BOOK_CHANGED_EVENT, {marketId});
            if (isOrderExecutedEvent(event)) {
                blockchainEventManager.emit(ORDER_EXECUTED_EVENT, {marketId});
            }
        }
    }
};

export function useBlockchainListener() {
    const [isConnected, setIsConnected] = useState(false);
    const {address: rawAddress} = useChain(getChainName());

    // Cache the last known good address to work around interchain-kit losing wallet
    // state (state-during-render pattern — refs must not be read during render).
    const [lastKnownAddress, setLastKnownAddress] = useState<string | undefined>(undefined);
    if (rawAddress && rawAddress !== '' && rawAddress !== lastKnownAddress) {
        setLastKnownAddress(rawAddress);
    }
    const address = rawAddress || lastKnownAddress;

    // The NewBlock handler is registered once; it reads the wallet through this ref at event time.
    const addressRef = useRef(address);
    useEffect(() => {
        addressRef.current = address;
    }, [address]);

    // NewBlock subscription — lives for the component lifetime
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint) return;

        return getChainFeed(rpcEndpoint).subscribe("tm.event='NewBlock'", (result: unknown) => {
            dispatchEvents(getNewBlockEvents(result));
            if (blockHasAddressTransfer(addressRef.current ?? '', result)) {
                blockchainEventManager.emit(CURRENT_WALLET_BALANCE_EVENT);
            }
        });
    }, []);

    // isConnected is true only while the feed reports live events; otherwise the wrapper polls
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint) return;

        return getChainFeed(rpcEndpoint).onStatus(status => setIsConnected(status === 'live'));
    }, []);

    return {
        isConnected,
    };
}
