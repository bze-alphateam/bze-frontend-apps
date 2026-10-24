import { describe, it, expect, vi } from "vitest";
import { getBurnerApp, getDexApp } from "@bze/bze-ui-kit";
import { factsFromTokenSetup, nextActions, type NextAction, type NextActionKind, type NextActionContext } from "./next-actions";

const HONEY = "factory/bze1creator/uhoney";
const ENC = encodeURIComponent(HONEY);
const DEX = getDexApp().href;
const BURNER = getBurnerApp().href;

const keys = (r: { recommended?: NextAction; more: NextAction[] }) => ({
    recommended: r.recommended?.key,
    more: r.more.map(a => a.key),
});
const target = (a: NextAction | undefined) => a?.target;
const byKey = (r: { recommended?: NextAction; more: NextAction[] }, key: string) =>
    [r.recommended, ...r.more].find(a => a?.key === key);

describe("nextActions", () => {
    describe("tokenCreated", () => {
        const ctx = { denom: HONEY, ticker: "HONEY" };

        it("recommends a DEX market, then staking rewards, an airdrop and the registry", () => {
            const r = nextActions("tokenCreated", ctx);
            expect(keys(r)).toEqual({ recommended: "market", more: ["rewards", "airdrop", "registry"] });
            expect(target(r.recommended)).toEqual({ href: `/create/market?base=${ENC}` });
            expect(target(byKey(r, "rewards"))).toEqual({ href: `/create/rewards?denom=${ENC}` });
            expect(byKey(r, "airdrop")?.title).toBe("Airdrop HONEY");
            expect(target(byKey(r, "airdrop"))).toEqual({ href: `/airdrop?prize=${ENC}` });
            expect(target(byKey(r, "registry"))).toEqual({ href: `/official?denom=${ENC}` });
        });

        it("leaves the registry out when listed, or on testnet", () => {
            expect(keys(nextActions("tokenCreated", ctx, { registry: "listed" })).more).toEqual(["rewards", "airdrop"]);
            expect(keys(nextActions("tokenCreated", ctx, { registry: "off" })).more).toEqual(["rewards", "airdrop"]);
        });
    });

    it("poolCreated: only adding liquidity, on the DEX pool page", () => {
        const r = nextActions("poolCreated", { poolId: "7" });
        expect(keys(r)).toEqual({ recommended: "addLiquidity", more: [] });
        expect(target(r.recommended)).toEqual({ app: "dex", href: `${DEX}/pools/details?id=7` });
    });

    it("marketCreated: only opening the market on the DEX", () => {
        const r = nextActions("marketCreated", { base: HONEY, quote: "ubze" });
        expect(keys(r)).toEqual({ recommended: "openMarket", more: [] });
        expect((target(r.recommended) as { app: string }).app).toBe("dex");
    });

    it("simpleRewardCreated: only Stake on DEX", () => {
        const r = nextActions("simpleRewardCreated", { stakedDenom: HONEY, stakedTicker: "HONEY" });
        expect(keys(r)).toEqual({ recommended: "stakeOnDex", more: [] });
        expect(target(r.recommended)).toEqual({ app: "dex", href: `${DEX}/staking?search=HONEY` });
    });

    it("compoundedCreated: Stake on DEX, then Add more rewards", () => {
        const r = nextActions("compoundedCreated", { denom: HONEY, ticker: "HONEY" });
        expect(keys(r)).toEqual({ recommended: "stakeOnDex", more: ["moreRewards"] });
        expect(target(byKey(r, "moreRewards"))).toEqual({ href: `/denom-reward/schedule?denom=${ENC}` });
    });

    describe("prizeAdded", () => {
        it("on a compounded reward: Stake on DEX, then Add more rewards", () => {
            const r = nextActions("prizeAdded", { stakedDenom: HONEY, stakedTicker: "HONEY" });
            expect(keys(r)).toEqual({ recommended: "stakeOnDex", more: ["moreRewards"] });
            expect(target(byKey(r, "moreRewards"))).toEqual({ href: `/denom-reward/schedule?denom=${ENC}` });
        });

        it("through a simple reward: only Stake on DEX", () => {
            expect(keys(nextActions("prizeAdded", { stakedDenom: HONEY, stakedTicker: "HONEY", viaSimpleReward: true })))
                .toEqual({ recommended: "stakeOnDex", more: [] });
        });
    });

    describe("multisendFinished", () => {
        it("batched: the report download", () => {
            const downloadReport = vi.fn();
            const r = nextActions("multisendFinished", { denom: HONEY, ticker: "HONEY", downloadReport });
            expect(keys(r)).toEqual({ recommended: "report", more: ["sendAgain"] });
            expect(target(r.recommended)).toEqual({ onClick: downloadReport });
        });

        it("not batched: another list with the token picked", () => {
            const r = nextActions("multisendFinished", { denom: HONEY, ticker: "HONEY" });
            expect(keys(r)).toEqual({ recommended: "sendAgain", more: [] });
            expect(target(r.recommended)).toEqual({ href: `/airdrop?to=list&denom=${ENC}` });
        });
    });

    it("raffleStarted: only opening it on Burner", () => {
        const r = nextActions("raffleStarted", { denom: HONEY, ticker: "HONEY" });
        expect(keys(r)).toEqual({ recommended: "openRaffle", more: [] });
        const t = target(r.recommended) as { app: string; href: string };
        expect(t.app).toBe("burner");
        expect(t.href.startsWith(BURNER)).toBe(true);
    });

    describe("listed", () => {
        const ctx = { denom: HONEY, ticker: "HONEY" };

        it("recommends Back to the token, then the brand kit and staking rewards", () => {
            const r = nextActions("listed", ctx);
            expect(keys(r)).toEqual({ recommended: "backToToken", more: ["brandKit", "rewards"] });
            expect(target(r.recommended)).toEqual({ href: `/tokens/token?denom=${ENC}` });
            expect(target(byKey(r, "rewards"))).toEqual({ href: `/create/rewards?denom=${ENC}` });
        });

        it("skips what the chain shows is done", () => {
            expect(keys(nextActions("listed", ctx, { brandKitSet: true, hasCompoundedReward: true })))
                .toEqual({ recommended: "backToToken", more: [] });
        });
    });

    it("never proposes renouncing or transferring the admin, and never more than three more", () => {
        const kinds: NextActionKind[] = [
            "tokenCreated", "poolCreated", "marketCreated", "simpleRewardCreated", "compoundedCreated",
            "prizeAdded", "multisendFinished", "raffleStarted", "listed",
        ];
        const ctx: NextActionContext = { denom: HONEY, ticker: "HONEY", base: HONEY, quote: "ubze", stakedDenom: HONEY };
        for (const kind of kinds) {
            const r = nextActions(kind, ctx);
            for (const a of [r.recommended, ...r.more]) {
                expect(`${a?.title} ${a?.text} ${a?.cta}`).not.toMatch(/renounce|transfer admin|lock/i);
            }
            expect(r.more.length).toBeLessThanOrEqual(3);
        }
    });
});

describe("factsFromTokenSetup", () => {
    const setup = {
        isLoading: false,
        items: [{ key: "brandKit", state: "done" }, { key: "registry", state: "todo" }],
        pools: [{ id: "1", base: HONEY, quote: "ubze" }],
        hasMarket: true,
        denomReward: { staking_denom: HONEY },
        hasStakers: false,
    };

    it("is undefined while useTokenSetup is still reading", () => {
        expect(factsFromTokenSetup({ ...setup, isLoading: true })).toBeUndefined();
    });

    it("maps the setup to facts", () => {
        expect(factsFromTokenSetup(setup)).toEqual({
            pools: setup.pools,
            hasMarket: true,
            hasCompoundedReward: true,
            hasStakers: false,
            registry: "not-listed",
            brandKitSet: true,
        });
    });

    it("no registry item (testnet) is 'off'; a listed one is 'listed'; no denom reward is not stakable", () => {
        expect(factsFromTokenSetup({ ...setup, items: [], denomReward: undefined })).toMatchObject({ registry: "off", brandKitSet: false, hasCompoundedReward: false });
        expect(factsFromTokenSetup({ ...setup, items: [{ key: "registry", state: "done" }] })?.registry).toBe("listed");
    });
});
