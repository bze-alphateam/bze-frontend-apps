import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import {
    DEFAULT_REWARDS_VIEW,
    PROGRAM_STATUSES,
    HolderRow,
    airdropDisabledReason,
    filterHolderRows,
    parseRewardsView,
    rewardsHref,
    sortHolderRows,
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

const tickers = (rows: HolderRow[]) => rows.map(r => r.ticker);
const query = (q: string) => { const p = new URLSearchParams(q); return (k: string) => p.get(k); };

describe("URL state", () => {
    it("defaults to holder rewards, all, most staked, every program", () => {
        expect(parseRewardsView(query(""))).toEqual({ tab: "holder", filter: "all", sort: "staked", status: "all" });
        expect(parseRewardsView(query("tab=x&filter=y&sort=z&status=w"))).toEqual(DEFAULT_REWARDS_VIEW);
    });

    it("round-trips every view through the link", () => {
        for (const tab of ["holder", "programs"] as const) {
            for (const filter of ["all", "stakers", "paying"] as const) {
                for (const sort of ["staked", "prizes", "name"] as const) {
                    for (const status of PROGRAM_STATUSES) {
                        const href = rewardsHref({ tab, filter, sort, status });
                        expect(href.startsWith("/rewards?")).toBe(true);
                        expect(parseRewardsView(query(href.split("?")[1]))).toEqual({ tab, filter, sort, status });
                    }
                }
            }
        }
        expect(rewardsHref({ filter: "paying" })).toBe("/rewards?tab=holder&filter=paying&sort=staked&status=all");
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
        expect(airdropDisabledReason({ staked_amount: "0" })).toBe("No stakers, nobody to airdrop to");
        expect(airdropDisabledReason({ staked_amount: "" })).toBe("No stakers, nobody to airdrop to");
        expect(airdropDisabledReason({ staked_amount: "1" })).toBe("");
    });
});

describe("filterHolderRows", () => {
    const rows = [
        row("AAA", "10", { counts: counts(1, 2) }),
        row("BBB", "0", { counts: counts(1, 1) }),
        row("CCC", "5", { counts: counts(2, 0) }),
        row("DDD", "5", { counts: undefined }),
        row("EEE", "5", { counts: null }),
    ];

    it("All keeps every row", () => {
        expect(tickers(filterHolderRows(rows, "all"))).toEqual(["AAA", "BBB", "CCC", "DDD", "EEE"]);
    });

    it("Has stakers drops zero-staked rows", () => {
        expect(tickers(filterHolderRows(rows, "stakers"))).toEqual(["AAA", "CCC", "DDD", "EEE"]);
    });

    it("Paying now keeps running schedules and rows still loading, drops failed counts", () => {
        expect(tickers(filterHolderRows(rows, "paying"))).toEqual(["AAA", "BBB", "DDD"]);
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

    it("Name A–Z ignores case", () => {
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
