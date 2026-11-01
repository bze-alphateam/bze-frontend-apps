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

    // Cache the last known good address to work around interchain-kit losing wallet state:
    // rawAddress can momentarily flap to '' / undefined, so we fall back to the last
    // non-empty value to keep the Tx subscriptions below from churning.
    const lastKnownAddressRef = useRef<string | undefined>(undefined);
    // lastKnownAddressRef is only written (in the effect below) when rawAddress is non-empty,
    // i.e. in lockstep with a rawAddress change that already re-renders this hook. The ref
    // therefore never changes without an accompanying render, so the react-hooks/refs hazard
    // ("component won't update when the ref changes") cannot occur here. Reading it in render
    // is intentional: it lets `address` stick to the last good value while rawAddress flaps
    // empty, keeping the Tx subscriptions below from churning.
    // eslint-disable-next-line react-hooks/refs -- safe render-time ref read, justified above
    const address = rawAddress || lastKnownAddressRef.current;

    useEffect(() => {
        if (rawAddress && rawAddress !== '') {
            lastKnownAddressRef.current = rawAddress;
        }
    }, [rawAddress]);

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
