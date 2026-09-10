import { describe, it, expect } from "vitest";
import type { ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";

import {
    filterValidators,
    formatCommissionRate,
    sortValidatorsByTokens,
} from "./validator-list";

// Minimal validator — only the fields the list logic reads matter.
function validator(
    operator: string,
    moniker: string,
    tokens: string,
    rate = "0.05",
): ValidatorSDKType {
    return {
        operator_address: operator,
        tokens,
        jailed: false,
        description: { moniker },
        commission: { commission_rates: { rate } },
    } as unknown as ValidatorSDKType;
}

const ALICE = validator("bzevaloper1alice", "Alice Node", "3000000");
const BOB = validator("bzevaloper1bob", "Bob Stake", "1000000");
const CAROL = validator("bzevaloper1carol", "Carol Validators", "2000000");

describe("filterValidators", () => {
    const validators = [ALICE, BOB, CAROL];

    it("returns every validator for an empty search term", () => {
        expect(filterValidators(validators, "")).toEqual(validators);
    });

    it("matches on the moniker, case-insensitively", () => {
        expect(filterValidators(validators, "alice")).toEqual([ALICE]);
        expect(filterValidators(validators, "ALICE")).toEqual([ALICE]);
    });

    it("matches on the operator address", () => {
        expect(filterValidators(validators, "1bob")).toEqual([BOB]);
    });

    it("returns nothing when no validator matches", () => {
        expect(filterValidators(validators, "zzz")).toEqual([]);
    });

    it("does not mutate the input array", () => {
        const input = [ALICE, BOB];
        const snapshot = [...input];
        filterValidators(input, "alice");
        expect(input).toEqual(snapshot);
    });
});

describe("sortValidatorsByTokens", () => {
    it("orders validators by bonded tokens, largest first", () => {
        expect(
            sortValidatorsByTokens([BOB, ALICE, CAROL]).map((v) => v.operator_address),
        ).toEqual([ALICE.operator_address, CAROL.operator_address, BOB.operator_address]);
    });

    it("keeps token amounts distinct beyond Number.MAX_SAFE_INTEGER", () => {
        // These two 16-digit amounts collapse to the same JS number (they differ
        // past 2^53), so a plain Number subtraction would treat them as equal.
        // BigNumber keeps them apart and orders the larger one first.
        const bigger = validator("bzevaloper1big", "Bigger", "9007199254740993");
        const smaller = validator("bzevaloper1small", "Smaller", "9007199254740992");
        expect(sortValidatorsByTokens([smaller, bigger])[0].operator_address).toBe(
            "bzevaloper1big",
        );
    });

    it("does not mutate the input array", () => {
        const input = [BOB, ALICE, CAROL];
        const snapshot = input.map((v) => v.operator_address);
        sortValidatorsByTokens(input);
        expect(input.map((v) => v.operator_address)).toEqual(snapshot);
    });
});

describe("formatCommissionRate", () => {
    it("renders a decimal rate as a percentage", () => {
        expect(formatCommissionRate("0.05")).toBe("5");
        expect(formatCommissionRate("0.1")).toBe("10");
    });

    it("keeps at most one decimal place", () => {
        expect(formatCommissionRate("0.125")).toBe("12.5");
    });

    it("treats a missing rate as zero", () => {
        expect(formatCommissionRate(undefined)).toBe("0");
    });
});
