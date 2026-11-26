import {describe, expect, it} from "vitest";
import type {EncodeObject} from "@bze/bzejs/types";
import {buildAcceptAdminNominationMsg, buildAdminExecuteMsg, buildUpdateDaoMetadataMsg} from "@bze/bze-ui-kit";
import {DAO_ADDRESS, OTHER, SUB_ADDRESS} from "@/test/composer-fixtures";
import {ADMIN_EXECUTE_TYPE, inspectExecution, MAX_EXECUTION_DEPTH} from "./execution";

const send = (): EncodeObject => ({
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: {fromAddress: DAO_ADDRESS, toAddress: OTHER, amount: [{denom: "ubze", amount: "5"}]},
});
const rename = (): EncodeObject => buildUpdateDaoMetadataMsg({daoAddress: DAO_ADDRESS, daoId: "4", name: "x", description: ""});
const grant = (): EncodeObject => ({
    typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
    value: {granter: DAO_ADDRESS, grantee: OTHER, grant: {authorization: {typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization", value: new Uint8Array()}}},
});
const exec = (...msgs: EncodeObject[]): EncodeObject => buildAdminExecuteMsg({admin: DAO_ADDRESS, daoId: "7", msgs});
const nest = (levels: number, inner: EncodeObject = send()): EncodeObject => (levels === 0 ? inner : exec(nest(levels - 1, inner)));

describe("inspectExecution", () => {
    it("a plain list runs one execution deep", () => {
        expect(inspectExecution([send(), rename(), buildAcceptAdminNominationMsg({nominee: DAO_ADDRESS, daoId: "9"})])).toEqual({ok: true, depth: 1});
    });

    it("counts the admin executes nested inside each other, along the deepest branch", () => {
        expect(inspectExecution([nest(1)])).toEqual({ok: true, depth: 2});
        expect(inspectExecution([send(), nest(3), nest(1)])).toEqual({ok: true, depth: 4});
        expect(MAX_EXECUTION_DEPTH).toBe(5);
        expect(inspectExecution([nest(MAX_EXECUTION_DEPTH - 1)])).toEqual({ok: true, depth: MAX_EXECUTION_DEPTH});
        expect(inspectExecution([nest(MAX_EXECUTION_DEPTH)])).toEqual({ok: true, depth: MAX_EXECUTION_DEPTH + 1});
    });

    it.each([
        ["an authz grant", () => grant(), /MsgGrant.*1133/],
        ["an authz exec", (): EncodeObject => ({typeUrl: "/cosmos.authz.v1beta1.MsgExec", value: {grantee: DAO_ADDRESS, msgs: []}}), /MsgExec.*1133/],
        ["a fee allowance", (): EncodeObject => ({typeUrl: "/cosmos.feegrant.v1beta1.MsgGrantAllowance", value: {granter: DAO_ADDRESS, grantee: OTHER}}), /MsgGrantAllowance.*1133/],
        ["a settle message", (): EncodeObject => ({typeUrl: "/bze.dao.MsgSettleProposal", value: {sender: DAO_ADDRESS, proposalId: 3n}}), /settle message/],
    ])("refuses %s, at the top and inside a nested admin execute", (_name, make, message) => {
        const top = inspectExecution([send(), make()]);
        expect(top).toMatchObject({ok: false, index: 1, error: expect.stringMatching(message)});
        const nested = inspectExecution([nest(1, make())]);
        expect(nested).toMatchObject({ok: false, index: 0, error: expect.stringMatching(/message 1 inside it/)});
        expect(nested.ok === false && nested.error).toMatch(message);
    });

    it("a message it cannot read back is an error, never skipped", () => {
        expect(inspectExecution([{typeUrl: "/not.a.Type", value: {}}])).toMatchObject({ok: false, index: 0, error: expect.stringMatching(/could not be read back/)});
    });

    it("knows the type it counts", () => {
        expect(ADMIN_EXECUTE_TYPE).toBe(exec(send()).typeUrl);
        expect(SUB_ADDRESS).toBeTruthy();
    });
});
