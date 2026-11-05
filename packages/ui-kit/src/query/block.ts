import {GetBlockByHeightResponseSDKType} from "@bze/bzejs/cosmos/base/tendermint/v1beta1/query";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";
import {getRestClient} from "./client";
import BigNumber from "bignumber.js";
import {BlockResults} from "../types/block";
import {getSettings} from "../storage/settings";

type FailoverBlockTimes = {
    [key: string]: string;
};

const FAILOVER_BLOCKTIMES: FailoverBlockTimes = {
    "9334084": "2023-12-07T14:30:55.034845214Z",
    "4423602": "2023-01-18T07:51:31.391193017Z",
    "4827583": "2023-02-14T03:34:27.791387761Z",
    "5149043": "2023-03-07T11:41:10.455072975Z",
    "10855457": "2024-03-17T19:41:34.031980836Z",
};

const BLOCK_KEY = 'tendermint:block:';

export async function getBlockDetailsByHeight(height: BigNumber): Promise<GetBlockByHeightResponseSDKType> {
    try {
        const cacheKey = `${BLOCK_KEY}${height}`;
        const localData = getFromLocalStorage(cacheKey);
        if (null !== localData) {
            const parsed = JSON.parse(localData);
            if (parsed) {
                return parsed;
            }
        }

        const client = await getRestClient();
        const response = await client.cosmos.base.tendermint.v1beta1.getBlockByHeight({height: BigInt(height.toFixed(0))});

        setInLocalStorage(cacheKey, JSON.stringify(response), 0);

        return response;
    } catch (e) {
        console.error(e);
        return {};
    }
}

export async function getBlockTimeByHeight(height: BigNumber): Promise<Date | undefined> {
    const details = await getBlockDetailsByHeight(height);
    if (details.block_id === undefined) {
        if (height.toFixed(0) in FAILOVER_BLOCKTIMES) {
            return new Date(FAILOVER_BLOCKTIMES[height.toFixed(0)]);
        }
    }

    return details.block?.header?.time
}

/** The HTTP base of a CometBFT RPC endpoint saved as ws(s)://, without trailing slashes. */
function rpcHttpUrl(endpoint: string): string {
    return endpoint.trim().replace(/^ws(s?):\/\//i, 'http$1://').replace(/\/+$/, '');
}

/** CometBFT's answer for a height it has not committed yet: the block is simply not there yet. */
const FUTURE_HEIGHT_PATTERN = /must be less than or equal to the current blockchain height/;

/**
 * The block's results, or `undefined` while the node has not processed `height` yet. Throws when
 * the node can't be read (network error, any other error answer), so callers can tell
 * "not there yet" from "can't read the chain".
 */
export async function getBlockResults(height: number): Promise<BlockResults | undefined> {
    const settings = getSettings();
    const url = `${rpcHttpUrl(settings.endpoints.rpcEndpoint)}/block_results?height=${height}`;

    // A plain GET (no Content-Type) needs no CORS preflight.
    const response = await fetch(url);
    let body: (BlockResults & { error?: { data?: unknown; message?: unknown } }) | undefined;
    try {
        body = await response.json();
    } catch {
        body = undefined;
    }

    const error = body?.error;
    if (error && FUTURE_HEIGHT_PATTERN.test(String(error.data ?? error.message ?? ''))) {
        return undefined;
    }
    if (!response.ok || error || !body) {
        throw new Error(`block_results at ${height}: HTTP ${response.status}${error ? ` ${String(error.data ?? error.message ?? '')}` : ''}`);
    }

    return body;
}
