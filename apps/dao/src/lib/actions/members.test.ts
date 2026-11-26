import {describe, expect, it} from "vitest";
import {packDaoMsgs} from "@bze/bze-ui-kit";
import {tryDescribe} from "../propose/describe";
import {ctxWith, DAO, DAO_ADDRESS, FOURTH, FIFTH, OTHER, PARAMS, STAKE_DAO, THIRD, WALLET} from "@/test/composer-fixtures";
import {membersEntry} from "./members";

// DAO members: WALLET and OTHER
const fields = (over: Record<string, string> = {}) => ({add: THIRD, remove: "", ...over});

describe("the members action", () => {
    it("is offered to a member-list DAO only", () => {
        expect(membersEntry.available(DAO)).toBe(true);
        expect(membersEntry.available(STAKE_DAO)).toBe(false);
        expect(membersEntry.validate(fields(), ctxWith({dao: STAKE_DAO}))).toMatch(/votes with stake/);
    });

    it("builds an update signed by the DAO, with the lists in lowercase", () => {
        const msg = membersEntry.build(fields({add: `${THIRD.toUpperCase()}\n${FOURTH}`, remove: WALLET}), ctxWith());
        expect(msg.typeUrl).toBe("/bze.dao.MsgUpdateMembers");
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 4n, add: [THIRD, FOURTH], remove: [WALLET]});
        expect(packDaoMsgs([msg])).toHaveLength(1);
    });

    it("needs at least one change", () => {
        expect(membersEntry.validate({add: "", remove: ""}, ctxWith())).toMatch(/at least one member/);
    });

    it.each([
        [{add: "cosmos1abc"}, /not a valid address/],
        [{add: `${THIRD} ${THIRD.toUpperCase()}`}, /twice/],
        [{add: THIRD, remove: THIRD}, /not a member|both added and removed/],
        [{add: WALLET}, /already a member/],
        [{add: DAO_ADDRESS}, /member of itself/],
        [{add: "", remove: FOURTH}, /is not a member/],
        [{add: "", remove: "bad"}, /not a valid address/],
    ])("refuses %j", (over, message) => {
        expect(membersEntry.validate(fields(over), ctxWith())).toMatch(message);
    });

    it("refuses an address that is both added and removed, in any letter case", () => {
        const dao = {...DAO, members: [WALLET, OTHER, THIRD]};
        expect(membersEntry.validate({add: THIRD.toUpperCase(), remove: THIRD}, ctxWith({dao}))).toMatch(/both added and removed/);
    });

    it("keeps between 1 and max_static_members members", () => {
        expect(membersEntry.validate({add: "", remove: `${WALLET}\n${OTHER}`}, ctxWith())).toMatch(/at least one member/);
        expect(membersEntry.validate({add: "", remove: WALLET}, ctxWith())).toBeUndefined();
        const params = {...PARAMS, max_static_members: "3"};
        expect(membersEntry.validate({add: `${THIRD}`, remove: ""}, ctxWith({params}))).toBeUndefined();
        expect(membersEntry.validate({add: `${THIRD} ${FOURTH}`, remove: ""}, ctxWith({params}))).toMatch(/at most 3 members \(it would have 4\)/);
        expect(membersEntry.validate({add: `${THIRD} ${FOURTH}`, remove: OTHER}, ctxWith({params}))).toBeUndefined();
    });

    it("explains what an addition and a removal do", () => {
        const text = membersEntry.warnings?.(fields({remove: WALLET}), ctxWith()).join(" ") ?? "";
        expect(text).toMatch(/votes on proposals still in voting drop to 0/);
        expect(text).toMatch(/only on proposals submitted after/);
    });

    it("is read back with the addresses to add and remove", () => {
        const read = tryDescribe(membersEntry.build(fields({remove: WALLET}), ctxWith()), DAO, (c) => c.amount);
        expect(read).toEqual({ok: true, action: {type: "update_members", add: [THIRD], remove: [WALLET]}});
    });

    it("never needs FIFTH to be known: an unrelated address is just an address", () => {
        expect(membersEntry.validate({add: FIFTH, remove: ""}, ctxWith())).toBeUndefined();
    });
});
