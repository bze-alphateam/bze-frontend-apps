import {beforeEach, describe, expect, it, vi} from 'vitest'
import {toBase64} from '@interchainjs/encoding'

const {totalSupply, denomsMetadata} = vi.hoisted(() => ({
    totalSupply: vi.fn(),
    denomsMetadata: vi.fn(),
}))

vi.mock('./client', () => ({
    getRestClient: async () => ({cosmos: {bank: {v1beta1: {totalSupply, denomsMetadata}}}}),
}))

import {getAllSupply, getAllSupplyMetadata} from './supply'

const coin = (denom: string) => ({denom, amount: '1000'})
const metadata = (base: string) => ({base, display: base, denom_units: []})
const KEY = new Uint8Array([7, 8, 9])

describe('getAllSupply', () => {
    beforeEach(() => {
        totalSupply.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('returns a single page as is', async () => {
        totalSupply.mockResolvedValue({supply: [coin('ubze')], pagination: {next_key: null, total: '0'}})

        expect(await getAllSupply()).toEqual([coin('ubze')])
        expect(totalSupply).toHaveBeenCalledTimes(1)
    })

    it('requests the next page with next_key until the node stops returning one', async () => {
        totalSupply
            .mockResolvedValueOnce({supply: [coin('ubze'), coin('factory/bze1a/one')], pagination: {next_key: toBase64(KEY), total: '0'}})
            .mockResolvedValueOnce({supply: [coin('factory/bze1a/new')], pagination: {next_key: null, total: '0'}})

        expect((await getAllSupply())?.map(c => c.denom)).toEqual(['ubze', 'factory/bze1a/one', 'factory/bze1a/new'])
        expect(totalSupply).toHaveBeenCalledTimes(2)
        expect(totalSupply.mock.calls[0][0].pagination.key).toEqual(new Uint8Array())
        expect(totalSupply.mock.calls[1][0].pagination.key).toEqual(KEY)
    })

    it('never asks the node to count the total', async () => {
        totalSupply
            .mockResolvedValueOnce({supply: [coin('ubze')], pagination: {next_key: toBase64(KEY), total: '0'}})
            .mockResolvedValueOnce({supply: [], pagination: {next_key: null, total: '0'}})

        await getAllSupply()

        for (const [params] of totalSupply.mock.calls) {
            expect(params.pagination.countTotal).toBe(false)
        }
    })

    it('returns undefined when a page fails, not a partial list', async () => {
        totalSupply
            .mockResolvedValueOnce({supply: [coin('ubze')], pagination: {next_key: toBase64(KEY), total: '0'}})
            .mockRejectedValueOnce(new Error('Network Error'))

        expect(await getAllSupply()).toBeUndefined()
    })
})

describe('getAllSupplyMetadata', () => {
    beforeEach(() => {
        denomsMetadata.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('requests the next page with next_key until the node stops returning one', async () => {
        denomsMetadata
            .mockResolvedValueOnce({metadatas: [metadata('ubze')], pagination: {next_key: toBase64(KEY), total: '0'}})
            .mockResolvedValueOnce({metadatas: [metadata('factory/bze1a/new')], pagination: {next_key: null, total: '0'}})

        expect((await getAllSupplyMetadata())?.map(m => m.base)).toEqual(['ubze', 'factory/bze1a/new'])
        expect(denomsMetadata.mock.calls[1][0].pagination.key).toEqual(KEY)
        expect(denomsMetadata.mock.calls[1][0].pagination.countTotal).toBe(false)
    })

    it('returns undefined when a page fails', async () => {
        denomsMetadata.mockRejectedValue(new Error('Network Error'))

        expect(await getAllSupplyMetadata()).toBeUndefined()
    })
})
