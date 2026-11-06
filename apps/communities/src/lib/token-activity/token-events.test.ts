import {describe, expect, it} from "vitest";

import {describeTokenEvent, eventWhen, type TokenHistoryEvent} from "./token-events";

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const TMS = "factory/bze142cru2h3xa6p4kajyg7wzcuweq0p72puyar263/utms";
const CREATOR = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const TICKERS: Record<string, string> = {[NOAD]: "NOAD", [TMS]: "TMS", ubze: "BZE"};
const ctx = {ticker: "NOAD", decimals: 6, tickerOf: (denom: string) => TICKERS[denom] ?? denom};

const event = (kind: string, extra: Partial<TokenHistoryEvent> = {}): TokenHistoryEvent => ({
    height: 4082925,
    tx_index: 0,
    seq: 0,
    tx_hash: "86684BB3CA4FC285E006D2CA9A1A7CB4EF44464C5AB55BE62FA8CD2025109EB8",
    kind,
    actor: CREATOR,
    amount: null,
    details: null,
    time: "2026-11-04T20:59:28.627861Z",
    ...extra,
});

describe("describeTokenEvent", () => {
    it("writes a brand kit change", () => {
        expect(describeTokenEvent(event("branding_changed"), ctx, NOAD)).toEqual({
            title: "Brand kit updated",
            tag: "Branding",
            text: "New colours and font for every NOAD page.",
            primary: false,
        });
    });

    it("names a new pool by its pair, in the chain's order", () => {
        const text = describeTokenEvent(event("pool_created", {details: {base: TMS, quote: NOAD, lp_denom: "ulp/x"}}), ctx, NOAD);

        expect(text.title).toBe("TMS / NOAD pool created");
        expect(text.text).toBe("A new pool lets anyone swap NOAD for TMS.");
        expect(text.tag).toBe("Pool");
    });

    it("writes a mint with its amount and recipient, in the primary", () => {
        const text = describeTokenEvent(event("minted", {amount: "1000000000", details: {recipient: CREATOR}}), ctx, NOAD);

        expect(text).toMatchObject({title: "1,000 NOAD minted", tag: "Mint", primary: true});
        expect(text.text).toBe("Minted by the admin to bze1z3…qwg3l.");
    });

    it("tells an admin change from a renounce", () => {
        expect(describeTokenEvent(event("admin_changed", {details: {to: "bze1newadmin000000000000000000000000000"}}), ctx).title).toBe("Admin changed");
        expect(describeTokenEvent(event("admin_changed", {details: {to: ""}}), ctx).title).toBe("Admin renounced");
    });

    it.each([
        ["created", "NOAD created"],
        ["burned", "NOAD burned"],
        ["metadata_changed", "Details updated"],
        ["halted", "Trading halted"],
        ["unhalted", "Trading resumed"],
        ["market_created", "NOAD / BZE market created"],
        ["something_new", "Token updated"],
    ])("titles %s as %s", (kind, title) => {
        const details = kind === "market_created" ? {base: NOAD, quote: "ubze"} : null;

        expect(describeTokenEvent(event(kind, {details}), ctx, NOAD).title).toBe(title);
    });
});

describe("eventWhen", () => {
    it("writes the UTC day and the block", () => {
        expect(eventWhen({time: "2026-11-04T23:59:28Z", height: 4082925})).toBe("Nov 4, 2026 · block 4,082,925");
    });

    it("keeps the block when the time can't be read", () => {
        expect(eventWhen({time: "nope", height: 12})).toBe("block 12");
    });
});
