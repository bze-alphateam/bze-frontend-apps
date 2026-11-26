import {describe, expect, it} from "vitest";
import {percentDown, percentUp, ratioPercentUp, tallySummary, tallyView} from "./proposal-tally";
import {CONFIG} from "@/test/proposal-fixtures";

const tally = (denominator: string, yes: string, no: string, abstain = "0") => ({denominator, yes, no, abstain});
const bar = (view: ReturnType<typeof tallyView>, id: string) => view!.bars.find((b) => b.id === id)!;

describe("percent text", () => {
    it("rounds down for a share achieved and up for a bar to reach", () => {
        expect(percentDown("1", "3")).toBe("33.33%");
        expect(percentUp("1", "3")).toBe("33.34%");
        expect(percentDown("2", "5")).toBe("40%");
        expect(percentUp("2", "5")).toBe("40%");
        expect(percentDown("0", "0")).toBe("0%");
        expect(ratioPercentUp("0.333333333333333333")).toBe("33.34%");
        expect(ratioPercentUp("0.400000000000000000")).toBe("40%");
        expect(ratioPercentUp("1")).toBe("100%");
    });
});

describe("tallyView against the pinned bars (the BFE-369 boundaries)", () => {
    it("a turnout exactly on the quorum counts, and one weight short does not", () => {
        const on = tallyView(CONFIG, tally("1000", "300", "100"), false);
        expect(bar(on, "quorum")).toMatchObject({met: true, achieved: "40%", required: "40%", comparison: "at least"});

        const short = tallyView(CONFIG, tally("1000", "300", "99"), false);
        expect(bar(short, "quorum")).toMatchObject({met: false, achieved: "39.9%", required: "40%"});
    });

    it("the text never claims more than the rule: a hair under the quorum reads below the bar", () => {
        // 399999 / 1000000 = 39.9999%: shown as 39.99%, not 40%
        const view = tallyView(CONFIG, tally("1000000", "299999", "100000"), false);
        expect(bar(view, "quorum")).toMatchObject({met: false, achieved: "39.99%", required: "40%"});
    });

    it("yes has to be strictly more than the threshold: a tie does not pass", () => {
        const tie = tallyView(CONFIG, tally("100", "25", "25"), false);
        expect(bar(tie, "quorum").met).toBe(true);
        expect(bar(tie, "threshold")).toMatchObject({met: false, achieved: "50%", required: "50%", comparison: "more than"});
        expect(tie!.passesRegular).toBe(false);

        const above = tallyView(CONFIG, tally("100", "26", "25"), false);
        expect(bar(above, "threshold").met).toBe(true);
        expect(above!.passesRegular).toBe(true);
    });

    it("abstain counts for the turnout but not for the share of yes", () => {
        const view = tallyView(CONFIG, tally("100", "20", "10", "10"), false);
        expect(bar(view, "quorum")).toMatchObject({met: true, achieved: "40%"});
        expect(bar(view, "threshold").achieved).toBe("66.66%");
    });

    it("no votes at all: nothing is met", () => {
        const view = tallyView(CONFIG, tally("100", "0", "0"), false);
        expect(view!.bars.map((b) => b.met)).toEqual([false, false]);
        expect(view!.passesRegular).toBe(false);
    });

    it("an expedited proposal adds the two expedite bars (both against the whole denominator)", () => {
        const view = tallyView(CONFIG, tally("100", "71", "0"), true);
        expect(view!.bars.map((b) => b.id)).toEqual(["quorum", "threshold", "expedite-quorum", "expedite-yes"]);
        expect(bar(view, "expedite-quorum")).toMatchObject({met: true, required: "60%"});
        expect(bar(view, "expedite-yes")).toMatchObject({met: true, achieved: "71%", required: "70%"});
        expect(view!.passesExpedite).toBe(true);

        const exact = tallyView(CONFIG, tally("100", "70", "0"), true);
        expect(bar(exact, "expedite-yes").met).toBe(false);
        expect(exact!.passesExpedite).toBe(false);
    });

    it("a regular proposal has no expedite verdict", () => {
        expect(tallyView(CONFIG, tally("100", "71", "0"), false)!.passesExpedite).toBeNull();
    });

    it("keeps the remaining weight and the stacked shares of the denominator", () => {
        const view = tallyView(CONFIG, tally("1000", "300", "100", "50"), false)!;
        expect(view.remaining).toBe("550");
        expect(view.shares).toEqual({yes: 3000, no: 1000, abstain: 500});
    });

    it("works with weights beyond a safe integer", () => {
        const view = tallyView(CONFIG, tally("1000000000000000000000", "300000000000000000000", "100000000000000000000"), false);
        expect(bar(view, "quorum")).toMatchObject({met: true, achieved: "40%"});
    });

    it("has no bars without the pinned rules, without a tally or with unreadable ratios", () => {
        expect(tallyView(null, tally("100", "1", "0"), false)).toBeNull();
        expect(tallyView(CONFIG, null, false)).toBeNull();
        expect(tallyView({...CONFIG, min_quorum: "forty percent"}, tally("100", "1", "0"), false)).toBeNull();
    });

    it("uses the pinned config it is given, never anything else", () => {
        const stricter = {...CONFIG, min_quorum: "0.500000000000000000"};
        expect(bar(tallyView(stricter, tally("100", "30", "10"), false), "quorum").met).toBe(false);
        expect(bar(tallyView(CONFIG, tally("100", "30", "10"), false), "quorum").met).toBe(true);
    });
});

describe("tallySummary", () => {
    it("turnout and the share of yes, rounded down", () => {
        expect(tallySummary(tally("1000", "300", "100", "50"))).toBe("Turnout 45%, 75% yes");
    });
    it("no yes share without a decided vote, nothing without a tally", () => {
        expect(tallySummary(tally("1000", "0", "0", "50"))).toBe("Turnout 5%");
        expect(tallySummary(null)).toBe("");
    });
});
