import {AuthInfo, Fee, SignerInfo, Tx, TxBody} from "@bze/bzejs/cosmos/tx/v1beta1/tx";

/**
 * The fee a gas simulation must carry so the chain runs the same code path as the real tx.
 *
 * With an empty fee the txfeecollector ante handler never records the fee denom in the context,
 * so every module fee (create market/pool/reward, ...) is captured in the native denom. A tx that
 * pays in another token captures that module fee in the token and swaps it through its pool,
 * which costs far more gas (BZE testnet: create denom reward simulated ~77k, executed ~175k).
 * One unit of the fee token is enough to select that path; the simulated amount does not matter.
 */
export function simulationFeeCoins(feeDenom: string, nativeDenom: string): { denom: string; amount: string }[] {
    if (!feeDenom || feeDenom === nativeDenom) {
        return [];
    }

    return [{denom: feeDenom, amount: "1"}];
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
