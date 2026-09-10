import { describe, it, expect } from "vitest";
import type {
    ValidatorSDKType,
    DelegationResponseSDKType,
} from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import type { DelegationDelegatorRewardSDKType } from "@bze/bzejs/cosmos/distribution/v1beta1/distribution";

import { buildMyValidators } from "./my-validators";

const NATIVE = "ubze";

function validator(operator: string): ValidatorSDKType {
    return {
        operator_address: operator,
        description: { moniker: operator },
    } as unknown as ValidatorSDKType;
}

function delegation(validatorAddress: string, amount: string): DelegationResponseSDKType {
    return {
        delegation: { delegator_address: "bze1me", validator_address: validatorAddress },
        balance: { denom: NATIVE, amount },
    } as unknown as DelegationResponseSDKType;
}

function reward(
    validatorAddress: string,
    amount: string,
    denom = NATIVE,
): DelegationDelegatorRewardSDKType {
    return {
        validator_address: validatorAddress,
        reward: [{ denom, amount }],
    } as unknown as DelegationDelegatorRewardSDKType;
}

const VAL_A = validator("bzevaloper1a");
const VAL_B = validator("bzevaloper1b");
const VAL_JAILED = validator("bzevaloper1jailed");

describe("buildMyValidators", () => {
    it("pairs each delegation with its validator and native-denom rewards", () => {
        const result = buildMyValidators({
            allValidators: [VAL_A],
            delegatorValidators: [],
            delegations: [delegation("bzevaloper1a", "500")],
            rewards: [reward("bzevaloper1a", "12")],
            nativeDenom: NATIVE,
        });

        expect(result).toHaveLength(1);
        expect(result[0].validator.operator_address).toBe("bzevaloper1a");
        expect(result[0].delegation?.balance?.amount).toBe("500");
        expect(result[0].rewards.toString()).toBe("12");
    });

    it("sorts positions by staked amount, largest first", () => {
        const result = buildMyValidators({
            allValidators: [VAL_A, VAL_B],
            delegatorValidators: [],
            delegations: [
                delegation("bzevaloper1a", "100"),
                delegation("bzevaloper1b", "900"),
            ],
            rewards: [],
            nativeDenom: NATIVE,
        });

        expect(result.map((r) => r.validator.operator_address)).toEqual([
            "bzevaloper1b",
            "bzevaloper1a",
        ]);
    });

    it("keeps delegations to validators only in the delegator list (jailed/unbonding)", () => {
        // VAL_JAILED is absent from allValidators (bonded only) but present in the
        // delegator's own validator list, so its delegation must stay visible.
        const result = buildMyValidators({
            allValidators: [VAL_A],
            delegatorValidators: [VAL_JAILED],
            delegations: [delegation("bzevaloper1jailed", "300")],
            rewards: [],
            nativeDenom: NATIVE,
        });

        expect(result.map((r) => r.validator.operator_address)).toEqual(["bzevaloper1jailed"]);
    });

    it("drops delegations whose validator is in neither list", () => {
        const result = buildMyValidators({
            allValidators: [VAL_A],
            delegatorValidators: [],
            delegations: [delegation("bzevaloper1unknown", "300")],
            rewards: [],
            nativeDenom: NATIVE,
        });

        expect(result).toEqual([]);
    });

    it("drops dust delegations below 1 uamount", () => {
        const result = buildMyValidators({
            allValidators: [VAL_A],
            delegatorValidators: [],
            delegations: [delegation("bzevaloper1a", "0")],
            rewards: [],
            nativeDenom: NATIVE,
        });

        expect(result).toEqual([]);
    });

    it("defaults rewards to zero when there is no native-denom reward entry", () => {
        const result = buildMyValidators({
            allValidators: [VAL_A],
            delegatorValidators: [],
            delegations: [delegation("bzevaloper1a", "500")],
            // A reward exists, but only in another denom.
            rewards: [reward("bzevaloper1a", "50", "uother")],
            nativeDenom: NATIVE,
        });

        expect(result[0].rewards.toString()).toBe("0");
    });

    it("rounds fractional reward amounts to a whole uamount", () => {
        const result = buildMyValidators({
            allValidators: [VAL_A],
            delegatorValidators: [],
            delegations: [delegation("bzevaloper1a", "500")],
            rewards: [reward("bzevaloper1a", "12.99")],
            nativeDenom: NATIVE,
        });

        expect(result[0].rewards.toString()).toBe("13");
    });

    it("does not mutate the delegations input", () => {
        const delegations = [
            delegation("bzevaloper1a", "100"),
            delegation("bzevaloper1b", "900"),
        ];
        const snapshot = delegations.map((d) => d.balance?.amount);
        buildMyValidators({
            allValidators: [VAL_A, VAL_B],
            delegatorValidators: [],
            delegations,
            rewards: [],
            nativeDenom: NATIVE,
        });
        expect(delegations.map((d) => d.balance?.amount)).toEqual(snapshot);
    });
});
