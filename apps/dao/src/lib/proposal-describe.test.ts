import {describe, expect, it} from "vitest";
import type {DaoCoin, DaoProposalMessage} from "@bze/bze-ui-kit";
import {configValueText, describeMessage, describeMessages, MAX_NESTING, titleOfType, type DescribeContext} from "./proposal-describe";
import {CONFIG} from "@/test/proposal-fixtures";

const fmt = (c: DaoCoin) => `${Number(c.amount) / 1e6} ${c.denom === "ubze" ? "BZE" : c.denom}`;
const ctx: DescribeContext = {daoAddress: "bze1dao", before: CONFIG, formatCoin: fmt};
const msg = (type: string, rest: Record<string, unknown> = {}): DaoProposalMessage => ({"@type": type, ...rest});

describe("describeMessage", () => {
    it("a bank send from the DAO, and one from someone else", () => {
        const body = {to_address: "bze1to", amount: [{denom: "ubze", amount: "2500000"}]};
        expect(describeMessage(msg("/cosmos.bank.v1beta1.MsgSend", {from_address: "bze1dao", ...body}), ctx))
            .toEqual({type: "send", from: "bze1dao", to: "bze1to", amount: [{denom: "ubze", amount: "2500000"}], fromDao: true, subDao: null});
        expect(describeMessage(msg("/cosmos.bank.v1beta1.MsgSend", {from_address: "bze1other", ...body}), ctx)).toMatchObject({fromDao: false});
    });

    it("a config update lists only the fields that differ from the rules pinned at submission", () => {
        const action = describeMessage(msg("/bze.dao.MsgUpdateDaoConfig", {
            dao_id: "4",
            config: {...CONFIG, min_quorum: "0.5", voting_period: "172800s", proposal_deposit: {denom: "ubze", amount: "0"}, expedite_quorum: "0.6"},
        }), ctx);
        expect(action).toEqual({
            type: "update_config",
            unchanged: false,
            changes: [
                {field: "min_quorum", label: "quorum", before: "40%", after: "50%"},
                {field: "voting_period", label: "voting period", before: "3 days", after: "2 days"},
                {field: "proposal_deposit", label: "proposal deposit", before: "9 BZE", after: "None"},
            ],
        });
    });

    it("reads the camelCase spelling and duration objects too", () => {
        const action = describeMessage(msg("/bze.dao.MsgUpdateDaoConfig", {config: {...CONFIG, votingPeriod: {seconds: "172800"}, voting_period: undefined}}), {...ctx, before: null});
        expect(action).toMatchObject({type: "update_config", changes: expect.arrayContaining([expect.objectContaining({field: "voting_period", before: null, after: "2 days"})])});
    });

    it("a config update that changes nothing says so", () => {
        expect(describeMessage(msg("/bze.dao.MsgUpdateDaoConfig", {config: CONFIG}), ctx)).toMatchObject({type: "update_config", unchanged: true, changes: []});
    });

    it("metadata, members and electorate", () => {
        expect(describeMessage(msg("/bze.dao.MsgUpdateMetadata", {name: "New", description: "Text"}), ctx)).toEqual({type: "update_metadata", name: "New", description: "Text"});
        expect(describeMessage(msg("/bze.dao.MsgUpdateMembers", {add: ["bze1a"], remove: ["bze1b", "bze1c"]}), ctx)).toEqual({type: "update_members", add: ["bze1a"], remove: ["bze1b", "bze1c"]});
        expect(describeMessage(msg("/bze.dao.MsgUpdateElectorate", {electorate: {sr_ids: ["000000000017"], dr_denom: "ulmn"}}), ctx)).toEqual({type: "update_electorate", srIds: ["000000000017"], drDenom: "ulmn"});
        expect(describeMessage(msg("/bze.dao.MsgUpdateElectorate", {}), ctx)).toEqual({type: "update_electorate", srIds: [], drDenom: ""});
    });

    it("an admin nomination, an empty nominee handing the DAO to its voters, the withdrawal and the acceptance", () => {
        expect(describeMessage(msg("/bze.dao.MsgNominateAdmin", {nominee: "bze1next"}), ctx)).toEqual({type: "nominate_admin", daoId: "", nominee: "bze1next", toVoters: false});
        expect(describeMessage(msg("/bze.dao.MsgNominateAdmin", {nominee: ""}), ctx)).toEqual({type: "nominate_admin", daoId: "", nominee: "", toVoters: true});
        expect(describeMessage(msg("/bze.dao.MsgWithdrawAdminNomination", {}), ctx)).toEqual({type: "withdraw_nomination", daoId: ""});
        expect(describeMessage(msg("/bze.dao.MsgAcceptAdminNomination", {nominee: "bze1next"}), ctx)).toEqual({type: "accept_admin", daoId: "", nominee: "bze1next"});
    });

    it("an admin execute describes its inner messages as the sub-DAO's, not this DAO's", () => {
        const inner = msg("/cosmos.bank.v1beta1.MsgSend", {from_address: "bze1dao", to_address: "bze1to", amount: []});
        const action = describeMessage(msg("/bze.dao.MsgAdminExecute", {dao_id: "9", msgs: [inner]}), ctx);
        expect(action).toMatchObject({type: "admin_execute", daoId: "9", actions: [{type: "send", fromDao: false}]});
    });

    it("a send inside an admin execute is the sub-DAO's own: named as such, not flagged as a foreign account", () => {
        const inner = msg("/cosmos.bank.v1beta1.MsgSend", {from_address: "bze1subdao", to_address: "bze1to", amount: []});
        const action = describeMessage(msg("/bze.dao.MsgAdminExecute", {dao_id: "9", msgs: [inner]}), ctx);
        expect(action).toMatchObject({type: "admin_execute", actions: [{type: "send", from: "bze1subdao", fromDao: false, subDao: "9"}]});
    });

    it("matches the full type URL: a look-alike from another package is raw, not a send or a rename", () => {
        expect(describeMessage(msg("/evil.pkg.MsgSend", {from_address: "bze1dao", to_address: "bze1x", amount: []}), ctx).type).toBe("other");
        expect(describeMessage(msg("/other.MsgUpdateMetadata", {name: "x"}), ctx).type).toBe("other");
    });

    it("a field the config leaves out is its default: no 'Off to Off' lines", () => {
        const before = {...CONFIG, allow_expedite: false, expedited_period: "0s", expedite_quorum: "0", expedite_threshold: "0", proposal_cost: null, proposal_deposit: null, deposit_refund_policy: "ALWAYS" as const, cost_destination: "BURN" as const, kept_deposit_destination: "BURN" as const};
        const sparse = {min_quorum: "0.4", threshold: "0.5", voting_period: "259200s", open_submission: false};
        expect(describeMessage(msg("/bze.dao.MsgUpdateDaoConfig", {config: sparse}), {...ctx, before})).toMatchObject({type: "update_config", unchanged: true, changes: []});
        const changed = describeMessage(msg("/bze.dao.MsgUpdateDaoConfig", {config: {...sparse, allow_expedite: true}}), {...ctx, before});
        expect(changed).toMatchObject({changes: [{field: "allow_expedite", before: "Off", after: "On"}]});
    });

    it("stops reading nested admin executes at the cap and shows them raw", () => {
        let nested = msg("/bze.dao.MsgUpdateMetadata", {name: "deep"});
        for (let i = 0; i < MAX_NESTING + 2; i++) nested = msg("/bze.dao.MsgAdminExecute", {dao_id: String(i), msgs: [nested]});
        let action = describeMessage(nested, ctx);
        let depth = 0;
        while (action.type === "admin_execute") {
            depth += 1;
            action = action.actions[0];
        }
        expect(depth).toBe(MAX_NESTING - 1);
        expect(action.type).toBe("other");
    });

    it("anything else is a raw block with its type and JSON", () => {
        const action = describeMessage(msg("/cosmos.staking.v1beta1.MsgDelegate", {amount: {denom: "ubze", amount: "1"}}), ctx);
        expect(action).toMatchObject({type: "other", typeUrl: "/cosmos.staking.v1beta1.MsgDelegate", title: "Delegate"});
        expect(action.type === "other" && JSON.parse(action.json)).toEqual({"@type": "/cosmos.staking.v1beta1.MsgDelegate", amount: {denom: "ubze", amount: "1"}});
    });

    it("malformed fields never throw", () => {
        expect(describeMessage(msg("/cosmos.bank.v1beta1.MsgSend", {amount: "lots", to_address: 5}), ctx)).toMatchObject({type: "send", amount: [], to: "5"});
        expect(describeMessage(msg("/bze.dao.MsgUpdateMembers", {add: "bze1a"}), ctx)).toEqual({type: "update_members", add: [], remove: []});
    });
});

describe("describeMessages", () => {
    it("a text-only proposal has no actions", () => {
        expect(describeMessages([], ctx)).toEqual([]);
    });
});

describe("config text", () => {
    it("says each value the way the rules panel does", () => {
        expect(configValueText("threshold", "0.333333333333333333", fmt)).toBe("33.34%");
        expect(configValueText("allow_expedite", true, fmt)).toBe("On");
        expect(configValueText("open_submission", false, fmt)).toBe("Members or voters only");
        expect(configValueText("deposit_refund_policy", "NEVER", fmt)).toBe("never refunded");
        expect(configValueText("kept_deposit_destination", "BURN", fmt)).toBe("burned");
        expect(configValueText("proposal_cost", null, fmt)).toBe("None");
    });
});

describe("titleOfType", () => {
    it("turns a type URL into words", () => {
        expect(titleOfType("/cosmos.bank.v1beta1.MsgMultiSend")).toBe("Multi send");
        expect(titleOfType("")).toBe("Unknown action");
    });
});
