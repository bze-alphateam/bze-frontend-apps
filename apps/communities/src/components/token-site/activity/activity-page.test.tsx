import React from "react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {Asset} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import {MSG, ScanError, type ScanHolder, type ScanToken, type ScanTransfer, type ScanTx} from "@/lib/token-activity";
import {renderWithScan, scanClient} from "@/test-support/scan";

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const ULMN = "ibc/9DA252F9F9C86132CC282EA431DFB7DE7729501F6DC9A3E0F50EC8C6EE380CC7";
const CREATOR = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const TRADER = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
const REWARDS = "bze1245yut9zht8q4hz39sd0lzqtzkuw5us58k46ua";
const DEX = "bze18mhtjwczlzqqgvw84uz8lrdv4hqule3jp8allp";
const HASH = "EDA31BBD24F96E51707CCC623670317FDE5AE23DC5F9EEB46E8B224AB159B3C0";

const getDenomReward = vi.fn();
const getStakingRewards = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getDenomReward: (denom: string) => getDenomReward(denom),
    getStakingRewards: () => getStakingRewards(),
    useAssets: () => ({denomTicker: (denom: string) => (denom === "ubze" ? "BZE" : denom), denomDecimals: () => 6}),
}));

vi.mock("@/hooks/useNavigation", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/hooks/useNavigation")>()),
    useDenomParam: () => asset.denom,
}));

// The frame (brand kit, header, wallet) has its own tests; here it hands the page its token.
vi.mock("./inner-site", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./inner-site")>()),
    InnerSite: ({children}: { children: (asset: Asset) => React.ReactNode }) => <>{children(asset)}</>,
}));

import {ActivityPage, activityStats} from "./activity-page";

forbidNetwork();

const NOAD_ASSET: Asset = {type: "factory", denom: NOAD, decimals: 6, name: "NoAdminToken", ticker: "NOAD", logo: "", stable: false, verified: false};
const ULMN_ASSET: Asset = {type: "ibc", denom: ULMN, decimals: 6, name: "ULMN", ticker: "ULMN", logo: "", stable: false, verified: false};
let asset: Asset = NOAD_ASSET;

const token = (over: Partial<ScanToken> = {}): ScanToken => ({
    denom: NOAD, symbol: "NOAD", name: "NoAdminToken", kind: "factory", exponent: 6, supply: "1000880000000", holders_count: 8,
    price_usd: null, halted: false, logo_url: null, origin_chain: null, description: null, creator: CREATOR, creator_label: null,
    admin: CREATOR, admin_label: null, created_height: null, created_tx_hash: null, created_time: null, events: [], events_next_cursor: null,
    transfers_24h: {count: 9, amount: "1198870000"}, ...over,
});

const sold: ScanTransfer = {
    height: 4099213, tx_index: 0, tx_hash: HASH, time: "2026-11-05T21:05:21Z", seq: 1, msg_index: 0, msg_type: MSG.multiSwap,
    kind: "transfer", sender: TRADER, sender_label: null, recipient: DEX, recipient_label: {name: "DEX", kind: "module"},
    denom: NOAD, amount: "10000000", symbol: "NOAD", exponent: 6,
};

const tx: ScanTx = {
    height: 4099213, tx_index: 0, hash: HASH, time: "2026-11-05T21:05:21Z", success: true, msg_count: 1, msg_types: [MSG.multiSwap],
    fee: [{denom: "ubze", amount: "3823"}], signer: TRADER, signers: [TRADER], fee_payer: TRADER, memo: null, code: 0, error_log: null,
    gas_wanted: 0, gas_used: 0, messages: [],
    transfers: [{seq: 0, msg_index: null, kind: "transfer", sender: TRADER, sender_label: null, recipient: "bze1fee", recipient_label: null, denom: "ubze", amount: "3823", symbol: "BZE", exponent: 6}],
    dex: null, ibc_transfers: null,
};

const holder = (rank: number, address: string, balance: string, share: string, label: ScanHolder["label"] = null): ScanHolder =>
    ({rank, address, label, balance, share_pct: share});

const HOLDERS: ScanHolder[] = [
    holder(1, CREATOR, "965105382489", "96.42568"),
    holder(2, "bze13gf8772w8ru0rk7yul9dzdd2ecprg736tyvst2", "17000000000", "1.69851"),
    holder(3, "bze1n60y35rwk0zh03vxvwfzvxe0lxmhx6ek6r5nx5", "9995000000", "0.99862"),
    holder(4, REWARDS, "7056000000", "0.70498", {name: "Rewards", kind: "module"}),
    holder(5, DEX, "964433611", "0.09636", {name: "DEX", kind: "module"}),
    holder(6, "bze142cru2h3xa6p4kajyg7wzcuweq0p72puyar263", "614317350", "0.06138"),
    holder(7, TRADER, "130856550", "0.01307"),
];

const account = (address: string, amount: string) => ({
    address, label: null, first_seen: null, last_seen_height: null, tx_count: 0, activity_count: 0,
    balances: [{denom: NOAD, amount, symbol: "NOAD", exponent: 6}], delegations: [], unbonding: [], rewards: [], total_staked: null,
    total_rewards: [], live: {available: true},
});

function client(over: Parameters<typeof scanClient>[0] = {}) {
    return scanClient({
        token: vi.fn(async () => token()),
        tokenTransfers: vi.fn(async () => ({items: [sold], next_cursor: null})),
        tx: vi.fn(async () => tx),
        tokenHolders: vi.fn(async () => ({items: HOLDERS, next_cursor: null})),
        tokenEvents: vi.fn(async () => ({
            items: [{height: 4082925, tx_index: 0, seq: 0, tx_hash: HASH, kind: "branding_changed", actor: CREATOR, actor_label: null, amount: null, details: null, time: "2026-11-04T20:59:28Z"}],
            next_cursor: null,
        })),
        modules: vi.fn(async () => ({items: [{address: REWARDS, name: "Rewards", module: "rewards"}, {address: DEX, name: "DEX", module: "tradebin"}]})),
        account: vi.fn(async (address: string) => account(address, address === REWARDS ? "7056000000" : "964433611")),
        ...over,
    });
}

beforeEach(() => {
    asset = NOAD_ASSET;
    getDenomReward.mockResolvedValue({staking_denom: NOAD, lock: 7, min_stake: "1", staked_amount: "20000000"});
    getStakingRewards.mockResolvedValue({list: [{reward_id: "1", staking_denom: NOAD, staked_amount: "5000000"}, {reward_id: "2", staking_denom: "ubze", staked_amount: "999"}]});
});

describe("activityStats", () => {
    it("shows a factory token's holders, 24h moves, supply and creation", () => {
        const stats = activityStats(token({created_time: "2026-10-09T10:00:00Z"}), "NOAD", 6, false);

        expect(stats.map((stat) => [stat.label, stat.value])).toEqual([
            ["Holders", "8"],
            ["Transfers · 24h", "9"],
            ["Moved · 24h", "1,198.87 NOAD"],
            ["Supply", "1,000,880 NOAD"],
            ["Created", "Oct 9, 2026"],
        ]);
    });

    it("says what is unknown yet", () => {
        const stats = activityStats(token({holders_count: null, admin: null}), "NOAD", 6, false);

        expect(stats.find((stat) => stat.id === "holders")?.value).toBe("—");
        expect(stats.find((stat) => stat.id === "created")).toMatchObject({value: "—", note: "not indexed yet"});
        expect(stats.find((stat) => stat.id === "supply")?.note).toBe("fixed: no admin");
    });

    it("shows where an IBC token comes from instead of its creation", () => {
        const stats = activityStats(token({origin_chain: {chain_id: "lumen-testnet", name: null, logo_url: null, status: null}}), "ULMN", 6, true);

        expect(stats.slice(3).map((stat) => [stat.label, stat.value])).toEqual([["On BeeZee", "1,000,880 ULMN"], ["Comes from", "lumen-testnet"]]);
    });
});

describe("ActivityPage", () => {
    it("shows the token's numbers and one row per transaction", async () => {
        renderWithScan(<ActivityPage/>, client());

        expect(screen.getByRole("heading", {level: 1, name: "What's happening with NOAD"})).toBeInTheDocument();
        expect(await screen.findByTestId("activity-stat-holders")).toHaveTextContent("Holders8");
        const row = await screen.findByTestId("activity-row");
        expect(row).toHaveTextContent("Sold NOAD");
        await waitFor(() => expect(row).toHaveTextContent("Fee 0.003823 BZE"));
        expect(screen.getByRole("link", {name: "NoAdminToken"})).toHaveAttribute("href", `/token?denom=${encodeURIComponent(NOAD)}`);
    });

    it("shows the empty state when Scan has no rows", async () => {
        renderWithScan(<ActivityPage/>, client({tokenTransfers: vi.fn(async () => ({items: [], next_cursor: null}))}));

        expect(await screen.findByText("No activity indexed yet")).toBeInTheDocument();
    });

    it("shows an error with Retry when Scan doesn't answer, and asks again", async () => {
        const scan = client({tokenTransfers: vi.fn().mockRejectedValue(new ScanError("BZE Scan unreachable", 0))});
        renderWithScan(<ActivityPage/>, scan);

        const retry = await screen.findByRole("button", {name: "Retry"});
        expect(screen.getByText(/Couldn.t load NOAD activity/)).toBeInTheDocument();
        const calls = vi.mocked(scan.tokenTransfers).mock.calls.length;
        await userEvent.click(retry);
        await waitFor(() => expect(vi.mocked(scan.tokenTransfers).mock.calls.length).toBeGreaterThan(calls));
    });

    it("splits the supply and ranks the holders on the Holders tab", async () => {
        renderWithScan(<ActivityPage/>, client());

        await userEvent.click(await screen.findByRole("tab", {name: /Holders/}));

        const split = await screen.findByTestId("supply-split");
        expect(within(split).getByTestId("supply-part-staked")).toHaveTextContent("25 NOAD");
        expect(within(split).getByTestId("supply-part-budgets")).toHaveTextContent("7,031 NOAD");
        expect(within(split).getByTestId("supply-part-dex")).toHaveTextContent("964.433611 NOAD");
        expect(within(split).getByTestId("supply-part-top10")).toHaveTextContent("99.20 %");
        expect(getStakingRewards).toHaveBeenCalled();

        const rows = screen.getAllByTestId("holder-row");
        expect(rows).toHaveLength(7);
        expect(rows[0]).toHaveTextContent("Creator");
        expect(rows[3]).toHaveTextContent("Rewards");
        expect(rows[3]).toHaveTextContent("Module");
        expect(within(rows[0]).getAllByRole("link")[0]).toHaveAttribute("href", `/token/holder?denom=${encodeURIComponent(NOAD)}&address=${CREATOR}`);
    });

    it("tells the split it can't be worked out when a module balance isn't live", async () => {
        renderWithScan(<ActivityPage/>, client({account: vi.fn(async (address: string) => ({...account(address, "0"), live: {available: false}}))}));

        await userEvent.click(await screen.findByRole("tab", {name: /Holders/}));

        expect(await screen.findByText(/Couldn.t work out where the NOAD is/)).toBeInTheDocument();
    });

    it("shows the token's events on the History tab", async () => {
        renderWithScan(<ActivityPage/>, client());

        await userEvent.click(await screen.findByRole("tab", {name: "History"}));

        expect(await screen.findByText("Brand kit updated")).toBeInTheDocument();
        expect(screen.getByText("Earlier history isn't indexed yet.")).toBeInTheDocument();
    });

    it("has no History tab for an IBC token", async () => {
        asset = ULMN_ASSET;
        renderWithScan(<ActivityPage/>, client({token: vi.fn(async () => token({denom: ULMN, kind: "ibc"}))}));

        expect(await screen.findByRole("tab", {name: "Activity"})).toBeInTheDocument();
        expect(screen.queryByRole("tab", {name: "History"})).not.toBeInTheDocument();
        expect(await screen.findByTestId("activity-stat-origin")).toBeInTheDocument();
    });
});
