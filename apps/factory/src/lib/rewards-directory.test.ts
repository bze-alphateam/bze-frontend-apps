import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import {
    DEFAULT_REWARDS_VIEW,
    HolderRow,
    REWARD_FILTERS,
    REWARD_KINDS,
    REWARD_SORTS,
    SIMPLE_STATUSES,
    SimpleRow,
    airdropDisabledReason,
    createdBy,
    dailyPrizeEnd,
    filterHolderRows,
    filterSimpleRows,
    matchesStakedToken,
    parseRewardsView,
    rewardsHref,
    searchText,
    sortHolderRows,
    sortSimpleRows,
    toCounts,
} from "./rewards-directory";

const counts = (prizes: number, schedules: number) => ({ prizes, schedules, payingDenoms: [] });

const row = (ticker: string, staked: string, over: Partial<HolderRow> = {}): HolderRow => ({
    dr: { staking_denom: `u${ticker.toLowerCase()}`, lock: 1, min_stake: "0", staked_amount: staked },
    ticker,
    stakedDisplay: new BigNumber(staked),
    counts: counts(0, 0),
    ...over,
});

const reward = (id: string, over: Partial<StakingRewardSDKType> = {}): StakingRewardSDKType => ({
    reward_id: id,
    prize_amount: "1000000",
    prize_denom: "ubze",
    staking_denom: "utok",
    duration: 10,
    payouts: 1,
    min_stake: 0n,
    lock: 0,
    staked_amount: "1",
    distributed_stake: "0",
    ...over,
});

const simple = (ticker: string, over: Partial<SimpleRow> = {}, r: Partial<StakingRewardSDKType> = {}): SimpleRow => ({
    reward: reward(ticker, { staking_denom: `u${ticker.toLowerCase()}`, ...r }),
    ticker,
    stakedDisplay: new BigNumber(1),
    prizeDisplay: new BigNumber(1),
    ...over,
});

const tickers = (rows: { ticker: string }[]) => rows.map(r => r.ticker);
const query = (q: string) => { const p = new URLSearchParams(q); return (k: string) => p.get(k); };

describe("URL state", () => {
    it("defaults to every kind, any filter, most staked, any status, no search", () => {
        expect(parseRewardsView(query(""))).toEqual({ kind: "all", filter: "all", sort: "staked", status: "all", q: "", denom: "" });
        expect(parseRewardsView(query("kind=x&filter=y&sort=z&status=w"))).toEqual(DEFAULT_REWARDS_VIEW);
    });

    it("maps the old tab= to its kind, unless a kind is given", () => {
        expect(parseRewardsView(query("tab=holder")).kind).toBe("compounded");
        expect(parseRewardsView(query("tab=programs")).kind).toBe("simple");
        expect(parseRewardsView(query("tab=nope")).kind).toBe("all");
        expect(parseRewardsView(query("tab=programs&kind=compounded")).kind).toBe("compounded");
        // The old Paying now filter keeps working.
        expect(parseRewardsView(query("tab=holder&filter=paying")).filter).toBe("paying");
    });

    it("round-trips every view through the link", () => {
        for (const kind of REWARD_KINDS) {
            for (const filter of REWARD_FILTERS) {
                for (const sort of REWARD_SORTS) {
                    for (const status of SIMPLE_STATUSES) {
                        const href = rewardsHref({ kind, filter, sort, status, q: "a b", denom: "factory/bze1x/utok" });
                        expect(href.startsWith("/rewards?")).toBe(true);
                        expect(parseRewardsView(query(href.split("?")[1]))).toEqual({ kind, filter, sort, status, q: "a b", denom: "factory/bze1x/utok" });
                    }
                }
            }
        }
    });

    it("writes the search and the deep-linked token only when set", () => {
        expect(rewardsHref()).toBe("/rewards?kind=all&filter=all&sort=staked&status=all");
        expect(rewardsHref({ q: "  " })).toBe("/rewards?kind=all&filter=all&sort=staked&status=all");
        expect(rewardsHref({ kind: "simple", q: "tok" })).toBe("/rewards?kind=simple&filter=all&sort=staked&status=all&q=tok");
    });

    it("prefills the search with the deep-linked token until something is typed", () => {
        expect(searchText({ q: "", denom: "ubze" })).toBe("ubze");
        expect(searchText({ q: "tok", denom: "ubze" })).toBe("tok");
    });
});

describe("createdBy", () => {
    it("is the connected wallet's factory prefix, nothing without a wallet", () => {
        expect(createdBy("factory/bze1me/utok", "bze1me")).toBe(true);
        expect(createdBy("factory/bze1meme/utok", "bze1me")).toBe(false);
        expect(createdBy("factory/bze1me/utok", undefined)).toBe(false);
        expect(createdBy("ubze", "bze1me")).toBe(false);
    });
});

describe("matchesStakedToken", () => {
    const tok = { denom: "factory/bze1x/utok", ticker: "TOK", name: "Token" };

    it("matches ticker, name or denom, ignoring case; an empty search matches all", () => {
        expect(matchesStakedToken(tok, "")).toBe(true);
        expect(matchesStakedToken(tok, "tok")).toBe(true);
        expect(matchesStakedToken(tok, "OKEN")).toBe(true);
        expect(matchesStakedToken(tok, "bze1x")).toBe(true);
        expect(matchesStakedToken(tok, "nope")).toBe(false);
    });

    it("matches the deep-linked denom exactly, not every denom containing it", () => {
        const lp = { denom: "ulp_factory/bze1x/utok_ubze", ticker: "TOK/BZE LP" };
        const bze = { denom: "ubze", ticker: "BZE" };
        expect(matchesStakedToken(lp, "ubze")).toBe(true);
        expect(matchesStakedToken(lp, "ubze", "ubze")).toBe(false);
        expect(matchesStakedToken(bze, "ubze", "ubze")).toBe(true);
        // Once the search is edited it is an ordinary search again.
        expect(matchesStakedToken(lp, "ubz", "ubze")).toBe(true);
    });
});

describe("toCounts", () => {
    it("counts prize entries, running schedules and the distinct paying prize denoms", () => {
        expect(toCounts([{}, {}, {}], [{ prize_denom: "ubze" }, { prize_denom: "utok" }, { prize_denom: "ubze" }]))
            .toEqual({ prizes: 3, schedules: 3, payingDenoms: ["ubze", "utok"] });
    });
});

describe("airdropDisabledReason", () => {
    it("explains a DR without stakers (chain error 5018)", () => {
        expect(airdropDisabledReason({ staked_amount: "0" })).toBe("Nothing staked yet");
        expect(airdropDisabledReason({ staked_amount: "" })).toBe("Nothing staked yet");
        expect(airdropDisabledReason({ staked_amount: "1" })).toBe("");
    });
});

describe("dailyPrizeEnd", () => {
    it("names the end day", () => {
        const now = new Date(2026, 9, 22, 12);
        expect(dailyPrizeEnd("50 BZE", 4, now)).toBe("50 BZE a day · ends 26 Oct");
    });
});

describe("filterHolderRows", () => {
    const rows = [
        row("AAA", "10", { counts: counts(1, 2) }),
        row("BBB", "0", { counts: counts(1, 1) }),
        row("CCC", "5", { counts: counts(2, 0) }),
        row("DDD", "5", { counts: undefined }),
        row("EEE", "5", { counts: null }),
        row("MINE", "0", { dr: { staking_denom: "factory/bze1me/umine", lock: 1, min_stake: "0", staked_amount: "0" } }),
    ];

    it("All keeps every row", () => {
        expect(tickers(filterHolderRows(rows, "all"))).toEqual(["AAA", "BBB", "CCC", "DDD", "EEE", "MINE"]);
    });

    it("Has stakers drops zero-staked rows", () => {
        expect(tickers(filterHolderRows(rows, "stakers"))).toEqual(["AAA", "CCC", "DDD", "EEE"]);
    });

    it("Paying now keeps running schedules and rows still loading, drops failed counts", () => {
        expect(tickers(filterHolderRows(rows, "paying"))).toEqual(["AAA", "BBB", "DDD"]);
    });

    it("Created by you keeps the wallet's own tokens, none without a wallet", () => {
        expect(tickers(filterHolderRows(rows, "mine", "bze1me"))).toEqual(["MINE"]);
        expect(filterHolderRows(rows, "mine")).toEqual([]);
    });
});

describe("filterSimpleRows", () => {
    const rows = [
        simple("RUN", {}, { payouts: 1, duration: 10 }),
        simple("DONE", {}, { payouts: 10, duration: 10, staked_amount: "0" }),
        simple("MINE", {}, { staking_denom: "factory/bze1me/umine" }),
    ];

    it("status keeps running or finished rewards", () => {
        expect(tickers(filterSimpleRows(rows, "all", "all"))).toEqual(["RUN", "DONE", "MINE"]);
        expect(tickers(filterSimpleRows(rows, "all", "running"))).toEqual(["RUN", "MINE"]);
        expect(tickers(filterSimpleRows(rows, "all", "finished"))).toEqual(["DONE"]);
    });

    it("Has stakers and Created by you apply; Paying now is about daily prizes and doesn't", () => {
        expect(tickers(filterSimpleRows(rows, "stakers", "all"))).toEqual(["RUN", "MINE"]);
        expect(tickers(filterSimpleRows(rows, "mine", "all", "bze1me"))).toEqual(["MINE"]);
        expect(tickers(filterSimpleRows(rows, "paying", "all"))).toEqual(["RUN", "DONE", "MINE"]);
    });
});

describe("sortHolderRows", () => {
    it("Most staked compares USD value when both prices are known", () => {
        const rows = [
            row("BZE", "1500", { usdPrice: new BigNumber("0.01") }), // $15
            row("TOK", "50", { usdPrice: new BigNumber("1") }), // $50
        ];
        expect(tickers(sortHolderRows(rows, "staked"))).toEqual(["TOK", "BZE"]);
    });

    it("Most staked falls back to the display amount without both prices", () => {
        const rows = [
            row("TOK", "50", { usdPrice: new BigNumber("1") }),
            row("BZE", "1500"),
            row("ZER", "50", { usdPrice: new BigNumber(0) }),
        ];
        expect(tickers(sortHolderRows(rows, "staked"))).toEqual(["BZE", "TOK", "ZER"]);
    });

    it("A–Z ignores case", () => {
        expect(tickers(sortHolderRows([row("tok", "1"), row("BZE", "1"), row("Abc", "1")], "name"))).toEqual(["Abc", "BZE", "tok"]);
    });

    it("Most prize tokens sorts loaded rows only; loading rows keep their slot, failed ones go last", () => {
        const rows = [
            row("ONE", "1", { counts: counts(1, 0) }),
            row("LOAD", "1", { counts: undefined }),
            row("FAIL", "1", { counts: null }),
            row("FIVE", "1", { counts: counts(5, 0) }),
            row("TWO", "1", { counts: counts(2, 0) }),
        ];
        expect(tickers(sortHolderRows(rows, "prizes"))).toEqual(["FIVE", "LOAD", "TWO", "ONE", "FAIL"]);
    });

    it("keeps the chain order on ties and never mutates its input", () => {
        const rows = [row("B", "1"), row("A", "1")];
        expect(tickers(sortHolderRows(rows, "staked"))).toEqual(["B", "A"]);
        sortHolderRows(rows, "name");
        expect(tickers(rows)).toEqual(["B", "A"]);
    });
});

describe("sortSimpleRows", () => {
    it("puts running rewards before finished ones, whatever the sort", () => {
        const rows = [
            simple("DONE", { stakedDisplay: new BigNumber(100) }, { payouts: 10, duration: 10 }),
            simple("RUN", { stakedDisplay: new BigNumber(1) }),
        ];
        for (const sort of REWARD_SORTS) expect(tickers(sortSimpleRows(rows, sort))).toEqual(["RUN", "DONE"]);
    });

    it("Most staked by USD when priced, else the display amount", () => {
        const rows = [
            simple("BZE", { stakedDisplay: new BigNumber(1500), usdPrice: new BigNumber("0.01") }),
            simple("TOK", { stakedDisplay: new BigNumber(50), usdPrice: new BigNumber(1) }),
        ];
        expect(tickers(sortSimpleRows(rows, "staked"))).toEqual(["TOK", "BZE"]);
        expect(tickers(sortSimpleRows(rows.map(r => ({ ...r, usdPrice: undefined })), "staked"))).toEqual(["BZE", "TOK"]);
    });

    it("Most prize tokens compares the prize a day, by USD when both are priced", () => {
        const rows = [
            simple("A", { prizeDisplay: new BigNumber(100), prizeUsdPrice: new BigNumber("0.01") }), // $1 a day
            simple("B", { prizeDisplay: new BigNumber(10), prizeUsdPrice: new BigNumber(1) }), // $10 a day
        ];
        expect(tickers(sortSimpleRows(rows, "prizes"))).toEqual(["B", "A"]);
        expect(tickers(sortSimpleRows(rows.map(r => ({ ...r, prizeUsdPrice: undefined })), "prizes"))).toEqual(["A", "B"]);
    });

    it("A–Z by staked token, chain order on ties, input untouched", () => {
        const rows = [simple("tok"), simple("BZE"), simple("Abc")];
        expect(tickers(sortSimpleRows(rows, "name"))).toEqual(["Abc", "BZE", "tok"]);
        expect(tickers(rows)).toEqual(["tok", "BZE", "Abc"]);
    });
});
