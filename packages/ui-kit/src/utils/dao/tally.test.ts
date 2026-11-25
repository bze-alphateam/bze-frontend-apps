import { describe, expect, it } from 'vitest'
import {
    daoExpediteTally,
    daoRegularTally,
    daoRemainingWeight,
    daoYesNeededExpedite,
    daoYesNeededRegular,
    ratioAtomics,
} from './tally'

// The cases are the chain's own (x/dao/types/tally_test.go at v8.3.0-rc1), so the UI and the
// chain agree on every boundary. Scan's port (BFE-354) uses the same table.

const half = '0.5'
// 7/13 truncated to 18 decimals, as the chain's QuoTruncate (and DAO DAO) does
const sevenThirteenths = '0.538461538461538461'

const passes = (quorum: string, threshold: string, denominator: number | bigint, yes: number | bigint, no: number | bigint, abstain: number | bigint) =>
    daoRegularTally({ denominator, yes, no, abstain }, quorum, threshold).passes

const expeditePasses = (quorum: string, threshold: string, denominator: number, yes: number, no: number, abstain: number) =>
    daoExpediteTally({ denominator, yes, no, abstain }, quorum, threshold).passes

describe('ratioAtomics', () => {
    it('reads plain and 18-decimal ratios alike', () => {
        expect(ratioAtomics('0.4')).toBe(400_000_000_000_000_000n)
        expect(ratioAtomics('0.400000000000000000')).toBe(400_000_000_000_000_000n)
        expect(ratioAtomics('1')).toBe(10n ** 18n)
        expect(ratioAtomics(sevenThirteenths)).toBe(538_461_538_461_538_461n)
    })

    it('refuses anything else', () => {
        for (const bad of ['', '-0.1', '1e-3', '0.1234567890123456789', 'abc', '.5']) {
            expect(() => ratioAtomics(bad), bad).toThrow()
        }
    })
})

describe('daoRegularTally', () => {
    it('D16: no yes and no no votes, or a zero denominator, never pass', () => {
        expect(passes(half, half, 10, 0, 0, 10)).toBe(false)
        expect(passes(half, half, 10, 0, 0, 0)).toBe(false)
        expect(passes(half, half, 0, 0, 0, 0)).toBe(false)
        expect(passes('0', '0', 0, 0, 0, 0)).toBe(false)
        expect(passes(half, half, 0, 3, 0, 0)).toBe(false)
    })

    it('D17: boundaries at 7/13', () => {
        expect(passes(sevenThirteenths, sevenThirteenths, 13, 7, 6, 0)).toBe(true)
        expect(passes(sevenThirteenths, sevenThirteenths, 13, 6, 7, 0)).toBe(false)
        expect(passes(sevenThirteenths, half, 13, 6, 0, 0)).toBe(false)
        expect(passes('1', half, 1, 1, 0, 0)).toBe(true)
        expect(passes('1', half, 1, 0, 1, 0)).toBe(false)
        expect(passes('1', half, 2, 1, 0, 0)).toBe(false)
    })

    it('D17: a majority of one passes at 50%, a tie never does', () => {
        for (let count = 1; count <= 2000; count++) {
            expect(passes(half, half, 2 * count + 1, count + 1, count, 0)).toBe(true)
            expect(passes(half, half, 2 * count, count, count, 0)).toBe(false)
        }
    })

    it('the threshold is strict', () => {
        expect(passes(half, half, 2, 1, 1, 0)).toBe(false)
        expect(passes(half, half, 100, 50, 50, 0)).toBe(false)
        expect(passes(half, half, 100, 51, 49, 0)).toBe(true)
        expect(passes(half, '0.6', 10, 6, 4, 0)).toBe(false)
        expect(passes(half, '0.6', 100, 61, 39, 0)).toBe(true)
    })

    it.each([
        ['quorum met exactly, threshold exceeded', 100, 25, 15, 0, true],
        ['threshold met exactly', 100, 24, 16, 0, false],
        ['quorum one short', 100, 24, 15, 0, false],
        ['abstain fills the quorum', 100, 4, 2, 34, true],
        ['abstain does not move the threshold', 100, 2, 3, 95, false],
        ['unanimous over quorum', 100, 40, 0, 0, true],
        ['unanimous under quorum', 100, 39, 0, 0, false],
        ['full turnout, all no', 100, 0, 100, 0, false],
    ])('quorum 0.4 / threshold 0.6: %s', (_desc, denominator, yes, no, abstain, want) => {
        expect(passes('0.4', '0.6', denominator, yes, no, abstain)).toBe(want)
    })

    it('reports each bar on its own', () => {
        expect(daoRegularTally({ denominator: 100, yes: 25, no: 15, abstain: 0 }, '0.4', '0.6'))
            .toEqual({ quorumMet: true, thresholdMet: true, passes: true })
        expect(daoRegularTally({ denominator: 100, yes: 24, no: 16, abstain: 0 }, '0.4', '0.6'))
            .toEqual({ quorumMet: true, thresholdMet: false, passes: false })
        expect(daoRegularTally({ denominator: 100, yes: 39, no: 0, abstain: 0 }, '0.4', '0.6'))
            .toEqual({ quorumMet: false, thresholdMet: true, passes: false })
        expect(daoRegularTally({ denominator: 0, yes: 0, no: 0, abstain: 0 }, '0.4', '0.6'))
            .toEqual({ quorumMet: false, thresholdMet: false, passes: false })
    })

    it('handles stake beyond 10^30 without overflow, as decimal strings', () => {
        const big = 10n ** 36n
        const yes = big / 2n
        expect(passes(half, half, big, yes + 1n, yes - 1n, 0n)).toBe(true)
        expect(passes(half, half, big, yes, yes, 0n)).toBe(false)
        expect(daoRegularTally({ denominator: big.toString(), yes: (yes + 1n).toString(), no: (yes - 1n).toString(), abstain: '0' }, half, half).passes).toBe(true)
    })
})

describe('weights', () => {
    it('refuses a number that is not a safe integer', () => {
        expect(() => daoRegularTally({ denominator: 1e21, yes: 1, no: 0, abstain: 0 }, half, half)).toThrow('safe integer')
        expect(() => daoRegularTally({ denominator: 10, yes: 1.5, no: 0, abstain: 0 }, half, half)).toThrow('safe integer')
    })
})

describe('daoExpediteTally', () => {
    it.each([
        ['yes one unit above the bar', 150, 100, 0, 0, true],
        ['yes exactly at the bar', 150, 99, 0, 0, false],
        ['no votes do not lower the yes bar', 150, 99, 51, 0, false],
        ['no votes do not block a met yes bar', 150, 100, 50, 0, true],
        ['empty denominator', 0, 0, 0, 0, false],
        ['nobody voted', 150, 0, 0, 0, false],
    ])('quorum 0.6 / threshold 0.66: %s', (_desc, denominator, yes, no, abstain, want) => {
        expect(expeditePasses('0.6', '0.66', denominator, yes, no, abstain)).toBe(want)
    })

    it('measures the quorum against the full denominator, met at equality', () => {
        expect(expeditePasses('0.9', '0.66', 150, 100, 0, 34)).toBe(false)
        expect(expeditePasses('0.9', '0.66', 150, 100, 0, 35)).toBe(true)
        expect(daoExpediteTally({ denominator: 150, yes: 100, no: 0, abstain: 34 }, '0.9', '0.66'))
            .toEqual({ quorumMet: false, yesMet: true, passes: false })
    })

    it('D7: a tally that meets the expedite bars still passes after every remaining unit votes no', () => {
        const configs = [
            ['0.4', '0.5', '0.6', '0.66'],
            ['0.5', '0.5', '0.5', '0.5'],
            ['0.1', '0.9', '0.1', '0.9'],
            ['1', '0.99', '1', '0.99'],
        ]
        for (const [quorum, threshold, eq, et] of configs) {
            for (let d = 1; d <= 20; d++) {
                for (let yes = 0; yes <= d; yes++) {
                    for (let no = 0; yes + no <= d; no++) {
                        for (let abstain = 0; yes + no + abstain <= d; abstain++) {
                            if (!expeditePasses(eq, et, d, yes, no, abstain)) continue
                            const rest = d - yes - no - abstain
                            expect(passes(quorum, threshold, d, yes, no + rest, abstain)).toBe(true)
                        }
                    }
                }
            }
        }
    })
})

describe('votes still needed', () => {
    const tally = (denominator: number, yes: number, no: number, abstain: number) => ({ denominator, yes, no, abstain })

    it('is 0 when the tally already passes', () => {
        expect(daoYesNeededRegular(tally(100, 25, 15, 0), '0.4', '0.6')).toBe(0n)
        expect(daoYesNeededExpedite(tally(150, 100, 0, 0), '0.6', '0.66')).toBe(0n)
    })

    it('counts the remaining weight that has not voted', () => {
        expect(daoRemainingWeight(tally(100, 25, 15, 10))).toBe(50n)
        expect(daoRemainingWeight(tally(10, 6, 6, 0))).toBe(0n)
    })

    it('regular: the result passes and one unit less does not', () => {
        const configs: [string, string][] = [['0.4', '0.6'], [half, half], [sevenThirteenths, sevenThirteenths], ['1', '0.99'], ['0.1', '0.9']]
        for (const [q, th] of configs) {
            for (let d = 1; d <= 14; d++) {
                for (let yes = 0; yes <= d; yes++) {
                    for (let no = 0; yes + no <= d; no++) {
                        for (let abstain = 0; yes + no + abstain <= d; abstain++) {
                            const t = tally(d, yes, no, abstain)
                            const needed = daoYesNeededRegular(t, q, th)
                            const remaining = d - yes - no - abstain
                            if (needed === null) {
                                // even every remaining unit voting yes does not pass
                                expect(passes(q, th, d, yes + remaining, no, abstain)).toBe(false)
                                continue
                            }
                            const x = Number(needed)
                            expect(passes(q, th, d, yes + x, no, abstain)).toBe(true)
                            if (x > 0) expect(passes(q, th, d, yes + x - 1, no, abstain)).toBe(false)
                        }
                    }
                }
            }
        }
    })

    it('expedite: the result meets the bars and one unit less does not', () => {
        const configs: [string, string][] = [['0.6', '0.66'], [half, half], ['1', '0.99'], ['0.1', '0.9']]
        for (const [q, th] of configs) {
            for (let d = 1; d <= 14; d++) {
                for (let yes = 0; yes <= d; yes++) {
                    for (let no = 0; yes + no <= d; no++) {
                        for (let abstain = 0; yes + no + abstain <= d; abstain++) {
                            const needed = daoYesNeededExpedite(tally(d, yes, no, abstain), q, th)
                            const remaining = d - yes - no - abstain
                            if (needed === null) {
                                expect(expeditePasses(q, th, d, yes + remaining, no, abstain)).toBe(false)
                                continue
                            }
                            const x = Number(needed)
                            expect(expeditePasses(q, th, d, yes + x, no, abstain)).toBe(true)
                            if (x > 0) expect(expeditePasses(q, th, d, yes + x - 1, no, abstain)).toBe(false)
                        }
                    }
                }
            }
        }
    })

    it('is null on a zero denominator', () => {
        expect(daoYesNeededRegular(tally(0, 0, 0, 0), half, half)).toBeNull()
        expect(daoYesNeededExpedite(tally(0, 0, 0, 0), half, half)).toBeNull()
    })
})
