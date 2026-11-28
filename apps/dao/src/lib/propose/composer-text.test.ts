import {describe, expect, it} from "vitest";
import {DAO, DAO_ADDRESS, OTHER, STAKE_DAO, WALLET} from "@/test/composer-fixtures";
import type {MsgAction} from "@/lib/proposal-describe";
import {shortAddress} from "@/lib/format";
import {bytesLine, cardDetail, pickerSubtitle, sizeLine, slotsLine, summaryLine, type CardTextContext, type Segment} from "./composer-text";

const ctx: CardTextContext = {
    formatCoin: (c) => `${c.amount} ${c.denom}`,
    wallet: WALLET,
    nameOf: (a) => (a === DAO_ADDRESS ? "Founders" : undefined),
    daoName: (id) => (id === "9" ? "Pollen Fund" : `DAO ${id}`),
};
const plain = (segments: Segment[]) => segments.map((s) => (s.strong ? `*${s.text}*` : s.text)).join("");

describe("bytesLine", () => {
    it("counts up to the limit, then says what to do", () => {
        expect(bytesLine(34, 140)).toEqual({text: "34 of 140 bytes", over: false});
        expect(bytesLine(140, 140).over).toBe(false);
        expect(bytesLine(152, 140)).toEqual({text: "152 of 140 bytes: shorten it. Emoji and accents count as 2–4 bytes.", over: true});
    });
});

describe("summaryLine", () => {
    it("says the summary is plain text, never Markdown", () => {
        expect(summaryLine(312, 5000).text).toBe("Plain text. 312 of 5,000 bytes. Line breaks are kept and web links become links; no images or HTML.");
        expect(summaryLine(312, 5000).short).toBe("Plain text · 312 of 5,000 bytes");
        const over = "5,001 of 5,000 bytes: shorten it. Emoji and accents count as 2–4 bytes.";
        expect(summaryLine(5001, 5000)).toEqual({text: over, short: over, over: true});
    });
});

describe("sizeLine", () => {
    it("shows the bytes and the actions against both limits", () => {
        expect(sizeLine(3620, 20000, 2, 16)).toEqual({text: "3,620 of 20,000 bytes · 2 of 16 actions", over: false, percent: 18});
    });
    it("over the bytes: a full bar and what to do", () => {
        expect(sizeLine(21400, 20000, 3, 16)).toEqual({text: "21,400 of 20,000 bytes: remove an action or make one smaller", over: true, percent: 100});
    });
    it("over the action count", () => {
        expect(sizeLine(10, 20000, 17, 16)).toMatchObject({text: "17 of 16 actions: remove an action", over: true});
    });
});

it("slotsLine counts the proposals in voting against the DAO's limit", () => {
    expect(slotsLine(2, 10)).toBe("2 of 10 proposal slots are in use.");
});

describe("pickerSubtitle", () => {
    it("names the DAO, its type and who governs it", () => {
        expect(pickerSubtitle({...DAO, admin: DAO.address})).toBe(`${DAO.name} · Member list · governs itself`);
        expect(pickerSubtitle({...STAKE_DAO, admin: OTHER})).toBe(`${STAKE_DAO.name} · Stakers · has an admin`);
    });
});

describe("cardDetail", () => {
    it("a payment: the amount in bold, then who gets it", () => {
        const send: MsgAction = {type: "send", from: DAO_ADDRESS, to: OTHER, amount: [{denom: "ubze", amount: "5"}], fromDao: true, subDao: null};
        expect(plain(cardDetail(send, ctx))).toBe(`*5 ubze* to *${shortAddress(OTHER)}*`);
    });
    it("a members change that adds the wallet says (you)", () => {
        expect(plain(cardDetail({type: "update_members", add: [WALLET], remove: []}, ctx))).toBe(`Add *${shortAddress(WALLET)}* (you)`);
        expect(plain(cardDetail({type: "update_members", add: [WALLET, OTHER], remove: [DAO_ADDRESS]}, ctx))).toBe("Add *2 addresses*, remove *Founders*");
    });
    it("names DAOs, never numbers them", () => {
        expect(plain(cardDetail({type: "accept_admin", daoId: "9", nominee: DAO_ADDRESS}, ctx))).toBe("Become the admin of *Pollen Fund*");
        expect(plain(cardDetail({type: "admin_execute", daoId: "9", actions: [{type: "withdraw_nomination", daoId: "9"}]}, ctx))).toBe("*1 action* as Pollen Fund");
    });
    it("a rules change lists what changes", () => {
        const action: MsgAction = {type: "update_config", unchanged: false, changes: [{field: "threshold", label: "Threshold", before: "50%", after: "60%"}]};
        expect(plain(cardDetail(action, ctx))).toBe("1 setting change: *Threshold*");
    });
    it("a handover to the voters and a nomination", () => {
        expect(plain(cardDetail({type: "nominate_admin", daoId: "4", nominee: "", toVoters: true}, ctx))).toBe("Hand it to its own voters");
        expect(plain(cardDetail({type: "nominate_admin", daoId: "4", nominee: OTHER, toVoters: false}, ctx))).toBe(`Nominate *${shortAddress(OTHER)}*`);
    });
});
