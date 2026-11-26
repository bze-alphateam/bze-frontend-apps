import {describe, expect, it} from "vitest";
import {DAO, DAO_ADDRESS, FOURTH, OTHER, WALLET} from "@/test/composer-fixtures";
import {shortcutDraft, shortcutHref, shortcutOf} from "./shortcuts";

const key = () => "k1";
const dao = {type: DAO.type, members: [WALLET, OTHER], address: DAO_ADDRESS};

describe("the shortcut link", () => {
    it("names a shortcut only for join and leave", () => {
        expect(shortcutOf("?shortcut=join")).toBe("join");
        expect(shortcutOf("shortcut=leave&x=1")).toBe("leave");
        for (const search of ["", "?shortcut=", "?shortcut=remove", "?shortcut=JOIN", "?other=join"]) expect(shortcutOf(search)).toBeNull();
    });

    it("links from the DAO page to the composer", () => {
        expect(shortcutHref("4", "join")).toBe("/dao/4/propose?shortcut=join");
        expect(shortcutHref("4", "leave")).toBe("/dao/4/propose?shortcut=leave");
    });
});

describe("the draft a shortcut opens", () => {
    it("join: adds the connected wallet, with a title that names it", () => {
        const draft = shortcutDraft("join", dao, FOURTH, key);
        expect(draft?.title).toMatch(/^Add bze1.*as a member$/);
        expect(draft).toMatchObject({summary: "", expedited: false, actions: [{key: "k1", type: "update-members", fields: {add: FOURTH, remove: ""}}]});
    });

    it("leave: removes the connected wallet", () => {
        const draft = shortcutDraft("leave", dao, WALLET, key);
        expect(draft?.title).toMatch(/^Remove bze1.*as a member$/);
        expect(draft?.actions[0].fields).toEqual({add: "", remove: WALLET});
    });

    it("takes the address from the wallet in lowercase, whatever case it is written in", () => {
        expect(shortcutDraft("join", dao, FOURTH.toUpperCase(), key)?.actions[0].fields.add).toBe(FOURTH);
    });

    it("does not apply to a member joining, a non-member leaving, a stake DAO, or no wallet", () => {
        expect(shortcutDraft("join", dao, WALLET, key)).toBeNull();
        expect(shortcutDraft("leave", dao, FOURTH, key)).toBeNull();
        expect(shortcutDraft("join", {...dao, type: "DAO_TYPE_STAKE"}, FOURTH, key)).toBeNull();
        expect(shortcutDraft("join", dao, null, key)).toBeNull();
        expect(shortcutDraft("join", dao, DAO_ADDRESS, key)).toBeNull();
    });
});
