import React from "react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {screen, waitFor, within} from "@testing-library/react";
import type {Asset} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import type {ScanAccount, ScanAccountActivity} from "@/lib/token-activity";
import {renderWithScan, scanClient} from "@/test-support/scan";

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const HOLDER = "bze142cru2h3xa6p4kajyg7wzcuweq0p72puyar263";

const useTokenDenomReward = vi.fn();
const getStakingRewards = vi.fn();
const getAddressStakingRewards = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useTokenDenomReward: (denom: string, address?: string) => useTokenDenomReward(denom, address),
    getStakingRewards: () => getStakingRewards(),
    getAddressStakingRewards: (address: string) => getAddressStakingRewards(address),
    useAssets: () => ({denomTicker: (denom: string) => (denom === "ubze" ? "BZE" : denom), denomDecimals: () => 6}),
}));

vi.mock("next/navigation", async (importOriginal) => ({
    ...(await importOriginal<typeof import("next/navigation")>()),
    useSearchParams: () => new URLSearchParams({denom: NOAD, address: HOLDER}),
}));

vi.mock("./inner-site", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./inner-site")>()),
    InnerSite: ({children}: { children: (asset: Asset) => React.ReactNode }) => <>{children(ASSET)}</>,
}));

import {HolderPage, supplyShareText} from "./holder-page";

forbidNetwork();

const ASSET: Asset = {type: "factory", denom: NOAD, decimals: 6, name: "NoAdminToken", ticker: "NOAD", logo: "", stable: false, verified: false};

const account = (over: Partial<ScanAccount> = {}): ScanAccount => ({
    address: HOLDER, label: null, first_seen: null, last_seen_height: null, tx_count: 0, activity_count: 0,
    balances: [{denom: NOAD, amount: "614317350", symbol: "NOAD", exponent: 6}], delegations: [], unbonding: [], rewards: [],
    total_staked: null, total_rewards: [], live: {available: true}, ...over,
});

const activity = (hash: string, amount: string, msgType: string): ScanAccountActivity => ({
    time: "2026-11-04T11:44:16Z", height: 4076670, tx_hash: hash, kind: "dex", category: "dex", is_signer: true, success: true,
    counterparty: null, deltas: [{denom: NOAD, amount, symbol: "NOAD", exponent: 6}], msg_types: [msgType], details: null,
    fee: [{denom: "ubze", amount: "3156", symbol: "BZE", exponent: 6}],
});

function client(over: Parameters<typeof scanClient>[0] = {}) {
    return scanClient({
        token: vi.fn(async () => ({supply: "1000880000000", holders_count: 8, creator: "bze1creator"}) as never),
        tokenHolders: vi.fn(async () => ({items: [{rank: 6, address: HOLDER, label: null, balance: "614317350", share_pct: "0.06138"}], next_cursor: null})),
        account: vi.fn(async () => account()),
        accountActivity: vi.fn(async () => ({
            items: [
                activity("A".repeat(64), "-500000000", "/bze.tradebin.MsgCreateLiquidityPool"),
                activity("B".repeat(64), "1144317350", "/bze.tradebin.MsgMultiSwap"),
                {...activity("C".repeat(64), "0", "/bze.tokenfactory.MsgSetDenomBranding"), deltas: []},
            ],
            next_cursor: null,
        })),
        ...over,
    });
}

beforeEach(() => {
    useTokenDenomReward.mockReturnValue({item: undefined, prizeDenoms: [], isLoading: false, hasError: false, reload: vi.fn()});
    getStakingRewards.mockResolvedValue({list: []});
    getAddressStakingRewards.mockResolvedValue({address: HOLDER, active: new Map(), unlocking: new Map()});
});

describe("supplyShareText", () => {
    it.each([
        ["965105382489", "1000880000000", "96.43 % of the supply"],
        ["614317350", "1000880000000", "0.06 % of the supply"],
        ["1", "1000880000000", "less than 0.01 % of the supply"],
    ])("writes %s of %s as %s", (balance, supply, text) => {
        expect(supplyShareText(balance, supply)).toBe(text);
    });

    it("says nothing without a supply", () => {
        expect(supplyShareText("1", null)).toBeUndefined();
    });
});

describe("HolderPage", () => {
    it("shows the holder's rank, balance, stake and signed moves in the token", async () => {
        renderWithScan(<HolderPage/>, client());

        expect(await screen.findByText("NOAD holder · #6 of 8")).toBeInTheDocument();
        expect(screen.getByRole("heading", {level: 1, name: "bze142…ar263"})).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId("holder-balance")).toHaveTextContent("614.31735 NOAD"));
        expect(screen.getByTestId("holder-balance")).toHaveTextContent("0.06 % of the supply");
        await waitFor(() => expect(screen.getByTestId("holder-staked")).toHaveTextContent("Not staking NOAD in the holders pool or any program."));

        const rows = await screen.findAllByTestId("activity-row");
        // The branding update didn't change the NOAD balance, so it has no row.
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent("−500 NOAD");
        expect(rows[1]).toHaveTextContent("+1,144.31735 NOAD");
        expect(rows[1]).toHaveTextContent("Bought NOAD");
        expect(within(rows[0]).queryByText("by")).not.toBeInTheDocument();
        expect(rows[0]).toHaveTextContent("Fee 0.003156 BZE");
    });

    it("lists the holder's holders pool position", async () => {
        useTokenDenomReward.mockReturnValue({
            item: {
                denomReward: {staking_denom: NOAD, lock: 7, min_stake: "0", staked_amount: "20000000"},
                position: {participant: {address: HOLDER, staking_denom: NOAD, amount: "20000000"}, pending: []},
                unlocks: [],
            },
            prizeDenoms: [], isLoading: false, hasError: false, reload: vi.fn(),
        });
        renderWithScan(<HolderPage/>, client());

        const position = await screen.findByTestId("holder-position");
        expect(position).toHaveTextContent("Holders pool");
        expect(position).toHaveTextContent("20 NOAD");
        expect(position).toHaveTextContent("7-day unlock · nothing unlocking");
        expect(useTokenDenomReward).toHaveBeenCalledWith(NOAD, HOLDER);
    });

    it("keeps the activity when the node can't tell the balance", async () => {
        renderWithScan(<HolderPage/>, client({account: vi.fn(async () => account({balances: [], live: {available: false}}))}));

        expect(await screen.findByText(/Couldn.t read the balance from the node/)).toBeInTheDocument();
        expect(await screen.findAllByTestId("activity-row")).toHaveLength(2);
    });
});
