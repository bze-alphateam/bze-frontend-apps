'use client';

import { useBlockchainListener } from '@/hooks/useBlockchainListener';
import {useEffect} from "react";
import {useWalletHealthCheck} from "@bze/bze-ui-kit";
import {
    blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT,
    EPOCH_START_EVENT,
    LOCK_CHANGED_EVENT,
    NEXT_BURN_CHANGED_EVENT,
    ORDER_EXECUTED_EVENT,
    RAFFLE_CHANGED_EVENT,
    SUPPLY_CHANGED_EVENT,
    addDebounce,
    addMultipleDebounce,
    CONNECTION_TYPE_NONE,
    CONNECTION_TYPE_POLLING,
    CONNECTION_TYPE_WS,
} from "@bze/bze-ui-kit";
import { useBurnerContext } from "@/hooks/useBurnerContext";

const POLLING_INTERVAL = 10 * 1000;
const RAFFLE_POLLING_INTERVAL = 7 * 1000;

export function BlockchainListenerWrapper() {
    useWalletHealthCheck();
    const {isConnected} = useBlockchainListener();
    const {
        updateBalances,
        updateMarketsData,
        updateConnectionType,
        updateAssets,
        updateNextBurn,
        updateRaffles,
        processPendingRaffleContributions,
        updateLockBalance,
        updateEpochs,
    } = useBurnerContext()

    useEffect(() => {
        //will call this to trigger the connection type change to NONE after (polling_interval * 2) seconds
        const fallbackToNone = () => addDebounce('connection-type-none', POLLING_INTERVAL * 2, () => {
            updateConnectionType(CONNECTION_TYPE_NONE)
        })

        //calling this stops fallbackToNone debounce from triggering
        const removeFallback = () => addDebounce('connection-type-none', 500, () => {})

        let pollingInterval: NodeJS.Timeout;
        let rafflePollingInterval: NodeJS.Timeout;
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
                updateNextBurn()
                updateRaffles()
                updateLockBalance()
                updateEpochs()

                //reset the fallback debounce time
                //this will start the fallback again, resetting the timer when it should trigger
                fallbackToNone();
            }, POLLING_INTERVAL)

            // Faster polling for pending raffle contributions (7 seconds to match ~6 second block time)
            rafflePollingInterval = setInterval(() => {
                processPendingRaffleContributions()
            }, RAFFLE_POLLING_INTERVAL)
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
            //on next burn change refresh next burn data
            const nextBurnUnsubscribe = blockchainEventManager.subscribe(NEXT_BURN_CHANGED_EVENT, () => {
                //use debounce to avoid multiple calls to updateNextBurn
                addDebounce('refresh-next-burn-func', 100, updateNextBurn)
            })
            //on raffle change refresh raffle data and process pending contributions
            const raffleUnsubscribe = blockchainEventManager.subscribe(RAFFLE_CHANGED_EVENT, () => {
                //use debounce to avoid multiple calls to updateRaffles
                addDebounce('refresh-raffle-func', 100, updateRaffles)

                // Process pending raffle contributions
                addDebounce('process-pending-raffle-contributions', 200, processPendingRaffleContributions)
            })
            //on lock address change refresh lock balance
            const lockUnsubscribe = blockchainEventManager.subscribe(LOCK_CHANGED_EVENT, () => {
                //use debounce to avoid multiple calls to updateLockBalance
                addDebounce('refresh-lock-balance-func', 100, updateLockBalance)
            })
            const epochUnsubscribe = blockchainEventManager.subscribe(EPOCH_START_EVENT, () => {
                addDebounce('refresh-epoch-func', 1000, updateEpochs)
            })

            unsubscribers.push(
                balanceUnsubscribe,
                marketUnsubscribe,
                updateAssetsUnsubscribe,
                nextBurnUnsubscribe,
                raffleUnsubscribe,
                lockUnsubscribe,
                epochUnsubscribe,
            )
        }

        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval)
            }
            if (rafflePollingInterval) {
                clearInterval(rafflePollingInterval)
            }

            removeFallback()
            unsubscribers.forEach(unsubscribe => unsubscribe())
        };
    }, [isConnected, updateBalances, updateMarketsData, updateConnectionType, updateAssets, updateNextBurn, updateRaffles, processPendingRaffleContributions, updateLockBalance, updateEpochs]);

    return null; // This component renders nothing, just runs the hook
}