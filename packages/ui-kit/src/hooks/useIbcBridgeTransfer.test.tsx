// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// The real useIBCTx runs over a faked wallet, signing client and node, so the withdraw path is
// driven end to end: simulation, fee, signing and broadcast.
const { toastMock, simulateMock, signDirectMock, queryClient } = vi.hoisted(() => ({
    toastMock: { loading: vi.fn(() => 'toast-id'), dismiss: vi.fn(), error: vi.fn(), success: vi.fn(), clickableSuccess: vi.fn() },
    simulateMock: vi.fn(),
    signDirectMock: vi.fn(),
    queryClient: { getBaseAccount: vi.fn(), broadcastTxSync: vi.fn(), getTx: vi.fn() },
}))

const cosmosWallet = {
    getOfflineSigner: async () => ({
        getAccounts: async () => [{ address: 'addr1', pubkey: new Uint8Array(33).fill(2), algo: 'secp256k1' }],
        signDirect: signDirectMock,
    }),
}

vi.mock('@interchain-kit/react', () => ({
    useChain: () => ({
        address: 'addr1',
        disconnect: vi.fn(),
        wallet: { info: { name: 'keplr-extension' }, getWalletOfType: () => cosmosWallet },
        chain: { chainId: 'bzetestnet-3', bech32Prefix: 'bze' },
        getRpcEndpoint: async () => 'http://rpc.test',
    }),
}))
vi.mock('@interchainjs/cosmos', () => ({ createCosmosQueryClient: async () => queryClient }))
vi.mock('./useSigningClient', () => ({
    useSigningClient: () => ({
        signingClient: {
            signAndBroadcast: vi.fn(),
            getEncoder: () => ({ encode: () => ({ finish: () => new Uint8Array([1, 2, 3]) }) }),
            getSequence: async () => BigInt(7),
            config: { queryClient: {} },
        },
        isSigningClientReady: true,
        signingClientError: undefined,
    }),
}))
vi.mock('./useToast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('./useLiquidityPools', () => ({ useLiquidityPools: () => ({ getDenomsPool: () => undefined }) }))
vi.mock('./useSettings', () => ({ useSettings: () => ({ feeDenom: 'ubze' }) }))
vi.mock('./useFeeTokens', () => ({ useFeeTokens: () => ({ isValidFeeDenom: () => true }) }))
vi.mock('./useAssets', () => ({ useAssetsContext: () => ({ updateBalances: vi.fn() }) }))
vi.mock('@bze/bzejs/cosmos/tx/v1beta1/service.rpc.func', () => ({ getSimulate: simulateMock }))
vi.mock('../query/denom_config', () => ({ getDenomConfig: vi.fn().mockResolvedValue({ gasSurcharge: 0, transferFee: 0 }) }))
vi.mock('../query/txfeecollector_params', () => ({
    getTxFeeCollectorParams: vi.fn().mockResolvedValue({ validatorMinGasFee: { denom: 'ubze', amount: '0.01' }, blockedIbcInbound: [] }),
}))
vi.mock('../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../constants/chain')>()),
    getChainName: () => 'beezee',
}))

import { useIbcBridgeTransfer, type IbcTransferPlan } from './useIbcBridgeTransfer'

const WITHDRAW: IbcTransferPlan = {
    isDeposit: false,
    sourceChannel: 'channel-0',
    tokenDenom: 'ubze',
    decimals: 6,
    sourceAddress: 'bze1sender',
    destAddress: 'osmo1receiver',
    amount: '10',
}

const run = async (plan: IbcTransferPlan) => {
    const { result } = renderHook(() => useIbcBridgeTransfer('beezee'))
    let ok = true
    await act(async () => { ok = await result.current.executeIbcTransfer(plan) })
    return ok
}

describe('useIbcBridgeTransfer withdraw refused by the chain', () => {
    beforeEach(() => {
        Object.values(toastMock).forEach(m => m.mockClear())
        signDirectMock.mockReset()
        simulateMock.mockReset()
        queryClient.broadcastTxSync.mockReset()
        queryClient.getBaseAccount.mockReset().mockResolvedValue({ accountNumber: BigInt(5), sequence: BigInt(3) })
    })

    it.each([
        ['Outflow exceeds quota - Net Outflow: 5, Channel Value: 100, Threshold: 2%: quota exceeded', /over today's limit/],
        ['denom ubze is blacklisted: denom is blacklisted', /to and from other chains are stopped/],
        ['channel channel-0: ibc transfers on this channel are stopped', /Transfers on this route are stopped/],
        ['circuit breaker disables execution of this message: /ibc.applications.transfer.v1.MsgTransfer', /paused on BeeZee/],
    ])('signs and broadcasts nothing and shows the mapped message for "%s"', async (raw, expected) => {
        simulateMock.mockRejectedValue(new Error(`failed to execute message; message index: 0: ${raw}`))

        const ok = await run(WITHDRAW)

        expect(ok).toBe(false)
        expect(signDirectMock).not.toHaveBeenCalled()
        expect(queryClient.broadcastTxSync).not.toHaveBeenCalled()
        expect(toastMock.error).toHaveBeenCalledTimes(1)
        expect(toastMock.error).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(expected))
    })

    it('does not simulate a deposit, which is signed on the foreign chain with the wallet fee', async () => {
        simulateMock.mockRejectedValue(new Error('refused'))

        await run({ ...WITHDRAW, isDeposit: true })
        expect(simulateMock).not.toHaveBeenCalled()
    })
})
