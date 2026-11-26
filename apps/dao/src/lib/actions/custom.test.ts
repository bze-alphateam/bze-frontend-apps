import {describe, expect, it} from "vitest";
import {packDaoMsgs} from "@bze/bze-ui-kit";
import {ctxWith, DAO, DAO_ADDRESS, OTHER, WALLET} from "@/test/composer-fixtures";
import {customEntry, customPlaceholder, firstMismatch, MAX_CUSTOM_JSON_CHARS, parseCustomMessage} from "./custom";

const SEND = "/cosmos.bank.v1beta1.MsgSend";
const send = (over: Record<string, unknown> = {}) =>
    JSON.stringify({"@type": SEND, from_address: DAO_ADDRESS, to_address: OTHER, amount: [{denom: "ubze", amount: "5"}], ...over});

describe("a custom message", () => {
    it("decodes through the codec and reads back what would be signed", () => {
        const result = parseCustomMessage(send(), ctxWith());
        expect(result).toMatchObject({
            ok: true,
            typeUrl: SEND,
            json: {"@type": SEND, from_address: DAO_ADDRESS, to_address: OTHER, amount: [{denom: "ubze", amount: "5"}]},
        });
        if (result.ok) expect(packDaoMsgs([result.msg])).toHaveLength(1);
    });

    it("accepts the signer in another letter case", () => {
        expect(parseCustomMessage(send({from_address: DAO_ADDRESS.toUpperCase()}), ctxWith()).ok).toBe(true);
    });

    it.each([
        ["", /Paste the message/],
        ["{", /not valid JSON/],
        ["[1]", /one JSON object/],
        ["5", /one JSON object/],
        ["null", /one JSON object/],
        [JSON.stringify({from_address: "x"}), /"@type"/],
        [JSON.stringify({"@type": "MsgSend"}), /"@type"/],
        [JSON.stringify({"@type": "/cosmos.bank.v1beta1.MsgNope"}), /cannot encode/],
    ])("refuses %j", (text, message) => {
        const result = parseCustomMessage(text, ctxWith());
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(message);
    });

    it("refuses a message that is too long before parsing it", () => {
        const result = parseCustomMessage(" ".repeat(10) + "x".repeat(MAX_CUSTOM_JSON_CHARS + 1), ctxWith());
        expect(result).toEqual({ok: false, error: expect.stringMatching(/far larger/)});
    });

    it("requires the DAO to be the signer: another account, or none", () => {
        const other = parseCustomMessage(send({from_address: WALLET}), ctxWith());
        expect(other).toEqual({ok: false, error: expect.stringContaining(`"from_address" is ${WALLET}`)});
        const none = parseCustomMessage(send({from_address: ""}), ctxWith());
        expect(none).toEqual({ok: false, error: expect.stringContaining(`Set "from_address" to the DAO's address`)});
    });

    it("checks every input of a multi-send", () => {
        const body = (second: string) => JSON.stringify({
            "@type": "/cosmos.bank.v1beta1.MsgMultiSend",
            inputs: [{address: DAO_ADDRESS, coins: [{denom: "ubze", amount: "1"}]}, {address: second, coins: [{denom: "ubze", amount: "1"}]}],
            outputs: [{address: OTHER, coins: [{denom: "ubze", amount: "2"}]}],
        });
        expect(parseCustomMessage(body(DAO_ADDRESS), ctxWith()).ok).toBe(true);
        expect(parseCustomMessage(body(WALLET), ctxWith())).toMatchObject({ok: false});
    });

    it("reads the module-specific signer fields (creator, authority, delegator)", () => {
        const delegate = (who: string) => JSON.stringify({"@type": "/cosmos.staking.v1beta1.MsgDelegate", delegator_address: who, validator_address: "bzevaloper1x", amount: {denom: "ubze", amount: "1"}});
        expect(parseCustomMessage(delegate(DAO_ADDRESS), ctxWith()).ok).toBe(true);
        expect(parseCustomMessage(delegate(WALLET), ctxWith()).ok).toBe(false);
        const mint = (who: string) => JSON.stringify({"@type": "/bze.tokenfactory.MsgMint", creator: who, coins: "5factory/x/y"});
        expect(parseCustomMessage(mint(WALLET), ctxWith())).toMatchObject({ok: false, error: expect.stringContaining('"creator"')});
    });

    it("refuses a DAO admin-executing itself, accepts it for another DAO", () => {
        const exec = (daoId: string) => JSON.stringify({"@type": "/bze.dao.MsgAdminExecute", admin: DAO_ADDRESS, dao_id: daoId, msgs: []});
        expect(parseCustomMessage(exec(DAO.id), ctxWith())).toEqual({ok: false, error: expect.stringMatching(/cannot run messages as itself/)});
        expect(parseCustomMessage(exec("9"), ctxWith()).ok).toBe(true);
    });

    it("refuses a field the type does not have: camelCase or a typo is never silently dropped", () => {
        const result = parseCustomMessage(send({toAddress: OTHER, memo_text: "hi"}), ctxWith());
        expect(result).toEqual({ok: false, error: expect.stringMatching(/"toAddress" is not a field of this type/)});
        // an explicit default is not an unknown field
        expect(parseCustomMessage(send({}), ctxWith()).ok).toBe(true);
    });

    it("refuses a body the codec cannot read", () => {
        const result = parseCustomMessage(send({amount: "5ubze"}), ctxWith());
        expect(result.ok).toBe(false);
    });

    it("is an entry whose validate and build agree", () => {
        const fields = {json: send()};
        expect(customEntry.validate(fields, ctxWith())).toBeUndefined();
        expect(customEntry.build(fields, ctxWith()).typeUrl).toBe(SEND);
        expect(customEntry.validate({json: ""}, ctxWith())).toMatch(/Paste the message/);
        expect(() => customEntry.build({json: "{"}, ctxWith())).toThrow();
        expect(customEntry.initialFields(ctxWith())).toEqual({json: ""});
    });

    it("shows a placeholder, not a value: an untouched editor is never a valid message", () => {
        expect(JSON.parse(customPlaceholder(DAO_ADDRESS))).toMatchObject({"@type": SEND, from_address: DAO_ADDRESS});
        expect(customEntry.validate({json: ""}, ctxWith())).toMatch(/Paste the message/);
    });

    describe("what is typed is what the chain would read", () => {
        const config = (over: Record<string, unknown> = {}) => ({
            min_quorum: "0.4", threshold: "0.5", voting_period: "259200000000000", allow_expedite: false, expedited_period: "0",
            expedite_quorum: "0", expedite_threshold: "0", open_submission: false, deposit_refund_policy: 2,
            cost_destination: 1, kept_deposit_destination: 0, ...over,
        });
        const update = (cfg: Record<string, unknown>) => JSON.stringify({"@type": "/bze.dao.MsgUpdateDaoConfig", authority: DAO_ADDRESS, dao_id: "4", config: cfg});

        it("an enum as a number reads back as typed", () => {
            const result = parseCustomMessage(update(config()), ctxWith());
            expect(result).toMatchObject({ok: true, json: {config: {deposit_refund_policy: 2}}});
        });

        it("an enum written as its name (the chain's REST form) is refused, never read as the zero value", () => {
            const result = parseCustomMessage(update(config({deposit_refund_policy: "NEVER"})), ctxWith());
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error).toMatch(/enums as numbers/);
        });

        it("a ratio typed as a decimal is the same number the chain reads", () => {
            expect(firstMismatch({r: "0.4"}, {r: "400000000000000000"})).toBeNull();
            expect(firstMismatch({r: "0.4"}, {r: "400000000000000001"})).toMatch(/"r" is "0.4"/);
            expect(parseCustomMessage(update(config({min_quorum: "400000000000000000"})), ctxWith()).ok).toBe(true);
        });

        it("a duration written in the REST form is refused with the way to write it", () => {
            const result = parseCustomMessage(update(config({voting_period: "259200s"})), ctxWith());
            expect(result).toEqual({ok: false, error: expect.stringContaining("durations as nanoseconds")});
        });

        it("a typo nested inside the message is refused too", () => {
            const result = parseCustomMessage(update(config({votng_period: "1s"})), ctxWith());
            expect(result).toEqual({ok: false, error: expect.stringContaining("config.votng_period")});
        });
    });

    describe("firstMismatch", () => {
        it("accepts what is there and what protobuf leaves out as a default", () => {
            expect(firstMismatch({a: "1", b: "", c: 0, d: false, e: [], f: null, g: {}}, {a: "1"})).toBeNull();
            expect(firstMismatch({n: 5}, {n: "5"})).toBeNull();
            expect(firstMismatch({list: [{x: "1"}]}, {list: [{x: "1"}]})).toBeNull();
        });
        it("names the first thing that differs", () => {
            expect(firstMismatch({a: "1"}, {a: "2"})).toBe('"a" is "1" but the chain would read "2"');
            expect(firstMismatch({a: "1"}, {})).toMatch(/"a" is not a field/);
            expect(firstMismatch({a: {b: "1"}}, {a: {}})).toMatch(/"a.b" is not a field/);
            expect(firstMismatch({l: [1, 2]}, {l: [1]})).toMatch(/l/);
            expect(firstMismatch({l: [{x: "1"}]}, {l: [{x: "9"}]})).toBe('"l[0].x" is "1" but the chain would read "9"');
        });
    });
});
