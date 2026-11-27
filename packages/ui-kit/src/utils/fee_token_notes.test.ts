import BigNumber from 'bignumber.js'
import { describe, expect, it } from 'vitest'
import type { DenomConfigInfo } from '../query/denom_config'
import {
    feeSurchargeNote, feeTokenExplanation, feeTokenOptionNote, formatRatioPercent, formatSurchargePercent, hasSurcharge, hasTransferFee,
} from './fee_token_notes'

const info = (gas: string, transfer: string, communityPool = '', status: DenomConfigInfo['status'] = 'ok'): DenomConfigInfo => ({
    status, communityPool, gasSurcharge: new BigNumber(gas), transferFee: new BigNumber(transfer),
})

describe('fee token notes', () => {
    it('formats a ratio as a percent with up to 2 decimals and no trailing zeros', () => {
        expect(formatRatioPercent(0.5)).toBe('50')
        expect(formatRatioPercent(new BigNumber('0.015'))).toBe('1.5')
        expect(formatRatioPercent('0.01234')).toBe('1.23')
        expect(formatRatioPercent('2')).toBe('200')
        expect(formatSurchargePercent(new BigNumber('0.5'))).toBe('+50%')
    })

    it('notes a surcharge-only, a transfer-fee-only and a both token, and nothing for none', () => {
        expect(feeTokenOptionNote(info('0.5', '0'))).toBe('network fee +50%')
        expect(feeTokenOptionNote(info('0', '0.01'))).toBe('app fees +1%')
        expect(feeTokenOptionNote(info('0.5', '0.01'))).toBe('network fee +50% · app fees +1%')
        expect(feeTokenOptionNote(info('0', '0'))).toBe('')
        expect(feeTokenOptionNote(undefined)).toBe('')
    })

    it('says "community" only when the community pool is set, else "burned"', () => {
        expect(feeTokenExplanation('HONEY', info('0.5', '0.01', 'bze1pool')))
            .toBe('Paying fees in HONEY costs 50% more network fee, which goes to the HONEY community. App fees paid in HONEY cost 1% more.')
        expect(feeTokenExplanation('HONEY', info('0.5', '0')))
            .toBe('Paying fees in HONEY costs 50% more network fee, which is burned.')
        expect(feeTokenExplanation('HONEY', info('0', '0.02'))).toBe('App fees paid in HONEY cost 2% more.')
        expect(feeTokenExplanation('HONEY', info('0', '0', '', 'unsupported'))).toBe('')
    })

    it('words the estimate surcharge note only for a gas surcharge', () => {
        expect(feeSurchargeNote('HONEY', info('0.5', '0'))).toBe('includes +50% HONEY surcharge')
        expect(feeSurchargeNote('HONEY', info('0', '0.01'))).toBe('')
        expect(feeSurchargeNote('HONEY', undefined)).toBe('')
    })

    it('shows a non-zero ratio below 0.01% as "<0.01%", never "0%", and nothing for zero', () => {
        const tiny = info('0.00001', '0.00001')
        expect(formatRatioPercent('0.00001')).toBe('<0.01')
        expect(feeTokenOptionNote(tiny)).toBe('network fee +<0.01% · app fees +<0.01%')
        expect(feeTokenExplanation('HONEY', tiny))
            .toBe('Paying fees in HONEY costs <0.01% more network fee, which is burned. App fees paid in HONEY cost <0.01% more.')
        expect(feeSurchargeNote('HONEY', tiny)).toBe('includes +<0.01% HONEY surcharge')
        expect(formatRatioPercent(0)).toBe('0')
        expect(feeTokenOptionNote(info('0', '0'))).toBe('')
    })

    it('tells a gas surcharge and a transfer fee apart', () => {
        expect(hasSurcharge(info('0.5', '0'))).toBe(true)
        expect(hasSurcharge(info('0', '0.01'))).toBe(false)
        expect(hasSurcharge(info('0.00001', '0'))).toBe(true)
        expect(hasTransferFee(info('0', '0.01'))).toBe(true)
        expect(hasTransferFee(info('0.5', '0'))).toBe(false)
        expect(hasTransferFee(undefined)).toBe(false)
    })
})
