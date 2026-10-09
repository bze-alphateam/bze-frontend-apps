import { beforeEach, describe, expect, it, vi } from 'vitest'

// The queries go through bzejs' LCD client; the client is replaced so each test controls the
// wire response and can inspect the request (denom as query param, pagination key).
const { denomBrandingMock, allDenomBrandingMock } = vi.hoisted(() => ({
    denomBrandingMock: vi.fn(),
    allDenomBrandingMock: vi.fn(),
}))

vi.mock('./client', () => ({
    getRestClient: async () => ({
        bze: { tokenfactory: { denomBranding: denomBrandingMock, allDenomBranding: allDenomBrandingMock } },
    }),
}))

import { getAllDenomBranding, getDenomBranding } from './branding'

const FACTORY_DENOM = 'factory/bze1creator/mytoken'

const KIT = {
    font: 'inter',
    light: { background: '#ffffff', text: '#111111', primary: '#aa0000', secondary: '#555555' },
    dark: { background: '#000000', text: '#eeeeee', primary: '#ff4444', secondary: '#999999' },
}

// An axios-style rejection, as the LCD client surfaces it.
const httpError = (status: number, code: number) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status, data: { code, message: 'x', details: [] } },
    })

describe('getDenomBranding', () => {
    beforeEach(() => { denomBrandingMock.mockReset() })

    it('passes the denom as the query param and returns the stored kit', async () => {
        denomBrandingMock.mockResolvedValue({ branding: KIT })

        expect(await getDenomBranding(FACTORY_DENOM)).toEqual(KIT)
        expect(denomBrandingMock).toHaveBeenCalledWith({ denom: FACTORY_DENOM })
    })

    it('returns null when no kit is stored (gRPC NotFound → HTTP 404)', async () => {
        denomBrandingMock.mockRejectedValue(httpError(404, 5))

        expect(await getDenomBranding(FACTORY_DENOM)).toBeNull()
    })

    it('returns null when the node answers without a branding', async () => {
        denomBrandingMock.mockResolvedValue({ branding: null })

        expect(await getDenomBranding(FACTORY_DENOM)).toBeNull()
    })

    it('throws on a pre-v8.2.0 node (HTTP 501) so an error is never shown as "no brand kit"', async () => {
        denomBrandingMock.mockRejectedValue(httpError(501, 12))

        await expect(getDenomBranding(FACTORY_DENOM)).rejects.toThrow('501')
    })
})

describe('getAllDenomBranding', () => {
    beforeEach(() => { allDenomBrandingMock.mockReset() })

    it('follows next_key across pages', async () => {
        allDenomBrandingMock
            .mockResolvedValueOnce({ denom_brandings: [{ denom: 'a', branding: KIT }], pagination: { next_key: btoa('k') } })
            .mockResolvedValueOnce({ denom_brandings: [{ denom: 'b', branding: KIT }], pagination: { next_key: null } })

        const records = await getAllDenomBranding()

        expect(records.map(r => r.denom)).toEqual(['a', 'b'])
        expect(allDenomBrandingMock).toHaveBeenCalledTimes(2)
        const secondKey = allDenomBrandingMock.mock.calls[1][0].pagination.key
        expect(Array.from(secondKey)).toEqual(['k'.charCodeAt(0)])
    })
})
