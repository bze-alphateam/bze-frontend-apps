import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TOKEN_LOGO_PLACEHOLDER } from '../constants/placeholders'
import { truncateDenom } from '../utils/denom'

// getChainAssets reads the chain through the supply, pools, halted-denoms and IBC
// queries (mocked here) and the chain registry through getAssetLists /
// getIBCAssetList, replaced with small fixtures so each path is pinned exactly.
// Everything else in constants/chain (chain name, chains, connections) stays real.
const { getAllSupplyMock, getHashIBCTraceMock, counterpartyChainForChannelMock, getAssetListsMock, getIBCAssetListMock } = vi.hoisted(() => ({
    getAllSupplyMock: vi.fn(),
    getHashIBCTraceMock: vi.fn(),
    counterpartyChainForChannelMock: vi.fn(),
    getAssetListsMock: vi.fn(),
    getIBCAssetListMock: vi.fn(),
}))

vi.mock('../query/supply', () => ({
    getAllSupply: () => getAllSupplyMock(),
    getAllSupplyMetadata: async () => [],
}))
vi.mock('../query/liquidity_pools', () => ({ getLiquidityPools: async () => [] }))
vi.mock('../query/halted_denoms', () => ({ getHaltedDenoms: async () => [] }))
vi.mock('../query/ibc', () => ({
    getHashIBCTrace: (hash: string) => getHashIBCTraceMock(hash),
    counterpartyChainForChannel: (channelId: string, portId: string) => counterpartyChainForChannelMock(channelId, portId),
}))
vi.mock('../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../constants/chain')>()),
    getAssetLists: () => getAssetListsMock(),
    getIBCAssetList: () => getIBCAssetListMock(),
}))

import { getChainAssets } from './assets_factory'

const SPOOF_DENOM = 'ibc/1111111111111111111111111111111111111111111111111111111111111111'
const BZE_LISTED_DENOM = 'ibc/2222222222222222222222222222222222222222222222222222222222222222'
const REGISTRY_DENOM = 'ibc/3333333333333333333333333333333333333333333333333333333333333333'

const registryAsset = (base: string, name: string, symbol: string, display: string, logo: string, extra: Record<string, unknown> = {}) => ({
    base,
    name,
    symbol,
    display,
    typeAsset: 'sdk.coin',
    denomUnits: [{ denom: base, exponent: 0 }, { denom: display, exponent: 6 }],
    logoURIs: { svg: logo },
    ...extra,
})

// Other chains' registry entries for the base denoms the traces below claim.
const OSMOSIS_LIST = { chainName: 'osmosis', assets: [registryAsset('uosmo', 'Osmosis', 'OSMO', 'osmo', 'osmo.svg')] }
const NOBLE_LIST = { chainName: 'noble', assets: [registryAsset('uusdc', 'USD Coin', 'USDC', 'usdc', 'usdc.svg')] }
// BZE's own list names one IBC coin by its exact ibc/<hash> denom.
const BZE_LIST = {
    chainName: 'beezee',
    assets: [registryAsset(BZE_LISTED_DENOM, 'Listed On BZE', 'LST', 'lst', 'lst.svg', { description: 'listed by BZE' })],
}

const REGISTRY_IBC_ASSET = registryAsset(REGISTRY_DENOM, 'Cosmos Hub Atom', 'ATOM', 'atom', 'atom.svg', {
    traces: [{
        type: 'ibc',
        counterparty: { chain_name: 'cosmoshub', base_denom: 'uatom', channel_id: 'channel-500' },
        chain: { channel_id: 'channel-5' },
    }],
})

const TRACES: Record<string, { path: string; base_denom: string }> = {
    [SPOOF_DENOM.replace('ibc/', '')]: { path: 'transfer/channel-999', base_denom: 'uosmo' },
    [BZE_LISTED_DENOM.replace('ibc/', '')]: { path: 'transfer/channel-998', base_denom: 'uusdc' },
}

describe('getChainAssets IBC coins', () => {
    beforeEach(() => {
        getAllSupplyMock.mockResolvedValue([
            { denom: SPOOF_DENOM, amount: '1000' },
            { denom: BZE_LISTED_DENOM, amount: '2000' },
            { denom: REGISTRY_DENOM, amount: '3000' },
        ])
        getAssetListsMock.mockReturnValue([OSMOSIS_LIST, NOBLE_LIST, BZE_LIST])
        getIBCAssetListMock.mockReturnValue([REGISTRY_IBC_ASSET])
        getHashIBCTraceMock.mockImplementation(async (hash: string) => TRACES[hash])
        // The light client of the fake chain declares itself osmosis-1.
        counterpartyChainForChannelMock.mockResolvedValue({ chainId: 'osmosis-1', channelId: 'channel-0' })
    })

    it('never gives a coin on an unregistered channel another chain\'s identity', async () => {
        const { assets } = await getChainAssets()
        const spoof = assets.get(SPOOF_DENOM)

        expect(spoof).toMatchObject({
            name: 'uosmo',
            ticker: truncateDenom(SPOOF_DENOM),
            decimals: 0,
            logo: TOKEN_LOGO_PLACEHOLDER,
            verified: false,
        })
        // Routing data stays as the trace and light client report it.
        expect(spoof?.IBCData).toEqual({
            chain: { channelId: 'channel-999' },
            counterparty: { chainName: 'osmosis', chainPrettyName: 'Osmosis', channelId: 'channel-0', baseDenom: 'uosmo' },
        })
    })

    it('still names an unregistered-channel coin listed in BZE\'s own asset list', async () => {
        const { assets } = await getChainAssets()

        expect(assets.get(BZE_LISTED_DENOM)).toMatchObject({
            name: 'Listed On BZE',
            ticker: 'LST',
            decimals: 6,
            logo: 'lst.svg',
            description: 'listed by BZE',
            verified: true,
        })
    })

    it('leaves coins from the registry IBC list unchanged', async () => {
        const { assets, ibcData } = await getChainAssets()

        expect(assets.get(REGISTRY_DENOM)).toMatchObject({
            name: 'Cosmos Hub Atom',
            ticker: 'ATOM',
            decimals: 6,
            logo: 'atom.svg',
            verified: true,
        })
        expect(ibcData.get('channel-5')?.counterparty).toEqual({
            chainName: 'cosmoshub',
            chainPrettyName: 'Cosmos Hub',
            channelId: 'channel-500',
            baseDenom: 'uatom',
        })
        expect(getHashIBCTraceMock).not.toHaveBeenCalledWith(REGISTRY_DENOM.replace('ibc/', ''))
    })
})
