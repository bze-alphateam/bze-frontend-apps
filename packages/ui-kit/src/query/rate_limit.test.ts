import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { settingsMock } = vi.hoisted(() => ({ settingsMock: vi.fn() }))
vi.mock('../storage/settings', () => ({ getSettings: settingsMock }))

import { clearRateLimitCache, getRateLimit, nextRateLimitReset } from './rate_limit'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const limit = (o: { send?: string; recv?: string; inflow?: string; outflow?: string; value?: string; hours?: string } = {}) => ({
    rate_limit: {
        path: { denom: 'ubze', channel_or_client_id: 'channel-0' },
        quota: { max_percent_send: o.send ?? '2', max_percent_recv: o.recv ?? '2', duration_hours: o.hours ?? '24' },
        flow: { inflow: o.inflow ?? '0', outflow: o.outflow ?? '0', channel_value: o.value ?? '1000' },
    },
})

describe('getRateLimit', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        clearRateLimitCache()
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: 'https://rest.example' } })
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

    it('queries by BZE-side channel and url-encoded denom', async () => {
        fetchMock.mockResolvedValue(json(limit()))
        await getRateLimit('channel-3', 'ibc/ABC')

        expect(fetchMock).toHaveBeenCalledWith('https://rest.example/Stride-Labs/ibc-rate-limiting/ratelimit/ratelimit/channel-3/by_denom?denom=ibc%2FABC', expect.anything())
    })

    it('truncates the threshold (floor of value * percent / 100)', async () => {
        fetchMock.mockResolvedValue(json(limit({ value: '1999', send: '2', recv: '3' })))
        const r = await getRateLimit('channel-0', 'ubze')

        expect(r?.sendThreshold).toBe(BigInt(39)) // 39.98
        expect(r?.recvThreshold).toBe(BigInt(59)) // 59.97
    })

    it('room is threshold minus net flow: the room itself passes, one more would be refused', async () => {
        fetchMock.mockResolvedValue(json(limit({ value: '1000', send: '2', outflow: '15' })))
        const r = await getRateLimit('channel-0', 'ubze')

        expect(r?.sendThreshold).toBe(BigInt(20))
        expect(r?.sendRoom).toBe(BigInt(5)) // net 15 + 5 = 20, not > 20
    })

    it('negative net flow puts the room above the threshold', async () => {
        // send net = outflow - inflow = -30; receive net = +30
        fetchMock.mockResolvedValue(json(limit({ value: '1000', send: '2', recv: '2', inflow: '30' })))
        const r = await getRateLimit('channel-0', 'ubze')

        expect(r?.sendRoom).toBe(BigInt(50))
        expect(r?.recvRoom).toBe(BigInt(0)) // 20 - 30 < 0, floored
    })

    it('0% receive leaves no room and a zero threshold', async () => {
        fetchMock.mockResolvedValue(json(limit({ recv: '0' })))
        const r = await getRateLimit('channel-0', 'ubze')

        expect(r?.recvRoom).toBe(BigInt(0))
        expect(r?.recvThreshold).toBe(BigInt(0))
    })

    it('handles supplies beyond 2^53 exactly', async () => {
        fetchMock.mockResolvedValue(json(limit({ value: '900000000000000000001', send: '2' })))
        const r = await getRateLimit('channel-0', 'ubze')

        expect(r?.sendThreshold).toBe(BigInt(18000000000000000000))
    })

    it('channel_value 0 means no limit', async () => {
        fetchMock.mockResolvedValue(json(limit({ value: '0' })))
        expect(await getRateLimit('channel-0', 'ubze')).toBeNull()
    })

    it('rate_limit null means no limit', async () => {
        fetchMock.mockResolvedValue(json({ rate_limit: null }))
        expect(await getRateLimit('channel-0', 'ubze')).toBeNull()
    })

    it.each([501, 404, 500])('HTTP %i (v8.2.0 node) means no limit and is not cached', async (status) => {
        fetchMock.mockResolvedValueOnce(json({ code: 12 }, status))
        expect(await getRateLimit('channel-0', 'ubze')).toBeNull()

        fetchMock.mockResolvedValueOnce(json(limit()))
        expect((await getRateLimit('channel-0', 'ubze'))?.sendThreshold).toBe(BigInt(20))
    })

    it('fails open on network errors and garbage', async () => {
        fetchMock.mockRejectedValueOnce(new Error('offline'))
        expect(await getRateLimit('channel-0', 'ubze')).toBeNull()

        fetchMock.mockResolvedValueOnce(json(limit({ value: 'abc' })))
        expect(await getRateLimit('channel-0', 'ubze')).toBeNull()
    })

    it('caches per route for 30 s and shares one in-flight request', async () => {
        vi.useFakeTimers()
        fetchMock.mockImplementation(async () => json(limit()))
        await Promise.all([getRateLimit('channel-0', 'ubze'), getRateLimit('channel-0', 'ubze')])
        await getRateLimit('channel-0', 'ubze')
        expect(fetchMock).toHaveBeenCalledTimes(1)

        await getRateLimit('channel-2', 'ubze')
        expect(fetchMock).toHaveBeenCalledTimes(2)

        vi.advanceTimersByTime(30_001)
        await getRateLimit('channel-0', 'ubze')
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('clearRateLimitCache forces a fresh read', async () => {
        fetchMock.mockImplementation(async () => json(limit()))
        await getRateLimit('channel-0', 'ubze')
        clearRateLimitCache()
        await getRateLimit('channel-0', 'ubze')

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})

describe('nextRateLimitReset', () => {
    const at = (iso: string) => new Date(iso)

    it('24 h resets at the next 00:00 UTC', () => {
        expect(nextRateLimitReset(at('2026-11-26T23:59:59Z'), 24)?.toISOString()).toBe('2026-11-27T00:00:00.000Z')
        expect(nextRateLimitReset(at('2026-11-27T00:00:01Z'), 24)?.toISOString()).toBe('2026-11-28T00:00:00.000Z')
    })

    it('6 h resets at the next multiple of 6', () => {
        expect(nextRateLimitReset(at('2026-11-26T07:30:00Z'), 6)?.toISOString()).toBe('2026-11-26T12:00:00.000Z')
        expect(nextRateLimitReset(at('2026-11-26T18:00:00Z'), 6)?.toISOString()).toBe('2026-11-27T00:00:00.000Z')
    })

    it('a duration that does not divide 24 has no derivable reset', () => {
        expect(nextRateLimitReset(at('2026-11-26T07:30:00Z'), 5)).toBeUndefined()
    })
})

describe('getRateLimit robustness', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        clearRateLimitCache()
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: 'https://rest.example' } })
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

    it('a zero threshold leaves no room even when net flow would make it positive', async () => {
        // receive net = inflow - outflow = -50 would give room 50 with a 0 threshold
        fetchMock.mockResolvedValue(json(limit({ recv: '0', outflow: '50' })))
        const r = await getRateLimit('channel-0', 'ubze')

        expect(r?.recvRoom).toBe(BigInt(0))
    })

    it('never rejects when settings throw', async () => {
        settingsMock.mockImplementation(() => { throw new Error('no settings') })

        await expect(getRateLimit('channel-0', 'ubze')).resolves.toBeNull()
    })

    it('does not cache a response that started before clearRateLimitCache', async () => {
        let release: (r: Response) => void = () => {}
        fetchMock.mockImplementationOnce(() => new Promise<Response>(res => { release = res }))
        const stale = getRateLimit('channel-0', 'ubze')
        clearRateLimitCache()
        release(json(limit({ send: '2' })))
        await stale

        fetchMock.mockResolvedValueOnce(json(limit({ send: '5' })))
        expect((await getRateLimit('channel-0', 'ubze'))?.sendThreshold).toBe(BigInt(50))
    })

    it('gives up on a never-resolving fetch after about 3 s, caching nothing', async () => {
        vi.useFakeTimers()
        fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}))
        const pending = getRateLimit('channel-0', 'ubze')
        await vi.advanceTimersByTimeAsync(3001)

        expect(await pending).toBeNull()

        fetchMock.mockResolvedValueOnce(json(limit()))
        expect((await getRateLimit('channel-0', 'ubze'))?.sendThreshold).toBe(BigInt(20))
    })
})
