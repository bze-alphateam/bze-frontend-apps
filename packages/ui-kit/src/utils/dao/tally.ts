// The x/dao tally rules (chain v8.3.0, x/dao/types/tally.go), in exact integer
// arithmetic. A ratio (a cosmos LegacyDec) is an integer count of 10^-18, so
// "part / whole ≥ ratio" is compared as `part · 10^18 ≥ ratio_atomics · whole`:
// no float and no rounding, so the UI never disagrees with the chain (or with
// Scan, which ports the same rule) on a boundary.
//
//   regular  (at or after voting_end):  turnout / denominator ≥ min_quorum
//                                       and yes / (yes + no) > threshold   (strict)
//   expedite (early settle):            turnout / denominator ≥ expedite_quorum
//                                       and yes / denominator > expedite_threshold
//
// A zero denominator never passes, nor a regular tally with no yes and no no
// votes, nor an expedite tally with no yes.

const ONE = 10n ** 18n;

/** Integer weights as the chain sends them (decimal strings) or as bigints. */
export type DaoWeight = string | number | bigint;

export interface DaoTallyInput {
    denominator: DaoWeight;
    yes: DaoWeight;
    no: DaoWeight;
    abstain: DaoWeight;
}

export interface DaoRegularTallyResult {
    quorumMet: boolean;
    thresholdMet: boolean;
    passes: boolean;
}

export interface DaoExpediteTallyResult {
    quorumMet: boolean;
    yesMet: boolean;
    passes: boolean;
}

const int = (v: DaoWeight): bigint => (typeof v === 'bigint' ? v : BigInt(String(v)));

/**
 * The atomics (10^-18 units) of a decimal ratio: `"0.4"` and
 * `"0.400000000000000000"` are both 400000000000000000n. Throws on anything
 * but a plain non-negative decimal with at most 18 fraction digits.
 */
export const ratioAtomics = (ratio: string): bigint => {
    const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(ratio);
    if (!match) {
        throw new Error(`invalid ratio: ${ratio}`);
    }
    return BigInt(match[1]) * ONE + BigInt((match[2] ?? '').padEnd(18, '0'));
}

/** part / whole compared with the ratio: -1, 0 or 1. */
const compareRatio = (part: bigint, whole: bigint, ratio: bigint): number => {
    const left = part * ONE;
    const right = ratio * whole;
    return left === right ? 0 : left > right ? 1 : -1;
}

const ceilDiv = (a: bigint, b: bigint): bigint => (a <= 0n ? 0n : (a + b - 1n) / b);

/** The regular bars, as the chain applies them at or after `voting_end`. */
export const daoRegularTally = (t: DaoTallyInput, minQuorum: string, threshold: string): DaoRegularTallyResult => {
    const denominator = int(t.denominator), yes = int(t.yes), no = int(t.no), abstain = int(t.abstain);
    if (denominator <= 0n) {
        return {quorumMet: false, thresholdMet: false, passes: false};
    }

    const decided = yes + no;
    const quorumMet = compareRatio(decided + abstain, denominator, ratioAtomics(minQuorum)) >= 0;
    const thresholdMet = decided > 0n && compareRatio(yes, decided, ratioAtomics(threshold)) > 0;
    return {quorumMet, thresholdMet, passes: quorumMet && thresholdMet};
}

/** The expedite bars, both against the full denominator, as the chain applies them before `voting_end`. */
export const daoExpediteTally = (t: DaoTallyInput, expediteQuorum: string, expediteThreshold: string): DaoExpediteTallyResult => {
    const denominator = int(t.denominator), yes = int(t.yes), no = int(t.no), abstain = int(t.abstain);
    if (denominator <= 0n) {
        return {quorumMet: false, yesMet: false, passes: false};
    }

    const quorumMet = compareRatio(yes + no + abstain, denominator, ratioAtomics(expediteQuorum)) >= 0;
    const yesMet = yes > 0n && compareRatio(yes, denominator, ratioAtomics(expediteThreshold)) > 0;
    return {quorumMet, yesMet, passes: quorumMet && yesMet};
}

/** The voting power that has not voted yet (never negative). */
export const daoRemainingWeight = (t: DaoTallyInput): bigint => {
    const left = int(t.denominator) - int(t.yes) - int(t.no) - int(t.abstain);
    return left > 0n ? left : 0n;
}

/**
 * The least additional yes weight that makes the tally pass the regular bars
 * (0 when it already passes), counting it towards the turnout too. Null when
 * the voting power that has not voted yet cannot reach it, or the denominator
 * is zero.
 */
export const daoYesNeededRegular = (t: DaoTallyInput, minQuorum: string, threshold: string): bigint | null => {
    const denominator = int(t.denominator), yes = int(t.yes), no = int(t.no), abstain = int(t.abstain);
    if (denominator <= 0n) return null;

    const q = ratioAtomics(minQuorum), th = ratioAtomics(threshold);
    if (th >= ONE) return null;

    // quorum: (turnout + x) · 10^18 ≥ q · denominator
    const forQuorum = ceilDiv(q * denominator, ONE) - (yes + no + abstain);
    // threshold: (yes + x) · 10^18 > th · (yes + x + no)  ⇔  (yes + x) · (10^18 − th) > th · no
    const forThreshold = (th * no) / (ONE - th) + 1n - yes;

    let needed = forQuorum > forThreshold ? forQuorum : forThreshold;
    if (needed < 0n) needed = 0n;
    return needed <= daoRemainingWeight(t) ? needed : null;
}

/**
 * The least additional yes weight that makes an expedited proposal meet the
 * expedite bars (0 when it already does). Null when the voting power that has
 * not voted yet cannot reach it, or the denominator is zero.
 */
export const daoYesNeededExpedite = (t: DaoTallyInput, expediteQuorum: string, expediteThreshold: string): bigint | null => {
    const denominator = int(t.denominator), yes = int(t.yes), no = int(t.no), abstain = int(t.abstain);
    if (denominator <= 0n) return null;

    const q = ratioAtomics(expediteQuorum), th = ratioAtomics(expediteThreshold);
    const forQuorum = ceilDiv(q * denominator, ONE) - (yes + no + abstain);
    // yes: (yes + x) · 10^18 > th · denominator, and yes + x ≥ 1
    let forYes = (th * denominator) / ONE + 1n - yes;
    if (yes + forYes < 1n) forYes = 1n - yes;

    let needed = forQuorum > forYes ? forQuorum : forYes;
    if (needed < 0n) needed = 0n;
    return needed <= daoRemainingWeight(t) ? needed : null;
}
