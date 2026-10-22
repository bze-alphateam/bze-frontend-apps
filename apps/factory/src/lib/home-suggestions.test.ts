import { describe, it, expect } from "vitest";
import {
    homeDrafts,
    suggestions,
    type HomeDrafts,
    type HomeToken,
    type TokenFacts,
    type TokenFactsState,
} from "./home-suggestions";
import { EMPTY_TOKEN_FORM } from "./token-draft";
import type { MultiSendRun, RunBatch } from "./multisend-run";

const tok = (ticker: string, logo?: string): HomeToken => ({ denom: `factory/bze1me/u${ticker.toLowerCase()}`, ticker, logo });
const HONEY = tok("HONEY", "honey.png");
const BEE = tok("BEE");
const WAX = tok("WAX");
const JAM = tok("JAM");

const POOL = { pair: "HONEY/BZE", lpDenom: "ulp_1", isNativePair: true };

// A token with everything set up: no rule matches.
const complete = (extra: Partial<TokenFacts> = {}): TokenFacts => ({
    pools: [POOL],
    runningSimpleRewards: ["ulp_1"],
    compounded: { stakedLabel: "1,200", schedules: [{ id: "4", daysLeft: 30 }] },
    ...extra,
});

const kinds = (drafts: HomeDrafts, tokens: HomeToken[], facts: Record<string, TokenFactsState>) =>
    suggestions(drafts, tokens, facts).cards.map(c => c.kind);

describe("suggestions: the rules for a token you created", () => {
    it("1. no pool: create a <T>/BZE pool", () => {
        const [card] = suggestions({}, [HONEY], { [HONEY.denom]: complete({ pools: [] }) }).cards;
        expect(card).toMatchObject({
            kind: "noPool",
            subject: "HONEY",
            state: "No market yet",
            why: "Nobody can buy HONEY yet. A HONEY/BZE pool lets people swap from the first minute.",
            action: { label: "Create a HONEY/BZE pool", href: `/pool/new?base=${encodeURIComponent(HONEY.denom)}` },
            avatar: { ticker: "HONEY", logo: "honey.png" },
            primary: false,
        });
    });

    it("2. a pool without a simple reward on its LP shares: reward the liquidity", () => {
        const [card] = suggestions({}, [HONEY], { [HONEY.denom]: complete({ runningSimpleRewards: [] }) }).cards;
        expect(card).toMatchObject({
            kind: "noLpReward",
            subject: "HONEY",
            state: "Pool HONEY/BZE · no staking rewards",
            why: "People hold HONEY/BZE pool shares but earn nothing for keeping them. A simple reward pays them to stay.",
            action: { label: "Reward HONEY/BZE liquidity", href: "/reward/new?staking=ulp_1" },
        });
    });

    it("2. prefers the pool against BZE, and any rewarded pool counts", () => {
        const pools = [{ pair: "HONEY/WAX", lpDenom: "ulp_2", isNativePair: false }, POOL];
        expect(suggestions({}, [HONEY], { [HONEY.denom]: complete({ pools, runningSimpleRewards: [] }) }).cards[0].action.href)
            .toBe("/reward/new?staking=ulp_1");
        expect(kinds({}, [HONEY], { [HONEY.denom]: complete({ pools, runningSimpleRewards: ["ulp_2"] }) })).toEqual([]);
    });

    it("3. a daily prize ending within 7 days: extend it", () => {
        const facts = complete({ compounded: { stakedLabel: "1,200", schedules: [{ id: "4", daysLeft: 30 }, { id: "7", daysLeft: 3 }] } });
        const [card] = suggestions({}, [HONEY], { [HONEY.denom]: facts }).cards;
        expect(card).toMatchObject({
            kind: "prizeEnding",
            subject: "HONEY compounded reward",
            state: "Daily prize ends in 3 days",
            why: "1,200 HONEY is staked. Extend the daily prize before it stops.",
            action: { label: "Extend the daily prize", href: `/denom-reward/schedule?denom=${encodeURIComponent(HONEY.denom)}&schedule=7` },
        });
    });

    it("3. the 7-day boundary: 7 days left is ending, 8 is not, and a finished prize is not", () => {
        const at = (daysLeft: number) => kinds({}, [HONEY], {
            [HONEY.denom]: complete({ compounded: { stakedLabel: "1", schedules: [{ id: "1", daysLeft }] } }),
        });
        expect(at(7)).toEqual(["prizeEnding"]);
        expect(at(8)).toEqual([]);
        expect(at(0)).toEqual([]);
        expect(suggestions({}, [HONEY], {
            [HONEY.denom]: complete({ compounded: { stakedLabel: "1", schedules: [{ id: "1", daysLeft: 1 }] } }),
        }).cards[0].state).toBe("Daily prize ends in 1 day");
    });

    it("4. not stakable: make it stakable", () => {
        const [card] = suggestions({}, [HONEY], { [HONEY.denom]: complete({ compounded: undefined }) }).cards;
        expect(card).toMatchObject({
            kind: "notStakable",
            subject: "HONEY",
            state: "Not stakable yet",
            why: "Make HONEY stakable so holders have a reason to keep it.",
            action: { label: "Make HONEY stakable", href: `/denom-reward/new?denom=${encodeURIComponent(HONEY.denom)}` },
        });
    });

    it("5. nothing to do: the token is skipped", () => {
        expect(kinds({}, [HONEY], { [HONEY.denom]: complete() })).toEqual([]);
    });

    it("takes the first matching rule only", () => {
        // No pool and not stakable: the pool comes first.
        expect(kinds({}, [HONEY], { [HONEY.denom]: { pools: [], runningSimpleRewards: [] } })).toEqual(["noPool"]);
        // Unrewarded pool and a prize ending: the liquidity reward comes first.
        expect(kinds({}, [HONEY], {
            [HONEY.denom]: complete({ runningSimpleRewards: [], compounded: { stakedLabel: "1", schedules: [{ id: "1", daysLeft: 2 }] } }),
        })).toEqual(["noLpReward"]);
        // A prize ending comes before... nothing else: a token with a prize is stakable.
        expect(kinds({}, [HONEY], {
            [HONEY.denom]: complete({ compounded: { stakedLabel: "1", schedules: [{ id: "1", daysLeft: 2 }] } }),
        })).toEqual(["prizeEnding"]);
    });

    it("never suggests Renounce or Transfer admin, and a renounced token gets the same suggestions", () => {
        // The rules don't read the admin at all: the token list carries none.
        const all = [complete({ pools: [] }), complete({ runningSimpleRewards: [] }), complete({ compounded: undefined })]
            .map(f => suggestions({}, [HONEY], { [HONEY.denom]: f }).cards[0]);
        for (const card of all) expect(`${card.action.label} ${card.why}`).not.toMatch(/renounce|transfer|admin/i);
    });

    it("skips a token whose facts failed, never guessing", () => {
        expect(kinds({}, [HONEY, BEE], { [HONEY.denom]: "error", [BEE.denom]: complete({ pools: [] }) })).toEqual(["noPool"]);
        expect(suggestions({}, [HONEY, BEE], { [HONEY.denom]: "error", [BEE.denom]: complete({ pools: [] }) }).cards[0].subject).toBe("BEE");
    });

    it("counts loading tokens as pending shimmer cards", () => {
        const result = suggestions({}, [HONEY, BEE], { [HONEY.denom]: "loading", [BEE.denom]: complete({ pools: [] }) });
        expect(result.cards.map(c => c.subject)).toEqual(["BEE"]);
        expect(result.pending).toBe(1);
        expect(suggestions({}, [HONEY], {}).pending).toBe(1);
    });
});

describe("suggestions: drafts and the 3-card cap", () => {
    const tokenDraft = { ticker: "BEE", answered: ["details"] as const };

    it("an unfinished token draft: step, progress and what is left", () => {
        const [card] = suggestions({ token: { ...tokenDraft, answered: ["details"] } }, [], {}).cards;
        expect(card).toMatchObject({
            kind: "tokenDraft",
            subject: "Unfinished: BEE token",
            state: "Draft · step 2 of 4 · saved in this browser",
            progress: { step: 2, total: 4 },
            why: "Supply, Permissions and Review are left. Everything you typed is still there.",
            action: { label: "Continue creating BEE", href: "/token/new" },
            primary: true,
        });
    });

    it.each([
        [[], 1, "Details, Supply, Permissions and Review are left."],
        [["details", "supply"], 3, "Permissions and Review are left."],
        [["details", "supply", "permissions"], 4, "Review is left."],
        [["details", "permissions"], 3, "Supply and Review are left."],
    ] as const)("the draft step text for %j", (answered, step, why) => {
        const [card] = suggestions({ token: { ticker: "BEE", answered } }, [], {}).cards;
        expect(card.state).toBe(`Draft · step ${step} of 4 · saved in this browser`);
        expect(card.why).toBe(`${why} Everything you typed is still there.`);
    });

    it("a draft without a ticker yet", () => {
        const [card] = suggestions({ token: { ticker: "", answered: [] } }, [], {}).cards;
        expect(card.subject).toBe("Unfinished token");
        expect(card.action.label).toBe("Continue creating your token");
    });

    it("a stopped multi-send run resumes; it wins over an unsent list", () => {
        const drafts: HomeDrafts = { multisendRun: { ticker: "WAX", stoppedAt: 3, batches: 5 }, multisendDraft: { ticker: "WAX" } };
        const cards = suggestions(drafts, [], {}).cards;
        expect(cards).toHaveLength(1);
        expect(cards[0]).toMatchObject({
            kind: "multisendRun",
            state: "Batch 3 of 5 stopped",
            action: { label: "Resume sending", href: "/multisend" },
        });
    });

    it("an unsent multi-send list continues", () => {
        const [card] = suggestions({ multisendDraft: { ticker: "WAX" } }, [], {}).cards;
        expect(card).toMatchObject({ kind: "multisendDraft", subject: "Your WAX list", action: { label: "Continue your list", href: "/multisend" } });
    });

    it("drafts come first, then tokens, at most 3 cards", () => {
        const facts = { [HONEY.denom]: complete({ pools: [] }), [BEE.denom]: complete({ pools: [] }), [WAX.denom]: complete({ pools: [] }) };
        const drafts: HomeDrafts = { token: tokenDraft, multisendDraft: { ticker: "WAX" } };
        expect(kinds(drafts, [HONEY, BEE, WAX], facts)).toEqual(["tokenDraft", "multisendDraft", "noPool"]);
        expect(suggestions({}, [HONEY, BEE, WAX], facts).cards.map(c => c.subject)).toEqual(["HONEY", "BEE", "WAX"]);
    });

    it("reads at most the first 3 tokens", () => {
        const facts = { [HONEY.denom]: complete(), [BEE.denom]: complete(), [WAX.denom]: complete(), [JAM.denom]: complete({ pools: [] }) };
        expect(kinds({}, [HONEY, BEE, WAX, JAM], facts)).toEqual([]);
    });
});

describe("homeDrafts", () => {
    const tokenOf = (denom: string) => ({ ticker: denom === "uwax" ? "WAX" : "?", logo: denom === "uwax" ? "wax.png" : undefined });
    const batch = (id: number, status: RunBatch["status"]): RunBatch => ({ id, count: 100, total: "100", status });
    const run = (statuses: RunBatch["status"][]): MultiSendRun => ({ fingerprint: "f", denom: "uwax", batches: statuses.map((s, i) => batch(i + 1, s)), startedAt: 0 });

    it("takes the token draft's symbol and finished steps", () => {
        expect(homeDrafts({ token: { form: { ...EMPTY_TOKEN_FORM, symbol: "BEE" }, answered: ["details"] } }, tokenOf).token)
            .toEqual({ ticker: "BEE", answered: ["details"] });
    });

    it("an unfinished run stops at its first unsent batch", () => {
        expect(homeDrafts({ multisendRun: run(["sent", "sent", "unknown", "pending"]) }, tokenOf).multisendRun)
            .toEqual({ ticker: "WAX", logo: "wax.png", stoppedAt: 3, batches: 4 });
    });

    it("a finished run is not work left", () => {
        expect(homeDrafts({ multisendRun: run(["sent", "sent"]) }, tokenOf).multisendRun).toBeUndefined();
    });

    it("a multi-send list without lines is no draft", () => {
        expect(homeDrafts({ multisendDraft: { denom: "uwax", mode: "same", sameAmount: "5", text: "  " } }, tokenOf).multisendDraft).toBeUndefined();
        expect(homeDrafts({ multisendDraft: { denom: "uwax", mode: "same", sameAmount: "5", text: "bze1a" } }, tokenOf).multisendDraft)
            .toEqual({ ticker: "WAX", logo: "wax.png" });
        expect(homeDrafts({ multisendDraft: { denom: "", mode: "same", sameAmount: "", text: "bze1a" } }, tokenOf).multisendDraft)
            .toEqual({ ticker: "" });
    });
});
