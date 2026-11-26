import {describe, expect, it} from "vitest";
import {consoleRole, controlFingerprint} from "./access";

const DAO = {address: "bze1dao", admin: "bze1admin", pending_admin: ""};

describe("consoleRole", () => {
    it("the external admin of a DAO has the console", () => {
        expect(consoleRole(DAO, "bze1admin")).toBe("admin");
        expect(consoleRole(DAO, "BZE1ADMIN")).toBe("admin");
    });

    it("the nominee has the console, the admin staying the admin until the nominee accepts", () => {
        const pending = {...DAO, pending_admin: "bze1next"};
        expect(consoleRole(pending, "bze1next")).toBe("nominee");
        expect(consoleRole(pending, "bze1admin")).toBe("admin");
    });

    it("anyone else, a wallet that is not connected, and the voters of a self-owned DAO have none", () => {
        expect(consoleRole(DAO, "bze1stranger")).toBe("none");
        expect(consoleRole(DAO, null)).toBe("none");
        expect(consoleRole({...DAO, pending_admin: "bze1next"}, "bze1stranger")).toBe("none");
        // a self-owned DAO's own account is its admin: it acts through proposals, not through a console
        expect(consoleRole({address: "bze1dao", admin: "bze1dao", pending_admin: ""}, "bze1dao")).toBe("none");
        expect(consoleRole({address: "bze1dao", admin: "bze1dao", pending_admin: ""}, "bze1admin")).toBe("none");
    });

    it("an empty nomination names nobody, so it never matches an empty wallet", () => {
        expect(consoleRole(DAO, "")).toBe("none");
    });
});

describe("controlFingerprint", () => {
    it("changes with the admin, the nomination and their sequence numbers", () => {
        const base = {admin: "a", pending_admin: "", admin_seq: "1", pending_admin_seq: "0"};
        const seen = new Set([base, {...base, admin: "b"}, {...base, pending_admin: "n"}, {...base, admin_seq: "2"}, {...base, pending_admin_seq: "3"}].map(controlFingerprint));
        expect(seen.size).toBe(5);
    });
});
