import { describe, it, expect, beforeEach } from "vitest";
import {
    type PlaybookFacts,
    chooseToken,
    createdReturnHref,
    hasRunningLpCampaign,
    loadPlaybookProgress,
    playbookById,
    playbookHref,
    progressOnLoad,
    savePlaybookProgress,
    stepHref,
    stepStatuses,
} from "./playbooks";

const DENOM = "factory/bze1me/uhoney";
const ENC = encodeURIComponent(DENOM);
const LP = "ulp_1";

const launch = playbookById("launch")!;
const noticed = playbookById("noticed")!;
const lps = playbookById("lps")!;

const facts = (patch: Partial<PlaybookFacts> = {}, done: string[] = []): PlaybookFacts => ({
    denom: DENOM,
    items: ["pool", "holderRewards", "registry"].map(key => ({ key, state: done.includes(key) ? "done" : "todo" })),
    admin: "bze1me",
    lpCampaign: false,
    ...patch,
});
const states = (playbook: typeof launch, f: PlaybookFacts, manual: string[] = []) => stepStatuses(playbook, f, manual).map(s => s.state);

beforeEach(() => localStorage.clear());

describe("playbook steps", () => {
    it("launch: detected from the token, its checklist and its admin", () => {
        expect(states(launch, { items: [], lpCampaign: false })).toEqual(["current", "later", "later", "later", "later"]);
        expect(states(launch, facts())).toEqual(["done", "current", "later", "later", "later"]);
        expect(states(launch, facts({}, ["pool", "holderRewards"]))).toEqual(["done", "done", "done", "current", "later"]);
        expect(states(launch, facts({ admin: "" }, ["pool", "holderRewards", "registry"]))).toEqual(["done", "done", "done", "done", "done"]);
        // A failed admin lookup is not a lock.
        expect(states(launch, facts({ admin: undefined }, ["pool", "holderRewards", "registry"]))[4]).toBe("current");
    });

    it("launch on testnet: no registry item, so the logo step is marked by hand", () => {
        const testnet = facts({ items: [{ key: "pool", state: "done" }, { key: "holderRewards", state: "done" }] });
        const logo = stepStatuses(launch, testnet, []).find(s => s.step.goalId === "registry")!;
        expect(logo).toMatchObject({ state: "current", manual: true });
        expect(states(launch, testnet, ["registry"])[3]).toBe("done");
    });

    it("noticed: the gift can only be marked, the stakable step is detected", () => {
        const s = stepStatuses(noticed, facts(), []);
        expect(s.map(x => [x.step.goalId, x.state, x.manual])).toEqual([["reach", "current", true], ["stakable", "later", false]]);
        expect(states(noticed, facts({}, ["holderRewards"]), ["reach"])).toEqual(["done", "done"]);
    });

    it("lps: an existing pool skips step 1, a running LP campaign finishes it", () => {
        expect(states(lps, facts({}, ["pool"]))).toEqual(["done", "current"]);
        expect(states(lps, facts({ lpCampaign: true }, ["pool"]))).toEqual(["done", "done"]);
    });

    it("hasRunningLpCampaign: running programs staking an LP token of the token's pools", () => {
        const pools = [{ lp_denom: LP, base: DENOM, quote: "ubze" }];
        const program = (staking_denom: string, payouts: number) => ({ staking_denom, prize_denom: DENOM, payouts, duration: 30 });
        expect(hasRunningLpCampaign([program(LP, 3)], DENOM, pools)).toBe(true);
        expect(hasRunningLpCampaign([program(LP, 30)], DENOM, pools)).toBe(false);
        expect(hasRunningLpCampaign([program(DENOM, 3)], DENOM, pools)).toBe(false);
        expect(hasRunningLpCampaign([program("ulp_other", 3)], DENOM, pools)).toBe(false);
    });
});

describe("playbook links", () => {
    it("step buttons carry the way back to the playbook and its step", () => {
        const pool = launch.steps[1];
        expect(stepHref(launch, pool, facts())).toBe(
            `/pool/new?base=${ENC}&${new URLSearchParams({ return: `/playbooks?id=launch&denom=${ENC}&step=pool`, returnLabel: "the playbook" })}`,
        );
        const campaign = lps.steps[1];
        expect(stepHref(lps, campaign, facts({ lpDenom: LP }))).toMatch(/^\/reward\/new\?staking=ulp_1&return=/);
    });

    it("creating the token returns to the bare playbook; the launch screen adds the token and the step", () => {
        const href = stepHref(launch, launch.steps[0], { items: [], lpCampaign: false });
        expect(href).toBe(`/token/new?${new URLSearchParams({ return: "/playbooks?id=launch", returnLabel: "the playbook" })}`);
        expect(createdReturnHref("/playbooks?id=launch", DENOM)).toBe(`/playbooks?id=launch&denom=${ENC}&step=createToken&completed=1`);
        expect(playbookHref("noticed", DENOM)).toBe(`/playbooks?id=noticed&denom=${ENC}`);
    });
});

describe("playbook progress", () => {
    it("is stored and restored per playbook", () => {
        expect(loadPlaybookProgress("launch")).toBeUndefined();
        savePlaybookProgress("noticed", { denom: DENOM, manualDone: ["reach"] });
        expect(loadPlaybookProgress("noticed")).toEqual({ denom: DENOM, manualDone: ["reach"] });
        expect(loadPlaybookProgress("launch")).toBeUndefined();
    });

    it("step=…&completed=1 marks the step; a back link (no completed) marks nothing", () => {
        expect(progressOnLoad(undefined, { step: "reach", completed: "1" }, noticed)).toEqual({ manualDone: ["reach"] });
        expect(progressOnLoad(undefined, { step: "reach" }, noticed)).toBeUndefined();
        expect(progressOnLoad(undefined, { step: "nope", completed: "1" }, noticed)).toBeUndefined();
        expect(progressOnLoad(undefined, { denom: DENOM, step: "createToken", completed: "1" }, launch))
            .toEqual({ denom: DENOM, manualDone: ["createToken"] });
    });

    it("another token starts over; the first token keeps what was marked before it", () => {
        expect(chooseToken({ manualDone: ["reach"] }, DENOM)).toEqual({ denom: DENOM, manualDone: ["reach"] });
        expect(chooseToken({ denom: "other", manualDone: ["reach"] }, DENOM)).toEqual({ denom: DENOM, manualDone: [] });
        const same = { denom: DENOM, manualDone: ["reach"] };
        expect(chooseToken(same, DENOM)).toBe(same);
    });
});
