import BigNumber from "bignumber.js";
import type {GovParams, GovTally} from "@bze/bze-ui-kit";

// The tally in plain numbers and the three checks the chain runs when voting
// ends (x/gov v1 keeper/tally.go, SDK v0.50):
// - quorum: votes cast ÷ bonded tokens must not be below `quorum`;
// - veto: No with veto ÷ votes cast above `veto_threshold` fails (and burns
//   the deposit when `burn_vote_veto`);
// - threshold: Yes ÷ (votes cast − Abstain) must be above `threshold`
//   (`expedited_threshold` for an expedited proposal).
// Shares are percentages as BigNumber; null where the base is zero.

export type TallyOption = "yes" | "no" | "no_with_veto" | "abstain";

export const TALLY_OPTIONS: {option: TallyOption; label: string}[] = [
    {option: "yes", label: "Yes"},
    {option: "no", label: "No"},
    {option: "no_with_veto", label: "No with veto"},
    {option: "abstain", label: "Abstain"},
];

const EMPTY_TALLY: GovTally = {yes_count: "0", abstain_count: "0", no_count: "0", no_with_veto_count: "0"};

const num = (v: string | null | undefined) => {
    const n = new BigNumber(v ?? 0);
    return n.isFinite() ? n : new BigNumber(0);
};

const amounts = (tally: GovTally | null | undefined) => {
    const t = tally ?? EMPTY_TALLY;
    return {
        yes: num(t.yes_count),
        no: num(t.no_count),
        no_with_veto: num(t.no_with_veto_count),
        abstain: num(t.abstain_count),
    };
};

const pctOf = (part: BigNumber, total: BigNumber): BigNumber | null =>
    total.gt(0) ? part.div(total).times(100) : null;

/** Every vote cast, abstain included. */
export function totalVotes(tally: GovTally | null | undefined): BigNumber {
    const a = amounts(tally);
    return a.yes.plus(a.no).plus(a.no_with_veto).plus(a.abstain);
}

export interface TallyShare {
    option: TallyOption;
    label: string;
    /** Base units (ubze). */
    amount: BigNumber;
    /** Percent of all votes cast; null before any vote. */
    pct: BigNumber | null;
}

/** Each option's amount and share of all votes cast, in the order Yes, No, No with veto, Abstain. */
export function tallyShares(tally: GovTally | null | undefined): TallyShare[] {
    const a = amounts(tally);
    const total = totalVotes(tally);
    return TALLY_OPTIONS.map((o) => ({...o, amount: a[o.option], pct: pctOf(a[o.option], total)}));
}

/** Yes ÷ (Yes + No + No with veto), percent; abstain is left out. Null when nobody voted those. */
export function yesShare(tally: GovTally | null | undefined): BigNumber | null {
    const a = amounts(tally);
    return pctOf(a.yes, a.yes.plus(a.no).plus(a.no_with_veto));
}

/** Votes cast ÷ bonded tokens, percent; null when the bonded tokens are unknown. */
export function turnout(tally: GovTally | null | undefined, bondedTokens: string | null | undefined): BigNumber | null {
    return pctOf(totalVotes(tally), num(bondedTokens));
}

const fractionToPct = (fraction: string | null | undefined) => num(fraction).times(100);

export interface QuorumStatus {
    /** Percent; null when the bonded tokens are unknown. */
    turnout: BigNumber | null;
    /** Percent. */
    quorum: BigNumber;
    reached: boolean;
}

/** Turnout against the quorum; reached at exactly the quorum. */
export function quorumStatus(tally: GovTally | null | undefined, bondedTokens: string | null | undefined, params: Pick<GovParams, "quorum">): QuorumStatus {
    const t = turnout(tally, bondedTokens);
    const quorum = fractionToPct(params.quorum);
    return {turnout: t, quorum, reached: t != null && t.gte(quorum)};
}

export interface Check {
    ok: boolean;
    /** The measured share, percent; null when there is nothing to measure. */
    value: BigNumber | null;
    /** The threshold, percent. */
    need: BigNumber;
}

export interface Checks {
    quorum: Check;
    threshold: Check;
    veto: Check;
    /** All three pass: the proposal would pass if voting ended now. */
    passing: boolean;
}

/** The three checks on a tally, with the expedited threshold for an expedited proposal. */
export function passingChecks(
    tally: GovTally | null | undefined,
    bondedTokens: string | null | undefined,
    params: Pick<GovParams, "quorum" | "threshold" | "expedited_threshold" | "veto_threshold">,
    expedited: boolean,
): Checks {
    const a = amounts(tally);
    const total = totalVotes(tally);
    const q = quorumStatus(tally, bondedTokens, params);
    const yes = yesShare(tally);
    const veto = pctOf(a.no_with_veto, total);
    const threshold = fractionToPct(expedited ? params.expedited_threshold : params.threshold);
    const vetoThreshold = fractionToPct(params.veto_threshold);

    const quorum: Check = {ok: q.reached, value: q.turnout, need: q.quorum};
    const thresholdCheck: Check = {ok: yes != null && yes.gt(threshold), value: yes, need: threshold};
    // No votes means nothing was vetoed; the quorum check fails that tally anyway.
    const vetoCheck: Check = {ok: veto == null || veto.lte(vetoThreshold), value: veto, need: vetoThreshold};

    return {
        quorum,
        threshold: thresholdCheck,
        veto: vetoCheck,
        passing: quorum.ok && thresholdCheck.ok && vetoCheck.ok,
    };
}
