import { useEffect, useRef, useState } from 'react';
import {
    getSettings, getChainName, blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT, EPOCH_START_EVENT, SUPPLY_CHANGED_EVENT,
    TendermintEvent, getChainNativeAssetDenom,
    subscribeToBlockchainEvents,
    isBurnEvent, isCoinbaseEvent, isEpochStartEvent, getMintedAmount,
} from "@bze/bze-ui-kit";
import {useChain} from "@interchain-kit/react";

const dispatchBlockEvents = (events: TendermintEvent[]) => {
    if (!events) return;

    for (const event of events) {
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
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to Tx recipient:', e));

        subscribeToBlockchainEvents(
            rpcEndpoint,
            `tm.event='Tx' AND transfer.sender='${address}'`,
            () => { blockchainEventManager.emit(CURRENT_WALLET_BALANCE_EVENT); }
        ).then(unsub => { unsubSender = unsub; })
            .catch(e => console.error('[BlockchainListener] Failed to subscribe to Tx sender:', e));

        return () => {
            unsubRecipient?.();
            unsubSender?.();
        };
    }, [address]);

    return {isConnected};
}
