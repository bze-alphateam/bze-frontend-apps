// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// The wallet, signing client and toasts are fed directly. Most tests pass a fixed fee, which
// skips simulation, so a tx only signs, broadcasts and reports the result; the simulateFee
// tests leave the fee out and feed the simulate query and the chain params instead.
const { toastMock, signAndBroadcastMock, simulateMock, txFeeParamsMock, settings, getDenomsPoolMock, connected, queryClient } = vi.hoisted(() => ({
    toastMock: {
        loading: vi.fn(() => 'toast-id'),
        dismiss: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        clickableSuccess: vi.fn(),
    },
    signAndBroadcastMock: vi.fn(),
    simulateMock: vi.fn(),
    txFeeParamsMock: vi.fn(),
    settings: { feeDenom: 'ubze' },
    getDenomsPoolMock: vi.fn(),
    // The useChain() wallet (a ChainWalletStore); undefined unless a test connects one.
    connected: { wallet: undefined as unknown },
    // The node the direct signer reads the account from and broadcasts to.
    queryClient: {
        getBaseAccount: vi.fn(),
        broadcastTxSync: vi.fn(),
        getTx: vi.fn(),
    },
}))

vi.mock('@interchain-kit/react', () => ({
    useChain: () => ({
        address: 'addr1',
        disconnect: vi.fn(),
        wallet: connected.wallet,
        chain: { chainId: 'bzetestnet-3', bech32Prefix: 'bze' },
        getRpcEndpoint: async () => 'http://rpc.test',
    }),
}))
// The direct path builds a real interchainjs DirectSigner; only its node connection is faked.
vi.mock('@interchainjs/cosmos', () => ({ createCosmosQueryClient: async () => queryClient }))
vi.mock('./useSigningClient', () => ({
    useSigningClient: () => ({
        signingClient: {
            signAndBroadcast: signAndBroadcastMock,
            // What simulateFee needs from the interchainjs signer: an encoder per message type,
            // the account sequence and the query client the simulate call is sent through.
            getEncoder: () => ({ encode: () => ({ finish: () => new Uint8Array([1, 2, 3]) }) }),
            getSequence: async () => BigInt(7),
            config: { queryClient: {} },
        },
        isSigningClientReady: true,
        signingClientError: undefined,
    }),
}))
vi.mock('./useToast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('./useLiquidityPools', () => ({ useLiquidityPools: () => ({ getDenomsPool: getDenomsPoolMock }) }))
vi.mock('./useSettings', () => ({ useSettings: () => settings }))
vi.mock('./useFeeTokens', () => ({ useFeeTokens: () => ({ isValidFeeDenom: () => true }) }))
vi.mock('@bze/bzejs/cosmos/tx/v1beta1/service.rpc.func', () => ({ getSimulate: simulateMock }))
vi.mock('../query/txfeecollector_params', () => ({ getTxFeeCollectorParams: txFeeParamsMock }))
vi.mock('../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../constants/chain')>()),
    getChainName: () => 'beezee',
}))

import { useBZETx, useIBCTx, TxStatus } from './useTx'
import { estimateGasFee, GAS_ESTIMATES } from '../utils/gas_fee'
import { getForeignFeeSlippage, getGasMultiplier } from '../constants/chain'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import { AuthInfo, TxBody, TxRaw } from '@bze/bzejs/cosmos/tx/v1beta1/tx'

const FEE = { amount: [{ denom: 'ubze', amount: '1000' }], gas: '200000' }
const MSG = { typeUrl: '/cosmos.bank.v1beta1.MsgSend', value: {} }

// Only the sign mode tests connect a wallet.
beforeEach(() => {
    connected.wallet = undefined
})

describe('useTx success toast', () => {
    beforeEach(() => {
        Object.values(toastMock).forEach(m => m.mockClear())
        signAndBroadcastMock.mockReset()
        signAndBroadcastMock.mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => ({ code: 0, txhash: 'HASH', height: 10, events: [] }),
        })
    })

    it('links a BZE tx to the explorer', async () => {
        const { result } = renderHook(() => useBZETx())

        let ok = false
        await act(async () => { ok = await result.current.tx([MSG], { fee: FEE }) })

        expect(ok).toBe(true)
        expect(toastMock.clickableSuccess).toHaveBeenCalledWith(TxStatus.Successful, expect.any(Function), 'View on Explorer')
        expect(toastMock.success).not.toHaveBeenCalled()
    })

    // Regression: BZE Scan only knows BZE transactions, so a tx signed on another chain
    // (an IBC deposit) must never get a BZE Scan link. A develop merge once dropped this guard.
    it('gives a tx signed on another chain a plain toast without an explorer link', async () => {
        const { result } = renderHook(() => useIBCTx('osmosis'))

        let ok = false
        await act(async () => { ok = await result.current.tx([MSG], { fee: FEE }) })

        expect(ok).toBe(true)
        expect(toastMock.success).toHaveBeenCalledWith(TxStatus.Successful)
        expect(toastMock.clickableSuccess).not.toHaveBeenCalled()
    })
})

describe('useTx toasts and failure details', () => {
    beforeEach(() => {
        Object.values(toastMock).forEach(m => m.mockClear())
        signAndBroadcastMock.mockReset()
    })

    it('keeps today\'s toasts when the new options are not set', async () => {
        signAndBroadcastMock.mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => ({ code: 5, txhash: 'HASH', rawLog: 'insufficient funds', height: 10 }),
        })
        const onFailure = vi.fn()
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, onFailure }) })

        expect(toastMock.loading).toHaveBeenCalledTimes(1)
        expect(toastMock.error).toHaveBeenCalledWith(TxStatus.Failed, 'insufficient funds')
        expect(toastMock.dismiss).toHaveBeenCalledWith('toast-id')
        // The first argument is unchanged; the details are an extra, optional argument.
        expect(onFailure).toHaveBeenCalledWith('insufficient funds', { stage: 'chain', txHash: 'HASH', rawLog: 'insufficient funds', code: 5 })
    })

    it('fires no toast at all with toasts: false', async () => {
        signAndBroadcastMock.mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => ({ code: 0, txhash: 'HASH', height: 10 }),
        })
        const onSuccess = vi.fn()
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, onSuccess, toasts: false }) })

        expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ txhash: 'HASH', height: 10 }))
        Object.values(toastMock).forEach(m => expect(m).not.toHaveBeenCalled())
    })

    it('reports a wallet that never broadcast as the sign stage', async () => {
        signAndBroadcastMock.mockRejectedValue(new Error('Request rejected'))
        const onFailure = vi.fn()
        const onBroadcast = vi.fn()
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, onFailure, onBroadcast, toasts: false }) })

        expect(onBroadcast).not.toHaveBeenCalled()
        expect(onFailure).toHaveBeenCalledWith('Request rejected', { stage: 'sign', txHash: undefined, rawLog: 'Request rejected' })
        expect(toastMock.error).not.toHaveBeenCalled()
    })

    it('reports a wait that gave up after broadcast as the timeout stage', async () => {
        signAndBroadcastMock.mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => { throw new Error('Transaction HASH not found within timeout period') },
        })
        const onFailure = vi.fn()
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, onFailure, toasts: false }) })

        expect(onFailure).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ stage: 'timeout', txHash: 'HASH' }))
    })
})

describe('useTx simulateFee', () => {
    // Mainnet's validator_min_gas_fee; the gas margin and foreign fee slippage are the defaults (1.2 / 1.1).
    const CHAIN_GAS_PRICE = 0.01
    // 1M BZE : 10k USDC → spot = 100 ubze per uusdc
    const pool = { base: 'ubze', quote: 'uusdc', fee: '0.003', reserve_base: '1000000000000', reserve_quote: '10000000000' }

    const sentFee = async () => {
        const { result } = renderHook(() => useBZETx())
        await act(async () => { await result.current.tx([MSG], { toasts: false }) })
        expect(signAndBroadcastMock).toHaveBeenCalledTimes(1)
        return signAndBroadcastMock.mock.calls[0][2] as { amount: { denom: string; amount: string }[]; gas: string }
    }

    beforeEach(() => {
        Object.values(toastMock).forEach(m => m.mockClear())
        signAndBroadcastMock.mockReset().mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => ({ code: 0, txhash: 'HASH', height: 10, events: [] }),
        })
        simulateMock.mockReset().mockResolvedValue({ gasInfo: { gasUsed: BigInt(123_410), gasWanted: BigInt(0) } })
        txFeeParamsMock.mockReset().mockResolvedValue({
            validatorMinGasFee: { denom: 'ubze', amount: '0.010000000000000000' },
            blockedIbcInbound: [],
        })
        getDenomsPoolMock.mockReset().mockReturnValue(undefined)
        settings.feeDenom = 'ubze'
    })

    // gasUsed 123410 × 1.2 = 148092 gas (was × 1.5 = 185115); 148092 × 0.01 = 1480.92 → 1481 ubze,
    // rounded up: the ante handler requires ceil(gas × minGasPrice) and rejects one ubze less.
    it('sends ceil(ceil(gasUsed × 1.2) × chain gas price) in the native denom', async () => {
        const fee = await sentFee()

        expect(fee.gas).toBe('148092')
        expect(fee.amount).toEqual([{ denom: 'ubze', amount: '1481' }])
    })

    it('uses the chain gas price, not the env default', async () => {
        txFeeParamsMock.mockResolvedValue({ validatorMinGasFee: { denom: 'ubze', amount: '0.05' }, blockedIbcInbound: [] })

        const fee = await sentFee()

        // ceil(148092 × 0.05) = ceil(7404.6)
        expect(fee.amount).toEqual([{ denom: 'ubze', amount: '7405' }])
    })

    // The simulation already carries the fee token, so a foreign fee gets the same gas limit as a
    // native one (no second ×1.5, which sent 277673 gas and 31 uusdc here) and is the native fee
    // for that limit at spot × 1.1.
    it('sends a foreign fee with the native gas limit, priced at spot with the slippage buffer', async () => {
        settings.feeDenom = 'uusdc'
        getDenomsPoolMock.mockReturnValue(pool)

        const fee = await sentFee()

        expect(fee.gas).toBe('148092')                                   // ceil(123410 × 1.2), as in ubze
        expect(fee.amount).toEqual([{ denom: 'uusdc', amount: '17' }])   // ceil(ceil(148092 × 0.01) / 100 × 1.1)
        const required = Math.ceil(Number(fee.gas) * CHAIN_GAS_PRICE / 100)
        expect(Number(fee.amount[0].amount)).toBeGreaterThanOrEqual(required)
    })

    it('falls back to the native fee when the fee token has no pool', async () => {
        settings.feeDenom = 'uusdc'

        const fee = await sentFee()

        expect(fee.gas).toBe('148092')
        expect(fee.amount).toEqual([{ denom: 'ubze', amount: '1481' }])
    })

    // Forms reserve the pre-submit estimate on MAX and warn with it, so for the same gas it must
    // be exactly the fee the tx is sent with, in either denom.
    describe('matches the pre-submit estimate', () => {
        const estimateFor = (txFeeDenom: string) => estimateGasFee({
            spec: 'send',
            nativeDenom: 'ubze',
            txFeeDenom,
            gasPrice: CHAIN_GAS_PRICE,
            gasMultiplier: getGasMultiplier(),
            foreignFeeSlippage: getForeignFeeSlippage(),
            pool: txFeeDenom === 'ubze' ? undefined : pool as LiquidityPoolSDKType,
            minNativeLiquidity: 0,
        })

        beforeEach(() => {
            simulateMock.mockResolvedValue({ gasInfo: { gasUsed: BigInt(GAS_ESTIMATES.send.base), gasWanted: BigInt(0) } })
        })

        it('in the native denom', async () => {
            const estimate = estimateFor('ubze')

            const fee = await sentFee()

            expect(fee.gas).toBe(estimate.gas.toFixed(0))
            expect(fee.amount).toEqual([{ denom: 'ubze', amount: estimate.amount.toFixed(0) }])
        })

        it('in another token', async () => {
            settings.feeDenom = 'uusdc'
            getDenomsPoolMock.mockReturnValue(pool)
            const estimate = estimateFor('uusdc')

            const fee = await sentFee()

            expect(estimate.isNative).toBe(false)
            expect(fee.gas).toBe(estimate.gas.toFixed(0))
            expect(fee.amount).toEqual([{ denom: 'uusdc', amount: estimate.amount.toFixed(0) }])
        })
    })
})

describe('useTx sign mode', () => {
    const TX_HASH = new Uint8Array(32).fill(0xab)
    // The fee the wallet puts in place of the requested one, as BeePocket does when ours cannot be paid.
    const WALLET_FEE = { amount: [{ denom: 'ubze', amount: '4321' }], gasLimit: BigInt(123_456) }

    // A connected interchain-kit wallet: the ChainWalletStore useChain() hands out, over a cosmos
    // wallet whose signDirect answers like the extension (the request's body, its own authInfo).
    const connectWallet = (name: string) => {
        const cosmosWallet = {
            getOfflineSigner: vi.fn(async () => ({
                getAccounts: async () => [{ address: 'addr1', pubkey: new Uint8Array(33).fill(2), algo: 'secp256k1' }],
                signDirect: (signer: string, doc: { authInfoBytes: Uint8Array }) => cosmosWallet.signDirect('bzetestnet-3', signer, doc),
            })),
            signDirect: vi.fn(async (_chainId: string, _signer: string, doc: { authInfoBytes: Uint8Array }) => {
                const authInfo = AuthInfo.decode(doc.authInfoBytes)
                const authInfoBytes = AuthInfo.encode({ ...authInfo, fee: { ...authInfo.fee!, ...WALLET_FEE } }).finish()
                return {
                    signed: { ...doc, authInfoBytes },
                    signature: { pub_key: { type: 'tendermint/PubKeySecp256k1', value: '' }, signature: btoa('s'.repeat(64)) },
                }
            }),
            signAmino: vi.fn(async () => { throw new Error('Not supported by BeePocket') }),
        }
        connected.wallet = { info: { name }, getWalletOfType: () => cosmosWallet }
        return cosmosWallet
    }

    const broadcastTx = () => {
        expect(queryClient.broadcastTxSync).toHaveBeenCalledTimes(1)
        return TxRaw.decode(queryClient.broadcastTxSync.mock.calls[0][0].tx)
    }

    beforeEach(() => {
        Object.values(toastMock).forEach(m => m.mockClear())
        signAndBroadcastMock.mockReset().mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => ({ code: 0, txhash: 'HASH', height: 10, events: [] }),
        })
        simulateMock.mockReset()
        txFeeParamsMock.mockReset()
        getDenomsPoolMock.mockReset().mockReturnValue(undefined)
        settings.feeDenom = 'ubze'
        queryClient.getBaseAccount.mockReset().mockResolvedValue({ accountNumber: BigInt(5), sequence: BigInt(3) })
        queryClient.broadcastTxSync.mockReset().mockResolvedValue({ code: 0, hash: TX_HASH })
        queryClient.getTx.mockReset().mockResolvedValue({ height: 10, hash: TX_HASH, txResult: { code: 0, events: [] } })
    })

    // One message per flow the five dapps sign: send, order book, swap, liquidity, staking,
    // governance, burner, token factory, rewards and an IBC transfer.
    it.each([
        '/cosmos.bank.v1beta1.MsgSend',
        '/bze.tradebin.MsgCreateOrder',
        '/bze.tradebin.MsgCancelOrder',
        '/bze.tradebin.MsgMultiSwap',
        '/bze.tradebin.MsgAddLiquidity',
        '/cosmos.staking.v1beta1.MsgDelegate',
        '/cosmos.gov.v1.MsgVote',
        '/bze.burner.MsgFundBurner',
        '/bze.tokenfactory.MsgCreateDenom',
        '/bze.rewards.MsgJoinStaking',
        '/ibc.applications.transfer.v1.MsgTransfer',
    ])('BeePocket signs %s in direct mode and never in amino', async (typeUrl) => {
        const beePocket = connectWallet('beepocket-extension')
        const { result } = renderHook(() => useBZETx())

        let ok = false
        await act(async () => { ok = await result.current.tx([{ typeUrl, value: {} }], { fee: FEE, toasts: false }) })

        expect(ok).toBe(true)
        expect(beePocket.getOfflineSigner).toHaveBeenCalledWith('bzetestnet-3', 'direct')
        expect(beePocket.signDirect).toHaveBeenCalledTimes(1)
        expect(beePocket.signAmino).not.toHaveBeenCalled()
        expect(signAndBroadcastMock).not.toHaveBeenCalled()
        expect(TxBody.decode(broadcastTx().bodyBytes).messages.map(m => m.typeUrl)).toEqual([typeUrl])
    })

    // BeePocket replaces our fee when it cannot be paid; the tx must carry the one it signed.
    it('BeePocket broadcasts the authInfo it returned, with the fee it signed, not the requested one', async () => {
        connectWallet('beepocket-extension')
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, toasts: false }) })

        const fee = AuthInfo.decode(broadcastTx().authInfoBytes).fee!
        expect(fee.amount).toEqual(WALLET_FEE.amount)
        expect(fee.gasLimit).toBe(WALLET_FEE.gasLimit)
        expect(fee.amount).not.toEqual(FEE.amount)
    })

    // Regression: BeePocket used to get an empty fee on every tx and picked its own (BZE first),
    // so the fee token from the settings never reached it.
    it('BeePocket gets our simulated fee in the settings fee token', async () => {
        settings.feeDenom = 'uusdc'
        // 1M BZE : 10k USDC → spot = 100 ubze per uusdc
        getDenomsPoolMock.mockReturnValue({ base: 'ubze', quote: 'uusdc', fee: '0.003', reserve_base: '1000000000000', reserve_quote: '10000000000' })
        simulateMock.mockResolvedValue({ gasInfo: { gasUsed: BigInt(123_410), gasWanted: BigInt(0) } })
        txFeeParamsMock.mockResolvedValue({ validatorMinGasFee: { denom: 'ubze', amount: '0.01' }, blockedIbcInbound: [] })
        const beePocket = connectWallet('beepocket-extension')
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { toasts: false }) })

        expect(simulateMock).toHaveBeenCalledTimes(1)
        // The raw offline signer, never the wrapper that asks the wallet to set its own fee.
        expect(beePocket.signDirect).toHaveBeenCalledWith('bzetestnet-3', 'addr1', expect.anything())
        const requested = AuthInfo.decode(beePocket.signDirect.mock.calls[0][2].authInfoBytes).fee!
        expect(requested.amount).toEqual([{ denom: 'uusdc', amount: '17' }])   // see the simulateFee tests
        expect(requested.gasLimit).toBe(BigInt(148_092))
    })

    it('BeePocket gets the fee passed in the options', async () => {
        const beePocket = connectWallet('beepocket-extension')
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, toasts: false }) })

        const requested = AuthInfo.decode(beePocket.signDirect.mock.calls[0][2].authInfoBytes).fee!
        expect(requested.amount).toEqual(FEE.amount)
        expect(requested.gasLimit).toBe(BigInt(FEE.gas))
    })

    it('BeePocket sets its own fee with letWalletSetFee: no simulation, an empty fee amount in the request', async () => {
        const beePocket = connectWallet('beepocket-extension')
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { letWalletSetFee: true, toasts: false }) })

        expect(simulateMock).not.toHaveBeenCalled()
        expect(beePocket.signDirect).toHaveBeenCalledWith('bzetestnet-3', 'addr1', expect.anything(), { preferNoSetFee: false })
        const requested = AuthInfo.decode(beePocket.signDirect.mock.calls[0][2].authInfoBytes).fee!
        expect(requested.amount).toEqual([])
    })

    it('BeePocket ignores a request for amino (useDirectSign: false)', async () => {
        const beePocket = connectWallet('beepocket-extension')
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, useDirectSign: false, toasts: false }) })

        expect(beePocket.signDirect).toHaveBeenCalledTimes(1)
        expect(signAndBroadcastMock).not.toHaveBeenCalled()
    })

    it('Keplr keeps the amino signing client by default', async () => {
        const keplr = connectWallet('keplr-extension')
        const { result } = renderHook(() => useBZETx())

        let ok = false
        await act(async () => { ok = await result.current.tx([MSG], { fee: FEE, toasts: false }) })

        expect(ok).toBe(true)
        expect(signAndBroadcastMock).toHaveBeenCalledWith('addr1', [MSG], FEE, expect.any(String))
        expect(keplr.getOfflineSigner).not.toHaveBeenCalled()
        expect(queryClient.broadcastTxSync).not.toHaveBeenCalled()
    })

    it('Keplr signs direct with useDirectSign and sends the requested fee', async () => {
        const keplr = connectWallet('keplr-extension')
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, useDirectSign: true, toasts: false }) })

        expect(signAndBroadcastMock).not.toHaveBeenCalled()
        expect(keplr.getOfflineSigner).toHaveBeenCalledWith('bzetestnet-3', 'direct')
        // Without letWalletSetFee the request goes through the raw offline signer with our fee.
        const requested = AuthInfo.decode(keplr.signDirect.mock.calls[0][2].authInfoBytes).fee!
        expect(requested.amount).toEqual(FEE.amount)
        expect(requested.gasLimit).toBe(BigInt(FEE.gas))
    })
})
