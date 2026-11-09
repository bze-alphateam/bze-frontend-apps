// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const { signCosmos, signEvm, skipGetMsgs, toastError } = vi.hoisted(() => ({
    signCosmos: vi.fn(),
    signEvm: vi.fn(),
    skipGetMsgs: vi.fn(),
    toastError: vi.fn(),
}))

vi.mock('./useTx', () => ({ useSDKTx: () => ({ tx: signCosmos }) }))
vi.mock('./useEvmTransaction', () => ({ useEvmTransaction: () => ({ executeEvmTx: signEvm }) }))
vi.mock('./useToast', () => ({ useToast: () => ({ toast: { error: toastError, success: vi.fn() } }) }))
vi.mock('../query/skip', () => ({ skipGetMsgs }))
vi.mock('../utils/cross_chain', () => ({ convertSkipMsgToEncodeObject: (msg: unknown) => msg }))

import { useSkipBridgeTransfer } from './useSkipBridgeTransfer'
import type { SkipRouteResponse } from '../types/cross_chain'

const ROUTE = { required_chain_addresses: ['beezee-1'], operations: [] } as unknown as SkipRouteResponse
const EVM_TX = { evm_tx: { chain_id: '42161', to: '0xbridge' } }
const COSMOS_TX = { cosmos_tx: { chain_id: 'noble-1', msgs: [{ msg_type_url: '/ibc.applications.transfer.v1.MsgTransfer', msg: '{}' }] } }
const SOLANA_TX = { svm_tx: { chain_id: 'solana', tx: 'base64' } }

async function runTransfer(...txs: unknown[]) {
    skipGetMsgs.mockResolvedValue({ txs })
    const { result } = renderHook(() => useSkipBridgeTransfer('osmosis'))
    let outcome: Awaited<ReturnType<typeof result.current.executeSkipTransfer>> | undefined
    await act(async () => { outcome = await result.current.executeSkipTransfer(ROUTE, () => 'bze1buyer') })
    return outcome!
}

describe('useSkipBridgeTransfer', () => {
    beforeEach(() => {
        signCosmos.mockReset().mockResolvedValue(true)
        signEvm.mockReset().mockResolvedValue({ success: true, txHash: '0xhash' })
        skipGetMsgs.mockReset()
        toastError.mockReset()
    })

    it('signs nothing when a later step is a Cosmos transaction', async () => {
        const outcome = await runTransfer(EVM_TX, COSMOS_TX)

        expect(outcome.success).toBe(false)
        expect(signEvm).not.toHaveBeenCalled()
        expect(signCosmos).not.toHaveBeenCalled()
        expect(toastError).toHaveBeenCalledTimes(1)
    })

    it('signs nothing on a Solana route', async () => {
        const outcome = await runTransfer(SOLANA_TX, COSMOS_TX)

        expect(outcome.success).toBe(false)
        expect(signEvm).not.toHaveBeenCalled()
        expect(signCosmos).not.toHaveBeenCalled()
    })

    it('runs a route of one EVM transaction', async () => {
        const outcome = await runTransfer(EVM_TX)

        expect(outcome).toMatchObject({ success: true, txHash: '0xhash' })
        expect(signEvm).toHaveBeenCalledTimes(1)
    })

    it('runs a route of one Cosmos transaction', async () => {
        const outcome = await runTransfer(COSMOS_TX)

        expect(outcome.success).toBe(true)
        expect(signCosmos).toHaveBeenCalledTimes(1)
    })

    it('runs every step of an EVM-only route', async () => {
        const outcome = await runTransfer(EVM_TX, EVM_TX)

        expect(outcome.success).toBe(true)
        expect(signEvm).toHaveBeenCalledTimes(2)
    })
})
