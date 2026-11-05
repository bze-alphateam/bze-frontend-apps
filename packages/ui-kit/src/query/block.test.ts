import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The RPC endpoint comes from the saved settings; each test picks it.
const { settingsMock } = vi.hoisted(() => ({ settingsMock: vi.fn() }))

vi.mock('../storage/settings', () => ({ getSettings: settingsMock }))

import { getBlockResults } from './block'

const RESULTS = { jsonrpc: '2.0', id: -1, result: { height: '4084167', finalize_block_events: [] } }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('getBlockResults', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: '', rpcEndpoint: 'wss://testnet-rpc.getbze.com' } })
        fetchMock = vi.fn(async () => json(RESULTS))
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => vi.unstubAllGlobals())

    it('reads the block over HTTPS with a plain GET (no header, so no CORS preflight)', async () => {
        expect(await getBlockResults(4084167)).toEqual(RESULTS)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0]).toEqual(['https://testnet-rpc.getbze.com/block_results?height=4084167'])
    })

    it.each([
        ['wss://testnet-rpc.getbze.com/', 'https://testnet-rpc.getbze.com/block_results?height=7'],
        ['ws://localhost:26657/', 'http://localhost:26657/block_results?height=7'],
        ['https://testnet-rpc.getbze.com//', 'https://testnet-rpc.getbze.com/block_results?height=7'],
    ])('builds one path from the endpoint %s saved by the settings panel', async (endpoint, url) => {
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: '', rpcEndpoint: endpoint } })

        await getBlockResults(7)
        expect(fetchMock.mock.calls[0][0]).toBe(url)
    })

    it('answers undefined for a block the node has not committed yet', async () => {
        fetchMock.mockResolvedValue(json({
            jsonrpc: '2.0', id: -1,
            error: { code: -32603, message: 'Internal error', data: 'height 99999999 must be less than or equal to the current blockchain height 4084229' },
        }, 500))

        expect(await getBlockResults(99999999)).toBeUndefined()
    })

    it('throws on any other error answer, so it never reads as "not drawn yet"', async () => {
        fetchMock.mockResolvedValue(new Response('<html>502 Bad Gateway</html>', { status: 502 }))
        await expect(getBlockResults(4084167)).rejects.toThrow('HTTP 502')

        fetchMock.mockResolvedValue(json({
            jsonrpc: '2.0', id: -1,
            error: { code: -32603, message: 'Internal error', data: 'height 2 is not available, lowest height is 4000000' },
        }, 500))
        await expect(getBlockResults(2)).rejects.toThrow('lowest height is 4000000')
    })

    it('passes a failed request on', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

        await expect(getBlockResults(4084167)).rejects.toThrow('Failed to fetch')
    })
})
