import { describe, it, expect } from "vitest";
import {
    airdropHref,
    defaultReward,
    hasStaked,
    readAirdropLink,
    rewardsOfToken,
    simpleRewardKey,
    simpleStakedDenoms,
    stakersAirdropHref,
    stakersTarget,
} from "./airdrop";

const HONEY = "factory/bze1x/uhoney";
const LP = "ulp_uhoney_ubze";
const query = (q: string) => new URLSearchParams(q);
const sr = (reward_id: string, staking_denom: string, staked_amount: string, payouts = 0) =>
    ({ reward_id, staking_denom, prize_denom: "ubze", staked_amount, duration: 10, payouts });

describe("airdropHref", () => {
    it("is /airdrop with the non-empty parts", () => {
        expect(airdropHref()).toBe("/airdrop");
        expect(airdropHref({ to: "list", denom: "", prize: HONEY })).toBe(`/airdrop?to=list&prize=${encodeURIComponent(HONEY)}`);
    });

    it("sends a pool share's stakers to the LP providers flow", () => {
        expect(stakersTarget(LP)).toBe("lp");
        expect(stakersTarget(HONEY)).toBe("stakers");
        expect(stakersAirdropHref(HONEY, "7")).toBe(`/airdrop?to=stakers&denom=${encodeURIComponent(HONEY)}&id=7`);
        expect(stakersAirdropHref(LP)).toBe(`/airdrop?to=lp&denom=${LP}`);
    });
});

describe("readAirdropLink", () => {
    it("takes ?to= as given", () => {
        expect(readAirdropLink(query("to=list&denom=ubze"))).toEqual({ to: "list", denom: "ubze", id: "", prize: "" });
    });

    it("without ?to=, asks; only a prize picks nothing", () => {
        expect(readAirdropLink(query(""))).toEqual({ denom: "", id: "", prize: "" });
        expect(readAirdropLink(query("prize=ubze"))).toEqual({ denom: "", id: "", prize: "ubze" });
    });

    it("reads the old forms' names: a token or a reward means its stakers", () => {
        expect(readAirdropLink(query(`denom=${HONEY}`))).toMatchObject({ to: "stakers", denom: HONEY });
        expect(readAirdropLink(query(`staking=${LP}&id=3`))).toMatchObject({ to: "lp", denom: LP, id: "3" });
        expect(readAirdropLink(query("id=3"))).toMatchObject({ to: "stakers", id: "3" });
        expect(readAirdropLink(query(`community=${HONEY}&gift=ubze`))).toEqual({ to: "stakers", denom: HONEY, id: "", prize: "ubze" });
    });
});

describe("rewardsOfToken", () => {
    it("lists the compounded reward first, then the token's simple rewards, the most staked first", () => {
        const rewards = rewardsOfToken(HONEY, { staked_amount: "5" }, [sr("1", HONEY, "2"), sr("2", "ubze", "9"), sr("3", HONEY, "40", 10)]);
        expect(rewards.map(r => r.key)).toEqual(["compounded", simpleRewardKey("3"), simpleRewardKey("1")]);
        expect(rewards[1]).toMatchObject({ kind: "simple", rewardId: "3", prizeDenom: "ubze", staked: "40", daysLeft: 0 });
        expect(rewards[2]).toMatchObject({ daysLeft: 10 });
    });

    it("has no compounded entry without one", () => {
        expect(rewardsOfToken(HONEY, undefined, [sr("1", HONEY, "2")]).map(r => r.kind)).toEqual(["simple"]);
    });
});

describe("defaultReward", () => {
    const rewards = rewardsOfToken(HONEY, { staked_amount: "0" }, [sr("1", HONEY, "2"), sr("2", HONEY, "0")]);

    it("picks the reward a link names, even one nobody stakes in", () => {
        expect(defaultReward(rewards, "2")).toBe(simpleRewardKey("2"));
    });

    it("else the only one with stakers; several or none leave it to the user", () => {
        expect(defaultReward(rewards)).toBe(simpleRewardKey("1"));
        expect(defaultReward(rewardsOfToken(HONEY, { staked_amount: "3" }, [sr("1", HONEY, "2")]))).toBeUndefined();
        expect(defaultReward(rewardsOfToken(HONEY, { staked_amount: "0" }, []))).toBeUndefined();
    });
});

describe("hasStaked / simpleStakedDenoms", () => {
    it("needs a positive stake; collects the simple rewards' staked tokens", () => {
        expect(hasStaked({ staked: "1" })).toBe(true);
        expect(hasStaked({ staked: "0" })).toBe(false);
        expect(hasStaked({ staked: "" })).toBe(false);
        expect([...simpleStakedDenoms([sr("1", HONEY, "1"), sr("2", LP, "1"), sr("3", HONEY, "0")])]).toEqual([HONEY, LP]);
    });
});
