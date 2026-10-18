import { describe, it, expect } from 'vitest'
import { valoperToAccountAddress } from './address'

describe('valoperToAccountAddress', () => {
    it("gives a mainnet validator's own account", () => {
        // ChainTools on beezee-1; the account holds the validator's self-delegation.
        expect(valoperToAccountAddress('bzevaloper1prm55vzlp5u6excqdunwlm4tw254cq943m6e6m'))
            .toBe('bze1prm55vzlp5u6excqdunwlm4tw254cq94fl9jwy')
    })

    it('throws on an address that is not bech32', () => {
        expect(() => valoperToAccountAddress('not-an-address')).toThrow()
    })
})
