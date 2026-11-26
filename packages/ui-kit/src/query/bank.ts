import {getRestClient} from "./client";
import {Coin} from "@bze/bzejs/cosmos/base/v1beta1/coin";
import {getLockerAddress} from "../constants/chain";
import {getSettings} from "../storage/settings";

export async function getAddressBalances(address: string): Promise<Coin[]> {
    try {
        const client = await getRestClient();
        const response = await client.cosmos.bank.v1beta1.spendableBalances({address: address});

        return response.balances;
    } catch (e) {
        console.error("failed to get balances",e);

        return [];
    }
}

export async function getLockedBalances(): Promise<Coin[]> {
    try {
        const lockerAddress = getLockerAddress();
        if (!lockerAddress) {
            console.warn("Locker address not configured");
            return [];
        }

        return await getAddressBalances(lockerAddress);
    } catch (e) {
        console.error("failed to get locked balances", e);
        return [];
    }
}

/**
 * The bank balance (micro units, plain integer string) of `address` in one `denom`, or undefined
 * when the node cannot answer. Used where the address is arbitrary and only one denom matters.
 */
export async function getAddressDenomBalance(address: string, denom: string): Promise<string | undefined> {
    try {
        const url = `${getSettings().endpoints.restEndpoint}/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}/by_denom?denom=${encodeURIComponent(denom)}`;
        const resp = await fetch(url);
        if (resp.status !== 200) {
            return undefined;
        }
        const amount = (await resp.json())?.balance?.amount;
        return typeof amount === "string" && /^\d+$/.test(amount) ? amount : undefined;
    } catch (e) {
        console.error("failed to get address denom balance", e);
        return undefined;
    }
}
