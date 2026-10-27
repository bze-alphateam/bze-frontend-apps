import {describe, it, expect} from "vitest";
import {Asset} from "../types/asset";
import {
    ibcOriginFromRegistry,
    ibcOriginFromTrace,
    IbcConnectionEntry,
    IbcOrigin,
    RegistryAssetList,
    unverifyIndirectIbcDuplicates,
} from "./ibc_duplicates";

// Mainnet shapes: AtomOne reaches BZE directly (channel-6) and through
// Osmosis (channel-0 → Osmosis channel-94814); Injective's USDC directly
// (channel-13) and through the Cosmos Hub (channel-11 → Hub channel-220).
const ATONE_DIRECT = "ibc/B2219CA05421EA988F83E5E824BF69362E80A6A87503EFD18B92C91C9E03763D"
const ATONE_VIA_OSMOSIS = "ibc/E7CF15949EE673E0BD3F5AA7D711DD0A6C22992E7E5714A174DCEA289EB696A1"
const ATONE_ON_OSMOSIS = "ibc/BC26A7A805ECD6822719472BCB7842A48EF09DF206182F8F259B2593EB5D23FB"
const PHMN_VIA_OSMOSIS = "ibc/12C0B8B561AFCFDA3C73DEE0F7F84AA2B860D48493C27E8E81A5D14724FAB08B"
const USDC_INJ_BASE = "erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a"

const channel = (a: string, b: string) => ({
    chain1: {channelId: a, portId: "transfer"},
    chain2: {channelId: b, portId: "transfer"},
})

const CONNECTIONS: IbcConnectionEntry[] = [
    {chain1: {chainName: "beezee"}, chain2: {chainName: "osmosis"}, channels: [channel("channel-0", "channel-340")]},
    {chain1: {chainName: "atomone"}, chain2: {chainName: "osmosis"}, channels: [channel("channel-2", "channel-94814")]},
    {chain1: {chainName: "atomone"}, chain2: {chainName: "beezee"}, channels: [channel("channel-1", "channel-6")]},
    {chain1: {chainName: "beezee"}, chain2: {chainName: "cosmoshub"}, channels: [channel("channel-11", "channel-1898")]},
    {chain1: {chainName: "cosmoshub"}, chain2: {chainName: "injective"}, channels: [channel("channel-220", "channel-1")]},
]

const ASSET_LISTS: RegistryAssetList[] = [
    {
        chainName: "osmosis",
        assets: [{
            base: ATONE_ON_OSMOSIS,
            traces: [{type: "ibc", counterparty: {chainName: "atomone", baseDenom: "uatone"}}],
        }],
    },
]

const ibcAsset = (denom: string, verified: boolean): Asset => ({
    type: "IBC",
    denom,
    decimals: 6,
    name: denom,
    ticker: denom,
    logo: "",
    stable: false,
    verified,
    supply: 1n,
})

describe("ibcOriginFromTrace", () => {
    it("walks a two-hop trace through the registry channels to the home chain", () => {
        expect(ibcOriginFromTrace({path: "transfer/channel-11/transfer/channel-220", base_denom: USDC_INJ_BASE}, "beezee", CONNECTIONS))
            .toEqual({chainName: "injective", baseDenom: USDC_INJ_BASE, hops: 2})
    })

    it("resolves a direct trace from either side of a registry entry", () => {
        expect(ibcOriginFromTrace({path: "transfer/channel-6", base_denom: "uatone"}, "beezee", CONNECTIONS))
            .toEqual({chainName: "atomone", baseDenom: "uatone", hops: 1})
    })

    it("gives up when a hop is not in the registry", () => {
        expect(ibcOriginFromTrace({path: "transfer/channel-0/transfer/channel-169", base_denom: "cw20:juno1x"}, "beezee", CONNECTIONS))
            .toBeUndefined()
    })
})

describe("ibcOriginFromRegistry", () => {
    it("keeps a native counterparty denom as a one-hop origin", () => {
        expect(ibcOriginFromRegistry("atomone", "uatone", ASSET_LISTS))
            .toEqual({chainName: "atomone", baseDenom: "uatone", hops: 1})
    })

    it("follows an IBC voucher on the counterparty back to its home chain", () => {
        expect(ibcOriginFromRegistry("osmosis", ATONE_ON_OSMOSIS, ASSET_LISTS))
            .toEqual({chainName: "atomone", baseDenom: "uatone", hops: 2})
    })

    it("gives up when the counterparty voucher is not in the registry", () => {
        expect(ibcOriginFromRegistry("osmosis", "ibc/UNKNOWN", ASSET_LISTS)).toBeUndefined()
    })
})

describe("unverifyIndirectIbcDuplicates", () => {
    const setup = (origins: Array<[string, IbcOrigin]>) => {
        const assets = new Map(origins.map(([denom]) => [denom, ibcAsset(denom, true)]))
        unverifyIndirectIbcDuplicates(assets, new Map(origins))
        return assets
    }

    it("unverifies a two-hop asset that has a direct twin and keeps the direct one verified", () => {
        const assets = setup([
            [ATONE_DIRECT, {chainName: "atomone", baseDenom: "uatone", hops: 1}],
            [ATONE_VIA_OSMOSIS, {chainName: "atomone", baseDenom: "uatone", hops: 2}],
        ])

        expect(assets.get(ATONE_VIA_OSMOSIS)?.verified).toBe(false)
        expect(assets.get(ATONE_DIRECT)?.verified).toBe(true)
    })

    it("leaves a two-hop asset without a direct twin unchanged", () => {
        const assets = setup([
            [ATONE_DIRECT, {chainName: "atomone", baseDenom: "uatone", hops: 1}],
            [PHMN_VIA_OSMOSIS, {chainName: "juno", baseDenom: "cw20:juno1x", hops: 2}],
        ])

        expect(assets.get(PHMN_VIA_OSMOSIS)?.verified).toBe(true)
    })

    it("needs the same home chain, not just the same base denom", () => {
        const assets = setup([
            ["ibc/USDC_NOBLE", {chainName: "noble", baseDenom: "uusdc", hops: 1}],
            ["ibc/USDC_AXELAR_VIA_OSMOSIS", {chainName: "axelar", baseDenom: "uusdc", hops: 2}],
        ])

        expect(assets.get("ibc/USDC_AXELAR_VIA_OSMOSIS")?.verified).toBe(true)
    })

    it("does not touch assets without a resolved origin", () => {
        const assets = new Map([["factory/bze1x/utoken", ibcAsset("factory/bze1x/utoken", true)]])
        unverifyIndirectIbcDuplicates(assets, new Map([[ATONE_DIRECT, {chainName: "atomone", baseDenom: "uatone", hops: 1}]]))

        expect(assets.get("factory/bze1x/utoken")?.verified).toBe(true)
    })
})
