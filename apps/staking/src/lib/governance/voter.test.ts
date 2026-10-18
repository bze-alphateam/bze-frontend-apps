import { describe, it, expect } from "vitest";
import type { DelegationResponseSDKType, ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import type { GovVote } from "@bze/bze-ui-kit";
import {
    choiceByKey, isInactiveProposal, isWalletRejection, singleChoice, validatorVoteLabel,
    validatorsSentence, vetoWarning, voteSummary, votingPower,
} from "./voter";

const validator = (operator: string, moniker: string) =>
    ({ operator_address: operator, description: { moniker } }) as ValidatorSDKType;

const delegation = (operator: string, amount: string) =>
    ({
        delegation: { delegator_address: "bze1me", validator_address: operator, shares: amount },
        balance: { denom: "ubze", amount },
    }) as DelegationResponseSDKType;

const vote = (...options: [string, string][]): GovVote => ({
    proposal_id: "48",
    voter: "bze1me",
    metadata: "",
    options: options.map(([option, weight]) => ({ option, weight })) as GovVote["options"],
});

const HIVE = validator("bzevaloper1hive", "Hive Node");
const COMB = validator("bzevaloper1comb", "Comb Staking");

describe("votingPower", () => {
    it("counts only the stake with bonded validators", () => {
        const p = votingPower(
            [
                delegation("bzevaloper1comb", "10400000000"),
                delegation("bzevaloper1hive", "15000000000"),
                delegation("bzevaloper1jailed", "820000000"),
                delegation("bzevaloper1hive", "0"),
            ],
            [HIVE, COMB],
        );

        expect(p.power.toString()).toBe("25400000000");
        expect(p.inactive.toString()).toBe("820000000");
        expect(p.validators.map((v) => [v.validator.description?.moniker, v.amount.toString()])).toEqual([
            ["Hive Node", "15000000000"],
            ["Comb Staking", "10400000000"],
        ]);
    });

    it("is zero without delegations", () => {
        const p = votingPower([], [HIVE]);
        expect(p.power.toString()).toBe("0");
        expect(p.validators).toEqual([]);
    });
});

describe("votes", () => {
    it("reads a single choice and a split vote", () => {
        expect(singleChoice(vote(["VOTE_OPTION_NO_WITH_VETO", "1.000000000000000000"]))?.label).toBe("No with veto");
        const split = vote(["VOTE_OPTION_YES", "0.600000000000000000"], ["VOTE_OPTION_NO", "0.400000000000000000"]);
        expect(singleChoice(split)).toBeNull();
        expect(voteSummary(split)).toBe("Yes 60%, No 40%");
    });

    it("labels a validator's vote", () => {
        expect(validatorVoteLabel(vote(["VOTE_OPTION_YES", "1"]))).toBe("Yes");
        expect(validatorVoteLabel(null)).toBe("Not voted");
        expect(validatorVoteLabel(undefined)).toBe("—");
    });

    it("maps the choices to MsgVote options", () => {
        expect(["yes", "abstain", "no", "no_with_veto"].map((k) => choiceByKey(k as never).option)).toEqual([1, 2, 3, 4]);
    });
});

describe("validatorsSentence", () => {
    const yes = vote(["VOTE_OPTION_YES", "1"]);

    it("says nothing without validators", () => {
        expect(validatorsSentence([])).toBeNull();
        expect(validatorsSentence([{ moniker: "Hive Node", vote: undefined }])).toBeNull();
    });

    it("names one validator", () => {
        expect(validatorsSentence([{ moniker: "Hive Node", vote: yes }])).toBe("Hive Node voted Yes.");
    });

    it("names two and counts the rest past three", () => {
        expect(validatorsSentence([{ moniker: "Hive Node", vote: yes }, { moniker: "Comb Staking", vote: null }]))
            .toBe("Hive Node voted Yes, Comb Staking hasn't voted.");
        expect(validatorsSentence([
            { moniker: "A", vote: yes },
            { moniker: "B", vote: null },
            { moniker: "C", vote: yes },
            { moniker: "D", vote: null },
            { moniker: "E", vote: null },
        ])).toBe("A voted Yes, B hasn't voted, C voted Yes, 2 more validators.");
    });
});

describe("vetoWarning", () => {
    const proposal = { total_deposit: [{ denom: "ubze", amount: "100000000000" }] };

    it("burns the deposit only with burn_vote_veto", () => {
        expect(vetoWarning({ veto_threshold: "0.334000000000000000", burn_vote_veto: true }, proposal)).toBe(
            "Veto is for spam or harmful proposals. If more than 33.4% of all votes are No with veto, the proposal fails and the proposer's 100,000 BZE deposit is burned."
        );
        expect(vetoWarning({ veto_threshold: "0.334000000000000000", burn_vote_veto: false }, proposal)).toBe(
            "Veto is for spam or harmful proposals. If more than 33.4% of all votes are No with veto, the proposal fails."
        );
    });
});

describe("errors", () => {
    it("tells a wallet rejection and an ended vote apart", () => {
        expect(isWalletRejection("Request rejected")).toBe(true);
        expect(isWalletRejection("insufficient fees")).toBe(false);
        expect(isInactiveProposal("failed to execute message; message index: 0: 48: inactive proposal")).toBe(true);
    });
});
