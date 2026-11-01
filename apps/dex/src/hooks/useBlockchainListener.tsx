import {useEffect, useState} from 'react';
import {
    getSettings, getChainName, blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT, LOCK_CHANGED_EVENT, ORDER_BOOK_CHANGED_EVENT, ORDER_EXECUTED_EVENT,
    SUPPLY_CHANGED_EVENT, SWAP_EXECUTED_EVENT,
    TendermintEvent, getChainNativeAssetDenom,
    getChainFeed, getNewBlockEvents, getHardcodedLockAddress,
    isAddressTransfer, isOrderBookEvent, isOrderExecutedEvent, isSwapEvent,
    isCoinbaseEvent, isBurnEvent, getMintedAmount, getEventMarketId,
} from "@bze/bze-ui-kit";
import {useChain} from "@interchain-kit/react";

const dispatchEvents = (address: string, events: TendermintEvent[]) => {
    if (!events) return;

    for (const event of events) {
        // Coins sent to (or moved out of) the burner's lock address change the pools' "locked forever" amounts.
        if (isAddressTransfer(getHardcodedLockAddress(), event)) {
            blockchainEventManager.emit(LOCK_CHANGED_EVENT);
        }

        if (isAddressTransfer(address, event)) {
            blockchainEventManager.emit(CURRENT_WALLET_BALANCE_EVENT);
            continue;
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

    // NewBlock subscription — lives for the component lifetime
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint) return;

        return getChainFeed(rpcEndpoint).subscribe("tm.event='NewBlock'", (result: unknown) => {
            dispatchEvents(address ?? '', getNewBlockEvents(result));
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // isConnected is true only while the feed reports live events; otherwise the wrapper polls
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint) return;

        return getChainFeed(rpcEndpoint).onStatus(status => setIsConnected(status === 'live'));
    }, []);

    // Tx subscriptions — resubscribe whenever the wallet address changes
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint || !address || address === '') return;

        const recipientQuery = `tm.event='Tx' AND transfer.recipient='${address}'`;
        const senderQuery = `tm.event='Tx' AND transfer.sender='${address}'`;

        const handleTx = (result: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const events = (result as Record<string, any>)?.data?.value?.TxResult?.result?.events;
            if (events) {
                dispatchEvents(address, events);
            }
        };

        const unsubRecipient = getChainFeed(rpcEndpoint).subscribe(recipientQuery, handleTx);

        const unsubSender = getChainFeed(rpcEndpoint).subscribe(senderQuery, handleTx);

        return () => {
            unsubRecipient?.();
            unsubSender?.();
        };
    }, [address]);

    return {
        isConnected,
    };
}
