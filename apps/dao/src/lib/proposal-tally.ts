import {
    daoExpediteTally, daoRegularTally, daoRemainingWeight, ratioAtomics,
    type DaoConfig, type DaoTallyInput,
} from '@bze/bze-ui-kit';
import type {ProposalTally} from './proposal-model';

// The tally of a proposal against its bars. "Met" always comes from ui-kit's tally rules (exact BigInt,
// the chain's own comparison), never from the percentages shown. The text is rounded so it can never say
// more than the rule does: the share achieved rounds DOWN, the bar it has to reach rounds UP, so a
// proposal 0.001% short of its quorum reads "39.99% of 40%", not "40% of 40%".

const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10000);
const ONE = BigInt('1000000000000000000');

const big = (v: string): bigint => BigInt(v);

/** hundredths of a percent as "12.34%", dropping zero decimals: 4000 → "40%", 3999 → "39.99%". */
const hundredths = (n: bigint): string => {
    const whole = n / HUNDRED;
    const frac = n % HUNDRED;
    if (frac === ZERO) return `${whole}%`;
    const digits = frac.toString().padStart(2, '0').replace(/0$/, '');
    return `${whole}.${digits}%`;
};

/** part / whole as a percentage, rounded down (the share achieved). "0%" for an empty whole. */
export function percentDown(part: string, whole: string): string {
    const w = big(whole);
    return w <= ZERO ? '0%' : hundredths((big(part) * TEN_THOUSAND) / w);
}

/** part / whole as a percentage, rounded up (the share a bar needs). */
export function percentUp(part: string, whole: string): string {
    const w = big(whole);
    if (w <= ZERO) return '0%';
    const n = big(part) * TEN_THOUSAND;
    return hundredths((n + w - BigInt(1)) / w);
}

/** A chain ratio as a percentage rounded up; "100%" is exact only for a ratio of 1. */
export function ratioPercentUp(ratio: string): string {
    const atomics = ratioAtomics(ratio);
    // atomics / 10^18 * 10000 hundredths, rounded up
    const n = atomics * TEN_THOUSAND;
    return hundredths((n + ONE - BigInt(1)) / ONE);
}

export interface TallyBar {
    id: 'quorum' | 'threshold' | 'expedite-quorum' | 'expedite-yes';
    label: string;
    /** The share achieved, rounded down. */
    achieved: string;
    /** The bar to reach, rounded up. */
    required: string;
    /** "at least" for a quorum, "more than" for a threshold. */
    comparison: 'at least' | 'more than';
    met: boolean;
    /** The achieved share in hundredths of a percent, capped at 100%, for the bar's width. */
    widthHundredths: number;
    /** The required share in hundredths of a percent, for the marker. */
    markerHundredths: number;
    /** What the share is of, in weight units: the part counted and the whole it is counted against. */
    part: string;
    whole: string;
    /** The least part that meets the bar (exact, from the same ratio): "so 3 of 5" on a member list. */
    needed: string;
}

export interface TallyView {
    bars: TallyBar[];
    /** The regular rule passes now (what a settle at the voting end would decide). */
    passesRegular: boolean;
    /** Expedited proposals only: the expedite bars are met (it can be settled early). */
    passesExpedite: boolean | null;
    /** Weight that has not voted yet. */
    remaining: string;
    /** Shares of the whole denominator, rounded down. */
    shares: {yes: number; no: number; abstain: number};
    /** Shares of the votes cast (yes + no + abstain), for the stacked bar; all 0 before the first vote. */
    castShares: {yes: number; no: number; abstain: number};
}

/** The least part of `whole` that meets a bar of `ratio`: at least → ceil(r·w), more than → floor(r·w) + 1. */
function neededPart(ratio: string, whole: bigint, comparison: TallyBar['comparison']): string {
    const scaled = ratioAtomics(ratio) * whole;
    if (comparison === 'more than') return (scaled / ONE + BigInt(1)).toString();
    return ((scaled + ONE - BigInt(1)) / ONE).toString();
}

const hundredthsNumber = (part: bigint, whole: bigint, up: boolean): number => {
    if (whole <= ZERO) return 0;
    const n = part * TEN_THOUSAND;
    const v = up ? (n + whole - BigInt(1)) / whole : n / whole;
    return Number(v > TEN_THOUSAND ? TEN_THOUSAND : v);
};

/**
 * The bars of a proposal from its pinned config and tally; null when the rules or the tally are missing
 * or unreadable (the page then shows the plain numbers and no bars).
 */
export function tallyView(config: Pick<DaoConfig, 'min_quorum' | 'threshold' | 'expedite_quorum' | 'expedite_threshold'> | null, tally: ProposalTally | null, expedited: boolean): TallyView | null {
    if (!config || !tally) return null;
    try {
        const input: DaoTallyInput = tally;
        const regular = daoRegularTally(input, config.min_quorum, config.threshold);
        const den = big(tally.denominator), yes = big(tally.yes), no = big(tally.no), abstain = big(tally.abstain);
        const decided = yes + no;
        const turnout = decided + abstain;

        const bars: TallyBar[] = [
            {
                id: 'quorum', label: 'Turnout', comparison: 'at least', met: regular.quorumMet,
                achieved: percentDown(turnout.toString(), tally.denominator), required: ratioPercentUp(config.min_quorum),
                widthHundredths: hundredthsNumber(turnout, den, false), markerHundredths: hundredthsNumber(ratioAtomics(config.min_quorum), ONE, true),
                part: turnout.toString(), whole: tally.denominator, needed: neededPart(config.min_quorum, den, 'at least'),
            },
            {
                id: 'threshold', label: 'Yes of yes and no', comparison: 'more than', met: regular.thresholdMet,
                achieved: percentDown(tally.yes, decided.toString()), required: ratioPercentUp(config.threshold),
                widthHundredths: hundredthsNumber(yes, decided, false), markerHundredths: hundredthsNumber(ratioAtomics(config.threshold), ONE, true),
                part: tally.yes, whole: decided.toString(), needed: neededPart(config.threshold, decided, 'more than'),
            },
        ];

        let passesExpedite: boolean | null = null;
        if (expedited) {
            const fast = daoExpediteTally(input, config.expedite_quorum, config.expedite_threshold);
            passesExpedite = fast.passes;
            bars.push(
                {
                    id: 'expedite-quorum', label: 'Turnout to settle early', comparison: 'at least', met: fast.quorumMet,
                    achieved: percentDown(turnout.toString(), tally.denominator), required: ratioPercentUp(config.expedite_quorum),
                    widthHundredths: hundredthsNumber(turnout, den, false), markerHundredths: hundredthsNumber(ratioAtomics(config.expedite_quorum), ONE, true),
                    part: turnout.toString(), whole: tally.denominator, needed: neededPart(config.expedite_quorum, den, 'at least'),
                },
                {
                    id: 'expedite-yes', label: 'Yes of everyone to settle early', comparison: 'more than', met: fast.yesMet,
                    achieved: percentDown(tally.yes, tally.denominator), required: ratioPercentUp(config.expedite_threshold),
                    widthHundredths: hundredthsNumber(yes, den, false), markerHundredths: hundredthsNumber(ratioAtomics(config.expedite_threshold), ONE, true),
                    part: tally.yes, whole: tally.denominator, needed: neededPart(config.expedite_threshold, den, 'more than'),
                },
            );
        }

        return {
            bars,
            passesRegular: regular.passes,
            passesExpedite,
            remaining: daoRemainingWeight(input).toString(),
            shares: {
                yes: hundredthsNumber(yes, den, false),
                no: hundredthsNumber(no, den, false),
                abstain: hundredthsNumber(abstain, den, false),
            },
            castShares: {
                yes: hundredthsNumber(yes, turnout, false),
                no: hundredthsNumber(no, turnout, false),
                abstain: hundredthsNumber(abstain, turnout, false),
            },
        };
    } catch {
        return null;
    }
}

/** A one-line summary for a list row: "Turnout 25%, 80% yes", rounded down; empty without a tally. */
export function tallySummary(tally: ProposalTally | null): string {
    if (!tally) return '';
    const turnout = (big(tally.yes) + big(tally.no) + big(tally.abstain)).toString();
    const decided = (big(tally.yes) + big(tally.no)).toString();
    const yes = big(decided) > ZERO ? `, ${percentDown(tally.yes, decided)} yes` : '';
    return `Turnout ${percentDown(turnout, tally.denominator)}${yes}`;
}
