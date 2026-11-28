import {describe, expect, it} from "vitest";
import {describeDaoEvent, eventKind, historyTime} from "./dao-history";

const DAO = "bze1daoaddressxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const ctx = {daoAddress: DAO, nameOf: (a: string) => (a === "bze1named" ? "Alice" : undefined)};
const describe1 = (type: string, attrs: unknown) => describeDaoEvent({type, attrs}, ctx);

describe("describeDaoEvent", () => {
    it("EventDaoCreated: who governs it and who runs it, in the decided words", () => {
        expect(describe1("EventDaoCreated", {id: "1", address: DAO, admin: DAO, type: "DAO_TYPE_STAKE"})).toEqual({title: "DAO created", details: ["Governed by stakers", "No admin"], icon: "created"});
        expect(describe1("EventDaoCreated", {admin: "bze1named", type: "DAO_TYPE_STATIC_LIST"}).details).toEqual(["Governed by a member list", "Admin: Alice"]);
        expect(describe1("EventDaoCreated", {admin: "bze1unnamed000000000000000"}).details).toEqual(["Admin is an account (bze1unname…000000)"]);
    });

    it("EventDaoCreated names its creator when Scan knows it", () => {
        expect(describeDaoEvent({type: "EventDaoCreated", attrs: {admin: DAO}}, {...ctx, creator: "bze1named"}).title).toBe("DAO created by Alice");
    });

    it("never says \"Governed by its voters\", \"Has an admin\" or \"DAO #n\"", () => {
        const texts = [
            describe1("EventDaoCreated", {id: "3", address: DAO, admin: DAO, type: "DAO_TYPE_STAKE"}),
            describe1("EventDaoCreated", {id: "3", admin: "bze1named"}),
            describe1("EventAdminChanged", {id: "3", old_admin: DAO, new_admin: "bze1named"}),
        ].flatMap((d) => [d.title, ...d.details]).join(" | ");
        expect(texts).not.toMatch(/Governed by its voters|Has an admin|DAO #/);
    });

    it("EventAdminNominated", () => {
        expect(describe1("EventAdminNominated", {admin: "bze1named", nominee: "bze1nominee0000000000000"}).title).toBe("Alice nominated bze1nomine…000000 as admin");
    });

    it("EventAdminChanged: \"New admin: <name>\", and the handover to the DAO's own voters", () => {
        expect(describe1("EventAdminChanged", {old_admin: "bze1new", new_admin: "bze1named"})).toEqual({title: "New admin: Alice", details: ["bze1new handed the DAO to Alice, which accepted"], icon: "admin"});
        expect(describe1("EventAdminChanged", {old_admin: "bze1named", new_admin: DAO})).toEqual({title: "No admin: the DAO is run by its own voters", details: ["Alice handed the DAO to its own voters"], icon: "admin"});
    });

    it("a self-owned DAO acting is named as its voters, not by its raw address", () => {
        expect(describe1("EventAdminNominated", {admin: DAO, nominee: "bze1named"}).title).toBe("The DAO's own voters nominated Alice as admin");
        expect(describe1("EventAdminChanged", {old_admin: DAO, new_admin: "bze1named"}).details).toEqual(["The DAO's own voters handed the DAO to Alice, which accepted"]);
        expect(describe1("EventAdminExecuted", {admin: DAO, msg_count: "2"}).title).toBe("The DAO's own voters ran 2 actions as this DAO");
    });

    it("EventAdminNominationWithdrawn", () => {
        expect(describe1("EventAdminNominationWithdrawn", {nominee: "bze1named"})).toEqual({title: "The nomination of Alice as admin was withdrawn", details: [], icon: "withdraw"});
        expect(describe1("EventAdminNominationWithdrawn", {admin: "bze1named", nominee: "bze1nominee0000000000000"}).title).toBe("Alice withdrew the nomination of bze1nomine…000000");
    });

    it("EventDaoConfigUpdated lists the changed fields in words", () => {
        const e = describe1("EventDaoConfigUpdated", {id: "1", fields: ["min_quorum", "voting_period", "some_new_field"]});
        expect(e).toEqual({title: "Rules changed", details: ["Changed: quorum, voting period, some new field"], icon: "rules"});
    });

    it("EventDaoMetadataUpdated", () => {
        expect(describe1("EventDaoMetadataUpdated", {id: "1"})).toEqual({title: "Name and description changed", details: [], icon: "metadata"});
    });

    it("EventDaoElectorateUpdated: sources, or none", () => {
        const e = describe1("EventDaoElectorateUpdated", {sr_ids: ["000000000017"], dr_denom: "ubze"});
        expect(e).toEqual({title: "Voters changed", details: ["Sources: Simple reward #17 + Compounded reward (ubze)"], icon: "voters"});
        expect(describe1("EventDaoElectorateUpdated", {sr_ids: [], dr_denom: ""}).details).toEqual(["No sources left: nobody can vote until new ones are set"]);
    });

    it("EventDaoMembersUpdated shows who was added and removed, and cuts a long list", () => {
        const many = Array.from({length: 7}, (_, i) => `bze1member${i}00000000000000`);
        const e = describe1("EventDaoMembersUpdated", {added: many, removed: ["bze1named"]});
        expect(e.title).toBe("Members changed");
        expect(e.icon).toBe("members");
        expect(e.details[0]).toMatch(/^Added .* and 2 more$/);
        expect(e.details[1]).toBe("Removed Alice");
    });

    it("EventAdminExecuted", () => {
        expect(describe1("EventAdminExecuted", {admin: "bze1named", msg_count: "1"})).toEqual({title: "Alice ran an action as this DAO", details: [], icon: "execute"});
        expect(describe1("EventAdminExecuted", {admin: "bze1named", msg_count: "3"}).title).toBe("Alice ran 3 actions as this DAO");
    });

    it("accepts the package-prefixed type, JSON-quoted strings and arrays sent as strings", () => {
        expect(eventKind("bze.dao.EventDaoCreated")).toBe("EventDaoCreated");
        expect(describe1("bze.dao.EventAdminNominationWithdrawn", {nominee: '"bze1named"'}).title).toContain("Alice");
        expect(describe1("EventDaoMembersUpdated", {added: '["bze1named"]'}).details).toEqual(["Added Alice"]);
    });

    it("an unknown event type and odd attrs still read", () => {
        expect(describe1("EventSomethingNew", null)).toEqual({title: "Change: Something New", details: [], icon: "other"});
        expect(describe1("EventDaoCreated", "oops").title).toBe("DAO created");
    });
});

describe("historyTime", () => {
    const now = Date.parse("2026-11-28T15:00:00Z");
    it("today, this year and an older year, in UTC", () => {
        expect(historyTime("2026-11-28T09:12:00Z", now)).toBe("Today 09:12");
        expect(historyTime("2026-11-18T14:40:00Z", now)).toBe("18 Nov 14:40");
        expect(historyTime("2025-11-18T14:40:00Z", now)).toBe("18 Nov 2025 14:40");
    });
    it("missing or unreadable: empty", () => {
        expect(historyTime(null, now)).toBe("");
        expect(historyTime("nope", now)).toBe("");
    });
});
