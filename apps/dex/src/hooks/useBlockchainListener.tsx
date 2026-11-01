import {useEffect, useState} from 'react';
import {
    getSettings, getChainName, blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT, LOCK_CHANGED_EVENT, ORDER_BOOK_CHANGED_EVENT, ORDER_EXECUTED_EVENT,
    SUPPLY_CHANGED_EVENT, SWAP_EXECUTED_EVENT,
    TendermintEvent, getChainNativeAssetDenom,
    subscribeToBlockchainEvents, getNewBlockEvents, getHardcodedLockAddress,
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

        let unsubscribe: (() => void) | null = null;

        subscribeToBlockchainEvents(rpcEndpoint, "tm.event='NewBlock'", (result: unknown) => {
            dispatchEvents(address ?? '', getNewBlockEvents(result));

            setIsConnected(true);
        }).then(unsub => {
            unsubscribe = unsub;
        }).catch(e => {
            console.error('[BlockchainListener] Failed to subscribe to NewBlock:', e);
        });

        return () => {
            unsubscribe?.();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Tx subscriptions — resubscribe whenever the wallet address changes
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint || !address || address === '') return;

        let unsubRecipient: (() => void) | null = null;
        let unsubSender: (() => void) | null = null;

        const recipientQuery = `tm.event='Tx' AND transfer.recipient='${address}'`;
        const senderQuery = `tm.event='Tx' AND transfer.sender='${address}'`;

        const handleTx = (result: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const events = (result as Record<string, any>)?.data?.value?.TxResult?.result?.events;
            if (events) {
                dispatchEvents(address, events);
            }
        };

        subscribeToBlockchainEvents(rpcEndpoint, recipientQuery, handleTx)
            .then(unsub => { unsubRecipient = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to Tx recipient:', e));

        subscribeToBlockchainEvents(rpcEndpoint, senderQuery, handleTx)
            .then(unsub => { unsubSender = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to Tx sender:', e));

        return () => {
            unsubRecipient?.();
            unsubSender?.();
        };
    }, [address]);

    return {
        isConnected,
    };
}
