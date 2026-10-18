import BigNumber from "bignumber.js";
import {VoteOption} from "@bze/bzejs/cosmos/gov/v1/gov";
import type {DelegationResponseSDKType, ValidatorSDKType} from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import type {GovParams, GovProposal, GovVote, GovVoteOption} from "@bze/bze-ui-kit";
import type {TallyOption} from "./tally";
import {formatPct, fractionPct} from "./format";
import {coinsText, type DenomResolver} from "./details";

// The connected wallet's side of governance: its voting power, its vote and
// its validators' votes, as plain data and text. Pure; the hooks fetch.
//
// x/gov v1 counts a delegator's vote with their stake in *bonded* validators
// only (the tally iterates the bonded set). A delegator who hasn't voted
// inherits each validator's vote for the stake with that validator; a vote of
// their own replaces those for all of their stake.

export interface VoteChoice {
    key: TallyOption;
    /** The MsgVote option. */
    option: VoteOption;
    /** The option as the REST API writes it. */
    wire: GovVoteOption;
    label: string;
    description: string;
}

/** Single choice only, in the order the vote dialog lists them. */
export const VOTE_CHOICES: VoteChoice[] = [
    {key: "yes", option: VoteOption.VOTE_OPTION_YES, wire: "VOTE_OPTION_YES", label: "Yes", description: "I support this proposal."},
    {key: "no", option: VoteOption.VOTE_OPTION_NO, wire: "VOTE_OPTION_NO", label: "No", description: "I'm against it."},
    {
        key: "no_with_veto",
        option: VoteOption.VOTE_OPTION_NO_WITH_VETO,
        wire: "VOTE_OPTION_NO_WITH_VETO",
        label: "No with veto",
        description: "Against it, and it's spam or harmful. Enough veto votes burn the proposer's deposit.",
    },
    {key: "abstain", option: VoteOption.VOTE_OPTION_ABSTAIN, wire: "VOTE_OPTION_ABSTAIN", label: "Abstain", description: "No side. Still counts toward turnout."},
];

export const choiceByKey = (key: TallyOption): VoteChoice =>
    VOTE_CHOICES.find((c) => c.key === key) ?? VOTE_CHOICES[0];

const choiceByWire = (wire: GovVoteOption): VoteChoice | undefined => VOTE_CHOICES.find((c) => c.wire === wire);

export interface ValidatorStake {
    validator: ValidatorSDKType;
    /** The delegator's stake with this validator, in ubze. */
    amount: BigNumber;
}

export interface VotingPower {
    /** Stake with bonded validators, in ubze: what the tally counts. */
    power: BigNumber;
    /** Stake with unbonded, unbonding or jailed validators, in ubze: not counted. */
    inactive: BigNumber;
    /** The bonded validators the delegator stakes with, largest stake first. */
    validators: ValidatorStake[];
}

/** Voting power from the delegations and the bonded validator set. */
export function votingPower(delegations: DelegationResponseSDKType[], bonded: ValidatorSDKType[]): VotingPower {
    const byOperator = new Map(bonded.map((v) => [v.operator_address, v]));
    const stakes = new Map<string, ValidatorStake>();
    let inactive = new BigNumber(0);

    for (const d of delegations) {
        const amount = new BigNumber(d.balance?.amount ?? 0);
        if (!amount.isFinite() || !amount.gt(0)) continue;
        const operator = d.delegation?.validator_address ?? "";
        const validator = byOperator.get(operator);
        if (!validator) {
            inactive = inactive.plus(amount);
            continue;
        }
        const current = stakes.get(operator);
        stakes.set(operator, {validator, amount: current ? current.amount.plus(amount) : amount});
    }

    const validators = [...stakes.values()].sort((a, b) => b.amount.comparedTo(a.amount) ?? 0);
    const power = validators.reduce((sum, s) => sum.plus(s.amount), new BigNumber(0));

    return {power, inactive, validators};
}

/** The one option of a single-choice vote; null for no vote or a split vote. */
export function singleChoice(vote: GovVote | null | undefined): VoteChoice | null {
    if (!vote || vote.options.length !== 1) return null;
    return choiceByWire(vote.options[0].option) ?? null;
}

export const isSplit = (vote: GovVote | null | undefined): boolean => !!vote && vote.options.length > 1;

/** `Yes`, or for a split vote `Yes 60%, No 40%`. */
export function voteSummary(vote: GovVote): string {
    const single = singleChoice(vote);
    if (single) return single.label;
    return vote.options
        .map((o) => `${choiceByWire(o.option)?.label ?? "Unknown"} ${formatPct(new BigNumber(o.weight).times(100))}`)
        .join(", ");
}

/** A validator's vote in a row: `Yes`, `Yes 60%, No 40%`, `Not voted`; a dash when it didn't load. */
export function validatorVoteLabel(vote: GovVote | null | undefined): string {
    if (vote === undefined) return "—";
    return vote ? voteSummary(vote) : "Not voted";
}

export interface ValidatorVote {
    moniker: string;
    /** Null when the validator hasn't voted; undefined when the node didn't answer. */
    vote: GovVote | null | undefined;
}

const NAMED_VALIDATORS = 3;

/**
 * What the delegator's validators did, for a voter who hasn't voted yet:
 * `Hive Node voted Yes, Comb Staking hasn't voted.` Null without validators.
 * Validators whose vote didn't load are left out; past three, the rest are counted.
 */
export function validatorsSentence(validators: ValidatorVote[]): string | null {
    const known = validators.filter((v) => v.vote !== undefined);
    if (known.length === 0) return null;
    const parts = known.slice(0, NAMED_VALIDATORS)
        .map((v) => v.vote ? `${v.moniker} voted ${voteSummary(v.vote)}` : `${v.moniker} hasn't voted`);
    const rest = known.length - NAMED_VALIDATORS;
    if (rest > 0) parts.push(`${rest} more ${rest === 1 ? "validator" : "validators"}`);
    return `${parts.join(", ")}.`;
}

/** The veto warning of the confirm step; the burn only when `burn_vote_veto` is on. */
export function vetoWarning(
    params: Pick<GovParams, "veto_threshold" | "burn_vote_veto">,
    proposal: Pick<GovProposal, "total_deposit">,
    resolve?: DenomResolver,
): string {
    const start = `Veto is for spam or harmful proposals. If more than ${fractionPct(params.veto_threshold)} of all votes are No with veto, the proposal fails`;
    if (!params.burn_vote_veto) return `${start}.`;
    return `${start} and the proposer's ${coinsText(proposal.total_deposit, resolve)} deposit is burned.`;
}

/** The wallet refused to sign (Keplr "Request rejected", Leap "declined", WalletConnect "User rejected"…). */
export const isWalletRejection = (error: string): boolean => /reject|denied|declined|cancel/i.test(error);

/** x/gov's ErrInactiveProposal: voting ended while the dialog was open. */
export const isInactiveProposal = (error: string): boolean => /inactive proposal/i.test(error);
