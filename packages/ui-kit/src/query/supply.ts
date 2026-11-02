import {getRestClient} from "./client";
import {LcdPagination, readAllPages} from "./lcd";
import {CoinSDKType} from "@bze/bzejs/cosmos/base/v1beta1/coin";
import {MetadataSDKType} from "@bze/bzejs/cosmos/bank/v1beta1/bank";

// Both routes follow `pagination.next_key` page by page; `count_total` stays off because counting
// every denom on each request gets expensive as the chain's denom list grows.
export const getAllSupply = async () => {
    try {
        const client = await getRestClient();
        return await readAllPages<CoinSDKType>(async (pagination) => {
            const resp = await client.cosmos.bank.v1beta1.totalSupply({pagination}) as unknown as {
                supply?: CoinSDKType[];
                pagination?: LcdPagination
            };

            return {list: resp.supply, pagination: resp.pagination};
        });
    } catch (error) {
        console.error('failed to get supply: ', error);
    }

    return undefined
}

export const getAllSupplyMetadata = async () => {
    try {
        const client = await getRestClient();
        return await readAllPages<MetadataSDKType>(async (pagination) => {
            const resp = await client.cosmos.bank.v1beta1.denomsMetadata({pagination}) as unknown as {
                metadatas?: MetadataSDKType[];
                pagination?: LcdPagination
            };

            return {list: resp.metadatas, pagination: resp.pagination};
        });
    } catch (error) {
        console.error('failed to get supply metadata: ', error);
    }

    return undefined
}
