import {IBCData} from "../types/asset";
import {DenomTrace} from "../types/ibc";
import BigNumber from "bignumber.js";

export const canDepositFromIBC = (ibcData: IBCData): boolean => {
    return ibcData.counterparty.baseDenom !== "" && ibcData.counterparty.channelId !== "" && ibcData.counterparty.chainName != ""
}

export const canSendToIBC = (ibcData: IBCData): boolean => {
    return ibcData.chain.channelId !== "" && ibcData.counterparty.chainName != ""
}

/** Compute the denom on the first-hop (counterparty) chain, using only this trace. */
export async function denomOnFirstHopChainFromTrace(trace: DenomTrace): Promise<string | undefined> {
    try {
        if (!trace?.base_denom) return undefined;

        const parts = trace.path.split("/").filter(Boolean);
        if (parts.length < 2) {
            return trace.base_denom || undefined;
        }

        const remaining = parts.slice(2);
        if (remaining.length === 0) {
            return trace.base_denom;
        }

        const remainingPath = remaining.join("/");
        const full = `${remainingPath}/${trace.base_denom}`;

        const enc = new TextEncoder();
        const buf = enc.encode(full);
        const digest = await crypto.subtle.digest("SHA-256", buf);

        const hashBytes = new Uint8Array(digest);
        let hex = "";
        for (let i = 0; i < hashBytes.length; i++) {
            const b = hashBytes[i].toString(16).padStart(2, "0");
            hex += b;
        }
        return `ibc/${hex.toUpperCase()}`;
    } catch (e) {
        console.error("[denomOnFirstHopChainFromTrace] error:", e);
        return undefined;
    }
}

export const getIbcTransferTimeout = (): BigNumber => {
    return new BigNumber(Date.now() + 600_000).multipliedBy(1_000_000)
}

/**
 * Sign-mode options for an IBC MsgTransfer built by bzejs.
 *
 * Direct signing is forced on purpose. The chain's amino encoder always emits
 * `timeout_height` for MsgTransfer (`amino.dont_omitempty = true` in ibc-go v8
 * and v10), but the bzejs 3.1.0 amino converter omits it on a timestamp-only
 * transfer — the sign bytes never match and the chain rejects the tx with
 * code 4, on every chain, deposits and withdrawals alike. Until the converter
 * is fixed upstream the direct (protobuf) sign doc is the only one that
 * verifies. Ledger cannot sign direct, so this is a temporary workaround.
 *
 * Deposits sign on the foreign chain, where we don't know its gas price, so
 * the wallet is asked to fill the fee; withdrawals sign on BZE and use our own
 * fee simulation.
 */
export const ibcTransferTxOptions = (isDeposit: boolean) => ({
    useDirectSign: true,
    letWalletSetFee: isDeposit,
});
