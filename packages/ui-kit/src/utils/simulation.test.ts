import { describe, it, expect } from 'vitest'
import { SignerInfo, Tx, TxBody } from '@bze/bzejs/cosmos/tx/v1beta1/tx'
import { buildSimulationTxBytes, simulationFeeCoins } from './simulation'

const NATIVE = 'ubze'
const FOREIGN = 'factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd'

const signerInfo = SignerInfo.fromPartial({ modeInfo: { single: { mode: 1 } }, sequence: BigInt(156) })
const txBody = TxBody.fromPartial({ messages: [], memo: 'factory.getbze.com' })

const decodedFee = (bytes: Uint8Array) => Tx.decode(bytes).authInfo?.fee

describe('simulationFeeCoins', () => {
    // Regression: a native simulation carried an empty fee, so the fee deduction never ran and small
    // txs (set denom branding) ran out of gas by the ~20k it costs.
    it('carries one unit of the native denom when paying in it', () => {
        expect(simulationFeeCoins(NATIVE, NATIVE)).toEqual([{ denom: NATIVE, amount: '1' }])
    })

    it('falls back to the native denom when no fee denom is selected', () => {
        expect(simulationFeeCoins('', NATIVE)).toEqual([{ denom: NATIVE, amount: '1' }])
    })

    it('carries one unit of a foreign fee denom so the chain records it', () => {
        expect(simulationFeeCoins(FOREIGN, NATIVE)).toEqual([{ denom: FOREIGN, amount: '1' }])
    })
})

describe('buildSimulationTxBytes', () => {
    // Regression: the simulated tx always had an empty fee, so module fees of a tx paid in another
    // token were simulated on the cheap native path and the real tx ran out of gas.
    it('puts the foreign fee into the simulated auth info', () => {
        const bytes = buildSimulationTxBytes(txBody, [signerInfo], simulationFeeCoins(FOREIGN, NATIVE))

        const fee = decodedFee(bytes)
        expect(fee?.amount).toEqual([{ denom: FOREIGN, amount: '1' }])
        expect(fee?.gasLimit).toBe(BigInt(0))
    })

    it('puts the native fee into the simulated auth info', () => {
        const bytes = buildSimulationTxBytes(txBody, [signerInfo], simulationFeeCoins(NATIVE, NATIVE))

        expect(decodedFee(bytes)?.amount).toEqual([{ denom: NATIVE, amount: '1' }])
    })

    it('keeps the body, signer infos and one empty signature per signer', () => {
        const tx = Tx.decode(buildSimulationTxBytes(txBody, [signerInfo], []))

        expect(tx.body?.memo).toBe('factory.getbze.com')
        expect(tx.authInfo?.signerInfos[0].sequence).toBe(BigInt(156))
        expect(tx.signatures).toEqual([new Uint8Array(0)])
    })
})
