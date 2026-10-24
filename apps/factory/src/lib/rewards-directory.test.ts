import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { DenomReward, DenomRewardSchedule } from "@bze/bze-ui-kit";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import {
    DEFAULT_REWARDS_VIEW,
    GroupInput,
    REWARD_FILTERS,
    REWARD_KINDS,
    REWARD_SORTS,
    RewardGroup,
    TokenLookup,
    airdropDisabledReason,
    compoundedStatus,
    createdBy,
    formatLock,
    groupRewards,
    keepsCompounded,
    keepsSimple,
    matchesStakedToken,
    parseRewardsView,
    perDayLine,
    rewardCount,
    rewardsHref,
    searchText,
    simpleStatus,
    sortRewardGroups,
    specLine,
} from "./rewards-directory";

const dr = (denom: string, staked: string): DenomReward => ({ staking_denom: denom, lock: 1, min_stake: "0", staked_amount: staked });

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

const schedule = (prize_denom: string): DenomRewardSchedule =>
    ({ schedule_id: prize_denom, staking_denom: "", prize_denom, daily_amount: "1", duration: 10, payouts: 1 });

const TICKERS: Record<string, string> = { ubze: "BZE", utok: "TOK", umine: "MINE", "factory/bze1me/umine": "MINE", ulp: "TOK/BZE LP" };

const lookup = (prices: Record<string, number> = {}): TokenLookup => ({
    token: denom => ({ denom, ticker: TICKERS[denom] ?? denom, name: undefined, decimals: 0 }),
    usdPrice: denom => (prices[denom] === undefined ? undefined : new BigNumber(prices[denom])),
});

const input = (over: Partial<GroupInput> = {}, view: Partial<GroupInput["view"]> = {}): GroupInput => ({
    compounded: [],
    schedules: {},
    simple: [],
    ...over,
    view: { kind: "all", filter: "all", q: "", denom: "", ...view },
});

const tickers = (rows: { ticker: string }[]) => rows.map(r => r.ticker);
const query = (q: string) => { const p = new URLSearchParams(q); return (k: string) => p.get(k); };

describe("URL state", () => {
    it("defaults to every kind, any filter, most staked, no search", () => {
        expect(parseRewardsView(query(""))).toEqual({ kind: "all", filter: "all", sort: "staked", q: "", denom: "" });
        expect(parseRewardsView(query("kind=x&filter=y&sort=z"))).toEqual(DEFAULT_REWARDS_VIEW);
    });

    it("maps the old tab= to its kind, unless a kind is given", () => {
        expect(parseRewardsView(query("tab=holder")).kind).toBe("compounded");
        expect(parseRewardsView(query("tab=programs")).kind).toBe("simple");
        expect(parseRewardsView(query("tab=nope")).kind).toBe("all");
        expect(parseRewardsView(query("tab=programs&kind=compounded")).kind).toBe("compounded");
    });

    it("maps the old status= chips to the filter, unless a filter is given", () => {
        expect(parseRewardsView(query("filter=all&status=running")).filter).toBe("running");
        expect(parseRewardsView(query("status=finished")).filter).toBe("finished");
        expect(parseRewardsView(query("status=all")).filter).toBe("all");
        expect(parseRewardsView(query("filter=stakers&status=finished")).filter).toBe("stakers");
    });

    it("round-trips every view through the link", () => {
        for (const kind of REWARD_KINDS) {
            for (const filter of REWARD_FILTERS) {
                for (const sort of REWARD_SORTS) {
                    const href = rewardsHref({ kind, filter, sort, q: "a b", denom: "factory/bze1x/utok" });
                    expect(href.startsWith("/rewards?")).toBe(true);
                    expect(parseRewardsView(query(href.split("?")[1]))).toEqual({ kind, filter, sort, q: "a b", denom: "factory/bze1x/utok" });
                }
            }
        }
    });

    it("writes the search and the deep-linked token only when set", () => {
        expect(rewardsHref()).toBe("/rewards?kind=all&filter=all&sort=staked");
        expect(rewardsHref({ q: "  " })).toBe("/rewards?kind=all&filter=all&sort=staked");
        expect(rewardsHref({ kind: "simple", q: "tok" })).toBe("/rewards?kind=simple&filter=all&sort=staked&q=tok");
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

describe("airdropDisabledReason", () => {
    it("explains a DR without stakers (chain error 5018)", () => {
        expect(airdropDisabledReason({ staked_amount: "0" })).toBe("Nothing staked yet");
        expect(airdropDisabledReason({ staked_amount: "" })).toBe("Nothing staked yet");
        expect(airdropDisabledReason({ staked_amount: "5" })).toBe("");
    });
});

describe("the DEX's words", () => {
    it("statuses: paying daily or airdrops only; running, waiting for stakers or finished", () => {
        expect(compoundedStatus([schedule("ubze")])).toBe("paying");
        expect(compoundedStatus([])).toBe("airdrops");
        expect(compoundedStatus(undefined)).toBeUndefined();
        expect(compoundedStatus(null)).toBeUndefined();
        expect(simpleStatus(reward("1"))).toBe("running");
        expect(simpleStatus(reward("1", { staked_amount: "0" }))).toBe("waiting");
        expect(simpleStatus(reward("1", { payouts: 10 }))).toBe("finished");
    });

    it("spec line: Unlock, Min when there is one, the status", () => {
        expect(formatLock(7)).toBe("7d");
        expect(formatLock(0)).toBe("instant");
        expect(specLine(7, "", "paying")).toBe("Unlock 7d · Paying daily");
        expect(specLine(3, "1K CRNCH", "running")).toBe("Unlock 3d · Min 1K CRNCH · Running");
        expect(specLine(0, "", "waiting")).toBe("Unlock instant · Waiting for stakers");
        expect(specLine(14, "", undefined)).toBe("Unlock 14d");
    });

    it("per day: the amount and the elapsed / duration days", () => {
        expect(perDayLine("500 VDL", 16, 30)).toBe("500 VDL / day · 16 / 30 days");
        expect(perDayLine("1 BZE", 1000, 36500)).toBe("1 BZE / day · 1,000 / 36,500 days");
    });
});

describe("filters", () => {
    it("compounded: Has stakers, Paying daily (loading stays, failed goes), never Finished", () => {
        expect(keepsCompounded(dr("utok", "0"), [], "all")).toBe(true);
        expect(keepsCompounded(dr("utok", "0"), [], "stakers")).toBe(false);
        expect(keepsCompounded(dr("utok", "5"), [], "stakers")).toBe(true);
        expect(keepsCompounded(dr("utok", "5"), [schedule("ubze")], "paying")).toBe(true);
        expect(keepsCompounded(dr("utok", "5"), [], "paying")).toBe(false);
        expect(keepsCompounded(dr("utok", "5"), undefined, "paying")).toBe(true);
        expect(keepsCompounded(dr("utok", "5"), null, "paying")).toBe(false);
        expect(keepsCompounded(dr("utok", "5"), [], "running")).toBe(true);
        expect(keepsCompounded(dr("utok", "5"), [], "finished")).toBe(false);
    });

    it("simple: Has stakers, Paying daily = running with stakers, Running, Finished", () => {
        const running = reward("1");
        const waiting = reward("2", { staked_amount: "0" });
        const finished = reward("3", { payouts: 10 });
        const keep = (f: Parameters<typeof keepsSimple>[1]) => [running, waiting, finished].filter(r => keepsSimple(r, f)).map(r => r.reward_id);
        expect(keep("all")).toEqual(["1", "2", "3"]);
        expect(keep("stakers")).toEqual(["1", "3"]);
        expect(keep("paying")).toEqual(["1"]);
        expect(keep("running")).toEqual(["1", "2"]);
        expect(keep("finished")).toEqual(["3"]);
        expect(keep("mine")).toEqual(["1", "2", "3"]);
    });
});

describe("groupRewards", () => {
    it("one row per staked token: its compounded reward, then its simple rewards; chain order", () => {
        const groups = groupRewards(input({
            compounded: [dr("ubze", "1500"), dr("utok", "0")],
            schedules: { ubze: [schedule("ubze"), schedule("utok")], utok: [] },
            simple: [reward("3", { staking_denom: "utok", prize_denom: "umine", payouts: 10 }), reward("2", { staking_denom: "ulp", prize_denom: "utok" }), reward("1", { staking_denom: "utok", staked_amount: "5" })],
        }), lookup());

        expect(tickers(groups)).toEqual(["BZE", "TOK", "TOK/BZE LP"]);
        const [bze, tok, lp] = groups;
        expect(bze.compounded?.staking_denom).toBe("ubze");
        expect(bze.simple).toEqual([]);
        expect(bze.earn).toEqual(["ubze", "utok"]);
        // Running before finished.
        expect(tok.simple.map(r => r.reward_id)).toEqual(["1", "3"]);
        // The finished reward pays nothing any more: not in Earn.
        expect(tok.earn).toEqual(["ubze"]);
        // Staked in every listed reward of the token: 0 + 5 + 1.
        expect(tok.stakedDisplay.toString()).toBe("6");
        expect(rewardCount(tok)).toBe(3);
        expect(lp.compounded).toBeUndefined();
        expect(rewardCount(lp)).toBe(1);
    });

    it("schedules: missing while loading, null when they failed", () => {
        const [loading, failed] = groupRewards(input({ compounded: [dr("ubze", "1"), dr("utok", "1")], schedules: { utok: null } }), lookup());
        expect(loading.schedules).toBeUndefined();
        expect(failed.schedules).toBeNull();
    });

    it("kind keeps one kind; a token left without rewards drops out", () => {
        const base = { compounded: [dr("ubze", "1")], simple: [reward("1")] };
        expect(tickers(groupRewards(input(base, { kind: "compounded" }), lookup()))).toEqual(["BZE"]);
        expect(tickers(groupRewards(input(base, { kind: "simple" }), lookup()))).toEqual(["TOK"]);
        expect(groupRewards(input(base, { filter: "finished" }), lookup())).toEqual([]);
    });

    it("search and Yours look at the staked token", () => {
        const base = { compounded: [dr("ubze", "1"), dr("factory/bze1me/umine", "1")], simple: [reward("1")] };
        expect(tickers(groupRewards(input(base, { q: "tok" }), lookup()))).toEqual(["TOK"]);
        expect(tickers(groupRewards({ ...input(base, { filter: "mine" }), address: "bze1me" }, lookup()))).toEqual(["MINE"]);
        expect(groupRewards(input(base, { filter: "mine" }), lookup())).toEqual([]);
    });
});

describe("sortRewardGroups", () => {
    const group = (ticker: string, staked: number, over: Partial<RewardGroup> = {}): RewardGroup => ({
        denom: `u${ticker.toLowerCase()}`,
        ticker,
        schedules: [],
        simple: [],
        stakedDisplay: new BigNumber(staked),
        earn: [],
        ...over,
    });

    it("Most staked compares USD value when both prices are known, else the display amount", () => {
        const a = group("A", 1500, { usdPrice: new BigNumber("0.01") });
        const b = group("B", 50, { usdPrice: new BigNumber(1) });
        expect(tickers(sortRewardGroups([a, b], "staked"))).toEqual(["B", "A"]);
        expect(tickers(sortRewardGroups([a, group("C", 50)], "staked"))).toEqual(["A", "C"]);
    });

    it("A–Z ignores case", () => {
        expect(tickers(sortRewardGroups([group("b", 0), group("A", 0), group("C", 0)], "name"))).toEqual(["A", "b", "C"]);
    });

    it("Most prize tokens counts Earn; rows whose daily prizes are loading keep their slot", () => {
        const loading = group("L", 0, { compounded: dr("ul", "0"), schedules: undefined });
        const rows = [group("A", 0, { earn: ["x"] }), loading, group("B", 0, { earn: ["x", "y", "z"] }), group("C", 0, { earn: ["x", "y"] })];
        expect(tickers(sortRewardGroups(rows, "prizes"))).toEqual(["B", "L", "C", "A"]);
    });

    it("keeps the chain order on ties and never mutates its input", () => {
        const rows = [group("A", 1), group("B", 1), group("C", 2)];
        expect(tickers(sortRewardGroups(rows, "staked"))).toEqual(["C", "A", "B"]);
        expect(tickers(rows)).toEqual(["A", "B", "C"]);
    });
});
