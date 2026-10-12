import {AuthInfo, Fee, SignerInfo, Tx, TxBody} from "@bze/bzejs/cosmos/tx/v1beta1/tx";

/**
 * The fee a gas simulation must carry so the chain runs the same code path as the real tx.
 *
 * The fee is never empty: the ante handler only deducts a fee that is present, so a simulation
 * without one skips the transfer to the fee collector and under-counts every tx by ~20k gas
 * (BZE testnet: set denom branding simulated 41.6k with an empty fee, 62k with 1ubze, executed
 * 60.5k — out of gas at the 60k a 1.5 multiplier gave it).
 *
 * In another token the fee also makes the txfeecollector record the fee denom, so module fees
 * (create market/pool/reward, ...) are captured in the token and swapped through its pool,
 * which costs far more gas than the native capture (create denom reward simulated ~77k,
 * executed ~175k). One unit of the fee denom is enough either way; the amount does not matter.
 */
export function simulationFeeCoins(feeDenom: string, nativeDenom: string): { denom: string; amount: string }[] {
    return [{denom: feeDenom || nativeDenom, amount: "1"}];
}

/** The unsigned tx bytes sent to `cosmos.tx.v1beta1.Service/Simulate`. */
export function buildSimulationTxBytes(
    txBody: TxBody,
    signerInfos: SignerInfo[],
    feeAmount: { denom: string; amount: string }[],
): Uint8Array {
    const authInfo = AuthInfo.fromPartial({
        signerInfos,
        fee: Fee.fromPartial({amount: feeAmount, gasLimit: BigInt(0)}),
    });
    const tx = Tx.fromPartial({
        body: txBody,
        authInfo,
        signatures: signerInfos.map(() => new Uint8Array(0)),
    });

    return Tx.encode(tx).finish();
}
