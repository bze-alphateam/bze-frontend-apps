import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../storage/settings', () => ({ getSettings: () => ({ endpoints: { restEndpoint: 'https://rest.test' } }) }))
vi.mock('../constants/chain', () => ({ getLockerAddress: () => '' }))

import { getAddressDenomBalance } from './bank'

const answer = (status: number, body: unknown) => vi.fn().mockResolvedValue({ status, json: async () => body })

describe('getAddressDenomBalance', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('reads the balance of one denom from the by_denom route', async () => {
        const fetchMock = answer(200, { balance: { denom: 'factory/a/x', amount: '1234' } })
        vi.stubGlobal('fetch', fetchMock)
        expect(await getAddressDenomBalance('bze1pool', 'factory/a/x')).toBe('1234')
        expect(fetchMock).toHaveBeenCalledWith('https://rest.test/cosmos/bank/v1beta1/balances/bze1pool/by_denom?denom=factory%2Fa%2Fx')
    })

    it('is undefined on a failing node or an unreadable answer', async () => {
        vi.stubGlobal('fetch', answer(500, {}))
        expect(await getAddressDenomBalance('bze1pool', 'factory/a/x')).toBeUndefined()
        vi.stubGlobal('fetch', answer(200, { balance: { amount: 'abc' } }))
        expect(await getAddressDenomBalance('bze1pool', 'factory/a/x')).toBeUndefined()
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
        expect(await getAddressDenomBalance('bze1pool', 'factory/a/x')).toBeUndefined()
    })
})
