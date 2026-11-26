import {describe, expect, it} from "vitest";
import type {Dao} from "@bze/bze-ui-kit";
import {actionsFor, DAO_FEATURES, staticJoinText, type DaoFeatures} from "./dao-actions";

const ALL: DaoFeatures = {newProposal: true, memberComposer: true, adminConsole: true};
const dao = (over: Partial<Dao> = {}, open = false) => ({
    address: "bze1dao", admin: "bze1admin", pending_admin: "", type: "DAO_TYPE_STATIC_LIST", members: ["bze1member"],
    config: {open_submission: open} as Dao["config"], ...over,
});

describe("actionsFor", () => {
    it("shows nothing while the other stories have not shipped", () => {
        expect(actionsFor(DAO_FEATURES, dao(), "bze1admin")).toEqual({newProposal: false, adminConsole: false, requestToJoin: false, leave: false});
    });

    it("new proposal needs a connected wallet", () => {
        expect(actionsFor(ALL, dao(), null).newProposal).toBe(false);
        expect(actionsFor(ALL, dao(), "bze1x").newProposal).toBe(true);
    });

    it("the admin console is for the external admin and the pending nominee only", () => {
        expect(actionsFor(ALL, dao(), "bze1admin").adminConsole).toBe(true);
        expect(actionsFor(ALL, dao({pending_admin: "bze1next"}), "bze1next").adminConsole).toBe(true);
        expect(actionsFor(ALL, dao(), "bze1member").adminConsole).toBe(false);
        expect(actionsFor(ALL, dao({admin: "bze1dao"}), "bze1dao").adminConsole).toBe(false);
    });

    it("request to join: open submission, not a member; leave: a member", () => {
        expect(actionsFor(ALL, dao({}, true), "bze1x").requestToJoin).toBe(true);
        expect(actionsFor(ALL, dao({}, false), "bze1x").requestToJoin).toBe(false);
        expect(actionsFor(ALL, dao({}, true), "bze1member")).toMatchObject({requestToJoin: false, leave: true});
        expect(actionsFor(ALL, dao({type: "DAO_TYPE_STAKE", members: []}, true), "bze1x")).toMatchObject({requestToJoin: false, leave: false});
    });
});

describe("staticJoinText", () => {
    it("tells a visitor how to get in", () => {
        expect(staticJoinText({config: {open_submission: false} as Dao["config"]}, false).at(-1)).toBe("Ask a member to propose adding you.");
        expect(staticJoinText({config: {open_submission: true} as Dao["config"]}, false).at(-1)).toMatch(/Anyone can propose adding themselves/);
        expect(staticJoinText({config: {open_submission: true} as Dao["config"]}, true).at(-1)).toMatch(/You are a member/);
    });
});
