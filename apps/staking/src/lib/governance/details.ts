import BigNumber from "bignumber.js";
import {prettyAmount, uAmountToBigNumberAmount, type GovCoin, type GovParams, type GovProposal, type GovTally} from "@bze/bze-ui-kit";
import {passingChecks, totalVotes, type Check, type Checks} from "./tally";
import {durationText, formatDateTimeUtc, fractionPct} from "./format";

// The proposal page in plain words: amounts, what happens to the deposit, the
// final result's checks and the timeline. Pure functions; the clock is always
// passed in. depositsReturned() and timeline() follow BZE Scan's
// ui/src/render/proposals.

/** How to show a denom: ticker and decimals, or undefined when the app doesn't know it. */
export type DenomResolver = (denom: string) => {ticker: string; decimals: number} | undefined;

const BZE = {ticker: "BZE", decimals: 6};

/** `3,000,000 BZE`; another denom with its ticker when known, else the raw amount and denom. */
export function coinText(coin: GovCoin, resolve?: DenomResolver): string {
    const d = coin.denom === "ubze" ? BZE : resolve?.(coin.denom);
    if (!d) return `${coin.amount} ${coin.denom}`;
    return `${prettyAmount(uAmountToBigNumberAmount(coin.amount, d.decimals))} ${d.ticker}`;
}

/** `100,000 BZE and 2 USDC`; "nothing" for none. */
export function coinsText(list: GovCoin[] | null | undefined, resolve?: DenomResolver): string {
    if (!list || list.length === 0) return "nothing";
    const parts = list.map((c) => coinText(c, resolve));
    return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Voting power (ubze) in whole BZE: `113,492,784`. */
export function wholeBze(uAmount: BigNumber | string): string {
    return prettyAmount(uAmountToBigNumberAmount(uAmount, 6).decimalPlaces(0, BigNumber.ROUND_HALF_UP));
}

export const isOpen = (p: Pick<GovProposal, "status">) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD";

/** No with veto above the veto threshold, of all votes cast. */
export function isVetoed(tally: GovTally | null | undefined, params: Pick<GovParams, "veto_threshold">): boolean {
    const total = totalVotes(tally);
    if (!total.gt(0)) return false;
    return new BigNumber(tally?.no_with_veto_count ?? 0).div(total).gt(params.veto_threshold);
}

/** Whether the deposits went back to the depositors: passed or failed, or rejected without a burning veto. */
export function depositsReturned(p: Pick<GovProposal, "status">, vetoed: boolean, burnVoteVeto: boolean): boolean {
    return p.status === "PROPOSAL_STATUS_PASSED"
        || p.status === "PROPOSAL_STATUS_FAILED"
        || (p.status === "PROPOSAL_STATUS_REJECTED" && !(vetoed && burnVoteVeto));
}

/** What happens to the deposit: `returned` / `burned` once decided, the rule while voting. */
export function depositFate(
    p: Pick<GovProposal, "status">,
    tally: GovTally | null | undefined,
    params: Pick<GovParams, "veto_threshold" | "burn_vote_veto" | "burn_vote_quorum">,
): string {
    if (isOpen(p)) {
        if (params.burn_vote_veto && params.burn_vote_quorum) return "returned unless vetoed or short of quorum";
        if (params.burn_vote_veto) return "returned unless vetoed";
        if (params.burn_vote_quorum) return "returned unless short of quorum";
        return "returned when voting ends";
    }
    return depositsReturned(p, isVetoed(tally, params), params.burn_vote_veto) ? "returned" : "burned";
}

/** The tally panel's footnote; the veto sentence follows `burn_vote_veto`. */
export function tallyFootnote(params: Pick<GovParams, "veto_threshold" | "burn_vote_veto">): string {
    const veto = fractionPct(params.veto_threshold);
    return params.burn_vote_veto
        ? `Abstain counts toward turnout, not toward the Yes share. If No with veto goes above ${veto}, the proposal fails and its deposit is burned.`
        : `Abstain counts toward turnout, not toward the Yes share. If No with veto goes above ${veto}, the proposal fails.`;
}

/** A finished proposal's quorum: known from its result, unknown (null) when the chain could have rejected it for either reason. */
export interface FinalChecks extends Omit<Checks, "quorum" | "passing"> {
    quorum: Omit<Check, "ok" | "value"> & {ok: boolean | null};
}

/**
 * The checks on a finished proposal's final tally. The chain keeps no turnout,
 * so the quorum is read from the result: a passed or failed proposal met it; a
 * rejected one whose Yes share and veto both pass can only have missed it; any
 * other rejection doesn't tell (the quorum is checked first).
 */
export function finalChecks(
    p: Pick<GovProposal, "status" | "expedited" | "final_tally_result">,
    params: Pick<GovParams, "quorum" | "threshold" | "expedited_threshold" | "veto_threshold">,
): FinalChecks {
    const c = passingChecks(p.final_tally_result, null, params, p.expedited);
    let ok: boolean | null = null;
    if (p.status === "PROPOSAL_STATUS_PASSED" || p.status === "PROPOSAL_STATUS_FAILED") ok = true;
    else if (c.threshold.ok && c.veto.ok) ok = false;
    return {quorum: {ok, need: c.quorum.need}, threshold: c.threshold, veto: c.veto};
}

export type TimelineState = "done" | "now" | "todo" | "passed" | "rejected";

export interface TimelineItem {
    label: string;
    detail: string;
    state: TimelineState;
}

const RESULT: Partial<Record<GovProposal["status"], {label: string; detail: string; state: TimelineState}>> = {
    PROPOSAL_STATUS_PASSED: {label: "Passed", detail: "Messages executed", state: "passed"},
    PROPOSAL_STATUS_REJECTED: {label: "Rejected", detail: "Nothing changes", state: "rejected"},
    PROPOSAL_STATUS_FAILED: {label: "Failed", detail: "Passed, but its messages failed to run", state: "rejected"},
};

/** Submitted, voting started, voting now (while open), voting ends or ended, and the result. */
export function timeline(
    p: Pick<GovProposal, "status" | "submit_time" | "voting_start_time" | "voting_end_time">,
    now: Date,
): TimelineItem[] {
    const items: TimelineItem[] = [];
    if (p.submit_time) items.push({label: "Submitted", detail: formatDateTimeUtc(p.submit_time), state: "done"});
    if (p.voting_start_time) {
        items.push({label: "Voting started", detail: `${formatDateTimeUtc(p.voting_start_time)} · deposit reached`, state: "done"});
    }
    if (p.voting_end_time) {
        if (isOpen(p)) {
            const left = (new Date(p.voting_end_time).getTime() - now.getTime()) / 1000;
            items.push({label: "Voting now", detail: `${durationText(left)} left`, state: "now"});
            items.push({label: "Voting ends", detail: formatDateTimeUtc(p.voting_end_time), state: "todo"});
        } else {
            items.push({label: "Voting ended", detail: formatDateTimeUtc(p.voting_end_time), state: "done"});
        }
    }
    const result = RESULT[p.status];
    if (result) items.push(result);
    return items;
}
