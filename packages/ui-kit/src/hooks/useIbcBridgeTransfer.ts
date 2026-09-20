'use client'

import {useCallback, useState} from "react";
import {ibc} from "@bze/bzejs";
import {useIBCTx} from "./useTx";
import {amountToUAmount} from "../utils/amount";
import {getIbcTransferTimeout, ibcTransferTxOptions} from "../utils/ibc";
import {useAssetsContext} from "./useAssets";
import {sleep} from "../utils/functions";

/**
 * Everything needed to construct a single IBC MsgTransfer. Kept as a plain
 * data object so both deposit (built from a BridgeableAsset) and withdraw
 * (built from a WithdrawableAsset + chosen destination) can share the same
 * transfer hook without forcing the UI data models into a shared shape.
 */
export interface IbcTransferPlan {
    /** `'deposit'` signs on a foreign chain → BZE; `'withdraw'` signs on BZE → foreign. */
    isDeposit: boolean;
    /** IBC channel on the signing chain that carries the packet. */
    sourceChannel: string;
    /** Token denom on the signing chain (source denom for deposit, BZE voucher/native for withdraw). */
    tokenDenom: string;
    /** Decimal exponent of the asset — used to convert the human-readable amount. */
    decimals: number;
    /** Signer bech32 address. */
    sourceAddress: string;
    /** Receiver bech32 address on the destination chain. */
    destAddress: string;
    /** Human-readable amount, e.g. "12.5". */
    amount: string;
}

interface UseIbcBridgeTransferReturn {
    executeIbcTransfer: (plan: IbcTransferPlan) => Promise<boolean>;
    isExecuting: boolean;
    progressMessage: string;
}

/**
 * Sign and broadcast a single IBC MsgTransfer. The caller is responsible for
 * producing a valid `IbcTransferPlan`; this hook no longer knows anything
 * about allowlists, bridgeable assets, or balance lookup.
 */
export function useIbcBridgeTransfer(chainName: string): UseIbcBridgeTransferReturn {
    const {tx} = useIBCTx(chainName);
    const {updateBalances} = useAssetsContext();
    const [isExecuting, setIsExecuting] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');

    const executeIbcTransfer = useCallback(async (plan: IbcTransferPlan): Promise<boolean> => {
        const {isDeposit, sourceChannel, tokenDenom, decimals, sourceAddress, destAddress, amount} = plan;

        if (!amount || !sourceAddress || !destAddress) {
            console.error('[useIbcBridgeTransfer] missing address', {sourceAddress, destAddress});
            return false;
        }
        if (!sourceChannel || !tokenDenom) {
            console.error('[useIbcBridgeTransfer] missing channel or denom', {sourceChannel, tokenDenom});
            return false;
        }

        setIsExecuting(true);
        setProgressMessage('Preparing transfer...');

        try {
            const {transfer} = ibc.applications.transfer.v1.MessageComposer.withTypeUrl;

            const tokenAmount = amountToUAmount(amount, decimals);

            const msg = transfer({
                sourcePort: "transfer",
                sourceChannel,
                token: {denom: tokenDenom, amount: tokenAmount},
                sender: sourceAddress,
                receiver: destAddress,
                // Must be undefined (not { 0n, 0n }) — an all-zero Height serializes into
                // the amino sign doc as an empty object and produces a signature mismatch
                // against the chain's verification bytes.
                timeoutHeight: undefined as any,
                timeoutTimestamp: BigInt(getIbcTransferTimeout().toFixed(0)),
                memo: "",
                encoding: "",
                useAliasing: false,
            });

            setProgressMessage('Waiting for signature...');
            // Direct signing is forced and the wallet fills the fee on deposits —
            // see ibcTransferTxOptions for why amino cannot be used here yet.
            const success = await tx([msg], ibcTransferTxOptions(isDeposit));

            if (success) {
                setProgressMessage('Waiting for relayer...');
                updateBalances();
                sleep(4000).then(() => updateBalances());
                sleep(10000).then(() => updateBalances());
            }

            return success;
        } catch (e) {
            console.error('[useIbcBridgeTransfer] error:', e);
            return false;
        } finally {
            setIsExecuting(false);
            setProgressMessage('');
        }
    }, [tx, updateBalances]);

    return {executeIbcTransfer, isExecuting, progressMessage};
}
