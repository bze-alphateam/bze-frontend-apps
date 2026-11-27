import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getValidatorSupportedDenoms, isPoolSupportedByValidator } from './validator'

const PHOTON = 'ibc/82931180F0962712BFABB189083A94C77EA90E269ABFC6D310AF922B2B14E011'
const ATONE = 'ibc/B2219CA05421EA988F83E5E824BF69362E80A6A87503EFD18B92C91C9E03763D'
const CTL = 'factory/bze1972aqfzdg29ugjln74edx0xvcg4ehvysjptk77/CTL'

describe('isPoolSupportedByValidator', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_ATONE_VALIDATOR_SUPPORTED_DENOMS', ` ${PHOTON}, ${ATONE} ,`)
        vi.stubEnv('NEXT_PUBLIC_CHAIN_NATIVE_ASSET_DENOM', 'ubze')
    })
    afterEach(() => vi.unstubAllEnvs())

    it('parses the supported denoms list', () => {
        expect(getValidatorSupportedDenoms()).toEqual([PHOTON, ATONE])
    })

    it('supports a BZE pool paired with a supported denom, either side', () => {
        expect(isPoolSupportedByValidator(PHOTON, 'ubze')).toBe(true)
        expect(isPoolSupportedByValidator('ubze', PHOTON)).toBe(true)
    })

    it('does not support a supported denom paired with a non-BZE token', () => {
        expect(isPoolSupportedByValidator(CTL, ATONE)).toBe(false)
        expect(isPoolSupportedByValidator(PHOTON, ATONE)).toBe(false)
    })

    it('does not support a BZE pool with an unlisted denom', () => {
        expect(isPoolSupportedByValidator(CTL, 'ubze')).toBe(false)
    })

    it('supports nothing when the list is empty', () => {
        vi.stubEnv('NEXT_PUBLIC_ATONE_VALIDATOR_SUPPORTED_DENOMS', '')
        expect(isPoolSupportedByValidator(PHOTON, 'ubze')).toBe(false)
    })
})
