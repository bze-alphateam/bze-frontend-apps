import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// The checklist is driven off its data hooks only: metadata, brand kit, denom reward, pools, markets.
const { DENOM, mocks } = vi.hoisted(() => ({ DENOM: "factory/bze1owner/utok", mocks: {
    metadata: vi.fn(),
    branding: vi.fn(),
    denomReward: vi.fn(),
    pools: vi.fn(),
    markets: vi.fn(),
    registry: vi.fn(),
} }));

vi.mock("@/hooks/useTokenMetadata", () => ({ useTokenMetadata: () => mocks.metadata() }));
vi.mock("@/hooks/useDenomBranding", () => ({ useDenomBranding: () => mocks.branding() }));
vi.mock("@/hooks/useDenomReward", () => ({ useDenomReward: () => mocks.denomReward() }));
vi.mock("@/hooks/useRegistryListing", () => ({ useRegistryListing: () => mocks.registry() }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const tickers: Record<string, string> = { [DENOM]: "TOK", ubze: "BZE", uusdc: "USDC" };
    return {
        ...actual,
        useAsset: () => ({ asset: { denom: DENOM, ticker: "TOK", decimals: 6, supply: 5000000n }, isLoading: false }),
        useAssets: () => ({ denomTicker: (d: string) => tickers[d] ?? d }),
        useLiquidityPools: () => mocks.pools(),
        useMarkets: () => mocks.markets(),
    };
});

import { useTokenSetup } from "./useTokenSetup";

const pool = (id: string, base: string, quote: string) => ({ id, base, quote });
const schedule = (duration: number, payouts: number) => ({
    schedule_id: "1", staking_denom: DENOM, prize_denom: "ubze", daily_amount: "1", duration, payouts,
});

function setFacts({
    description = "",
    branding = { branding: null, hasError: false } as { branding: unknown; hasError: boolean },
    denomReward = { denomReward: undefined, schedules: [], hasError: false } as Record<string, unknown>,
    pools = [] as ReturnType<typeof pool>[],
    markets = [] as { base: string; quote: string }[],
} = {}) {
    mocks.metadata.mockReturnValue({ metadata: description ? { description } : undefined, isLoading: false, refresh: vi.fn() });
    mocks.branding.mockReturnValue({ ...branding, isLoading: false, refresh: vi.fn() });
    mocks.denomReward.mockReturnValue({ prizes: [], isLoading: false, refresh: vi.fn(), ...denomReward });
    mocks.pools.mockReturnValue({ pools, isLoading: false });
    mocks.markets.mockReturnValue({ markets, isLoading: false });
    // Off (testnet) unless a test says otherwise, so the item counts below stay the six chain items.
    mocks.registry.mockReturnValue({ status: "off", retry: vi.fn() });
}

const run = (admin: string | undefined = "bze1owner") => renderHook(() => useTokenSetup(DENOM, { admin })).result.current;
const stateOf = (result: ReturnType<typeof run>, key: string) => result.items.find(i => i.key === key)?.state;

beforeEach(() => {
    Object.values(mocks).forEach(m => m.mockReset());
    setFacts();
});

describe("useTokenSetup", () => {
    it("lists the items in order, with the supply on the created item", () => {
        const result = run();
        expect(result.items.map(i => i.key)).toEqual(["created", "description", "brandKit", "pool", "holderRewards", "market"]);
        expect(result.items[0]).toMatchObject({ state: "done", detail: "5 TOK" });
        expect(result.items.find(i => i.key === "market")?.optional).toBe(true);
    });

    it("a fresh token: everything but created is todo", () => {
        const result = run();
        expect(result.items.slice(1).map(i => i.state)).toEqual(["todo", "todo", "todo", "todo", "todo"]);
        expect(result.doneCount).toBe(1);
        expect(result.totalCount).toBe(6);
        expect(result.hasError).toBe(false);
    });

    it("everything done", () => {
        setFacts({
            description: "A token for bees",
            branding: { branding: { primary: "#000" }, hasError: false },
            denomReward: { denomReward: { staked_amount: "10" }, schedules: [schedule(10, 2)], hasError: false },
            pools: [pool("ubze_tok", "ubze", DENOM)],
            markets: [{ base: DENOM, quote: "ubze" }],
        });
        const result = run();
        expect(result.items.every(i => i.state === "done")).toBe(true);
        expect(result.doneCount).toBe(6);
        expect(result.totalCount).toBe(6);
        expect(result.hasStakers).toBe(true);
        expect(result.items.find(i => i.key === "description")?.action?.label).toBe("Edit");
    });

    it("holder rewards: partial without a running schedule, unknown on error", () => {
        setFacts({ denomReward: { denomReward: { staked_amount: "0" }, schedules: [schedule(10, 10)], hasError: false } });
        let result = run();
        expect(result.items.find(i => i.key === "holderRewards")).toMatchObject({
            state: "partial",
            detail: "Created, no daily prize running",
        });
        expect(result.hasStakers).toBe(false);
        expect(result.doneCount).toBe(1);

        setFacts({ denomReward: { denomReward: undefined, schedules: [], hasError: true } });
        result = run();
        expect(stateOf(result, "holderRewards")).toBe("unknown");
        expect(result.hasError).toBe(true);
    });

    it("brand kit: a query error is unknown, never todo", () => {
        setFacts({ branding: { branding: null, hasError: true } });
        const result = run();
        expect(stateOf(result, "brandKit")).toBe("unknown");
        expect(result.hasError).toBe(true);
        expect(result.totalCount).toBe(6);
    });

    it("pool and market match the token as base or as quote", () => {
        setFacts({ pools: [pool("p1", DENOM, "uusdc")], markets: [{ base: "ubze", quote: DENOM }] });
        let result = run();
        expect(result.items.find(i => i.key === "pool")).toMatchObject({ state: "done", detail: "TOK / USDC" });
        expect(stateOf(result, "market")).toBe("done");
        expect(result.items.find(i => i.key === "pool")?.action?.href).toMatch(/^\/pool\/add\?pool=p1&return=/);

        setFacts({ pools: [pool("p2", "ubze", DENOM)], markets: [{ base: DENOM, quote: "uusdc" }] });
        result = run();
        expect(result.items.find(i => i.key === "pool")).toMatchObject({ state: "done", detail: "BZE / TOK" });
        expect(stateOf(result, "market")).toBe("done");

        setFacts({ pools: [pool("p3", "ubze", "uusdc")], markets: [{ base: "ubze", quote: "uusdc" }] });
        result = run();
        expect(stateOf(result, "pool")).toBe("todo");
        expect(stateOf(result, "market")).toBe("todo");
        expect(result.items.find(i => i.key === "pool")?.href).toBe(
            "/pool/new?base=factory%2Fbze1owner%2Futok&return=%2Fmanage%2Ftoken%3Fdenom%3Dfactory%252Fbze1owner%252Futok%26tab%3Dtrading&returnLabel=TOK",
        );
    });

    it("a locked token turns a missing description and brand kit into impossible, outside the counts", () => {
        const result = run("");
        expect(stateOf(result, "description")).toBe("impossible");
        expect(stateOf(result, "brandKit")).toBe("impossible");
        expect(result.items.find(i => i.key === "description")).toMatchObject({
            detail: "Can't be added after the supply was locked",
            action: undefined,
        });
        expect(result.totalCount).toBe(4);
        expect(result.doneCount).toBe(1);
    });

    it("a locked token keeps a description and brand kit it already has", () => {
        setFacts({ description: "Fixed forever", branding: { branding: { primary: "#000" }, hasError: false } });
        const result = run("");
        expect(stateOf(result, "description")).toBe("done");
        expect(stateOf(result, "brandKit")).toBe("done");
        expect(result.totalCount).toBe(6);
        expect(result.doneCount).toBe(3);
    });

    it("registry: left out on testnet, todo when not listed, done when listed, unknown on error", () => {
        expect(run().items.some(i => i.key === "registry")).toBe(false);

        mocks.registry.mockReturnValue({ status: "not-listed", retry: vi.fn() });
        let result = run();
        expect(result.items.map(i => i.key)).toEqual(["created", "description", "brandKit", "pool", "holderRewards", "registry", "market"]);
        expect(result.items.find(i => i.key === "registry")).toMatchObject({
            state: "todo",
            optional: false,
            title: "Logo in every wallet · Cosmos Chain Registry",
            href: "/official?denom=factory%2Fbze1owner%2Futok",
            action: { label: "Get it listed", href: "/official?denom=factory%2Fbze1owner%2Futok" },
        });
        expect(result.totalCount).toBe(7);

        mocks.registry.mockReturnValue({ status: "listed", retry: vi.fn() });
        result = run();
        expect(stateOf(result, "registry")).toBe("done");
        expect(result.doneCount).toBe(2);

        const retry = vi.fn();
        mocks.registry.mockReturnValue({ status: "error", retry });
        result = run();
        expect(stateOf(result, "registry")).toBe("unknown");
        expect(result.hasError).toBe(true);
        void result.refresh();
        expect(retry).toHaveBeenCalledOnce();
    });

    it("registry: a locked token still gets it, and loading reads as loading", () => {
        mocks.registry.mockReturnValue({ status: "not-listed", retry: vi.fn() });
        expect(stateOf(run(""), "registry")).toBe("todo");

        mocks.registry.mockReturnValue({ status: "loading", retry: vi.fn() });
        expect(run().isLoading).toBe(true);
    });
});
