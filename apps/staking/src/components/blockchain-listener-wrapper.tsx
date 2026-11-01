'use client';

import { useBlockchainListener } from '@/hooks/useBlockchainListener';
import {useCallback, useEffect, useRef} from "react";
import {useWalletHealthCheck} from "@bze/bze-ui-kit";
import {
    blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT,
    EPOCH_START_EVENT,
    SUPPLY_CHANGED_EVENT,
    addDebounce,
    CONNECTION_TYPE_NONE,
    CONNECTION_TYPE_POLLING,
    CONNECTION_TYPE_WS,
} from "@bze/bze-ui-kit";
import { useStakingContext } from "@/hooks/useStakingContext";

const POLLING_INTERVAL = 10 * 1000;

export function BlockchainListenerWrapper() {
    useWalletHealthCheck();
    const {isConnected} = useBlockchainListener();
    const {
        updateBalances,
        updateMarketsData,
        updateConnectionType,
        updateAssets,
        updateEpochs,
    } = useStakingContext()

    const refreshAll = useCallback(() => {
        updateBalances()
        updateMarketsData()
        updateAssets()
        updateEpochs()
    }, [updateBalances, updateMarketsData, updateAssets, updateEpochs]);

    // Events missed while the feed was down are caught up once it recovers (not on the first connect).
    const hasBeenConnected = useRef(false);
    const wasConnected = useRef(false);
    useEffect(() => {
        if (isConnected && hasBeenConnected.current && !wasConnected.current) {
            refreshAll();
        }
        if (isConnected) hasBeenConnected.current = true;
        wasConnected.current = isConnected;
    }, [isConnected, refreshAll]);

    useEffect(() => {
        const fallbackToNone = () => addDebounce('connection-type-none', POLLING_INTERVAL * 2, () => {
            updateConnectionType(CONNECTION_TYPE_NONE)
        })

        const removeFallback = () => addDebounce('connection-type-none', 500, () => {})

        let pollingInterval: NodeJS.Timeout;
        const unsubscribers: (() => void)[] = [];
        if (!isConnected) {
            updateConnectionType(CONNECTION_TYPE_POLLING);
            fallbackToNone()

            pollingInterval = setInterval(() => {

                refreshAll()
                fallbackToNone();
            }, POLLING_INTERVAL)
        } else {
            removeFallback();
            updateConnectionType(CONNECTION_TYPE_WS);

            const updateAssetsUnsubscribe = blockchainEventManager.subscribe(SUPPLY_CHANGED_EVENT, () => {
                addDebounce('refresh-assets-func', 100, updateAssets)
            })

            const balanceUnsubscribe = blockchainEventManager.subscribe(CURRENT_WALLET_BALANCE_EVENT, () => {
                addDebounce('refresh-wallet-func', 1000, updateBalances)
            })

            const epochUnsubscribe = blockchainEventManager.subscribe(EPOCH_START_EVENT, () => {
                addDebounce('refresh-epoch-func', 1000, updateEpochs)
            })

            unsubscribers.push(
                balanceUnsubscribe,
                updateAssetsUnsubscribe,
                epochUnsubscribe,
            )
        }

        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval)
            }
            removeFallback()
            unsubscribers.forEach(unsubscribe => unsubscribe())
        };
    }, [isConnected, refreshAll, updateBalances, updateMarketsData, updateConnectionType, updateAssets, updateEpochs]);

    return null;
}
