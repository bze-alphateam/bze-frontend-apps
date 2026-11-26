import {describe, expect, it} from "vitest";
import {packDaoMsgs} from "@bze/bze-ui-kit";
import {buildUpdateDaoConfigMsg, buildUpdateDaoMembersMsg} from "@bze/bze-ui-kit";
import {CONFIG, DAO, DAO_ADDRESS, OTHER} from "@/test/composer-fixtures";
import {payEntry} from "@/lib/actions/pay";
import {ctxWith} from "@/test/composer-fixtures";
import {describeBuilt, tryDescribe} from "./describe";

const fmt = (c: {denom: string; amount: string}) => `${c.amount} ${c.denom}`;

describe("describeBuilt", () => {
    it("reads a payment as the proposal page will: from the DAO, to the recipient, the exact amount", () => {
        const msg = payEntry.build({denom: "ubze", amount: "1.123456", to: OTHER}, ctxWith());
        expect(describeBuilt(msg, DAO, fmt)).toEqual({
            type: "send", from: DAO_ADDRESS, to: OTHER, amount: [{denom: "ubze", amount: "1123456"}], fromDao: true, subDao: null,
        });
    });

    it("reads a config update against the DAO's rules, with ratios and periods in words, not as codec integers", () => {
        const msg = buildUpdateDaoConfigMsg({daoAddress: DAO_ADDRESS, daoId: "4", config: {...CONFIG, min_quorum: "0.5", voting_period: "172800s", deposit_refund_policy: "NEVER"}});
        const action = describeBuilt(msg, DAO, fmt);
        expect(action).toMatchObject({type: "update_config", unchanged: false});
        if (action.type !== "update_config") return;
        expect(action.changes.map((c) => [c.field, c.before, c.after])).toEqual([
            ["min_quorum", "40%", "50%"],
            ["voting_period", "3 days", "2 days"],
            ["deposit_refund_policy", "refunded only when the proposal passes", "never refunded"],
        ]);
    });

    it("reads a member change", () => {
        const msg = buildUpdateDaoMembersMsg({daoAddress: DAO_ADDRESS, daoId: "4", add: [OTHER]});
        expect(describeBuilt(msg, DAO, fmt)).toEqual({type: "update_members", add: [OTHER], remove: []});
    });

    it("tryDescribe reports a message it cannot read back instead of throwing", () => {
        expect(tryDescribe({typeUrl: "/nope.Msg", value: {}}, DAO, fmt)).toEqual({ok: false, error: expect.stringContaining("no decoder")});
        const ok = tryDescribe(payEntry.build({denom: "ubze", amount: "1", to: OTHER}, ctxWith()), DAO, fmt);
        expect(ok.ok).toBe(true);
        expect(packDaoMsgs([payEntry.build({denom: "ubze", amount: "1", to: OTHER}, ctxWith())])).toHaveLength(1);
    });
});
