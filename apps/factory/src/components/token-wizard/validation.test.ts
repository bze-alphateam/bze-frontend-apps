import { describe, it, expect } from "vitest";

import {
    MAX_DESCRIPTION_LENGTH,
    MAX_NAME_LENGTH,
    MAX_SUBDENOM_LENGTH,
    MAX_SYMBOL_LENGTH,
    suggestSubdenom,
    validateAmount,
    validateDescription,
    validateInitialSupply,
    validateName,
    validateSubdenom,
    validateSymbol,
} from "./validation";

describe("suggestSubdenom", () => {
    it("prefixes a sanitised, lowercased symbol with 'u'", () => {
        expect(suggestSubdenom("HONEY")).toBe("uhoney");
        expect(suggestSubdenom("MyToken")).toBe("umytoken");
    });

    it("strips characters outside [a-z0-9.-]", () => {
        expect(suggestSubdenom("A B$C")).toBe("uabc");
    });

    it("is empty when nothing survives sanitisation", () => {
        expect(suggestSubdenom("$$$")).toBe("");
        expect(suggestSubdenom("")).toBe("");
    });
});

describe("validateName", () => {
    it("accepts a normal name", () => {
        expect(validateName("Honey Token")).toBe("");
    });

    it("requires a non-blank name", () => {
        expect(validateName("")).toBe("Name is required.");
        expect(validateName("   ")).toBe("Name is required.");
    });

    it("enforces the minimum length after trimming", () => {
        expect(validateName("A")).toBe("Name must be at least 2 characters.");
    });

    it("enforces the maximum length", () => {
        expect(validateName("x".repeat(MAX_NAME_LENGTH + 1))).toBe(
            `Name must be at most ${MAX_NAME_LENGTH} characters.`,
        );
    });
});

describe("validateSymbol", () => {
    it("accepts a valid symbol", () => {
        expect(validateSymbol("HONEY")).toBe("");
        expect(validateSymbol("Bze2")).toBe("");
    });

    it("requires a symbol", () => {
        expect(validateSymbol("")).toBe("Symbol is required.");
    });

    it("enforces min and max length", () => {
        expect(validateSymbol("A")).toBe("Symbol must be at least 2 characters.");
        expect(validateSymbol("A".repeat(MAX_SYMBOL_LENGTH + 1))).toBe(
            `Symbol must be at most ${MAX_SYMBOL_LENGTH} characters.`,
        );
    });

    it("must start with a letter and be alphanumeric", () => {
        const err = "Symbol must start with a letter and contain only letters and digits.";
        expect(validateSymbol("1AB")).toBe(err);
        expect(validateSymbol("A-B")).toBe(err);
    });
});

describe("validateSubdenom", () => {
    it("accepts a valid subdenom", () => {
        expect(validateSubdenom("uhoney")).toBe("");
        expect(validateSubdenom("u.token-1")).toBe("");
    });

    it("requires a subdenom", () => {
        expect(validateSubdenom("")).toBe("Subdenom is required.");
    });

    it("enforces the maximum length", () => {
        expect(validateSubdenom("u".repeat(MAX_SUBDENOM_LENGTH + 1))).toBe(
            `Subdenom must be at most ${MAX_SUBDENOM_LENGTH} characters.`,
        );
    });

    it("rejects underscores and slashes with a specific message", () => {
        expect(validateSubdenom("u_token")).toBe('Subdenom cannot contain "_" or "/".');
        expect(validateSubdenom("u/token")).toBe('Subdenom cannot contain "_" or "/".');
    });

    it("rejects other disallowed characters", () => {
        expect(validateSubdenom("u token")).toBe(
            "Subdenom can only contain letters, digits, dots, and dashes.",
        );
    });
});

describe("validateDescription", () => {
    it("accepts an empty or normal description", () => {
        expect(validateDescription("")).toBe("");
        expect(validateDescription("A community token.")).toBe("");
    });

    it("enforces the maximum length", () => {
        expect(validateDescription("x".repeat(MAX_DESCRIPTION_LENGTH + 1))).toBe(
            `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
        );
    });
});

describe("validateAmount", () => {
    it("accepts a positive integer or decimal within the decimals budget", () => {
        expect(validateAmount("100", 6)).toBe("");
        expect(validateAmount("1.5", 6)).toBe("");
        expect(validateAmount("0.000001", 6)).toBe("");
    });

    it("requires an amount", () => {
        expect(validateAmount("", 6)).toBe("Amount is required.");
        expect(validateAmount("   ", 6)).toBe("Amount is required.");
    });

    it("rejects non-numeric or signed input", () => {
        expect(validateAmount("abc", 6)).toBe("Enter a valid positive number.");
        expect(validateAmount("1.2.3", 6)).toBe("Enter a valid positive number.");
        expect(validateAmount("-5", 6)).toBe("Enter a valid positive number.");
    });

    it("rejects zero", () => {
        expect(validateAmount("0", 6)).toBe("Amount must be greater than zero.");
        expect(validateAmount("0.000", 6)).toBe("Amount must be greater than zero.");
    });

    it("rejects more fractional digits than the token's decimals", () => {
        expect(validateAmount("1.1234567", 6)).toBe(
            "At most 6 decimal places (the token's decimals).",
        );
        expect(validateAmount("1.12", 2)).toBe("");
        expect(validateAmount("1.123", 2)).toBe(
            "At most 2 decimal places (the token's decimals).",
        );
    });
});

describe("validateInitialSupply", () => {
    it("accepts a valid supply", () => {
        expect(validateInitialSupply("1000000", 6)).toBe("");
    });

    it("re-labels the amount error for the supply field", () => {
        expect(validateInitialSupply("", 6)).toBe("Initial supply is required.");
        expect(validateInitialSupply("0", 6)).toBe("Initial supply must be greater than zero.");
    });

    it("leaves messages without the word 'Amount' unchanged", () => {
        expect(validateInitialSupply("abc", 6)).toBe("Enter a valid positive number.");
    });
});
