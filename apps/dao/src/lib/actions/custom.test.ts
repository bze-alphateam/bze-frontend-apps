import {describe, expect, it} from "vitest";
import {packDaoMsgs} from "@bze/bze-ui-kit";
import {ctxWith, DAO, DAO_ADDRESS, OTHER, WALLET} from "@/test/composer-fixtures";
import {customEntry, customExample, MAX_CUSTOM_JSON_CHARS, parseCustomMessage} from "./custom";

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
        expect(result).toEqual({ok: false, error: expect.stringMatching(/no field "toAddress", "memo_text"/)});
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

    it("offers an example with the DAO as the signer", () => {
        expect(JSON.parse(customExample(DAO_ADDRESS))).toMatchObject({"@type": SEND, from_address: DAO_ADDRESS});
    });
});
