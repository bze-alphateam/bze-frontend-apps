import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import {
    DEFAULT_FEE_SETTINGS,
    communityPoolError,
    denomConfigValue,
    gasSurchargeError,
    pctToChain,
    ratioToPct,
    settingChanges,
    settingsError,
    settingsFromConfig,
    transferFeeError,
} from "./denom-config";

const VALID = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";

describe("transferFeeError (0 to 5 %)", () => {
    it.each(["0", "5", "0.01", "4.99", " 1 "])("accepts %s", (v) => expect(transferFeeError(v)).toBe(""));
    it.each([
        ["5.01", /at most 5%/],
        ["-1", /Enter a number/],
        ["1.005", /2 decimal/],
        ["", /required/],
        ["abc", /Enter a number/],
        ["1e1", /Enter a number/],
    ])("refuses %j", (v, message) => expect(transferFeeError(v)).toMatch(message));
});

describe("gasSurchargeError (0 to 200 %)", () => {
    it.each(["0", "200", "50.25", "199.99"])("accepts %s", (v) => expect(gasSurchargeError(v)).toBe(""));
    it.each([
        ["200.01", /at most 200%/],
        ["201", /at most 200%/],
        ["-0.5", /Enter a number/],
        ["0.123", /2 decimal/],
        ["", /required/],
    ])("refuses %j", (v, message) => expect(gasSurchargeError(v)).toMatch(message));
});

describe("communityPoolError", () => {
    it("accepts empty (none) and a valid address", () => {
        expect(communityPoolError("")).toBe("");
        expect(communityPoolError("   ")).toBe("");
        expect(communityPoolError(VALID)).toBe("");
    });
    it("refuses anything that is not a bze address", () => {
        expect(communityPoolError("bze1notanaddress")).not.toBe("");
        expect(communityPoolError("cosmos1sx6ep2vtlzsdj73tseeq3ydahqyt0eyvyd7zl")).not.toBe("");
    });
});

describe("pctToChain", () => {
    it.each([["0", "0"], ["0.1", "0.001"], ["5", "0.05"], ["200", "2"], ["0.01", "0.0001"], [" 1 ", "0.01"]])("%s %% -> %s", (pct, ratio) => {
        expect(pctToChain(pct)).toBe(ratio);
    });
});

describe("ratioToPct and settingsFromConfig", () => {
    it("reads the live config back as percents", () => {
        expect(ratioToPct(new BigNumber("0.001"))).toBe("0.1");
        expect(settingsFromConfig({ communityPool: VALID, transferFee: new BigNumber("0.05"), gasSurcharge: new BigNumber(2) }))
            .toEqual({ communityPool: VALID, transferFeePct: "5", gasSurchargePct: "200" });
        expect(settingsFromConfig({ communityPool: "", transferFee: new BigNumber(0), gasSurcharge: new BigNumber(0) })).toEqual(DEFAULT_FEE_SETTINGS);
    });
});

describe("settingsError", () => {
    it("is empty for valid settings and names the first problem otherwise", () => {
        expect(settingsError({ communityPool: VALID, transferFeePct: "1", gasSurchargePct: "50" })).toBe("");
        expect(settingsError({ communityPool: "", transferFeePct: "6", gasSurchargePct: "50" })).toMatch(/Transfer fee/);
        expect(settingsError({ communityPool: "", transferFeePct: "1", gasSurchargePct: "300" })).toMatch(/Gas surcharge/);
    });
});

describe("settingChanges", () => {
    const before = { communityPool: "", transferFeePct: "1", gasSurchargePct: "0" };
    it("is empty when nothing changes, also for 1 vs 1.00", () => {
        expect(settingChanges(before, { ...before, transferFeePct: "1.00" })).toEqual([]);
    });
    it("lists each changed field old -> new, in form order", () => {
        expect(settingChanges(before, { communityPool: VALID, transferFeePct: "2.5", gasSurchargePct: "0" })).toEqual([
            { key: "communityPool", label: "Community pool", from: "None", to: VALID },
            { key: "transferFeePct", label: "Transfer fee", from: "1%", to: "2.5%" },
        ]);
    });
});

describe("denomConfigValue", () => {
    it("always carries all three fields, zero rates and an empty pool included", () => {
        expect(denomConfigValue("bze1me", "factory/bze1me/u", DEFAULT_FEE_SETTINGS)).toEqual({
            creator: "bze1me", denom: "factory/bze1me/u", communityPool: "", transferFee: "0", gasSurcharge: "0",
        });
        expect(denomConfigValue("bze1me", "factory/bze1me/u", { communityPool: ` ${VALID} `, transferFeePct: "1", gasSurchargePct: "50" })).toEqual({
            creator: "bze1me", denom: "factory/bze1me/u", communityPool: VALID, transferFee: "0.01", gasSurcharge: "0.5",
        });
    });
});
