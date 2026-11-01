// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BZE_CIRCLE_LOGO, TOKEN_LOGO_PLACEHOLDER } from '../constants/placeholders'
import type { RegistryAsset, RegistryAssetsResponse } from '../types/registry_asset'

// getChainAssets reads BZE Scan's list through the global fetch (stubbed per test), the supply,
// metadata, pools and halted denoms from the chain (mocked), and keeps the last good list in the
// real ui-kit localStorage helpers (jsdom). The bundled registry is emptied so a denom Scan does
// not list can only be named by its bank metadata.
const { getAllSupplyMock, getAllSupplyMetadataMock, getHaltedDenomsMock } = vi.hoisted(() => ({
    getAllSupplyMock: vi.fn(),
    getAllSupplyMetadataMock: vi.fn(),
    getHaltedDenomsMock: vi.fn(),
}))

vi.mock('../query/supply', () => ({
    getAllSupply: () => getAllSupplyMock(),
    getAllSupplyMetadata: () => getAllSupplyMetadataMock(),
}))
vi.mock('../query/liquidity_pools', () => ({ getLiquidityPools: async () => [] }))
vi.mock('../query/halted_denoms', () => ({ getHaltedDenoms: () => getHaltedDenomsMock() }))
vi.mock('../query/ibc', () => ({
    getHashIBCTrace: async () => undefined,
    counterpartyChainForChannel: async () => undefined,
}))
vi.mock('../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../constants/chain')>()),
    getAssetLists: () => [],
    getIBCAssetList: () => [],
}))

import { ASSETS_REFRESH_ATTEMPTS, getChainAssets, getChainAssetsAfterTx } from './assets_factory'
import { getRegistryAssetsURL } from '../query/registry_assets'

const GGE = 'factory/bze12gyp30f29zg26nuqrwdhl26ej4q066pt572fhm/GGE'
const HIDDEN = 'factory/bze1hidden/uhidden'
const ATOM = 'ibc/3333333333333333333333333333333333333333333333333333333333333333'
const UNKNOWN = 'ibc/9999999999999999999999999999999999999999999999999999999999999999'
const LP = 'ulp_ubze_' + GGE
// In the fallback's hard-coded VERIFIED_ASSETS: built from the chain it must still not be verified.
const NEW_TOKEN = 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl'

const chainInfo = {
    chain_name: 'osmosis', chain_id: 'osmosis-1', pretty_name: 'Osmosis', logo: 'osmo.svg',
    bech32_prefix: 'osmo', rest: ['https://rest.osmo.test'], rpc: ['https://rpc.osmo.test'],
}

const base = (denom: string, kind: string, extra: Partial<RegistryAsset> = {}): RegistryAsset => ({
    denom, kind, name: denom, ticker: denom.toUpperCase(), decimals: 6, logo: null, description: null,
    verified: false, stable: false, excluded: false, halted: false, deposit_allowed: true, withdraw_allowed: true,
    notice: null, ibc: null, lp: null, routes: null, version: 'a' + denom.length, ...extra,
})

const SCAN_ASSETS: RegistryAsset[] = [
    base('ubze', 'native', {
        name: 'BeeZee', ticker: 'BZE', logo: BZE_CIRCLE_LOGO, verified: true,
        routes: [{ ...chainInfo, channel_id: 'channel-0', counterparty_channel_id: 'channel-340', counterparty_denom: 'ibc/BZEONOSMO' }],
    }),
    base(GGE, 'factory', { name: 'Gege', ticker: 'GGE', description: 'the gege token', verified: true, stable: true, routes: [] }),
    base(HIDDEN, 'factory', { excluded: true, routes: [] }),
    base(ATOM, 'ibc', {
        name: 'Cosmos Hub Atom', ticker: 'ATOM', logo: 'atom.svg', verified: true, deposit_allowed: false,
        notice: { title: 'ATOM moves', text: 'Use the new channel.' },
        ibc: {
            channel_id: 'channel-5',
            counterparty: { ...chainInfo, chain_name: 'cosmoshub', chain_id: 'cosmoshub-4', pretty_name: 'Cosmos Hub', logo: 'hub.svg', bech32_prefix: 'cosmos', channel_id: 'channel-500', base_denom: 'uatom' },
            origin: { chain_name: 'cosmoshub', base_denom: 'uatom', hops: 1 },
            channel_confirmed: true,
        },
    }),
    base(UNKNOWN, 'ibc', {
        name: 'ufake', ticker: 'IBC/9999…9999', decimals: 0, deposit_allowed: false, withdraw_allowed: false,
        ibc: {
            channel_id: 'channel-77',
            counterparty: { chain_name: null, chain_id: 'fake-1', pretty_name: 'Unknown chain', logo: null, bech32_prefix: null, rest: null, rpc: null, channel_id: 'channel-1', base_denom: 'ufake' },
            origin: null,
            channel_confirmed: false,
        },
    }),
    base(LP, 'lp', { name: 'BZE/GGE LP Shares', ticker: 'BZE/GGE LP', decimals: 12, verified: true, lp: { base: 'ubze', quote: GGE } }),
]

const list = (version: string, assets: RegistryAsset[] = SCAN_ASSETS): RegistryAssetsResponse => ({ version, assets })

const SUPPLY = [
    { denom: 'ubze', amount: '1000' },
    { denom: GGE, amount: '2000' },
    { denom: HIDDEN, amount: '3000' },
    { denom: ATOM, amount: '4000' },
    { denom: UNKNOWN, amount: '5000' },
    { denom: LP, amount: '6000' },
]

const NEW_TOKEN_METADATA = {
    base: NEW_TOKEN, name: 'Vidulum', symbol: 'VDL', description: 'fresh token', display: 'vdl', uri: '', uri_hash: '',
    denom_units: [{ denom: NEW_TOKEN, exponent: 0, aliases: [] }, { denom: 'vdl', exponent: 6, aliases: [] }],
}

const jsonResponse = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
}) as unknown as Response

const fetchMock = vi.fn()

describe('getChainAssets from BZE Scan', () => {
    beforeEach(() => {
        localStorage.clear()
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
        getAllSupplyMock.mockResolvedValue(SUPPLY)
        getAllSupplyMetadataMock.mockResolvedValue([])
        getHaltedDenomsMock.mockResolvedValue([])
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('maps every field of Scan\'s list and takes the supply from the chain', async () => {
        fetchMock.mockResolvedValue(jsonResponse(list('v1')))

        const { assets, ibcData } = await getChainAssets()

        expect(fetchMock).toHaveBeenCalledWith(getRegistryAssetsURL(), undefined)
        expect(assets.get('ubze')).toMatchObject({
            type: 'Native', name: 'BeeZee', ticker: 'BZE', decimals: 6, logo: BZE_CIRCLE_LOGO,
            verified: true, stable: false, halted: false, supply: BigInt(1000),
            scan: {
                depositAllowed: true, withdrawAllowed: true,
                routes: [{
                    chain: { chainName: 'osmosis', chainId: 'osmosis-1', prettyName: 'Osmosis', logo: 'osmo.svg', bech32Prefix: 'osmo', rest: ['https://rest.osmo.test'] },
                    channelId: 'channel-0', counterpartyChannelId: 'channel-340', counterpartyDenom: 'ibc/BZEONOSMO',
                }],
            },
        })
        expect(assets.get(GGE)).toMatchObject({
            type: 'Factory', name: 'Gege', ticker: 'GGE', logo: TOKEN_LOGO_PLACEHOLDER, description: 'the gege token',
            verified: true, stable: true, supply: BigInt(2000),
        })
        expect(assets.get(ATOM)).toMatchObject({
            type: 'IBC', ticker: 'ATOM', logo: 'atom.svg', supply: BigInt(4000),
            IBCData: {
                chain: { channelId: 'channel-5' },
                counterparty: { chainName: 'cosmoshub', chainPrettyName: 'Cosmos Hub', channelId: 'channel-500', baseDenom: 'uatom' },
            },
            scan: {
                depositAllowed: false, withdrawAllowed: true,
                notice: { title: 'ATOM moves', text: 'Use the new channel.' },
                counterparty: { chainName: 'cosmoshub', chainId: 'cosmoshub-4', prettyName: 'Cosmos Hub', logo: 'hub.svg', bech32Prefix: 'cosmos' },
                origin: { chainName: 'cosmoshub', baseDenom: 'uatom', hops: 1 },
                routes: [],
            },
        })
        // A chain the registry does not know keeps empty names, so the bridge never offers it.
        expect(assets.get(UNKNOWN)?.IBCData?.counterparty).toEqual({ chainName: '', chainPrettyName: 'Unknown chain', channelId: 'channel-1', baseDenom: 'ufake' })
        expect(assets.get(UNKNOWN)?.scan?.counterparty).toEqual({ chainName: '', chainId: 'fake-1', prettyName: 'Unknown chain', logo: '', bech32Prefix: '', rest: [] })
        expect(assets.get(LP)).toMatchObject({ type: 'LP', ticker: 'BZE/GGE LP', decimals: 12, verified: true, supply: BigInt(6000) })
        expect(ibcData.get('channel-5')).toEqual(assets.get(ATOM)?.IBCData)
        expect(ibcData.get('channel-77')).toEqual(assets.get(UNKNOWN)?.IBCData)
    })

    it('drops excluded assets', async () => {
        fetchMock.mockResolvedValue(jsonResponse(list('v1')))

        const { assets } = await getChainAssets()

        expect(assets.has(HIDDEN)).toBe(false)
        expect([...assets.keys()].sort()).toEqual(['ubze', GGE, ATOM, UNKNOWN, LP].sort())
    })

    it('marks an asset halted when the chain halts it before Scan does', async () => {
        fetchMock.mockResolvedValue(jsonResponse(list('v1')))
        getHaltedDenomsMock.mockResolvedValue([GGE])

        const { assets } = await getChainAssets()

        expect(assets.get(GGE)?.halted).toBe(true)
        expect(assets.get(LP)?.halted).toBe(true)
        expect(assets.get('ubze')?.halted).toBe(false)
    })

    it('builds a denom Scan does not list yet from the chain, never verified', async () => {
        fetchMock.mockResolvedValue(jsonResponse(list('v1')))
        getAllSupplyMock.mockResolvedValue([...SUPPLY, { denom: NEW_TOKEN, amount: '7000' }])
        getAllSupplyMetadataMock.mockResolvedValue([NEW_TOKEN_METADATA])

        const { assets } = await getChainAssets()

        const fresh = assets.get(NEW_TOKEN)
        expect(fresh).toMatchObject({ name: 'Vidulum', ticker: 'VDL', decimals: 6, description: 'fresh token', supply: BigInt(7000), verified: false })
        expect(fresh?.scan).toBeUndefined()
    })

    it('uses the stored copy when Scan is down, answers non-2xx or sends an invalid body', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(list('v1')))
        const fromScan = await getChainAssets()

        for (const failure of [
            () => Promise.reject(new TypeError('fetch failed')),
            () => Promise.resolve(jsonResponse({ code: 'upstream_error' }, 503)),
            () => Promise.resolve(jsonResponse({ assets: 'nope' })),
            () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('html') } } as unknown as Response),
        ]) {
            fetchMock.mockImplementationOnce(failure)
            const { assets } = await getChainAssets()
            expect(assets).toEqual(fromScan.assets)
            expect(assets.get(ATOM)?.scan).toBeDefined()
        }
    })

    it('falls back to the chain + bundled registry build when Scan is down and nothing is stored', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'))
        getAllSupplyMock.mockResolvedValue([{ denom: 'ubze', amount: '1000' }, { denom: NEW_TOKEN, amount: '7000' }])
        getAllSupplyMetadataMock.mockResolvedValue([NEW_TOKEN_METADATA])

        const { assets } = await getChainAssets()

        // The hard-coded curation lists decide again, and no asset carries Scan's data.
        expect(assets.get(NEW_TOKEN)).toMatchObject({ ticker: 'VDL', verified: true })
        expect([...assets.values()].every(a => a.scan === undefined)).toBe(true)
    })

    describe('after the user\'s own transaction', () => {
        it('refetches past the HTTP cache until the version changes, showing the denom from the chain meanwhile', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse(list('v1')))
            await getChainAssets()

            getAllSupplyMock.mockResolvedValue([...SUPPLY, { denom: NEW_TOKEN, amount: '7000' }])
            getAllSupplyMetadataMock.mockResolvedValue([NEW_TOKEN_METADATA])
            const withNewToken = list('v2', [...SCAN_ASSETS, base(NEW_TOKEN, 'factory', { name: 'Vidulum Scan', ticker: 'VDL', routes: [] })])
            fetchMock.mockReset()
            fetchMock
                .mockResolvedValueOnce(jsonResponse(list('v1')))
                .mockResolvedValueOnce(jsonResponse(list('v1')))
                .mockResolvedValueOnce(jsonResponse(withNewToken))

            vi.useFakeTimers()
            const onInterim = vi.fn()
            const done = getChainAssetsAfterTx(NEW_TOKEN, onInterim)
            await vi.runAllTimersAsync()
            const { assets } = await done

            expect(onInterim).toHaveBeenCalledTimes(1)
            const interim = onInterim.mock.calls[0][0].assets
            expect(interim.get(NEW_TOKEN)).toMatchObject({ name: 'Vidulum', verified: false })
            expect(interim.get(NEW_TOKEN).scan).toBeUndefined()

            expect(fetchMock).toHaveBeenCalledTimes(3)
            for (const call of fetchMock.mock.calls) {
                expect(call).toEqual([getRegistryAssetsURL(), { cache: 'no-cache' }])
            }
            expect(assets.get(NEW_TOKEN)).toMatchObject({ name: 'Vidulum Scan', scan: { routes: [] } })
        })

        it('keeps the changed denom\'s display from the chain and Scan\'s curation while the version stays', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse(list('v1')))
            await getChainAssets()

            getAllSupplyMetadataMock.mockResolvedValue([{ ...NEW_TOKEN_METADATA, base: GGE, name: 'Gege Renamed', denom_units: [{ denom: GGE, exponent: 0, aliases: [] }, { denom: 'gge', exponent: 6, aliases: [] }] }])
            fetchMock.mockReset()
            fetchMock.mockResolvedValue(jsonResponse(list('v1')))

            vi.useFakeTimers()
            const done = getChainAssetsAfterTx(GGE)
            await vi.runAllTimersAsync()
            const { assets } = await done

            expect(fetchMock).toHaveBeenCalledTimes(ASSETS_REFRESH_ATTEMPTS)
            expect(assets.get(GGE)).toMatchObject({ name: 'Gege Renamed', verified: true, stable: true, scan: { depositAllowed: true } })
        })

        describe('when the version moves for someone else\'s change first', () => {
            const OTHER = 'factory/bze1other/uother'
            const GGE_RENAMED_METADATA = {
                base: GGE, name: 'Gege Renamed', symbol: 'GGE', description: 'the gege token', display: 'gge', uri: '', uri_hash: '',
                denom_units: [{ denom: GGE, exponent: 0, aliases: [] }, { denom: 'gge', exponent: 6, aliases: [] }],
            }
            const withOther = (assets: RegistryAsset[]) => [...assets, base(OTHER, 'factory', { name: 'Other', routes: [] })]

            beforeEach(async () => {
                fetchMock.mockResolvedValueOnce(jsonResponse(list('v1')))
                await getChainAssets()
                getAllSupplyMock.mockResolvedValue([...SUPPLY, { denom: OTHER, amount: '8000' }])
                getAllSupplyMetadataMock.mockResolvedValue([GGE_RENAMED_METADATA])
                fetchMock.mockReset()
            })

            it('keeps refetching until Scan\'s entry for the denom matches the chain', async () => {
                const renamed = SCAN_ASSETS.map(a => a.denom === GGE ? { ...a, name: 'Gege Renamed' } : a)
                fetchMock
                    .mockResolvedValueOnce(jsonResponse(list('v2', withOther(SCAN_ASSETS))))
                    .mockResolvedValueOnce(jsonResponse(list('v3', withOther(renamed))))

                vi.useFakeTimers()
                const done = getChainAssetsAfterTx(GGE)
                await vi.runAllTimersAsync()
                const { assets } = await done

                expect(fetchMock).toHaveBeenCalledTimes(2)
                expect(assets.get(GGE)).toMatchObject({ name: 'Gege Renamed', verified: true, stable: true })
                expect(assets.get(OTHER)).toMatchObject({ name: 'Other', scan: { routes: [] } })
            })

            it('shows the chain\'s display with Scan\'s curation from the newest list when Scan never catches up', async () => {
                fetchMock.mockResolvedValue(jsonResponse(list('v2', withOther(SCAN_ASSETS))))

                vi.useFakeTimers()
                const done = getChainAssetsAfterTx(GGE)
                await vi.runAllTimersAsync()
                const { assets } = await done

                expect(fetchMock).toHaveBeenCalledTimes(ASSETS_REFRESH_ATTEMPTS)
                expect(assets.get(GGE)).toMatchObject({ name: 'Gege Renamed', verified: true, stable: true, scan: { depositAllowed: true } })
                expect(assets.get(OTHER)).toMatchObject({ name: 'Other', scan: { routes: [] } })
            })
        })
    })
})
