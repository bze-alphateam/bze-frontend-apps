import {describe, expect, it} from "vitest";
import {actionPhrase, consoleAddress, handOverLine, heroLine, reviewLine, runLabel, votersPhrase, type ReviewContext} from "./review";
import type {MsgAction} from "../proposal-describe";

const ADDRESS = "bze1gr0000000000000000000000000000000a77k";
const ctx: ReviewContext = {
    dao: {id: "4", name: "Builders Grant Fund", description: "Grants for BZE builders."},
    formatCoin: (c) => `${Number(c.amount) / 1e6} BZE`,
    nameOf: (a) => (a === "bze1dao" ? "Builders Grant Fund" : undefined),
    daoName: (id) => (id === "9" ? "Art Guild" : undefined),
};
const pay: MsgAction = {type: "send", from: "bze1dao", to: ADDRESS, amount: [{denom: "ubze", amount: "8000000000"}], fromDao: true, subDao: null};
const describe2: MsgAction = {type: "update_metadata", name: "Builders Grant Fund", description: "Grants for BZE builders, reviewed monthly."};
const text = (segments: {text: string}[]) => segments.map((s) => s.text).join("");

describe("reviewLine", () => {
    it("reads the board's sentence: the DAO, the numbered actions, all or nothing", () => {
        const line = reviewLine([pay, describe2], ctx);
        expect(text(line)).toBe("Builders Grant Fund will: 1. pay 8000 BZE to bze1gr0…a77k, 2. change its description. If one fails, nothing happens.");
        expect(line.filter((s) => s.strong).map((s) => s.text)).toEqual(["1.", "2."]);
    });

    it("one action: it, not one", () => {
        expect(text(reviewLine([pay], ctx))).toMatch(/1\. pay 8000 BZE to bze1gr0…a77k\. If it fails, nothing happens\.$/);
    });

    it("nothing for no actions", () => {
        expect(reviewLine([], ctx)).toEqual([]);
    });
});

describe("actionPhrase", () => {
    it("tells a rename from a description change", () => {
        expect(actionPhrase({type: "update_metadata", name: "Builders Fund", description: "Grants for BZE builders."}, ctx)).toBe('rename it to "Builders Fund"');
        expect(actionPhrase({type: "update_metadata", name: "Builders Fund", description: "New"}, ctx)).toBe('rename it to "Builders Fund" and change its description');
    });

    it("names other DAOs, never by number", () => {
        expect(actionPhrase({type: "nominate_admin", daoId: "9", nominee: ADDRESS, toVoters: false}, ctx)).toBe("nominate bze1gr0…a77k to run Art Guild");
        expect(actionPhrase({type: "nominate_admin", daoId: "9", nominee: "", toVoters: true}, ctx)).toBe("hand Art Guild to its voters");
        expect(actionPhrase({type: "admin_execute", daoId: "9", actions: [pay, pay]}, ctx)).toBe("run 2 actions as Art Guild");
        expect(actionPhrase({type: "accept_admin", daoId: "12", nominee: "bze1dao"}, ctx)).toBe("become the admin of another DAO");
        expect(actionPhrase({type: "accept_admin", daoId: "12", nominee: "bze1dao"}, ctx)).not.toMatch(/#|12/);
    });

    it("members, rules, voters and raw messages", () => {
        expect(actionPhrase({type: "update_members", add: [ADDRESS], remove: ["bze1a", "bze1b"]}, ctx)).toBe("add bze1gr0…a77k and remove 2 members");
        expect(actionPhrase({type: "update_config", changes: [{field: "a", label: "A", before: "1", after: "2"}], unchanged: false} as MsgAction, ctx)).toBe("change 1 voting rule");
        expect(actionPhrase({type: "update_electorate", srIds: ["1"], drDenom: ""}, ctx)).toBe("change its voters");
        expect(actionPhrase({type: "other", typeUrl: "/x.MsgY", title: "MsgY", json: "{}"}, ctx)).toBe('send "MsgY"');
    });
});

describe("the console's small words", () => {
    it("runLabel", () => {
        expect(runLabel(0)).toBe("Run now");
        expect(runLabel(1)).toBe("Run the action now");
        expect(runLabel(2)).toBe("Run 2 actions now");
    });

    it("votersPhrase: members counted, stakers named", () => {
        expect(votersPhrase({type: "DAO_TYPE_STATIC_LIST", members: [{address: "a"}, {address: "b"}]} as never)).toBe("its 2 members");
        expect(votersPhrase({type: "DAO_TYPE_STATIC_LIST", members: [{address: "a"}]} as never)).toBe("its 1 member");
        expect(votersPhrase({type: "DAO_TYPE_STAKE", members: []} as never)).toBe("its stakers");
    });

    it("heroLine and handOverLine: the verb agrees, an empty member list names no voters", () => {
        const list = (n: number) => ({type: "DAO_TYPE_STATIC_LIST", members: Array.from({length: n}, (_, i) => `bze1m${i}`)}) as never;
        expect(heroLine(list(7))).toBe("You can run any action as the DAO without a vote, and hand it over. Its 7 members vote on proposals as usual.");
        expect(heroLine(list(1))).toMatch(/Its 1 member votes on proposals as usual\.$/);
        expect(heroLine(list(0))).toMatch(/It has no members to vote on proposals\.$/);
        expect(heroLine({type: "DAO_TYPE_STAKE", members: []} as never)).toMatch(/Its stakers vote on proposals as usual\.$/);
        expect(handOverLine(list(7))).toBe("You stop being admin at once. From then on only proposals its 7 members vote on can change the DAO. There's no accept step.");
        expect(handOverLine(list(1))).toContain("only proposals its 1 member votes on can change");
    });

    it("consoleAddress: 7 … 4 as on the boards", () => {
        expect(consoleAddress(ADDRESS)).toBe("bze1gr0…a77k");
        expect(consoleAddress("bze1short")).toBe("bze1short");
    });
});
