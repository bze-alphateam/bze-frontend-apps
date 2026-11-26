import {describe, expect, it} from "vitest";
import {packDaoMsgs} from "@bze/bze-ui-kit";
import {ctxWith, DAO_ADDRESS, OTHER} from "@/test/composer-fixtures";
import {payEntry} from "./pay";

const fields = (over: Record<string, string> = {}) => ({denom: "ubze", amount: "12.5", to: OTHER, ...over});

describe("the pay-from-the-treasury action", () => {
    it("builds a bank send whose sender is the DAO, with the amount in base units", () => {
        const msg = payEntry.build(fields(), ctxWith());
        expect(msg).toEqual({
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {fromAddress: DAO_ADDRESS, toAddress: OTHER, amount: [{denom: "ubze", amount: "12500000"}]},
        });
        // and it packs: the ui-kit has an encoder for it
        expect(packDaoMsgs([msg])).toHaveLength(1);
    });

    it("converts big amounts exactly and trims the recipient", () => {
        const msg = payEntry.build(fields({amount: "123456789012.123456", to: ` ${OTHER} `}), ctxWith());
        expect((msg.value as {amount: {amount: string}[]}).amount[0].amount).toBe("123456789012123456");
        expect((msg.value as {toAddress: string}).toAddress).toBe(OTHER);
    });

    it("starts on the first token of the treasury", () => {
        expect(payEntry.initialFields(ctxWith())).toEqual({denom: "ubze", amount: "", to: ""});
        expect(payEntry.initialFields(ctxWith({treasury: null}))).toEqual({denom: "", amount: "", to: ""});
    });

    it("accepts a valid payment", () => {
        expect(payEntry.validate(fields(), ctxWith())).toBeUndefined();
    });

    it.each([
        [{amount: ""}, /Enter an amount/],
        [{amount: "abc"}, /plain number/],
        [{amount: "-1"}, /plain number/],
        [{amount: "0"}, /more than zero/],
        [{amount: "0.0000001"}, /at most 6 decimals/],
        [{amount: "1e3"}, /plain number/],
        [{to: ""}, /Enter the address/],
        [{to: "cosmos1abc"}, /not a valid BeeZee address/],
        [{denom: "uatom"}, /Choose a token the treasury holds/],
    ])("refuses %j", (over, message) => {
        expect(payEntry.validate(fields(over), ctxWith())).toMatch(message);
    });

    it("says why when the treasury is empty or unreadable", () => {
        expect(payEntry.validate(fields(), ctxWith({treasury: []}))).toMatch(/holds no tokens/);
        expect(payEntry.validate(fields(), ctxWith({treasury: null}))).toMatch(/could not be read/);
    });

    it("an unknown token's amount is in its smallest unit: no decimals", () => {
        const ctx = ctxWith();
        expect(payEntry.validate(fields({denom: "factory/bze1x/ulmn", amount: "1.5"}), ctx)).toMatch(/whole number/);
        const msg = payEntry.build(fields({denom: "factory/bze1x/ulmn", amount: "40"}), ctx);
        expect((msg.value as {amount: unknown[]}).amount).toEqual([{denom: "factory/bze1x/ulmn", amount: "40"}]);
        expect(payEntry.warnings?.(fields({denom: "factory/bze1x/ulmn", amount: "40"}), ctx).join(" ")).toMatch(/smallest unit/);
    });

    it("warns, never blocks, when the amount is above the treasury's balance", () => {
        const over = fields({amount: "250.000001"});
        expect(payEntry.validate(over, ctxWith())).toBeUndefined();
        expect(payEntry.warnings?.(over, ctxWith()).join(" ")).toMatch(/holds less than this today/);
        expect(payEntry.warnings?.(fields({amount: "250"}), ctxWith()).join(" ")).not.toMatch(/holds less/);
    });

    it("warns about paying the DAO to itself", () => {
        expect(payEntry.warnings?.(fields({to: DAO_ADDRESS}), ctxWith()).join(" ")).toMatch(/own account/);
    });

    it("refuses to build an incomplete payment", () => {
        expect(() => payEntry.build(fields({amount: ""}), ctxWith())).toThrow();
    });
});
