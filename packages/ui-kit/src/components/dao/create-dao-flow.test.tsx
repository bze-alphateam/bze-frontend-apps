// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {ChakraProvider, defaultSystem} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import {toBech32} from '@interchainjs/encoding'
import {RECORDED_PARAMS} from '../../query/dao.fixtures'
import type {DaoStakeSource} from '../../utils/dao/create-sources'
import type {CreateDaoTx} from '../../hooks/useCreateDao'
import {CreateDaoFlow, type CreateDaoFlowProps} from './create-dao-flow'

const addr = (n: number) => toBech32('bze', new Uint8Array(20).fill(n))
const CREATOR = addr(1)

// The wallet, assets and fee hooks are fed directly; the chain reads go through `services`.
const {txMock} = vi.hoisted(() => ({txMock: {current: undefined as unknown as CreateDaoTx}}))

vi.mock('@interchain-kit/react', () => ({useChain: () => ({address: CREATOR})}))
vi.mock('../../hooks/useAssets', () => ({
    useAssets: () => ({denomTicker: (d: string) => (d === 'ubze' ? 'BZE' : d.split('/').pop()!.toUpperCase()), denomDecimals: () => 6}),
}))
vi.mock('../../hooks/useBalances', () => ({useBalance: (denom: string) => ({balance: {denom, amount: new BigNumber('900000000000')}})}))
vi.mock('../../hooks/useTx', () => ({useBZETx: () => ({tx: (...a: Parameters<CreateDaoTx>) => txMock.current(...a)})}))
vi.mock('../../hooks/useFeeEstimate', () => ({
    useFeeEstimate: () => ({method: 'native', isLoading: false, resolvedFee: {denom: 'ubze', amount: '50000000000'}}),
}))
vi.mock('../../hooks/useGasFeeEstimate', () => ({useGasFeeEstimate: () => ({estimate: undefined})}))
vi.mock('../../hooks/useTxFeeDenom', () => ({useTxFeeDenom: () => ({denom: 'ubze'})}))
vi.mock('../fee-estimate', () => ({FeeEstimateRow: () => null}))

const HONEY = 'factory/bze1x/honey'
const SOURCES: DaoStakeSource[] = [
    {kind: 'sr', id: '1', stakingDenom: HONEY, lock: 14, staked: '5000000'},
    {kind: 'sr', id: '3', stakingDenom: 'ubze', lock: 21, staked: '9000000'},
]

const services = (over: Partial<NonNullable<CreateDaoFlowProps['services']>> = {}) => ({
    getParams: async () => RECORDED_PARAMS.params,
    getSources: async () => SOURCES,
    getDaoByAddress: async () => null,
    fetchTxEvents: vi.fn().mockRejectedValue(new Error('x')),
    getTxLanding: vi.fn().mockResolvedValue('notfound'),
    ...over,
})

const renderFlow = (props: Partial<CreateDaoFlowProps> = {}) =>
    render(
        <ChakraProvider value={defaultSystem}>
            <CreateDaoFlow onCreated={vi.fn()} services={services()} {...props}/>
        </ChakraProvider>,
    )

const next = (name = 'Continue') => fireEvent.click(screen.getByRole('button', {name: new RegExp(name)}))
const current = () => document.querySelector('[data-state="current"]')!.getAttribute('data-testid')

beforeEach(() => {
    cleanup()
    txMock.current = vi.fn(async () => true)
})

describe('CreateDaoFlow with a locked type and staking token', () => {
    const preset = {type: 'DAO_TYPE_STAKE' as const, name: 'HONEY Holders', electorate: {sr_ids: ['1'], dr_denom: ''}}

    it('skips the Type step, shows who set it, and lists only the rewards of that token', async () => {
        renderFlow({preset, locked: {type: true, stakingDenom: HONEY}, lockedBy: 'the Factory'})

        await screen.findByTestId('create-dao-flow')
        expect(current()).toBe('step-name')
        const type = screen.getByTestId('step-type')
        expect(type.getAttribute('data-state')).toBe('done')
        expect(type.textContent).toContain('Set by the Factory')
        expect(within(type).queryByRole('button', {name: /Edit/})).toBeNull()
        expect((screen.getByPlaceholderText('Hive Council') as HTMLInputElement).value).toBe('HONEY Holders')

        next()
        await screen.findByTestId('source-picker')
        expect(screen.getByTestId('source-sr-1')).toBeTruthy()
        expect(screen.queryByTestId('source-sr-3')).toBeNull() // the BZE reward is not offered
        expect(screen.getByTestId('source-sr-1').querySelector('input')!.checked).toBe(true)
    })

    it('the preset deposit is in the signed rules from the start (the token is known)', async () => {
        renderFlow({preset, locked: {type: true, stakingDenom: HONEY}})
        await screen.findByTestId('create-dao-flow')
        next(); await screen.findByTestId('source-picker')
        next(); next() // voters, admin: an external admin keeps it valid either way
        // admin: nobody decides is valid here (HONEY is staked), so the next step is rules
        await waitFor(() => expect(current()).toBe('step-rules'))
        expect(screen.getByTestId('preset-token-community').getAttribute('data-checked')).toBe('')
        next('Continue to review')
        expect((await screen.findByTestId('review-proposal deposit')).textContent).toContain('1,000 HONEY')
    })
})

const toReview = async (props: Partial<CreateDaoFlowProps> = {}) => {
    renderFlow({preset: {name: 'Hive Council', members: [CREATOR, addr(2)]}, ...props})
    await screen.findByTestId('create-dao-flow')
    next() // type
    next() // name
    next() // voters
    next() // admin
    next('Continue to review')
    await screen.findByTestId('review')
}

describe('the review', () => {
    it('shows the proposal cost and deposit that will be signed and the free-proposals warning', async () => {
        await toReview()
        expect(screen.getByTestId('review-proposal cost').textContent).toContain('None')
        expect(screen.getByTestId('review-proposal deposit').textContent).toContain('None')
        expect(screen.getByText(/Proposals are free here/)).toBeTruthy()
    })
})

describe('creating', () => {
    it('clears the draft and does not call onCreated when the DAO exists but its id could not be read', async () => {
        const onCreated = vi.fn(), onDraftChange = vi.fn()
        txMock.current = async (_m, o) => { o?.onSuccess?.({txhash: 'ABC', height: 1, code: 0}); return true }
        await toReview({onCreated, onDraftChange})

        fireEvent.click(screen.getByRole('button', {name: /Create DAO/}))
        await screen.findByText('The DAO was created')
        expect(onDraftChange).toHaveBeenLastCalledWith(undefined)
        expect(onCreated).not.toHaveBeenCalled()
    })

    it('after a timeout the button stays off, the hash can be checked and a refused tx frees the retry', async () => {
        const tx = vi.fn<CreateDaoTx>(async (_m, o) => { o?.onBroadcast?.('HASH1'); o?.onFailure?.('took too long', {stage: 'timeout'}); return false })
        txMock.current = tx
        const getTxLanding = vi.fn().mockResolvedValue('failed')
        await toReview({services: services({getTxLanding})})

        fireEvent.click(screen.getByRole('button', {name: /Create DAO/}))
        await screen.findByText('Waiting for the chain')
        expect((screen.getByRole('button', {name: /Create DAO/}) as HTMLButtonElement).disabled).toBe(true)
        fireEvent.click(screen.getByRole('button', {name: /Create DAO/}))
        expect(tx).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByTestId('check-tx'))
        await screen.findByText(/refused by the chain/)
        expect(getTxLanding).toHaveBeenCalledWith('HASH1')
    })

    it('hands a created DAO to onCreated', async () => {
        const onCreated = vi.fn()
        const events = [{type: 'bze.dao.EventDaoCreated', attributes: [{key: 'id', value: '"9"'}, {key: 'address', value: '"bze1d"'}]}]
        txMock.current = async (_m, o) => { o?.onSuccess?.({txhash: 'ABC', height: 1, code: 0, events}); return true }
        await toReview({onCreated})
        fireEvent.click(screen.getByRole('button', {name: /Create DAO/}))
        await waitFor(() => expect(onCreated).toHaveBeenCalledWith({id: '9', address: 'bze1d', txHash: 'ABC'}))
    })
})
