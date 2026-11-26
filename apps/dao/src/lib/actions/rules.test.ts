import {describe, expect, it} from "vitest";
import {packDaoMsgs, type DaoConfig} from "@bze/bze-ui-kit";
import {ctxWith, CONFIG, DAO, DAO_ADDRESS, PARAMS} from "@/test/composer-fixtures";
import {tryDescribe} from "../propose/describe";
import {rulesConfig, rulesEntry, rulesFromFields} from "./rules";

const ctx = (config: Partial<DaoConfig> = {}) => ctxWith({dao: {...DAO, config: {...CONFIG, ...config}}});
const edit = (c: ReturnType<typeof ctx>, over: Record<string, string>) => ({...rulesEntry.initialFields(c), ...over});
const described = (c: ReturnType<typeof ctx>, fields: Record<string, string>) => {
    const read = tryDescribe(rulesEntry.build(fields, c), c.dao, (coin) => `${coin.amount} ${coin.denom}`);
    if (!read.ok || read.action.type !== "update_config") throw new Error("not a rules change");
    return read.action;
};

describe("the voting-rules action", () => {
    it("starts from the DAO's current rules", () => {
        expect(rulesEntry.initialFields(ctx())).toMatchObject({
            quorumPct: "40", thresholdPct: "50", votingDays: "3", allowExpedite: "true", expeditedDays: "1", expediteQuorumPct: "60", expediteThresholdPct: "70",
            openSubmission: "false", costAmount: "5", costDenom: "ubze", depositAmount: "9", depositDenom: "ubze", refundPolicy: "ONLY_PASSED", costDestination: "TREASURY", keptDepositDestination: "BURN",
        });
    });

    it("an untouched form changes nothing, so it cannot be sent", () => {
        const c = ctx();
        expect(rulesEntry.validate(rulesEntry.initialFields(c), c)).toMatch(/same rules the DAO has today/);
    });

    it("builds the whole config, signed by the DAO, with only the edited field changed", () => {
        const c = ctx();
        const msg = rulesEntry.build(edit(c, {quorumPct: "45"}), c);
        expect(msg.typeUrl).toBe("/bze.dao.MsgUpdateDaoConfig");
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 4n});
        expect(packDaoMsgs([msg])).toHaveLength(1);
        expect(described(c, edit(c, {quorumPct: "45"})).changes).toEqual([{field: "min_quorum", label: "quorum", before: "40%", after: "45%"}]);
    });

    it("shows every changed field before and after", () => {
        const c = ctx();
        const action = described(c, edit(c, {thresholdPct: "66.5", votingDays: "5", openSubmission: "true", costAmount: "", refundPolicy: "NEVER"}));
        expect(action.unchanged).toBe(false);
        expect(action.changes.map((x) => x.field)).toEqual(["threshold", "voting_period", "open_submission", "proposal_cost", "deposit_refund_policy"]);
        expect(action.changes.find((x) => x.field === "voting_period")).toMatchObject({before: "3 days", after: "5 days"});
        expect(action.changes.find((x) => x.field === "proposal_cost")).toMatchObject({before: "5000000 ubze", after: "None"});
    });

    it("sends a setting nobody touched exactly as the DAO has it, even when the form rounds it", () => {
        // 7200 s is not a whole number of days, and 1/3 has more decimals than the form shows
        const awkward = ctx({voting_period: "7200s", min_quorum: "0.333333333333333333", expedited_period: "3600s"});
        const initial = rulesEntry.initialFields(awkward);
        const result = rulesConfig({...initial, thresholdPct: "55"}, awkward);
        expect(result).toMatchObject({config: {voting_period: "7200s", min_quorum: "0.333333333333333333", expedited_period: "3600s"}});
        expect("config" in result && result.config.threshold).not.toBe(CONFIG.threshold);
    });

    it("an untouched form of an awkward config still reads as no change", () => {
        const awkward = ctx({voting_period: "7200s", min_quorum: "0.333333333333333333", expedited_period: "3600s"});
        expect(rulesEntry.validate(rulesEntry.initialFields(awkward), awkward)).toMatch(/same rules/);
    });

    it("keeps the expedite settings valid even with expedite off (a zero there is an old DAO's)", () => {
        const off = ctx({allow_expedite: false, expedited_period: "0s", expedite_quorum: "0.000000000000000000", expedite_threshold: "0.000000000000000000"});
        const fields = edit(off, {quorumPct: "41"});
        // the chain checks the expedite fields even when expedite is off: the old zeros do not pass, and the form says so
        expect(rulesEntry.validate(fields, off)).toMatch(/expedite quorum must be above 0%/);
        expect(rulesEntry.validate({...fields, expediteQuorumPct: "50", expediteThresholdPct: "60", expeditedDays: "1"}, off)).toBeUndefined();
    });

    it("checks the periods against the params' bounds, at the boundary", () => {
        const c = ctxWith({params: {...PARAMS, min_voting_period: "86400s", max_voting_period: "604800s"}});
        expect(rulesEntry.validate(edit(c, {votingDays: "7"}), c)).toBeUndefined();
        expect(rulesEntry.validate(edit(c, {votingDays: "7.5"}), c)).toMatch(/voting period must be between 1 day and 7 days/);
        expect(rulesEntry.validate(edit(c, {votingDays: "1", expeditedDays: "1"}), c)).toBeUndefined();
        expect(rulesEntry.validate(edit(c, {votingDays: "1", expeditedDays: "0.5"}), c)).toMatch(/expedited period must be between/);
    });

    it.each([
        [{quorumPct: "0"}, /quorum must be above 0%/],
        [{quorumPct: "101"}, /quorum must be above 0% and at most 100%/],
        [{thresholdPct: "100"}, /threshold must be above 0% and below 100%/],
        [{thresholdPct: "abc"}, /must be a percentage/],
        [{expediteQuorumPct: "30"}, /expedite quorum cannot be lower than the quorum/],
        [{expediteThresholdPct: "40"}, /expedite threshold cannot be lower than the threshold/],
        [{votingDays: "x"}, /number of days/],
        [{costAmount: "1.1234567"}, /at most 6 decimals/],
    ])("refuses %j", (over, message) => {
        const c = ctx();
        expect(rulesEntry.validate(edit(c, over), c)).toMatch(message);
    });

    it("refuses a stored draft that is not a complete set of rules, whatever is missing or wrong", () => {
        const c = ctx();
        const good = rulesEntry.initialFields(c);
        const broken: Record<string, string>[] = [
            {}, {...good, preset: "bogus"}, {...good, allowExpedite: "yes"}, {...good, refundPolicy: "SOMETIMES"},
            {...good, costDestination: "BANK"}, {...good, keptDepositDestination: ""},
            Object.fromEntries(Object.entries(good).filter(([k]) => k !== "thresholdPct")),
        ];
        for (const fields of broken) {
            expect(rulesFromFields(fields).ok).toBe(false);
            expect(rulesEntry.validate(fields, c)).toMatch(/saved rules are incomplete/);
            expect(() => rulesEntry.build(fields, c)).toThrow(/incomplete/);
        }
    });

    it("tells that open proposals keep their rules, once the rules are valid", () => {
        const c = ctx();
        expect(rulesEntry.warnings?.(edit(c, {quorumPct: "45"}), c).join(" ")).toMatch(/open now keep the rules they started with/);
        expect(rulesEntry.warnings?.(edit(c, {quorumPct: "0"}), c)).toEqual([]);
    });
});
