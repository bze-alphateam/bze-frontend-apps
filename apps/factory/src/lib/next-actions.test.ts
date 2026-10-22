import { describe, it, expect, vi } from "vitest";
import { getBurnerApp, getDexApp, getFactoryApp } from "@bze/bze-ui-kit";
import { factsFromTokenSetup, nextActions, type NextAction, type NextActionKind, type NextActionContext } from "./next-actions";

const HONEY = "factory/bze1creator/uhoney";
const GIFT = "factory/bze1other/uwax";
const DEX = getDexApp().href;
const BURNER = getBurnerApp().href;
const FACTORY = getFactoryApp().href;

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

        it("recommends the HONEY/BZE pool with the token prefilled, then stakable, registry and brand kit", () => {
            const r = nextActions("tokenCreated", ctx);
            expect(keys(r)).toEqual({ recommended: "pool", more: ["makeStakable", "registry", "brandKit"] });
            expect(r.recommended?.title).toBe("Let people buy HONEY");
            expect(target(r.recommended)).toEqual({ href: `/pool/new?base=${encodeURIComponent(HONEY)}` });
            expect(target(byKey(r, "makeStakable"))).toEqual({ href: `/denom-reward/new?denom=${encodeURIComponent(HONEY)}` });
            expect(target(byKey(r, "registry"))).toEqual({ href: `/official?denom=${encodeURIComponent(HONEY)}` });
            expect(target(byKey(r, "brandKit"))).toEqual({ href: `/tokens/token?denom=${encodeURIComponent(HONEY)}#details` });
        });

        it("skips a pool that already exists (either side) and promotes the first remaining step; the market fills the fourth slot", () => {
            const r = nextActions("tokenCreated", ctx, { pools: [{ id: "7", base: "ubze", quote: HONEY }] });
            expect(keys(r)).toEqual({ recommended: "makeStakable", more: ["registry", "brandKit", "market"] });
            expect(target(byKey(r, "market"))).toEqual({ href: `/market/new?base=${encodeURIComponent(HONEY)}` });
        });

        it("a pool against another token isn't the HONEY/BZE pool", () => {
            const r = nextActions("tokenCreated", ctx, { pools: [{ id: "8", base: HONEY, quote: GIFT }] });
            expect(r.recommended?.key).toBe("pool");
        });

        it("skips every step the chain shows done: stakable, listed, brand kit set, market open", () => {
            const r = nextActions("tokenCreated", ctx, {
                hasCompoundedReward: true,
                registry: "listed",
                brandKitSet: true,
                hasMarket: true,
            });
            expect(keys(r)).toEqual({ recommended: "pool", more: [] });
        });

        it("leaves the registry out on testnet", () => {
            expect(keys(nextActions("tokenCreated", ctx, { registry: "off" })).more).toEqual(["makeStakable", "brandKit", "market"]);
        });

        it("a market for the token, known from the markets list, counts too", () => {
            const r = nextActions("tokenCreated", ctx, { pools: [{ id: "1", base: HONEY, quote: "ubze" }], hasCompoundedReward: true, markets: [{ base: "ubze", quote: HONEY }] });
            expect(keys(r)).toEqual({ recommended: "registry", more: ["brandKit"] });
        });
    });

    describe("poolCreated", () => {
        const ctx: NextActionContext = {
            poolId: "12", lpDenom: "ulp_12", base: HONEY, quote: "ubze", pairLabel: "HONEY/BZE", startingPrice: "0.002 BZE per HONEY",
        };

        it("recommends adding withdrawable liquidity on the DEX pool page", () => {
            const r = nextActions("poolCreated", ctx);
            expect(keys(r)).toEqual({ recommended: "addLiquidity", more: ["rewardLps", "market", "announce"] });
            expect(target(r.recommended)).toEqual({ app: "dex", href: `${DEX}/pools/details?id=12` });
            expect(target(byKey(r, "rewardLps"))).toEqual({ href: "/reward/new?staking=ulp_12" });
            expect(target(byKey(r, "market"))).toEqual({ href: `/market/new?base=${encodeURIComponent(HONEY)}&quote=ubze` });
        });

        it("the announcement names the pair, the starting price and the pool link", () => {
            expect(target(byKey(nextActions("poolCreated", ctx), "announce"))).toEqual({
                copy: `The HONEY/BZE pool is open on the BZE DEX, starting at 0.002 BZE per HONEY. Swap here: ${DEX}/pools/details?id=12`,
                copied: "Announcement",
            });
        });

        it("keeps Reward liquidity providers disabled and pending until the LP denom is known", () => {
            const pending = byKey(nextActions("poolCreated", { ...ctx, lpDenom: undefined }), "rewardLps");
            expect(pending?.disabledReason).toBe("Waiting for the pool share token…");
            expect(pending?.pending).toBe(true);
            const known = byKey(nextActions("poolCreated", ctx), "rewardLps");
            expect(known?.disabledReason).toBeUndefined();
            expect(known?.pending).toBeUndefined();
        });

        it("skips the order book when the pair already has a market", () => {
            const r = nextActions("poolCreated", ctx, { markets: [{ base: "ubze", quote: HONEY }] });
            expect(keys(r).more).toEqual(["rewardLps", "announce"]);
        });
    });

    describe("marketCreated", () => {
        const ctx = { base: HONEY, quote: "ubze", pairLabel: "HONEY/BZE" };
        const marketUrl = `${DEX}/exchange/market?id=${encodeURIComponent(`${HONEY}/ubze`)}`;

        it("recommends opening the market on the DEX; the trading contest is shown disabled", () => {
            const r = nextActions("marketCreated", ctx);
            expect(keys(r)).toEqual({ recommended: "openMarket", more: ["pool", "contest", "copyMarket"] });
            expect(r.recommended?.title).toBe("Open the market on DEX");
            expect(target(r.recommended)).toEqual({ app: "dex", href: marketUrl });
            expect(target(byKey(r, "pool"))).toEqual({ href: `/pool/new?base=${encodeURIComponent(HONEY)}&quote=ubze` });
            expect(byKey(r, "contest")?.disabledReason).toBe("Coming soon");
            expect(target(byKey(r, "copyMarket"))).toEqual({
                copy: `HONEY/BZE order book is open on the BZE DEX. Place limit orders: ${marketUrl}`,
                copied: "Market link",
            });
        });

        it("skips the pool when the pair already has one", () => {
            const r = nextActions("marketCreated", ctx, { pools: [{ id: "3", base: "ubze", quote: HONEY }] });
            expect(keys(r).more).toEqual(["contest", "copyMarket"]);
        });
    });

    describe("simpleRewardCreated", () => {
        const ctx = { rewardId: "5", stakedDenom: HONEY, stakedTicker: "HONEY", prizeTicker: "BZE", prize: "100 BZE a day" };
        const stakingUrl = `${DEX}/staking?search=HONEY`;

        it("recommends copying the DEX staking link, then Stake on DEX and making the token stakable for good", () => {
            const r = nextActions("simpleRewardCreated", ctx);
            expect(keys(r)).toEqual({ recommended: "shareStaking", more: ["stakeOnDex", "makeStakable"] });
            expect(target(r.recommended)).toEqual({ copy: `Stake HONEY and earn 100 BZE a day on the BZE DEX: ${stakingUrl}`, copied: "Staking link" });
            expect(target(byKey(r, "stakeOnDex"))).toEqual({ app: "dex", href: stakingUrl });
            expect(byKey(r, "makeStakable")?.title).toBe("Make HONEY stakable for good");
            expect(target(byKey(r, "makeStakable"))).toEqual({ href: `/denom-reward/new?denom=${encodeURIComponent(HONEY)}` });
        });

        it("skips making it stakable when the staked token already has a compounded reward", () => {
            expect(keys(nextActions("simpleRewardCreated", ctx, { hasCompoundedReward: true })).more).toEqual(["stakeOnDex"]);
        });
    });

    describe("compoundedCreated", () => {
        const ctx = { denom: HONEY, ticker: "HONEY" };

        it("without a prize: recommends a daily prize; the airdrop is disabled while nothing is staked", () => {
            const r = nextActions("compoundedCreated", ctx);
            expect(keys(r)).toEqual({ recommended: "dailyPrize", more: ["airdrop", "sendToStake", "invitePartner"] });
            expect(target(r.recommended)).toEqual({ href: `/denom-reward/schedule?denom=${encodeURIComponent(HONEY)}` });
            const airdrop = byKey(r, "airdrop");
            expect(airdrop?.disabledReason).toBe("Available once someone is staking. We check before you sign.");
            expect(target(airdrop)).toEqual({ href: `/denom-reward/airdrop?denom=${encodeURIComponent(HONEY)}` });
            expect(nextActions("compoundedCreated", ctx, { hasStakers: false }).more[0].disabledReason).toBeDefined();
        });

        it("the airdrop is enabled once something is staked", () => {
            expect(byKey(nextActions("compoundedCreated", ctx, { hasStakers: true }), "airdrop")?.disabledReason).toBeUndefined();
        });

        it("Send people to stake copies the link and shows the DEX AppLink; the partner invite links /reach?community=", () => {
            const r = nextActions("compoundedCreated", ctx);
            const send = byKey(r, "sendToStake");
            expect(target(send)).toEqual({ copy: `HONEY is stakable on the BZE DEX. Stake it here: ${DEX}/staking?search=HONEY`, copied: "Staking link" });
            expect(send?.alsoApp).toEqual({ app: "dex", href: `${DEX}/staking?search=HONEY`, label: "DEX" });
            const invite = target(byKey(r, "invitePartner"));
            expect(invite).toMatchObject({ copied: "Invite" });
            expect((invite as { copy: string }).copy).toContain(`${FACTORY}/reach?community=${encodeURIComponent(HONEY)}`);
        });

        it("with a first prize: recommends telling stakers, then airdrop and reaching another community with the prize token", () => {
            const r = nextActions("compoundedCreated", { ...ctx, withPrize: true, prizeDenom: GIFT, prizeTicker: "WAX", prize: "50 WAX a day for 30 days" });
            expect(keys(r)).toEqual({ recommended: "tellStakers", more: ["airdrop", "reach"] });
            expect(target(r.recommended)).toEqual({
                copy: `New for HONEY stakers: 50 WAX a day for 30 days, shared by everyone staking HONEY. Stake HONEY on the BZE DEX: ${DEX}/staking?search=HONEY`,
                copied: "Announcement",
            });
            expect(target(byKey(r, "reach"))).toEqual({ href: `/reach?gift=${encodeURIComponent(GIFT)}` });
        });
    });

    describe("prizeAdded", () => {
        const ctx: NextActionContext = { stakedDenom: HONEY, stakedTicker: "HONEY", prizeDenom: GIFT, prizeTicker: "WAX", prize: "50 WAX a day" };

        it("daily prize: tell stakers, reach another community, extend before it ends", () => {
            const r = nextActions("prizeAdded", { ...ctx, prizeKind: "daily", scheduleId: "4" });
            expect(keys(r)).toEqual({ recommended: "tellStakers", more: ["reach", "extend"] });
            expect(target(byKey(r, "reach"))).toEqual({ href: `/reach?gift=${encodeURIComponent(GIFT)}` });
            expect(target(byKey(r, "extend"))).toEqual({ href: `/denom-reward/schedule?denom=${encodeURIComponent(HONEY)}&schedule=4` });
        });

        it("airdrop: no extend", () => {
            expect(keys(nextActions("prizeAdded", { ...ctx, prizeKind: "airdrop" }))).toEqual({ recommended: "tellStakers", more: ["reach"] });
        });
    });

    describe("reachedCommunity", () => {
        const ctx = { denom: GIFT, ticker: "WAX" };

        it("recommends making the gift token stakable, then its BZE pool on the DEX and another airdrop", () => {
            const r = nextActions("reachedCommunity", ctx, { pools: [{ id: "9", base: GIFT, quote: "ubze" }] });
            expect(keys(r)).toEqual({ recommended: "makeStakable", more: ["addLiquidity", "reach"] });
            expect(r.recommended?.title).toBe("Make WAX stakable");
            expect(target(byKey(r, "addLiquidity"))).toEqual({ app: "dex", href: `${DEX}/pools/details?id=9` });
            expect(byKey(r, "reach")?.title).toBe("Airdrop to another token");
            expect(target(byKey(r, "reach"))).toEqual({ href: `/reach?gift=${encodeURIComponent(GIFT)}` });
        });

        it("skips making it stakable when it already is, and offers a pool when it has no BZE pool", () => {
            const r = nextActions("reachedCommunity", ctx, { hasCompoundedReward: true, pools: [] });
            expect(keys(r)).toEqual({ recommended: "pool", more: ["reach"] });
            expect(target(r.recommended)).toEqual({ href: `/pool/new?base=${encodeURIComponent(GIFT)}` });
        });
    });

    describe("multisendFinished", () => {
        const ctx = { denom: HONEY, ticker: "HONEY" };

        it("batched: recommends the report download", () => {
            const downloadReport = vi.fn();
            const r = nextActions("multisendFinished", { ...ctx, downloadReport });
            expect(keys(r)).toEqual({ recommended: "report", more: ["makeStakable", "sendAgain"] });
            (target(r.recommended) as { onClick: () => void }).onClick();
            expect(downloadReport).toHaveBeenCalledOnce();
            expect(target(byKey(r, "sendAgain"))).toEqual({ href: `/multisend?denom=${encodeURIComponent(HONEY)}` });
        });

        it("not batched: recommends making the token stakable, unless it already is", () => {
            expect(keys(nextActions("multisendFinished", ctx))).toEqual({ recommended: "makeStakable", more: ["sendAgain"] });
            expect(keys(nextActions("multisendFinished", ctx, { hasCompoundedReward: true }))).toEqual({ recommended: "sendAgain", more: [] });
        });
    });

    describe("raffleStarted", () => {
        const ctx = { denom: HONEY, ticker: "HONEY" };
        const burnerUrl = `${BURNER}/coin?coin=${encodeURIComponent(HONEY)}`;

        it("recommends opening the raffle on Burner, then copying its link", () => {
            const r = nextActions("raffleStarted", ctx);
            expect(keys(r)).toEqual({ recommended: "openRaffle", more: ["copyRaffle"] });
            expect(target(r.recommended)).toEqual({ app: "burner", href: burnerUrl });
            expect(target(byKey(r, "copyRaffle"))).toEqual({ copy: `A burning raffle for HONEY is live on Burner. Join here: ${burnerUrl}`, copied: "Raffle link" });
        });

        it("offers an airdrop to the token's stakers when it has a compounded reward", () => {
            const r = nextActions("raffleStarted", ctx, { hasCompoundedReward: true, hasStakers: true });
            expect(keys(r).more).toEqual(["copyRaffle", "airdrop"]);
            expect(byKey(r, "airdrop")?.disabledReason).toBeUndefined();
        });
    });

    describe("listed", () => {
        const ctx = { denom: HONEY, ticker: "HONEY" };

        it("recommends Back to the token, then the brand kit and making it stakable", () => {
            const r = nextActions("listed", ctx);
            expect(keys(r)).toEqual({ recommended: "backToToken", more: ["brandKit", "makeStakable"] });
            expect(r.recommended?.title).toBe("Back to HONEY");
            expect(target(r.recommended)).toEqual({ href: `/tokens/token?denom=${encodeURIComponent(HONEY)}` });
            expect(byKey(r, "makeStakable")?.title).toBe("Make it stakable");
            expect(target(byKey(r, "makeStakable"))).toEqual({ href: `/denom-reward/new?denom=${encodeURIComponent(HONEY)}` });
        });

        it("skips what the chain shows is done", () => {
            expect(keys(nextActions("listed", ctx, { brandKitSet: true, hasCompoundedReward: true })))
                .toEqual({ recommended: "backToToken", more: [] });
        });
    });

    it("never proposes renouncing or transferring the admin, or locking the supply", () => {
        const kinds: NextActionKind[] = [
            "tokenCreated", "poolCreated", "marketCreated", "simpleRewardCreated", "compoundedCreated",
            "prizeAdded", "reachedCommunity", "multisendFinished", "raffleStarted", "listed",
        ];
        const ctx: NextActionContext = { denom: HONEY, ticker: "HONEY", base: HONEY, quote: "ubze", stakedDenom: HONEY, prizeDenom: GIFT, prizeKind: "daily" };
        for (const kind of kinds) {
            for (const withPrize of [false, true]) {
                const r = nextActions(kind, { ...ctx, withPrize });
                for (const a of [r.recommended, ...r.more]) {
                    expect(`${a?.title} ${a?.text} ${a?.cta}`).not.toMatch(/renounce|transfer admin|lock/i);
                    expect(JSON.stringify(a?.target)).not.toMatch(/control|lock=|renounce/i);
                }
                expect(r.more.length).toBeLessThanOrEqual(3);
            }
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

    it("maps the setup to facts, and drives the skip rules", () => {
        const facts = factsFromTokenSetup(setup);
        expect(facts).toEqual({
            pools: setup.pools,
            hasMarket: true,
            hasCompoundedReward: true,
            hasStakers: false,
            registry: "not-listed",
            brandKitSet: true,
        });
        expect(keys(nextActions("tokenCreated", { denom: HONEY, ticker: "HONEY" }, facts))).toEqual({ recommended: "registry", more: [] });
    });

    it("no registry item (testnet) is 'off'; a listed one is 'listed'; no denom reward is not stakable", () => {
        expect(factsFromTokenSetup({ ...setup, items: [], denomReward: undefined })).toMatchObject({ registry: "off", brandKitSet: false, hasCompoundedReward: false });
        expect(factsFromTokenSetup({ ...setup, items: [{ key: "registry", state: "done" }] })?.registry).toBe("listed");
    });
});
