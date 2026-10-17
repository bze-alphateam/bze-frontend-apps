import { afterEach, describe, expect, it } from 'vitest'

import {
    getExplorerAccountURL,
    getExplorerBaseURL,
    getExplorerBlockURL,
    getExplorerTxURL,
    getExplorerValidatorURL,
} from './chain'

const ENV_KEYS = ['NEXT_PUBLIC_EXPLORER_URL', 'NEXT_PUBLIC_CHAIN_NAME'] as const

describe('explorer links (BZE Scan)', () => {
    afterEach(() => {
        for (const key of ENV_KEYS) {
            delete process.env[key]
        }
    })

    it('falls back to the mainnet BZE Scan', () => {
        expect(getExplorerBaseURL()).toBe('https://explorer.getbze.com')
        expect(getExplorerTxURL('ABC')).toBe('https://explorer.getbze.com/txs/ABC')
        expect(getExplorerAccountURL('bze1xyz')).toBe('https://explorer.getbze.com/accounts/bze1xyz')
        expect(getExplorerValidatorURL('bzevaloper1xyz')).toBe('https://explorer.getbze.com/validators/bzevaloper1xyz')
        expect(getExplorerBlockURL(123)).toBe('https://explorer.getbze.com/blocks/123')
    })

    it('uses the configured base URL', () => {
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://testnet-explorer.getbze.com'
        expect(getExplorerTxURL('ABC')).toBe('https://testnet-explorer.getbze.com/txs/ABC')
        expect(getExplorerAccountURL('bze1xyz')).toBe('https://testnet-explorer.getbze.com/accounts/bze1xyz')
        expect(getExplorerValidatorURL('bzevaloper1xyz')).toBe('https://testnet-explorer.getbze.com/validators/bzevaloper1xyz')
        expect(getExplorerBlockURL('456')).toBe('https://testnet-explorer.getbze.com/blocks/456')
    })

    it('trims trailing slashes on the configured base URL', () => {
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://testnet-explorer.getbze.com//'
        expect(getExplorerBaseURL()).toBe('https://testnet-explorer.getbze.com')
        expect(getExplorerTxURL('ABC')).toBe('https://testnet-explorer.getbze.com/txs/ABC')
        expect(getExplorerAccountURL('bze1xyz')).toBe('https://testnet-explorer.getbze.com/accounts/bze1xyz')
        expect(getExplorerValidatorURL('bzevaloper1xyz')).toBe('https://testnet-explorer.getbze.com/validators/bzevaloper1xyz')
        expect(getExplorerBlockURL(BigInt(7))).toBe('https://testnet-explorer.getbze.com/blocks/7')
    })

    // BZE Scan serves one chain per host: links never carry a chain slug or
    // the chain name (the testnet chain name is "BeeZee Testnet 3").
    it('never puts a chain slug or the chain name in the path', () => {
        process.env.NEXT_PUBLIC_CHAIN_NAME = 'BeeZee Testnet 3'
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://testnet-explorer.getbze.com'
        expect(getExplorerTxURL('ABC')).toBe('https://testnet-explorer.getbze.com/txs/ABC')
    })
})
