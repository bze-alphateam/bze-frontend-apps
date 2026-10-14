import { afterEach, describe, expect, it } from 'vitest'

import { getChainExplorerURL, getExplorerChainSlug } from './chain'

const ENV_KEYS = ['NEXT_PUBLIC_EXPLORER_URL', 'NEXT_PUBLIC_EXPLORER_CHAIN', 'NEXT_PUBLIC_CHAIN_NAME'] as const

describe('getChainExplorerURL', () => {
    afterEach(() => {
        for (const key of ENV_KEYS) {
            delete process.env[key]
        }
    })

    it('falls back to the chaintools explorer and the beezee slug', () => {
        expect(getChainExplorerURL()).toBe('https://explorer.chaintools.tech/beezee')
    })

    it('uses the configured explorer base URL', () => {
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://explorer.getbze.com'
        expect(getChainExplorerURL()).toBe('https://explorer.getbze.com/beezee')
    })

    it('ignores a trailing slash on the configured base URL', () => {
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://explorer.getbze.com/'
        expect(getChainExplorerURL()).toBe('https://explorer.getbze.com/beezee')
    })

    // Regression: the testnet chain name is "BeeZee Testnet 3" but the testnet
    // explorer serves the chain under "beezee". Links used to embed the chain
    // name and 404'd as /BeeZee%20Testnet%203/tx/<hash>.
    it('does not derive the explorer path from the chain name', () => {
        process.env.NEXT_PUBLIC_CHAIN_NAME = 'BeeZee Testnet 3'
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://testnet.explorer.chaintools.tech'
        expect(`${getChainExplorerURL()}/tx/ABC`).toBe('https://testnet.explorer.chaintools.tech/beezee/tx/ABC')
    })

    it('lets the explorer slug be overridden', () => {
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://some.explorer'
        process.env.NEXT_PUBLIC_EXPLORER_CHAIN = 'bze-testnet'
        expect(getExplorerChainSlug()).toBe('bze-testnet')
        expect(getChainExplorerURL()).toBe('https://some.explorer/bze-testnet')
    })
})
