import { useEffect, useRef, useState } from 'react';
import {
    getSettings, getChainName, blockchainEventManager,
    CURRENT_WALLET_BALANCE_EVENT, EPOCH_START_EVENT, SUPPLY_CHANGED_EVENT,
    TendermintEvent, getChainNativeAssetDenom,
    getChainFeed, getNewBlockEvents, blockHasAddressTransfer,
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
            dispatchBlockEvents(getNewBlockEvents(result));
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

    return {isConnected};
}
