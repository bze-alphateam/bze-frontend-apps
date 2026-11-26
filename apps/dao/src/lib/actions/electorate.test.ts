import {describe, expect, it} from "vitest";
import {tryDescribe} from "../propose/describe";
import {ctxWith, DAO_ADDRESS, PARAMS, STAKE_DAO} from "@/test/composer-fixtures";
import {electorateEntry, votingStake} from "./electorate";
import type {ElectorateOption} from "./types";

const sr = (id: string, over: Partial<ElectorateOption> = {}): ElectorateOption => ({kind: "sr", id, stakingDenom: "ulmn", lock: 7, staked: "1000", own: "0", ...over});
const dr = (over: Partial<ElectorateOption> = {}): ElectorateOption => ({kind: "dr", id: "ulmn", stakingDenom: "ulmn", lock: 7, staked: "500", own: "0", ...over});

// STAKE_DAO votes with staking reward 000000000017 and is self-owned
const stakeDao = {...STAKE_DAO, electorate: {sr_ids: ["000000000017"], dr_denom: ""}};
const ctx = (over: Parameters<typeof ctxWith>[0] = {}) => ctxWith({
    dao: stakeDao,
    sources: [sr("000000000017", {lock: 2}), sr("000000000018"), sr("000000000019", {lock: 4}), sr("000000000020", {stakingDenom: "uother"}), dr()],
    ...over,
});
const fields = (srIds: string, drDenom = "") => ({srIds, drDenom});

describe("the voters action", () => {
    it("is offered to a stake DAO only, and starts from the current sources", () => {
        expect(electorateEntry.available(stakeDao)).toBe(true);
        expect(electorateEntry.available({...stakeDao, type: "DAO_TYPE_STATIC_LIST"})).toBe(false);
        expect(electorateEntry.initialFields(ctx())).toEqual({srIds: "000000000017", drDenom: ""});
        expect(electorateEntry.validate(fields("000000000018"), ctxWith())).toMatch(/member list/);
    });

    it("builds the whole new electorate, signed by the DAO", () => {
        const c = ctx();
        const msg = electorateEntry.build(fields("000000000017,000000000018", "ulmn"), c);
        expect(msg.typeUrl).toBe("/bze.dao.MsgUpdateElectorate");
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 4n, electorate: {srIds: ["000000000017", "000000000018"], drDenom: "ulmn"}});
        expect(tryDescribe(msg, stakeDao, (x) => x.amount)).toEqual({ok: true, action: {type: "update_electorate", srIds: ["000000000017", "000000000018"], drDenom: "ulmn"}});
    });

    it("says when the sources could not be read, never treating that as none", () => {
        expect(electorateEntry.validate(fields("000000000018"), ctx({sources: null}))).toMatch(/could not be read/);
    });

    it("keeps a source the DAO has even though its lock is below the minimum, and refuses to add one that short", () => {
        // 000000000017 has a 2-day lock (minimum 5): it stays valid, 000000000019 (4 days) cannot be added
        expect(electorateEntry.validate(fields("000000000017,000000000018"), ctx())).toBeUndefined();
        expect(electorateEntry.validate(fields("000000000017,000000000019"), ctx())).toMatch(/4-day unstaking lock: at least 5 days are required/);
    });

    it("accepts an added source whose lock is exactly the minimum", () => {
        expect(electorateEntry.validate(fields("000000000017", ""), ctx({sources: [sr("000000000017"), sr("000000000021", {lock: 5})]}))).toMatch(/same voters/);
        expect(electorateEntry.validate(fields("000000000021"), ctx({sources: [sr("000000000017"), sr("000000000021", {lock: 5})]}))).toBeUndefined();
        expect(electorateEntry.validate(fields("000000000021"), ctx({sources: [sr("000000000017"), sr("000000000021", {lock: 4})]}))).toMatch(/4-day unstaking lock/);
    });

    it.each([
        [fields("000000000018,000000000018"), /listed twice/],
        [fields("000000000018,000000000020"), /not .*Simple reward #20|stakes UMLN|must stake the same token/i],
        [fields("000000000099"), /was not found/],
        [fields("000000000018", "uzzz"), /was not found/],
        [fields("000000000017", ""), /same voters/],
    ])("refuses %j", (f, message) => {
        expect(electorateEntry.validate(f, ctx())).toMatch(message);
    });

    it("allows at most max_sr_per_dao staking rewards", () => {
        const many = Array.from({length: 6}, (_, i) => sr(`0000000000${30 + i}`));
        const c = ctx({sources: many, params: {...PARAMS, max_sr_per_dao: "5"}});
        expect(electorateEntry.validate(fields(many.slice(0, 5).map((s) => s.id).join(",")), c)).toBeUndefined();
        expect(electorateEntry.validate(fields(many.map((s) => s.id).join(",")), c)).toMatch(/at most 5 staking rewards/);
    });

    it("a self-owned DAO must keep voters: the DAO's own stake never counts", () => {
        const c = ctx({sources: [sr("000000000017"), sr("000000000018", {staked: "100", own: "100"}), sr("000000000019", {lock: 9, staked: "100", own: "40"})]});
        expect(electorateEntry.validate(fields("000000000018"), c)).toMatch(/error 1113/);
        expect(electorateEntry.validate(fields("", ""), c)).toMatch(/error 1113/);
        expect(electorateEntry.validate(fields("000000000019"), c)).toBeUndefined();
    });

    it("a DAO with an admin may have no voters, with a warning", () => {
        const administered = {...stakeDao, admin: "bze1qqp3kg3fxqp3kg3fxqp3kg3fxqp3kg3fx9xdm2"};
        const c = ctx({dao: administered});
        expect(electorateEntry.validate(fields("", ""), c)).toBeUndefined();
        expect(electorateEntry.warnings?.(fields("", ""), c).join(" ")).toMatch(/nobody can vote/);
    });

    it("sums the voting stake without the DAO's own", () => {
        expect(votingStake([sr("1", {staked: "100", own: "30"}), dr({staked: "50", own: "0"})]).toFixed()).toBe("120");
    });
});
