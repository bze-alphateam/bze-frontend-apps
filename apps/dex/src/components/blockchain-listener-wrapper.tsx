'use client';

import { useBlockchainListener } from '@/hooks/useBlockchainListener';
import {useEffect} from "react";
import {useAssetsContext, useWalletHealthCheck} from "@bze/bze-ui-kit";
import {blockchainEventManager, CURRENT_WALLET_BALANCE_EVENT, ORDER_EXECUTED_EVENT, SUPPLY_CHANGED_EVENT, SWAP_EXECUTED_EVENT, addDebounce, addMultipleDebounce, CONNECTION_TYPE_NONE, CONNECTION_TYPE_POLLING, CONNECTION_TYPE_WS} from "@bze/bze-ui-kit";

const POLLING_INTERVAL = 10 * 1000;

export function BlockchainListenerWrapper() {
    const {isConnected} = useBlockchainListener();
    const {updateBalances, updateMarketsData, updateConnectionType, updateAssets, updateLiquidityPools} = useAssetsContext();
    useWalletHealthCheck();

    useEffect(() => {
        //will call this to trigger the connection type change to NONE after (polling_interval * 2) seconds
        const fallbackToNone = () => addDebounce('connection-type-none', POLLING_INTERVAL * 2, () => {
            updateConnectionType(CONNECTION_TYPE_NONE)
        })

        //calling this stops fallbackToNone debounce from triggering
        const removeFallback = () => addDebounce('connection-type-none', 500, () => {})

        let pollingInterval: NodeJS.Timeout;
        const unsubscribers: (() => void)[] = [];
        if (!isConnected) {
            // use POLLING
            //by default, set the connection type to polling
            updateConnectionType(CONNECTION_TYPE_POLLING);

            //set the connection type to none after (polling_interval * 2) seconds
            fallbackToNone()

            pollingInterval = setInterval(() => {
                //update the state
                updateBalances()
                updateMarketsData()
                updateAssets()
                updateLiquidityPools()

                //reset the fallback debounce time
                //this will start the fallback again, resetting the timer when it should trigger
                fallbackToNone();
            }, POLLING_INTERVAL)
        } else {
            // use WS EVENTS
            removeFallback();
            updateConnectionType(CONNECTION_TYPE_WS);

            const updateAssetsUnsubscribe = blockchainEventManager.subscribe(SUPPLY_CHANGED_EVENT, () => {
                addDebounce('refresh-assets-func', 100, updateAssets)
            })

            //on balance change refresh balances
            const balanceUnsubscribe = blockchainEventManager.subscribe(CURRENT_WALLET_BALANCE_EVENT, () => {
                //use debounce to avoid multiple calls to updateBalances
                addDebounce('refresh-wallet-func', 1000, updateBalances)
            })
            //on ANY market change refresh market data
            const marketUnsubscribe = blockchainEventManager.subscribe(ORDER_EXECUTED_EVENT, () => {
                //use debounce to avoid multiple calls to updateMarketsData
                addMultipleDebounce('refresh-market-data-func', 1500, updateMarketsData, 2)
            })

            const swapUnsubscribe = blockchainEventManager.subscribe(SWAP_EXECUTED_EVENT, () => {
                addMultipleDebounce('refresh-swap-func', 500, updateLiquidityPools, 3)
            })

            unsubscribers.push(
                balanceUnsubscribe,
                marketUnsubscribe,
                updateAssetsUnsubscribe,
                swapUnsubscribe,
            )
        }

        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval)
            }

            removeFallback()
            unsubscribers.forEach(unsubscribe => unsubscribe())
        };
    }, [isConnected, updateBalances, updateMarketsData, updateConnectionType, updateAssets, updateLiquidityPools]);

    return null; // This component renders nothing, just runs the hook
}