import { afterEach, describe, expect, it } from 'vitest'

import { getEnvRestURL, getInjectiveRestURL, getInjectiveRpcUrl } from './endpoints'

describe('Injective endpoint overrides', () => {
    afterEach(() => {
        delete process.env.NEXT_PUBLIC_REST_URL_INJECTIVE
        delete process.env.NEXT_PUBLIC_RPC_URL_INJECTIVE
    })

    it('are empty when unset, so chain-registry endpoints are used', () => {
        expect(getInjectiveRestURL()).toBe('')
        expect(getInjectiveRpcUrl()).toBe('')
        expect(getEnvRestURL('injective')).toBe('')
    })

    it('feed the counterparty REST lookup for the injective chain', () => {
        process.env.NEXT_PUBLIC_REST_URL_INJECTIVE = 'https://injective-rest.example/'
        process.env.NEXT_PUBLIC_RPC_URL_INJECTIVE = 'wss://injective-rpc.example'

        expect(getInjectiveRestURL()).toBe('https://injective-rest.example/')
        expect(getInjectiveRpcUrl()).toBe('wss://injective-rpc.example')
        expect(getEnvRestURL('injective')).toBe('https://injective-rest.example')
    })
})
