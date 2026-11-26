import {describe, expect, it} from "vitest";
import {tryDescribe} from "../propose/describe";
import {ADMINISTERED_DAO, ctxWith, DAO, DAO_ADDRESS, OTHER, OTHER_DAO_ADDRESS, THIRD} from "@/test/composer-fixtures";
import {acceptEntry, nominateEntry, withdrawEntry} from "./admin";

const pending = {...DAO, pending_admin: OTHER};

describe("nominate an admin", () => {
    it("is for a self-owned DAO only", () => {
        expect(nominateEntry.available(DAO)).toBe(true);
        expect(nominateEntry.available(ADMINISTERED_DAO)).toBe(false);
        expect(nominateEntry.validate({nominee: OTHER}, ctxWith({dao: ADMINISTERED_DAO}))).toMatch(/hands it over/);
    });

    it("builds the message the DAO signs for itself", () => {
        const msg = nominateEntry.build({nominee: ` ${OTHER.toUpperCase()} `}, ctxWith());
        expect(msg.typeUrl).toBe("/bze.dao.MsgNominateAdmin");
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 4n, nominee: OTHER});
    });

    it.each([
        ["", /Enter the address/],
        ["cosmos1x", /not a valid BeeZee address/],
        [DAO_ADDRESS, /cannot nominate itself/],
        [DAO_ADDRESS.toUpperCase(), /cannot nominate itself/],
    ])("refuses the nominee %j", (nominee, message) => {
        expect(nominateEntry.validate({nominee}, ctxWith())).toMatch(message);
    });

    it("accepts another DAO's address, and warns what an external admin can do", () => {
        expect(nominateEntry.validate({nominee: OTHER_DAO_ADDRESS}, ctxWith())).toBeUndefined();
        expect(nominateEntry.warnings?.({nominee: OTHER}, ctxWith()).join(" ")).toMatch(/spending the whole treasury/);
    });

    it("warns, but does not refuse, while a nomination is pending (a withdraw can come first)", () => {
        expect(nominateEntry.validate({nominee: THIRD}, ctxWith({dao: pending}))).toBeUndefined();
        expect(nominateEntry.warnings?.({nominee: THIRD}, ctxWith({dao: pending})).join(" ")).toMatch(/already pending/);
    });

    it("is read back with the DAO and the nominee", () => {
        const read = tryDescribe(nominateEntry.build({nominee: OTHER}, ctxWith()), DAO, (c) => c.amount);
        expect(read).toEqual({ok: true, action: {type: "nominate_admin", daoId: "4", nominee: OTHER, toVoters: false}});
    });
});

describe("withdraw the nomination", () => {
    it("is offered for a self-owned DAO with a pending nomination only", () => {
        expect(withdrawEntry.available(pending)).toBe(true);
        expect(withdrawEntry.available(DAO)).toBe(false);
        expect(withdrawEntry.available({...ADMINISTERED_DAO, pending_admin: OTHER})).toBe(false);
    });

    it("builds the message the DAO signs for itself", () => {
        const msg = withdrawEntry.build({}, ctxWith({dao: pending}));
        expect(msg.typeUrl).toBe("/bze.dao.MsgWithdrawAdminNomination");
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 4n});
        expect(tryDescribe(msg, pending, (c) => c.amount)).toEqual({ok: true, action: {type: "withdraw_nomination", daoId: "4"}});
    });

    it("says when there is nothing to withdraw", () => {
        expect(withdrawEntry.validate({}, ctxWith())).toMatch(/no pending nomination/);
        expect(() => withdrawEntry.build({}, ctxWith())).toThrow(/no pending nomination/);
    });
});

describe("accept a nomination as this DAO", () => {
    const incoming = [{id: "9", name: "Hive", address: OTHER_DAO_ADDRESS}, {id: "11", name: "Bees", address: THIRD}];

    it("is offered only when a DAO nominated this one", () => {
        expect(acceptEntry.available(DAO, ctxWith({incoming}))).toBe(true);
        expect(acceptEntry.available(DAO, ctxWith({incoming: []}))).toBe(false);
        expect(acceptEntry.available(DAO, ctxWith({incoming: null}))).toBe(false);
        expect(acceptEntry.available(DAO)).toBe(false);
    });

    it("starts on the first nominating DAO and builds the nominee's acceptance, signed by this DAO", () => {
        const ctx = ctxWith({incoming});
        const fields = acceptEntry.initialFields(ctx);
        expect(fields).toEqual({daoId: "9"});
        const msg = acceptEntry.build(fields, ctx);
        expect(msg.typeUrl).toBe("/bze.dao.MsgAcceptAdminNomination");
        expect(msg.value).toMatchObject({nominee: DAO_ADDRESS, daoId: 9n});
        expect(tryDescribe(msg, DAO, (c) => c.amount)).toEqual({ok: true, action: {type: "accept_admin", daoId: "9", nominee: DAO_ADDRESS}});
    });

    it("refuses a DAO that did not nominate this one, and says when the nominations could not be looked up", () => {
        expect(acceptEntry.validate({daoId: "5"}, ctxWith({incoming}))).toMatch(/Choose a DAO/);
        expect(acceptEntry.validate({daoId: "9"}, ctxWith({incoming: null}))).toMatch(/could not be looked up/);
        expect(() => acceptEntry.build({daoId: "5"}, ctxWith({incoming}))).toThrow();
    });

    it("warns that a stale nomination is refused", () => {
        expect(acceptEntry.warnings?.({daoId: "9"}, ctxWith({incoming})).join(" ")).toMatch(/1135/);
    });
});
