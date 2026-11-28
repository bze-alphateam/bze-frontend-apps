import BigNumber from "bignumber.js";
import {describe, expect, it} from "vitest";
import type {DaoConfig} from "@bze/bze-ui-kit";
import {CONFIG} from "@/test/composer-fixtures";
import {costRows, summarizeCost} from "./cost";

const fmt = (c: {denom: string; amount: string}) => `${new BigNumber(c.amount).shiftedBy(-6).toFormat()} ${c.denom === "ubze" ? "BZE" : c.denom}`;
const balance = (n: string) => () => new BigNumber(n);
const config = (over: Partial<DaoConfig>): DaoConfig => ({...CONFIG, ...over});

describe("summarizeCost", () => {
    it("the cost is paid and gone, to the treasury or the burner", () => {
        const toTreasury = summarizeCost(config({proposal_deposit: null, cost_destination: "TREASURY"}), fmt, balance("100000000"));
        expect(toTreasury.lines).toEqual([{kind: "cost", coin: {denom: "ubze", amount: "5000000"}, text: "5 BZE is paid now and never refunded. It is sent to the DAO's treasury."}]);
        const burned = summarizeCost(config({proposal_deposit: null, cost_destination: "BURN"}), fmt, balance("100000000"));
        expect(burned.lines[0].text).toBe("5 BZE is paid now and never refunded. It is burned.");
    });

    describe("the deposit, for every refund policy and kept destination", () => {
        const text = (policy: DaoConfig["deposit_refund_policy"], kept: DaoConfig["kept_deposit_destination"]) =>
            summarizeCost(config({proposal_cost: null, deposit_refund_policy: policy, kept_deposit_destination: kept}), fmt, balance("1e12")).lines[0].text;

        it("ALWAYS: refunded whatever the result, the kept destination never applies", () => {
            expect(text("ALWAYS", "BURN")).toBe("9 BZE is put in escrow. It is held until the proposal is settled and then refunded to you, whatever the result.");
            expect(text("ALWAYS", "TREASURY")).toBe(text("ALWAYS", "BURN"));
        });
        it("ONLY_PASSED: refunded when it passes, otherwise kept and burned or sent to the treasury", () => {
            expect(text("ONLY_PASSED", "BURN")).toContain("refunded to you only if the proposal passes. If it is rejected or cancelled it is kept and burned.");
            expect(text("ONLY_PASSED", "TREASURY")).toContain("kept and sent to the DAO's treasury.");
        });
        it("NEVER: kept, burned or sent to the treasury", () => {
            expect(text("NEVER", "BURN")).toBe("9 BZE is put in escrow. It is held and never refunded: it is kept and burned.");
            expect(text("NEVER", "TREASURY")).toBe("9 BZE is put in escrow. It is held and never refunded: it is kept and sent to the DAO's treasury.");
        });
    });

    it("a DAO that charges nothing has no lines and needs nothing", () => {
        const s = summarizeCost(config({proposal_cost: null, proposal_deposit: null}), fmt, balance("0"));
        expect(s).toEqual({lines: [], requirements: [], short: false});
        const zero = summarizeCost(config({proposal_cost: {denom: "ubze", amount: "0"}, proposal_deposit: {denom: "ubze", amount: "000"}}), fmt, balance("0"));
        expect(zero.lines).toEqual([]);
    });

    it("cost and deposit in the same token add up exactly; the balance decides", () => {
        const enough = summarizeCost(CONFIG, fmt, balance("14000000"));
        expect(enough.requirements).toEqual([{denom: "ubze", needed: "14000000", balance: "14000000", short: false}]);
        expect(enough.short).toBe(false);
        const short = summarizeCost(CONFIG, fmt, balance("13999999"));
        expect(short.requirements[0]).toMatchObject({short: true});
        expect(short.short).toBe(true);
    });

    it("keeps different tokens apart: nothing is swapped", () => {
        const s = summarizeCost(config({proposal_deposit: {denom: "ulmn", amount: "1000"}}), fmt, (d) => new BigNumber(d === "ubze" ? "5000000" : "999"));
        expect(s.requirements).toEqual([
            {denom: "ubze", needed: "5000000", balance: "5000000", short: false},
            {denom: "ulmn", needed: "1000", balance: "999", short: true},
        ]);
        expect(s.short).toBe(true);
    });

    it("amounts past float precision stay exact", () => {
        const s = summarizeCost(config({proposal_cost: {denom: "ubze", amount: "9007199254740993"}, proposal_deposit: {denom: "ubze", amount: "1"}}), fmt, balance("9007199254740994"));
        expect(s.requirements[0]).toMatchObject({needed: "9007199254740994", short: false});
    });

    it("unknown balances do not count as short", () => {
        const s = summarizeCost(CONFIG, fmt, () => null);
        expect(s.requirements[0]).toMatchObject({balance: null, short: false});
        expect(s.short).toBe(false);
    });
});

describe("costRows", () => {
    it("a free DAO: no deposit and no cost, and no Back to you row", () => {
        expect(costRows(config({proposal_cost: null, proposal_deposit: null}), fmt)).toEqual([
            {label: "Deposit", text: "None"},
            {label: "Cost", text: "None"},
        ]);
    });

    it("a deposit held while voting, back by the DAO's refund policy, and a cost paid now", () => {
        const rows = (policy: DaoConfig["deposit_refund_policy"], kept: DaoConfig["kept_deposit_destination"]) =>
            costRows(config({deposit_refund_policy: policy, kept_deposit_destination: kept, cost_destination: "BURN"}), fmt);
        expect(rows("ONLY_PASSED", "TREASURY")).toEqual([
            {label: "Deposit", text: "9 BZE, held while voting"},
            {label: "Back to you", text: "Only if it passes; otherwise it goes to the treasury"},
            {label: "Cost", text: "5 BZE, paid now and never refunded (burned)"},
        ]);
        expect(rows("ALWAYS", "BURN")[1].text).toBe("Always, whatever the result");
        expect(rows("NEVER", "BURN")[1].text).toBe("Never; it is burned");
        expect(costRows(config({cost_destination: "TREASURY"}), fmt)[2].text).toBe("5 BZE, paid now and never refunded (to the treasury)");
    });
});
