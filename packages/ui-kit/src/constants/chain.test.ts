import { afterEach, describe, expect, it } from 'vitest'

import {
    getExplorerAccountURL,
    getExplorerBaseURL,
    getExplorerBlockURL,
    getExplorerProposalURL,
    getExplorerProposalsURL,
    getExplorerTokenURL,
    getExplorerTxURL,
    getExplorerValidatorURL,
    getForeignFeeSlippage,
    getGasMultiplier,
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
        expect(getExplorerProposalsURL()).toBe('https://explorer.getbze.com/proposals')
        expect(getExplorerProposalURL(48)).toBe('https://explorer.getbze.com/proposals/48')
    })

    it('uses the configured base URL', () => {
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://testnet-explorer.getbze.com'
        expect(getExplorerTxURL('ABC')).toBe('https://testnet-explorer.getbze.com/txs/ABC')
        expect(getExplorerAccountURL('bze1xyz')).toBe('https://testnet-explorer.getbze.com/accounts/bze1xyz')
        expect(getExplorerValidatorURL('bzevaloper1xyz')).toBe('https://testnet-explorer.getbze.com/validators/bzevaloper1xyz')
        expect(getExplorerBlockURL('456')).toBe('https://testnet-explorer.getbze.com/blocks/456')
        expect(getExplorerProposalURL('3')).toBe('https://testnet-explorer.getbze.com/proposals/3')
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

    // BZE Scan serves a token at /tokens/<encodeURIComponent(denom)>, like its own render/tokens.ts.
    it('links a token by its encoded denom', () => {
        expect(getExplorerTokenURL('ubze')).toBe('https://explorer.getbze.com/tokens/ubze')
        expect(getExplorerTokenURL('factory/bze1abc/uhoney')).toBe('https://explorer.getbze.com/tokens/factory%2Fbze1abc%2Fuhoney')
        expect(getExplorerTokenURL('ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4'))
            .toBe('https://explorer.getbze.com/tokens/ibc%2F6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4')
    })

    it('links a token on the configured explorer', () => {
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://testnet-explorer.getbze.com/'
        expect(getExplorerTokenURL('factory/bze1abc/uhoney')).toBe('https://testnet-explorer.getbze.com/tokens/factory%2Fbze1abc%2Fuhoney')
    })
})

describe('gas margin', () => {
    afterEach(() => {
        delete process.env.NEXT_PUBLIC_GAS_MULTIPLIER
        delete process.env.NEXT_PUBLIC_FOREIGN_FEE_SLIPPAGE
    })

    it('defaults to a 1.2 gas margin and a 1.1 foreign fee slippage', () => {
        delete process.env.NEXT_PUBLIC_GAS_MULTIPLIER
        delete process.env.NEXT_PUBLIC_FOREIGN_FEE_SLIPPAGE
        expect(getGasMultiplier()).toBe(1.2)
        expect(getForeignFeeSlippage()).toBe(1.1)
    })

    it('takes a positive override and ignores garbage', () => {
        process.env.NEXT_PUBLIC_GAS_MULTIPLIER = '1.3'
        expect(getGasMultiplier()).toBe(1.3)
        process.env.NEXT_PUBLIC_GAS_MULTIPLIER = '0'
        expect(getGasMultiplier()).toBe(1.2)
        process.env.NEXT_PUBLIC_GAS_MULTIPLIER = 'abc'
        expect(getGasMultiplier()).toBe(1.2)
    })
})
