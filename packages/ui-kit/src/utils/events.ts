import {Attribute, ORDER_BOOK_CHANGED_EVENT, TendermintEvent} from "../types/events";
import {getChainNativeAssetDenom} from "../constants/assets";
import {coins, parseCoins} from "./coins";

export const getMarketOrderBookChangedEvent = (marketId: string) => getMarketEventKey(ORDER_BOOK_CHANGED_EVENT, marketId)
export const getMarketEventKey = (eventType: string, marketId: string) => `${eventType}:${marketId}`

export const mapEventAttributes = (attributes: Attribute[]): Record<string, string> => {
    return attributes.reduce((acc, attr) => ({ ...acc, [attr.key]: attr.value.replace('\"', '').replace('\"', '') }), {});
}

export const getEventKeyValue = (event: TendermintEvent, key: string): string | undefined => {
    return event.attributes.find(attribute => attribute.key === key)?.value;
}

export const getEventMarketId = (event: TendermintEvent): string | undefined => {
    return getEventKeyValue(event, 'market_id')?.replaceAll('"', '');
}

export const isAddressTransfer = (address: string, event: TendermintEvent): boolean => {
    if (address === '' || event.type !== 'transfer') return false;
    return event.attributes.find(attribute => attribute.value === address) !== undefined;
}

export const isOrderBookEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('bze.tradebin.Order');
}

export const isOrderExecutedEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('bze.tradebin.OrderExecutedEvent');
}

export const isSwapEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('bze.tradebin.SwapEvent');
}

export const isCoinbaseEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('coinbase');
}

export const isBurnEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('burn');
}

export const isEpochStartEvent = (event: TendermintEvent): boolean => {
    return event.type.includes('bze.epochs.EpochStartEvent');
}

export const getMintedAmount = (event: TendermintEvent) => {
    const defaultCoin = coins(0, getChainNativeAssetDenom());
    try {
        const amountAttribute = event.attributes.find(attribute => attribute.key === 'amount');
        return amountAttribute ? parseCoins(amountAttribute.value) : defaultCoin;
    } catch (e) {
        console.error('Failed to parse minted amount from coinbase event', e);
        return defaultCoin;
    }
}

type NewBlockValue = {
    result_finalize_block?: { events?: TendermintEvent[]; tx_results?: ({ events?: TendermintEvent[] } | null)[] };
    txs_results?: ({ events?: TendermintEvent[] } | null)[];
};

/**
 * Every event of a `tm.event='NewBlock'` notification: the block's own (begin/end block) events
 * first, then each tx's events in block order. CometBFT 0.38 nests the tx results inside
 * `result_finalize_block.tx_results`; `txs_results` is the pre-0.38 shape, kept as a fallback.
 */
export const getNewBlockEvents = (result: unknown): TendermintEvent[] => {
    const value = (result as { data?: { value?: NewBlockValue } } | undefined)?.data?.value;
    if (!value) return [];

    const finalize = value.result_finalize_block;
    const txResults = finalize?.tx_results ?? value.txs_results ?? [];

    return [
        ...(finalize?.events ?? []),
        ...txResults.flatMap(tx => tx?.events ?? []),
    ];
}

/**
 * Whether a `tm.event='NewBlock'` notification moved coins to or from `address`, in the block's own
 * (begin/end block, FinalizeBlock) events or in any tx's events. Lets one NewBlock subscription
 * replace per-wallet Tx subscriptions, and also catches transfers that are not txs (e.g. order fills).
 */
export const blockHasAddressTransfer = (address: string, result: unknown): boolean => {
    if (!address) return false;
    return getNewBlockEvents(result).some(event => isAddressTransfer(address, event));
}
