import { describe, expect, it } from 'vitest'
import { canonicalAddress } from '../../index'

const BZE = 'bze1qyqszqgpqyqszqgpqyqszqgpqyqszqgp0hd4lt'

describe('canonicalAddress (from the package entry)', () => {
    it('is the lowercase form of an address of this chain', () => {
        expect(canonicalAddress(BZE)).toBe(BZE)
        expect(canonicalAddress(BZE.toUpperCase())).toBe(BZE)
    })

    it('refuses an address of another chain', () => {
        expect(canonicalAddress('cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du')).toBeUndefined()
    })

    it('refuses garbage: a bad checksum, mixed case, empty text, a plain word', () => {
        expect(canonicalAddress(BZE.slice(0, -1) + 'q')).toBeUndefined()
        expect(canonicalAddress('bze1QYqszqgpqyqszqgpqyqszqgpqyqszqgp0hd4lt')).toBeUndefined()
        expect(canonicalAddress('')).toBeUndefined()
        expect(canonicalAddress('hello')).toBeUndefined()
    })
})
