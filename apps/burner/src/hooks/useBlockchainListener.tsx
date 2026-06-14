import { useEffect, useRef, useState } from 'react';
import {
    getSettings, getChainName, blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT, EPOCH_START_EVENT,
    LOCK_CHANGED_EVENT, NEXT_BURN_CHANGED_EVENT,
    ORDER_BOOK_CHANGED_EVENT, ORDER_EXECUTED_EVENT,
    RAFFLE_CHANGED_EVENT, SUPPLY_CHANGED_EVENT,
    TendermintEvent, getChainNativeAssetDenom,
    getBurnerModuleAddress, getHardcodedLockAddress, getRaffleModuleAddress,
    subscribeToBlockchainEvents,
    isBurnEvent, isCoinbaseEvent, isEpochStartEvent,
    getMintedAmount, isOrderBookEvent, isOrderExecutedEvent, getEventMarketId,
} from "@bze/bze-ui-kit";
import {useChain} from "@interchain-kit/react";

const isRaffleEvent = (event: TendermintEvent) => event.type.includes('Raffle');

const dispatchBlockEvents = (events: TendermintEvent[]) => {
    if (!events) return;

    for (const event of events) {
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

    // Cache the last known good address to work around interchain-kit losing wallet state
    const lastKnownAddressRef = useRef<string | undefined>(undefined);
    const address = rawAddress || lastKnownAddressRef.current;

    useEffect(() => {
        if (rawAddress && rawAddress !== '') {
            lastKnownAddressRef.current = rawAddress;
        }
    }, [rawAddress]);

    // NewBlock subscription — lives for the component lifetime
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        if (!rpcEndpoint) return;

        let unsubscribe: (() => void) | null = null;

        subscribeToBlockchainEvents(rpcEndpoint, "tm.event='NewBlock'", (result: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = (result as Record<string, any>)?.data?.value;

            if (value?.result_finalize_block?.events) {
                dispatchBlockEvents(value.result_finalize_block.events);
            }

            if (value?.txs_results) {
                for (const txResult of value.txs_results) {
                    if (txResult?.events) {
                        dispatchBlockEvents(txResult.events);
                    }
                }
            }

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

    // Tx subscriptions for burner module address — mount once
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        const burnerAddr = getBurnerModuleAddress();
        if (!rpcEndpoint || !burnerAddr) return;

        let unsubRecipient: (() => void) | null = null;
        let unsubSender: (() => void) | null = null;

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.recipient='${burnerAddr}'`,
            () => { blockchainEventManager.emit(NEXT_BURN_CHANGED_EVENT); }
        ).then(unsub => { unsubRecipient = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to burner Tx recipient:', e));

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.sender='${burnerAddr}'`,
            () => { blockchainEventManager.emit(NEXT_BURN_CHANGED_EVENT); }
        ).then(unsub => { unsubSender = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to burner Tx sender:', e));

        return () => {
            unsubRecipient?.();
            unsubSender?.();
        };
    }, []);

    // Tx subscriptions for raffle module address — mount once
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        const raffleAddr = getRaffleModuleAddress();
        if (!rpcEndpoint || !raffleAddr) return;

        let unsubRecipient: (() => void) | null = null;
        let unsubSender: (() => void) | null = null;

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.recipient='${raffleAddr}'`,
            () => { blockchainEventManager.emit(RAFFLE_CHANGED_EVENT); }
        ).then(unsub => { unsubRecipient = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to raffle Tx recipient:', e));

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.sender='${raffleAddr}'`,
            () => { blockchainEventManager.emit(RAFFLE_CHANGED_EVENT); }
        ).then(unsub => { unsubSender = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to raffle Tx sender:', e));

        return () => {
            unsubRecipient?.();
            unsubSender?.();
        };
    }, []);

    // Tx subscriptions for lock address — mount once
    useEffect(() => {
        const rpcEndpoint = getSettings().endpoints.rpcEndpoint;
        const lockAddr = getHardcodedLockAddress();
        if (!rpcEndpoint || !lockAddr) return;

        let unsubRecipient: (() => void) | null = null;
        let unsubSender: (() => void) | null = null;

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.recipient='${lockAddr}'`,
            () => { blockchainEventManager.emit(LOCK_CHANGED_EVENT); }
        ).then(unsub => { unsubRecipient = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to lock Tx recipient:', e));

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.sender='${lockAddr}'`,
            () => { blockchainEventManager.emit(LOCK_CHANGED_EVENT); }
        ).then(unsub => { unsubSender = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to lock Tx sender:', e));

        return () => {
            unsubRecipient?.();
            unsubSender?.();
        };
    }, []);

    return {isConnected};
}
