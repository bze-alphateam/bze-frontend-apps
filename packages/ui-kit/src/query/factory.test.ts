import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The query reads the node's REST route with fetch; the settings supply the endpoint and fetch is stubbed.
vi.mock('../storage/settings', () => ({
    getSettings: () => ({ endpoints: { restEndpoint: 'https://rest.example/' } }),
}))

import { getFactoryDenomAdmin, getFactoryDenomAdminAddress, getFactoryDenomAuthority } from './factory'

const DENOM = 'factory/bze1creator/utoken'
const ADMIN = 'bze1admin'

const answer = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body })

describe('getFactoryDenomAuthority', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => vi.unstubAllGlobals())

    it('asks the encoded route of the node', async () => {
        fetchMock.mockResolvedValue(answer({ denomAuthority: { admin: ADMIN, mintable: true } }))

        await getFactoryDenomAuthority(DENOM)

        expect(fetchMock).toHaveBeenCalledWith(`https://rest.example/bze/tokenfactory/denom_authority?denom=${encodeURIComponent(DENOM)}`)
    })

    it.each([
        ['v8.3.0 mintable', { admin: ADMIN, mintable: true }, { admin: ADMIN, mintable: true }],
        ['v8.3.0 minting disabled, admin kept', { admin: ADMIN, mintable: false }, { admin: ADMIN, mintable: false }],
        ['v8.3.0 renounced', { admin: '', mintable: false }, { admin: '', mintable: false }],
        ['v8.2.0 admin set (no field)', { admin: ADMIN }, { admin: ADMIN, mintable: true }],
        ['v8.2.0 renounced (no field)', { admin: '' }, { admin: '', mintable: false }],
        ['v8.2.0 empty authority', {}, { admin: '', mintable: false }],
    ])('%s', async (_, denomAuthority, expected) => {
        fetchMock.mockResolvedValue(answer({ denomAuthority }))

        expect(await getFactoryDenomAuthority(DENOM)).toEqual(expected)
    })

    it('answers undefined when the node errors or is unreachable, never a renounced denom', async () => {
        fetchMock.mockResolvedValueOnce(answer({ message: 'not found' }, false, 404))
        expect(await getFactoryDenomAuthority(DENOM)).toBeUndefined()

        fetchMock.mockRejectedValueOnce(new Error('network down'))
        expect(await getFactoryDenomAuthority(DENOM)).toBeUndefined()
    })

    it('keeps the admin helpers working on top of it', async () => {
        fetchMock.mockResolvedValue(answer({ denomAuthority: { admin: ADMIN, mintable: false } }))
        expect(await getFactoryDenomAdmin(DENOM)).toBe(ADMIN)

        fetchMock.mockRejectedValue(new Error('network down'))
        expect(await getFactoryDenomAdmin(DENOM)).toBeUndefined()
        expect(await getFactoryDenomAdminAddress(DENOM)).toBe('')
    })
})
