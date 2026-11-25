import {getSettings} from "../storage/settings";
import {DEFAULT_MAX_FILLS_PER_ORDER, getTxResponseEvents, parseMaxFillsPerOrder} from "../utils/events";
import type {TendermintEvent} from "../types/events";

const getRestEndpoint = (): string => getSettings().endpoints.restEndpoint;

/**
 * How many resting orders one order may fill (chain v8.3.0 `maxFillsPerOrder`). Read with a raw
 * fetch because bzejs 3.2.0 still names that param field `orderBookPerBlockMessages`. Falls back to
 * the default when the node does not know it (v8.2.0) or the request fails.
 */
export const getMaxFillsPerOrder = async (): Promise<number> => {
    try {
        const resp = await fetch(`${getRestEndpoint()}/bze/tradebin/params`);
        if (!resp.ok) return DEFAULT_MAX_FILLS_PER_ORDER;

        return parseMaxFillsPerOrder(await resp.json());
    } catch {
        return DEFAULT_MAX_FILLS_PER_ORDER;
    }
}

/** The events of an included tx, from the node's REST API. Empty when it can not be read. */
export const getTxEventsByHash = async (txHash: string): Promise<TendermintEvent[]> => {
    try {
        const resp = await fetch(`${getRestEndpoint()}/cosmos/tx/v1beta1/txs/${encodeURIComponent(txHash)}`);
        if (!resp.ok) return [];

        return getTxResponseEvents((await resp.json())?.tx_response);
    } catch {
        return [];
    }
}
