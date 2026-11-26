import {describe, expect, it} from "vitest";
import {tryDescribe} from "../propose/describe";
import {ctxWith, DAO, DAO_ADDRESS, OTHER, PARAMS, SUB_ADDRESS, SUB_DAO, THIRD} from "@/test/composer-fixtures";
import {findAction} from "./registry";
import {innerFromField, innerToField, subAdminEntry, subContext, SUB_ADMIN_ID, SUB_EXECUTE_ID} from "./sub-dao";
import type {ActionContext, SubDao} from "./types";

const ctx = (over: Partial<ActionContext> = {}) => ctxWith({subDaos: [SUB_DAO], ...over});
const execute = findAction(SUB_EXECUTE_ID)!;
const withSub = (over: Partial<SubDao["dao"]>): SubDao => ({...SUB_DAO, dao: {...SUB_DAO.dao, ...over}});

describe("the admin of a sub-DAO", () => {
    const fields = (over: Record<string, string> = {}) => ({daoId: "7", mode: "nominate", nominee: THIRD, ...over});

    it("starts on the first sub-DAO, nominating", () => {
        expect(subAdminEntry.initialFields(ctx())).toEqual({daoId: "7", mode: "nominate", nominee: ""});
        expect(subAdminEntry.initialFields(ctxWith({subDaos: null}))).toMatchObject({daoId: ""});
    });

    it("nominates: this DAO signs as the sub-DAO's admin, for the sub-DAO", () => {
        const msg = subAdminEntry.build(fields({nominee: ` ${THIRD.toUpperCase()} `}), ctx());
        expect(msg.typeUrl).toBe("/bze.dao.MsgNominateAdmin");
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 7n, nominee: THIRD});
        expect(tryDescribe(msg, DAO, (c) => c.amount)).toEqual({ok: true, action: {type: "nominate_admin", daoId: "7", nominee: THIRD, toVoters: false}});
    });

    it("hands the sub-DAO to its voters with an empty nominee", () => {
        const msg = subAdminEntry.build(fields({mode: "voters", nominee: ""}), ctx());
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 7n, nominee: ""});
        expect(tryDescribe(msg, DAO, (c) => c.amount)).toMatchObject({ok: true, action: {type: "nominate_admin", daoId: "7", toVoters: true}});
    });

    it("withdraws a pending nomination of the sub-DAO", () => {
        const c = ctx({subDaos: [withSub({pending_admin: OTHER})]});
        const msg = subAdminEntry.build(fields({mode: "withdraw"}), c);
        expect(msg.typeUrl).toBe("/bze.dao.MsgWithdrawAdminNomination");
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 7n});
        expect(tryDescribe(msg, DAO, (x) => x.amount)).toEqual({ok: true, action: {type: "withdraw_nomination", daoId: "7"}});
    });

    it.each([
        [{daoId: "99"}, /Choose one of the DAOs/],
        [{mode: "dance"}, /Choose what to do/],
        [{nominee: ""}, /Enter the address/],
        [{nominee: "nope"}, /not a valid BeeZee address/],
        [{nominee: SUB_ADDRESS}, /cannot nominate itself/],
        [{nominee: DAO_ADDRESS}, /already the admin/],
        [{mode: "withdraw"}, /no pending nomination/],
    ])("refuses %j", (over, message) => {
        expect(subAdminEntry.validate(fields(over), ctx())).toMatch(message);
    });

    it("refuses a sub-DAO this DAO no longer administers, and says when the list could not be read", () => {
        expect(subAdminEntry.validate(fields(), ctx({subDaos: [withSub({admin: OTHER})]}))).toMatch(/no longer administered/);
        expect(subAdminEntry.validate(fields(), ctxWith({subDaos: null}))).toMatch(/could not be read/);
    });

    it("hands over to voters only when the sub-DAO has some", () => {
        const stake = withSub({type: "DAO_TYPE_STAKE", members: [], electorate: {sr_ids: [], dr_denom: ""}});
        expect(subAdminEntry.validate(fields({mode: "voters"}), ctx({subDaos: [stake]}))).toMatch(/no voters to hand it to/);
        const live = withSub({type: "DAO_TYPE_STAKE", members: [], electorate: {sr_ids: ["1"], dr_denom: ""}});
        const opt = (own: string) => [{kind: "sr" as const, id: "1", stakingDenom: "ulmn", lock: 7, staked: "100", own}];
        const liveSub = (own: string | null): SubDao => ({...SUB_DAO, dao: live.dao, sources: own === null ? null : opt(own)});
        expect(subAdminEntry.validate(fields({mode: "voters"}), ctx({subDaos: [liveSub("0")]}))).toBeUndefined();
        // the sub-DAO's own stake never votes: sources that only it staked in are no electorate (1113)
        expect(subAdminEntry.validate(fields({mode: "voters"}), ctx({subDaos: [liveSub("100")]}))).toMatch(/no voters to hand it to/);
        expect(subAdminEntry.validate(fields({mode: "voters"}), ctx({subDaos: [liveSub(null)]}))).toMatch(/could not be read/);
        expect(subAdminEntry.validate(fields({mode: "voters"}), ctx({subDaos: [{...liveSub("0"), sources: []}]}))).toMatch(/could not be read/);
    });

    it("warns when a nomination is already pending, and what handing over means", () => {
        const c = ctx({subDaos: [withSub({pending_admin: OTHER})]});
        expect(subAdminEntry.warnings?.(fields(), c).join(" ")).toMatch(/already has a pending nomination/);
        expect(subAdminEntry.warnings?.(fields({mode: "voters", nominee: ""}), ctx()).join(" ")).toMatch(/becomes self-owned/);
        expect(subAdminEntry.id).toBe(SUB_ADMIN_ID);
    });
});

describe("the context of a sub-DAO's actions", () => {
    it("is the sub-DAO: its address signs and its treasury pays, and it has no relations of its own", () => {
        const sub = subContext(ctx(), SUB_DAO);
        expect(sub.dao.address).toBe(SUB_ADDRESS);
        expect(sub.treasury).toEqual(SUB_DAO.treasury);
        expect(sub.subDaos).toEqual([]);
        expect(sub.incoming).toEqual([]);
        expect(sub.params).toBe(PARAMS);
    });

    it("uses the sub-DAO's own sources and its own stake in them, not the parent's", () => {
        const own = [{kind: "sr" as const, id: "5", stakingDenom: "ulmn", lock: 7, staked: "100", own: "40"}];
        const parent = [{kind: "sr" as const, id: "9", stakingDenom: "ulmn", lock: 7, staked: "999", own: "0"}];
        expect(subContext(ctx({sources: parent}), {...SUB_DAO, sources: own}).sources).toEqual(own);
        expect(subContext(ctx({sources: parent}), {...SUB_DAO, sources: null}).sources).toBeNull();
    });
});

describe("run actions as a sub-DAO", () => {
    const inner = (...items: {type: string; fields: Record<string, string>}[]) => innerToField(items);
    const pay = (over: Record<string, string> = {}) => ({type: "pay", fields: {denom: "ubze", amount: "12.5", to: OTHER, ...over}});
    const fields = (text: string, daoId = "7") => ({daoId, inner: text});

    it("starts empty on the first sub-DAO", () => {
        expect(execute.initialFields(ctx())).toEqual({daoId: "7", inner: ""});
    });

    it("builds an admin execute that this DAO signs, whose inner actions are signed by the sub-DAO", () => {
        const msg = execute.build(fields(inner(pay())), ctx());
        expect(msg.typeUrl).toBe("/bze.dao.MsgAdminExecute");
        expect(msg.value).toMatchObject({admin: DAO_ADDRESS, daoId: 7n});
        const read = tryDescribe(msg, DAO, (c) => `${c.amount} ${c.denom}`);
        expect(read).toMatchObject({ok: true, action: {type: "admin_execute", daoId: "7", actions: [{type: "send", from: SUB_ADDRESS, to: OTHER, subDao: "7", amount: [{denom: "ubze", amount: "12500000"}]}]}});
    });

    it("pays from the sub-DAO's treasury: the token must be one it holds", () => {
        expect(execute.validate(fields(inner(pay({denom: "factory/bze1x/ulmn"}))), ctx())).toMatch(/Action 1: Choose a token the treasury holds/);
        expect(execute.validate(fields(inner(pay())), ctxWith({subDaos: [{...SUB_DAO, treasury: null}]}))).toMatch(/treasury could not be read/);
    });

    it("shows a rules change of the sub-DAO before and after, against the sub-DAO's own rules", () => {
        const rules = findAction("update-rules")!;
        const sub = subContext(ctx(), SUB_DAO);
        const edited = {...rules.initialFields(sub), quorumPct: "45"};
        const msg = execute.build(fields(inner({type: "update-rules", fields: edited})), ctx());
        const read = tryDescribe(msg, DAO, (c) => c.amount, [SUB_DAO]);
        expect(read).toMatchObject({ok: true, action: {type: "admin_execute", actions: [{type: "update_config", changes: [{field: "min_quorum", before: "40%", after: "45%"}]}]}});
    });

    it("lists the members the sub-DAO has: an added one must not be a member yet", () => {
        const members = findAction("update-members")!;
        expect(execute.validate(fields(inner({type: "update-members", fields: {add: DAO.members[0], remove: ""}})), ctx())).toMatch(/Action 1: .* is already a member/);
        expect(execute.validate(fields(inner({type: "update-members", fields: {add: THIRD, remove: ""}})), ctx())).toBeUndefined();
        expect(members.id).toBe("update-members");
    });

    it("needs at least one action, and at most max_msgs_per_proposal", () => {
        expect(execute.validate(fields(""), ctx())).toBe("Add at least one action.");
        const params = {...PARAMS, max_msgs_per_proposal: "2"};
        expect(execute.validate(fields(inner(pay(), pay())), ctx({params}))).toBeUndefined();
        expect(execute.validate(fields(inner(pay(), pay(), pay())), ctx({params}))).toMatch(/At most 2 actions can run at once \(there are 3\)/);
    });

    it("keeps the actions within max_proposal_bytes", () => {
        const params = {...PARAMS, max_proposal_bytes: "120"};
        expect(execute.validate(fields(inner(pay(), pay(), pay())), ctx({params}))).toMatch(/bytes, at most 120 are allowed/);
    });

    const custom = (message: Record<string, unknown>) => ({type: "custom", fields: {json: JSON.stringify(message)}});

    it.each([
        ["an authz grant", {"@type": "/cosmos.authz.v1beta1.MsgGrant", granter: SUB_ADDRESS, grantee: OTHER}, /MsgGrant/],
        ["a fee allowance", {"@type": "/cosmos.feegrant.v1beta1.MsgGrantAllowance", granter: SUB_ADDRESS, grantee: OTHER}, /MsgGrantAllowance/],
        ["an authz exec", {"@type": "/cosmos.authz.v1beta1.MsgExec", grantee: SUB_ADDRESS, msgs: []}, /MsgExec/],
    ])("refuses %s through the admin (1133)", (_name, message, pattern) => {
        const problem = execute.validate(fields(inner(custom(message))), ctx());
        expect(problem).toMatch(/error 1133/);
        expect(problem).toMatch(pattern);
    });

    it("refuses a settle message, also inside an authz exec", () => {
        const settle = {"@type": "/bze.dao.MsgSettleProposal", sender: SUB_ADDRESS, proposal_id: "3"};
        expect(execute.validate(fields(inner(custom(settle))), ctx())).toMatch(/settle/i);
        const exec = {"@type": "/cosmos.authz.v1beta1.MsgExec", grantee: SUB_ADDRESS, msgs: [settle]};
        expect(execute.validate(fields(inner(custom(exec))), ctx())).toMatch(/settle/i);
    });

    it("refuses an inner message signed by anyone but the sub-DAO", () => {
        const send = {"@type": "/cosmos.bank.v1beta1.MsgSend", from_address: DAO_ADDRESS, to_address: OTHER, amount: [{denom: "ubze", amount: "1"}]};
        expect(execute.validate(fields(inner(custom(send))), ctx())).toMatch(/must be signed by the DAO only/);
    });

    it("refuses a sub-DAO that owns itself, and one that is not in the list", () => {
        expect(execute.validate(fields(inner(pay())), ctx({subDaos: [withSub({admin: SUB_ADDRESS})]}))).toMatch(/no longer administered|owns itself/);
        expect(execute.validate(fields(inner(pay()), "99"), ctx())).toMatch(/Choose one of the DAOs/);
    });

    it("offers inside only what the sub-DAO can do: no handover, no sub-DAOs of its own", () => {
        const text = inner({type: "nominate-admin", fields: {nominee: OTHER}});
        expect(execute.validate(fields(text), ctx())).toMatch(/Action 1 is not available for Garden club/);
        const nested = inner({type: SUB_EXECUTE_ID, fields: {daoId: "7", inner: ""}});
        expect(execute.validate(fields(nested), ctx())).toMatch(/Action 1 is not available/);
        expect(execute.validate(fields(inner({type: "no-such", fields: {}})), ctx())).toMatch(/not available/);
    });

    it("refuses a stored field that is not a list of actions with text fields", () => {
        for (const text of ["{", "{}", "[1]", '[{"type":1,"fields":{}}]', '[{"type":"pay","fields":{"a":1}}]', '[{"type":"pay"}]', JSON.stringify(Array.from({length: 65}, () => ({type: "pay", fields: {}})))]) {
            expect(typeof innerFromField(text)).toBe("string");
            expect(execute.validate(fields(text), ctx())).toMatch(/saved actions could not be read/);
        }
        expect(innerFromField("")).toEqual([]);
    });

    it("reads a stored field back with stable row ids", () => {
        const drafts = innerFromField(inner(pay(), pay({amount: "3"})));
        expect(drafts).toMatchObject([{key: "inner0", type: "pay"}, {key: "inner1", type: "pay"}]);
    });

    it("warns about the nesting limit and carries the inner warnings", () => {
        const text = execute.warnings?.(fields(inner(pay({amount: "9999"}))), ctx()).join(" ") ?? "";
        expect(text).toMatch(/Action 1: The treasury holds less than this today/);
        expect(text).toMatch(/at most 5 levels deep \(error 1134\)/);
    });
});
