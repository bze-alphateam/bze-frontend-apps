import { useEffect, useState } from 'react';
import {
    getSettings, getChainName, blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT, EPOCH_START_EVENT,
    LOCK_CHANGED_EVENT, NEXT_BURN_CHANGED_EVENT,
    ORDER_BOOK_CHANGED_EVENT, ORDER_EXECUTED_EVENT,
    RAFFLE_CHANGED_EVENT, SUPPLY_CHANGED_EVENT,
    TendermintEvent, getChainNativeAssetDenom,
    getBurnerModuleAddress, getHardcodedLockAddress, getRaffleModuleAddress,
    subscribeToBlockchainEvents, getNewBlockEvents,
    isAddressTransfer, isBurnEvent, isCoinbaseEvent, isEpochStartEvent,
    getMintedAmount, isOrderBookEvent, isOrderExecutedEvent, getEventMarketId,
} from "@bze/bze-ui-kit";
import {useChain} from "@interchain-kit/react";

const isRaffleEvent = (event: TendermintEvent) => event.type.includes('Raffle');

// The burner, raffle and lock module balances are watched through the transfers in each NewBlock
// notification, not with a Tx subscription per address: CometBFT caps a client at 5 subscriptions
// (max_subscriptions_per_client) and the node rejects any beyond that.
const dispatchModuleTransfers = (event: TendermintEvent) => {
    if (isAddressTransfer(getBurnerModuleAddress(), event)) blockchainEventManager.emit(NEXT_BURN_CHANGED_EVENT);
    if (isAddressTransfer(getRaffleModuleAddress(), event)) blockchainEventManager.emit(RAFFLE_CHANGED_EVENT);
    if (isAddressTransfer(getHardcodedLockAddress(), event)) blockchainEventManager.emit(LOCK_CHANGED_EVENT);
};

const dispatchBlockEvents = (events: TendermintEvent[]) => {
    if (!events) return;

    for (const event of events) {
        dispatchModuleTransfers(event);

        if (isRaffleEvent(event)) {
            blockchainEventManager.emit(RAFFLE_CHANGED_EVENT);
            continue;
        }

        if (isBurnEvent(event)) {
            blockchainEventManager.emit(SUPPLY_CHANGED_EVENT);
            continue;
        }

        if (isEpochStartEvent(event)) {
            blockchainEventManager.emit(EPOCH_START_EVENT);
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
            dispatchBlockEvents(getNewBlockEvents(result));

            setIsConnected(true);
        }).then(unsub => {
            unsubscribe = unsub;
        }).catch(e => {
            console.error('[BlockchainListener] Failed to subscribe to NewBlock:', e);
        });

        return () => { unsubscribe?.(); };
    }, []);

    // Tx subscriptions for user address — resubscribe on address change
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint || !address || address === '') return;

        let unsubRecipient: (() => void) | null = null;
        let unsubSender: (() => void) | null = null;

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.recipient='${address}'`,
            () => { blockchainEventManager.emit(CURRENT_WALLET_BALANCE_EVENT); }
        ).then(unsub => { unsubRecipient = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to user Tx recipient:', e));

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.sender='${address}'`,
            () => { blockchainEventManager.emit(CURRENT_WALLET_BALANCE_EVENT); }
        ).then(unsub => { unsubSender = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to user Tx sender:', e));

        return () => {
            unsubRecipient?.();
            unsubSender?.();
        };
    }, [address]);

    return {isConnected};
}
