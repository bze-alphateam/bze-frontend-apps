import {describe, expect, it} from "vitest";
import {DAO, DAO_ADDRESS, FOURTH, OTHER, WALLET} from "@/test/composer-fixtures";
import {isLastMember, LAST_MEMBER_TEXT, shortcutApplies, shortcutDraft, shortcutHref, shortcutInDraft, shortcutLabel, shortcutOf} from "./shortcuts";

describe("isLastMember", () => {
    it("is the only member of a member list, unless nobody can propose now", () => {
        expect(isLastMember({...DAO, members: [WALLET]}, WALLET)).toBe(true);
        expect(isLastMember({...DAO, members: [WALLET]}, WALLET.toUpperCase())).toBe(true);
        expect(isLastMember({...DAO, members: [WALLET]}, WALLET, {kind: "blocked"})).toBe(false);
        expect(isLastMember({...DAO, members: [WALLET, OTHER]}, WALLET)).toBe(false);
        expect(isLastMember({...DAO, members: [OTHER]}, WALLET)).toBe(false);
        expect(isLastMember({...DAO, members: [WALLET]}, null)).toBe(false);
        expect(isLastMember({...DAO, type: "DAO_TYPE_STAKE", members: [WALLET]}, WALLET)).toBe(false);
    });
    it("says why Leave is not offered", () => {
        expect(LAST_MEMBER_TEXT).toBe("You're the last member. A DAO needs at least one, so Leave is offered again once someone else is added.");
    });
});

const key = () => "k1";
const dao = {type: DAO.type, members: [WALLET, OTHER], address: DAO_ADDRESS, config: {...DAO.config, open_submission: true}};

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

    it("join needs a DAO open to submissions, leave needs another member to stay", () => {
        expect(shortcutDraft("join", {...dao, config: {...dao.config, open_submission: false}}, FOURTH, key)).toBeNull();
        expect(shortcutDraft("leave", {...dao, members: [WALLET]}, WALLET, key)).toBeNull();
    });

    it("does not apply to a member joining, a non-member leaving, a stake DAO, or no wallet", () => {
        expect(shortcutDraft("join", dao, WALLET, key)).toBeNull();
        expect(shortcutDraft("leave", dao, FOURTH, key)).toBeNull();
        expect(shortcutDraft("join", {...dao, type: "DAO_TYPE_STAKE"}, FOURTH, key)).toBeNull();
        expect(shortcutDraft("join", dao, null, key)).toBeNull();
        expect(shortcutDraft("join", dao, DAO_ADDRESS, key)).toBeNull();
    });
});

describe("when a shortcut is offered", () => {
    const open = {...dao, members: [WALLET, OTHER]};

    it("Request to join: a member list open to anyone, a wallet that is not a member", () => {
        expect(shortcutApplies("join", open, FOURTH)).toBe(true);
        expect(shortcutApplies("join", {...open, config: {...open.config, open_submission: false}}, FOURTH)).toBe(false);
        expect(shortcutApplies("join", open, WALLET)).toBe(false);
        expect(shortcutApplies("join", open, WALLET.toUpperCase())).toBe(false);
        expect(shortcutApplies("join", open, DAO_ADDRESS)).toBe(false);
        expect(shortcutApplies("join", {...open, type: "DAO_TYPE_STAKE", members: []}, FOURTH)).toBe(false);
        expect(shortcutApplies("join", open, null)).toBe(false);
    });

    it("Leave: a member who is not the last one, whether or not the DAO is open to anyone", () => {
        expect(shortcutApplies("leave", open, WALLET)).toBe(true);
        expect(shortcutApplies("leave", {...open, config: {...open.config, open_submission: false}}, WALLET)).toBe(true);
        expect(shortcutApplies("leave", open, FOURTH)).toBe(false);
        expect(shortcutApplies("leave", open, null)).toBe(false);
        expect(shortcutApplies("leave", {...open, type: "DAO_TYPE_STAKE"}, WALLET)).toBe(false);
    });

    it("Leave is not offered to the last member", () => {
        expect(shortcutApplies("leave", {...open, members: [WALLET]}, WALLET)).toBe(false);
        expect(shortcutDraft("leave", {...open, members: [WALLET]}, WALLET, key)).toBeNull();
    });

    it("names the DAO on the button", () => {
        expect(shortcutLabel("join", "Hive Council")).toBe("Request to join Hive Council");
        expect(shortcutLabel("leave", "Hive Council")).toBe("Leave Hive Council");
    });
});

describe("a DAO that cannot take a proposal", () => {
    const open = {...dao, members: [WALLET, OTHER]};
    const blocked = {kind: "blocked" as const};

    it("gets neither shortcut, by button or by link", () => {
        expect(shortcutApplies("join", open, FOURTH, blocked)).toBe(false);
        expect(shortcutApplies("leave", open, WALLET, blocked)).toBe(false);
        expect(shortcutDraft("join", open, FOURTH, key, blocked)).toBeNull();
        expect(shortcutDraft("leave", open, WALLET, key, blocked)).toBeNull();
    });

    it("any other status keeps them", () => {
        for (const kind of ["allowed", "maybe", "unknown", "not-a-voter"] as const) {
            expect(shortcutApplies("join", open, FOURTH, {kind})).toBe(true);
            expect(shortcutApplies("leave", open, WALLET, {kind})).toBe(true);
        }
        expect(shortcutApplies("leave", open, WALLET, null)).toBe(true);
    });
});

describe("the shortcut a draft holds", () => {
    const members = (fields: Record<string, string>) => ({key: "k", type: "update-members", fields});

    it("is leave while the wallet's removal is in the list, join while its addition is", () => {
        expect(shortcutInDraft([members({add: "", remove: WALLET})], WALLET)).toBe("leave");
        expect(shortcutInDraft([{key: "p", type: "pay", fields: {}}, members({add: `${OTHER}\n${FOURTH}`, remove: ""})], FOURTH.toUpperCase())).toBe("join");
    });

    it("is none once that action is gone, for someone else's change, or without a wallet", () => {
        expect(shortcutInDraft([], WALLET)).toBeNull();
        expect(shortcutInDraft([members({add: OTHER, remove: ""})], WALLET)).toBeNull();
        expect(shortcutInDraft([members({add: "", remove: WALLET})], null)).toBeNull();
    });
});
