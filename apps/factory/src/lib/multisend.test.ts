import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    MAX_RECIPIENT_LINES,
    addressProblem,
    exampleCsv,
    multiSendValue,
    parseRecipients,
} from "./multisend";

const A = "bze13x5v3t9plqu8ql3h44ltx0ys59uzz43lt6p0tz";
const B = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";
const C = "bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76";
const OSMO = "osmo108cyg5m3hwnu496xv5mnwkx33lmdvs7e7lptjl";

beforeEach(() => {
    // The ui-kit validator logs every bad checksum.
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("parseRecipients", () => {
    it("splits on commas, semicolons, tabs and spaces", () => {
        const text = [`${A},1`, `${B};2`, `${C}\t3`, `${A.toUpperCase()}   4`].join("\n");
        const { ready, problems } = parseRecipients(text, "perWallet", 6);
        expect(problems).toEqual([]);
        expect(ready).toEqual([
            { address: A, amount: "5000000" },
            { address: B, amount: "2000000" },
            { address: C, amount: "3000000" },
        ]);
    });

    it("skips blank lines, # comments and a header line", () => {
        const text = ["address,amount", "", "# winners of round 1", `${A},10`, "   ", `${B},20`].join("\n");
        const { ready, problems } = parseRecipients(text, "perWallet", 6);
        expect(problems).toEqual([]);
        expect(ready.map(r => r.address)).toEqual([A, B]);
    });

    it("only the first line can be a header", () => {
        const { problems } = parseRecipients([A, "address"].join("\n"), "same", 6, "1");
        expect(problems).toEqual([{ line: 2, text: "address", reason: "isn't a valid BeeZee address" }]);
    });

    it("same mode gives everyone the same amount and notes ignored amounts", () => {
        const { ready, notes, problems, total } = parseRecipients([A, `${B}, 99`].join("\n"), "same", 6, "2.5");
        expect(ready).toEqual([
            { address: A, amount: "2500000" },
            { address: B, amount: "2500000" },
        ]);
        expect(notes).toEqual([{ line: 2, text: `${B}, 99`, reason: "Amount ignored: everyone gets the same" }]);
        expect(problems).toEqual([]);
        expect(total).toBe("5000000");
    });

    it("same mode without a valid amount keeps the wallets at 0", () => {
        const { ready, total } = parseRecipients(A, "same", 6, "");
        expect(ready).toEqual([{ address: A, amount: "0" }]);
        expect(total).toBe("0");
    });

    it("per wallet sums the amounts of a duplicate", () => {
        const { ready, duplicates, total } = parseRecipients([`${A},1.5`, `${B},1`, `${A},2`].join("\n"), "perWallet", 6);
        expect(ready).toEqual([
            { address: A, amount: "3500000" },
            { address: B, amount: "1000000" },
        ]);
        expect(duplicates).toBe(1);
        expect(total).toBe("4500000");
    });

    it("same mode dedupes a duplicate", () => {
        const { ready, duplicates, total } = parseRecipients([A, B, A, A].join("\n"), "same", 0, "7");
        expect(ready.map(r => r.address)).toEqual([A, B]);
        expect(duplicates).toBe(2);
        expect(total).toBe("14");
    });

    it("names the foreign prefix, and calls anything else invalid", () => {
        const { problems, ready } = parseRecipients([OSMO, "bze1notreal", "hello world 5", A].join("\n"), "same", 6, "1");
        expect(ready.map(r => r.address)).toEqual([A]);
        expect(problems).toEqual([
            { line: 1, text: OSMO, reason: "osmo1… is not a BeeZee address. Only bze1… addresses work here" },
            { line: 2, text: "bze1notreal", reason: "isn't a valid BeeZee address" },
            { line: 3, text: "hello world 5", reason: "isn't a valid BeeZee address" },
        ]);
    });

    it("rejects missing, bad and too-small amounts", () => {
        const text = [A, `${B},abc`, `${C},0`, `${A},0.0000001`, `${B},1.1234567`].join("\n");
        const { ready, problems } = parseRecipients(text, "perWallet", 6);
        expect(ready).toEqual([]);
        expect(problems.map(p => [p.line, p.reason])).toEqual([
            [1, "Amount is missing"],
            [2, "Enter a valid positive number"],
            [3, "Amount must be greater than zero"],
            [4, "Amount is too small for 6 decimals"],
            [5, "At most 6 decimal places (the token's decimals)"],
        ]);
    });

    it("converts display units with the token's decimals", () => {
        expect(parseRecipients(`${A},1.5`, "perWallet", 0).problems[0].reason).toBe("At most 0 decimal places (the token's decimals)");
        expect(parseRecipients(`${A},15`, "perWallet", 0).ready[0].amount).toBe("15");
        expect(parseRecipients(`${A},0.000000000000000001`, "perWallet", 18).ready[0].amount).toBe("1");
        expect(parseRecipients(`${A},12.34`, "perWallet", 2).ready[0].amount).toBe("1234");
    });

    it("leaves out the lines past 5,000 wallets", () => {
        const lines = Array.from({ length: MAX_RECIPIENT_LINES + 3 }, () => A);
        const { ready, duplicates, problems } = parseRecipients(["address", ...lines].join("\n"), "same", 6, "1");
        expect(ready).toHaveLength(1);
        expect(duplicates).toBe(MAX_RECIPIENT_LINES - 1);
        expect(problems).toEqual([
            { line: MAX_RECIPIENT_LINES + 2, text: "3 more lines", reason: "Lists are limited to 5,000 wallets" },
        ]);
    });
});

describe("addressProblem", () => {
    it("accepts a BeeZee address", () => {
        expect(addressProblem(A)).toBe("");
    });
});

describe("multiSendValue", () => {
    it("has one input equal to the sum of the outputs", () => {
        const value = multiSendValue(C, "utok", [
            { address: A, amount: "3" },
            { address: B, amount: "40" },
        ]);
        expect(value).toEqual({
            inputs: [{ address: C, coins: [{ denom: "utok", amount: "43" }] }],
            outputs: [
                { address: A, coins: [{ denom: "utok", amount: "3" }] },
                { address: B, coins: [{ denom: "utok", amount: "40" }] },
            ],
        });
    });
});

describe("exampleCsv", () => {
    it("parses cleanly in its own mode", () => {
        const same = parseRecipients(exampleCsv("same"), "same", 6, "1");
        expect(same.problems).toEqual([]);
        expect(same.ready).toHaveLength(3);

        const perWallet = parseRecipients(exampleCsv("perWallet"), "perWallet", 6);
        expect(perWallet.problems).toEqual([]);
        expect(perWallet.ready.map(r => r.amount)).toEqual(["100000000", "200000000", "300000000"]);
    });
});
