import {describe, expect, it} from "vitest";
import {describeDaoEvent, eventKind} from "./dao-history";

const DAO = "bze1daoaddressxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const ctx = {daoAddress: DAO, nameOf: (a: string) => (a === "bze1named" ? "Alice" : undefined)};
const describe1 = (type: string, attrs: unknown) => describeDaoEvent({type, attrs}, ctx);

describe("describeDaoEvent", () => {
    it("EventDaoCreated: governed by its voters, or with an admin", () => {
        expect(describe1("EventDaoCreated", {id: "1", address: DAO, admin: DAO, type: "DAO_TYPE_STAKE"})).toEqual({title: "The DAO was created", details: ["Governed by its voters"]});
        expect(describe1("EventDaoCreated", {admin: "bze1named"}).details).toEqual(["Admin: Alice"]);
    });

    it("EventAdminNominated", () => {
        expect(describe1("EventAdminNominated", {admin: "bze1named", nominee: "bze1nominee0000000000000"}).title).toBe("Alice nominated bze1nomine…000000 as the new admin");
    });

    it("EventAdminChanged: to another account, and to the DAO's own voters", () => {
        expect(describe1("EventAdminChanged", {old_admin: "bze1named", new_admin: "bze1new"}).title).toBe("The admin changed from Alice to bze1new");
        expect(describe1("EventAdminChanged", {old_admin: "bze1named", new_admin: DAO}).title).toBe("The admin handed the DAO to its own voters");
    });

    it("EventAdminNominationWithdrawn", () => {
        expect(describe1("EventAdminNominationWithdrawn", {nominee: "bze1named"}).title).toBe("The nomination of Alice as admin was withdrawn");
    });

    it("EventDaoConfigUpdated lists the changed fields in words", () => {
        const e = describe1("EventDaoConfigUpdated", {id: "1", fields: ["min_quorum", "voting_period", "some_new_field"]});
        expect(e.details).toEqual(["Changed: quorum, voting period, some new field"]);
    });

    it("EventDaoMetadataUpdated", () => {
        expect(describe1("EventDaoMetadataUpdated", {id: "1"}).title).toBe("The name or description was updated");
    });

    it("EventDaoElectorateUpdated: sources, or none", () => {
        const e = describe1("EventDaoElectorateUpdated", {sr_ids: ["000000000017"], dr_denom: "ubze"});
        expect(e.details).toEqual(["Staking rewards: 17", "Denom Reward of ubze"]);
        expect(describe1("EventDaoElectorateUpdated", {sr_ids: [], dr_denom: ""}).title).toMatch(/cleared/);
    });

    it("EventDaoMembersUpdated shows who was added and removed, and cuts a long list", () => {
        const many = Array.from({length: 7}, (_, i) => `bze1member${i}00000000000000`);
        const e = describe1("EventDaoMembersUpdated", {added: many, removed: ["bze1named"]});
        expect(e.details[0]).toMatch(/^Added: .* and 2 more$/);
        expect(e.details[1]).toBe("Removed: Alice");
    });

    it("EventAdminExecuted", () => {
        expect(describe1("EventAdminExecuted", {admin: "bze1named", msg_count: "1"}).title).toBe("Alice ran a message as the DAO");
        expect(describe1("EventAdminExecuted", {admin: "bze1named", msg_count: "3"}).title).toBe("Alice ran 3 messages as the DAO");
    });

    it("accepts the package-prefixed type, JSON-quoted strings and arrays sent as strings", () => {
        expect(eventKind("bze.dao.EventDaoCreated")).toBe("EventDaoCreated");
        expect(describe1("bze.dao.EventAdminNominationWithdrawn", {nominee: '"bze1named"'}).title).toContain("Alice");
        expect(describe1("EventDaoMembersUpdated", {added: '["bze1named"]'}).details).toEqual(["Added: Alice"]);
    });

    it("an unknown event type and odd attrs still read", () => {
        expect(describe1("EventSomethingNew", null)).toEqual({title: "Change: Something New", details: []});
        expect(describe1("EventDaoCreated", "oops").title).toBe("The DAO was created");
    });
});
