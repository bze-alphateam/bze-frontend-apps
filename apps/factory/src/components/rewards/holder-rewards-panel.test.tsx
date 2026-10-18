import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// Drive the panel off its data hooks; the pay panel, tx layer and wallet are stubbed so the test
// asserts the panel's states (no holder rewards / live / query error) and its links only.
const { useDenomRewardMock, navigateMock, txMock, useChainMock } = vi.hoisted(() => ({
    useDenomRewardMock: vi.fn(),
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    useChainMock: vi.fn(),
}));

vi.mock("@/hooks/useDenomReward", () => ({ useDenomReward: () => useDenomRewardMock() }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: navigateMock }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/hooks/useFeePayment", () => ({ useFeePayment: () => ({ canPayFee: true }) }));
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows, txKind }: { rows: { label: string }[]; txKind?: string }) => (
        <div data-testid="pay-panel" data-tx-kind={txKind}>{rows.map(r => r.label).join(", ")}</div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => useChainMock() }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        "factory/bze1owner/utok": { denom: "factory/bze1owner/utok", ticker: "TOK", decimals: 6, logo: "" },
    };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useEpochs: () => ({ dayEpochInfo: { identifier: "day", current_epoch: "100" } }),
        useCreationFees: () => ({
            fees: { createDenomRewardFee: { denom: "ubze", amount: "25000000000" } },
            denomRewardLimits: { denomRewardLock: 7, denomRewardMinStake: "0", maxPrizeDenomsPerDr: 50 },
            isLoading: false,
        }),
    };
});

import { HolderRewardsPanel } from "./holder-rewards-panel";

const TOKEN = {
    denom: "factory/bze1owner/utok",
    ticker: "TOK",
    name: "TOK Token",
    type: "factory",
    decimals: 6,
    logo: "",
    stable: false,
    verified: false,
    supply: 1000000n,
} as unknown as Asset;
const ENC = encodeURIComponent(TOKEN.denom);

const BACK = { href: `/manage/token?denom=${ENC}&tab=rewards`, label: "TOK" };
const RETURN = `return=${encodeURIComponent(BACK.href)}&returnLabel=TOK`;

function renderPanel(returnTo?: typeof BACK) {
    return render(<HolderRewardsPanel asset={TOKEN} returnTo={returnTo} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const state = (overrides: Record<string, unknown> = {}) => ({
    denomReward: undefined,
    schedules: [],
    prizes: [],
    isLoading: false,
    hasError: false,
    refresh: vi.fn(),
    ...overrides,
});

const dr = { staking_denom: TOKEN.denom, lock: 14, min_stake: "5000000", staked_amount: "123000000" };
const schedule = {
    schedule_id: "000003",
    staking_denom: TOKEN.denom,
    prize_denom: "ubze",
    daily_amount: "2000000",
    duration: 30,
    payouts: 10,
};

// Wide screens get the table (phones the cards, both in the DOM under jsdom).
const table = () => within(screen.getByRole("table", { name: "Daily prizes" }));

beforeEach(() => {
    useDenomRewardMock.mockReset();
    navigateMock.mockReset();
    txMock.mockReset();
    useChainMock.mockReset().mockReturnValue({ address: "bze1someone" });
});

describe("HolderRewardsPanel: no holder rewards yet", () => {
    it("explains it, shows the values that will be frozen and the fee", () => {
        useDenomRewardMock.mockReturnValue(state());
        renderPanel();

        expect(screen.getByText("Holder rewards")).toBeInTheDocument();
        expect(screen.queryByText("Live")).not.toBeInTheDocument();
        expect(screen.getByText(/Holders have no reason to stake TOK yet/)).toHaveTextContent("creating it gives no special rights");
        expect(screen.getByText("7 days")).toBeInTheDocument();
        expect(screen.getByText("No minimum")).toBeInTheDocument();
        expect(screen.getByText("Set by the chain and fixed when created.")).toBeInTheDocument();
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Holder rewards fee");
        expect(screen.getByTestId("pay-panel")).toHaveAttribute("data-tx-kind", "create-denom-reward");
        expect(screen.getByRole("button", { name: "Make TOK stakable" })).toBeEnabled();
    });

    it("signs MsgCreateDenomReward for this denom from any wallet and refreshes", async () => {
        const s = state();
        useDenomRewardMock.mockReturnValue(s);
        txMock.mockImplementation(async (_msgs, opts) => opts.onSuccess());
        renderPanel();

        await userEvent.click(screen.getByRole("button", { name: "Make TOK stakable" }));

        expect(txMock).toHaveBeenCalledTimes(1);
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgCreateDenomReward");
        expect(msgs[0].value).toMatchObject({ creator: "bze1someone", denom: TOKEN.denom });
        expect(s.refresh).toHaveBeenCalled();
    });

    it("after creating, tips to add a daily prize", async () => {
        let current = state();
        useDenomRewardMock.mockImplementation(() => current);
        txMock.mockImplementation(async (_msgs, opts) => {
            current = state({ denomReward: { ...dr, staked_amount: "0" } });
            opts.onSuccess();
        });
        renderPanel(BACK);

        await userEvent.click(screen.getByRole("button", { name: "Make TOK stakable" }));

        const tip = within(await screen.findByTestId("holder-rewards-next"));
        expect(tip.getByText(/add a daily prize so stakers earn something/)).toBeInTheDocument();
        await userEvent.click(tip.getByRole("button", { name: /Add a daily prize/ }));
        expect(navigateMock).toHaveBeenCalledWith(`/denom-reward/schedule?denom=${ENC}&${RETURN}`);
    });

    it("asks to connect a wallet instead of creating", () => {
        useChainMock.mockReturnValue({ address: undefined });
        useDenomRewardMock.mockReturnValue(state());
        renderPanel();

        expect(screen.getByRole("button", { name: "Make TOK stakable" })).toBeDisabled();
        expect(screen.getByText("Connect your wallet to make it stakable.")).toBeInTheDocument();
    });
});

describe("HolderRewardsPanel: live", () => {
    it("shows its own frozen values, staked amount and daily prizes with what is left to pay", () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr, schedules: [schedule] }));
        renderPanel();

        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.getByText("123 TOK")).toBeInTheDocument();
        expect(screen.getByText("14 days")).toBeInTheDocument();
        expect(screen.getByText("5 TOK")).toBeInTheDocument();

        const row = within(table().getByTestId("holder-schedule-row"));
        expect(row.getByText("BZE")).toBeInTheDocument();
        expect(row.getByText("2 BZE")).toBeInTheDocument();
        expect(row.getByText("10 of 30 payout days")).toBeInTheDocument();
        expect(row.queryByText(/ends in/)).not.toBeInTheDocument();
        // left to pay = 2 × (30 − 10)
        expect(row.getByText("40 BZE")).toBeInTheDocument();
        expect(screen.getByTestId("holder-schedule-card")).toHaveTextContent("2 BZE / day");
        expect(screen.getByText(/Payout days skip days with nobody staked/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Make TOK stakable" })).not.toBeInTheDocument();
    });

    it("says when a daily prize ends in 7 payout days or fewer", () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr, schedules: [{ ...schedule, payouts: 23 }] }));
        renderPanel();

        expect(table().getByText("ends in 7 payout days")).toBeInTheDocument();
    });

    it("links Extend, Add a daily prize and Airdrop now to the deep-linkable forms", async () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr, schedules: [schedule] }));
        renderPanel();

        await userEvent.click(table().getByRole("button", { name: /Extend/ }));
        expect(navigateMock).toHaveBeenLastCalledWith(`/denom-reward/schedule?denom=${ENC}&schedule=000003`);

        const actions = within(screen.getByTestId("holder-rewards-actions"));
        await userEvent.click(actions.getByRole("button", { name: /Add a daily prize/ }));
        expect(navigateMock).toHaveBeenLastCalledWith(`/denom-reward/schedule?denom=${ENC}`);

        await userEvent.click(actions.getByRole("button", { name: /Airdrop now/ }));
        expect(navigateMock).toHaveBeenLastCalledWith(`/denom-reward/airdrop?denom=${ENC}`);
    });

    it("carries the return path on every form link when given", async () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr, schedules: [schedule] }));
        renderPanel(BACK);

        await userEvent.click(table().getByRole("button", { name: /Extend/ }));
        expect(navigateMock).toHaveBeenLastCalledWith(`/denom-reward/schedule?denom=${ENC}&schedule=000003&${RETURN}`);

        const actions = within(screen.getByTestId("holder-rewards-actions"));
        await userEvent.click(actions.getByRole("button", { name: /Add a daily prize/ }));
        expect(navigateMock).toHaveBeenLastCalledWith(`/denom-reward/schedule?denom=${ENC}&${RETURN}`);
        await userEvent.click(actions.getByRole("button", { name: /Airdrop now/ }));
        expect(navigateMock).toHaveBeenLastCalledWith(`/denom-reward/airdrop?denom=${ENC}&${RETURN}`);
    });

    it("lists the prize tokens against the cap with when each was last paid, never the accumulator", () => {
        const prizes = [
            { staking_denom: TOKEN.denom, prize_denom: "ubze", distributed_stake: "0.123456", last_distribution_epoch: "97" },
            { staking_denom: TOKEN.denom, prize_denom: "uatom", distributed_stake: "0", last_distribution_epoch: "0" },
        ];
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr, schedules: [schedule], prizes }));
        renderPanel();

        expect(screen.getByTestId("holder-prize-slots")).toHaveTextContent("2 of 50");
        const rows = screen.getAllByTestId("holder-prize");
        expect(rows[0]).toHaveTextContent("BZE");
        expect(rows[0]).toHaveTextContent("Last paid 3 days ago");
        expect(rows[1]).toHaveTextContent("uatom");
        expect(rows[1]).toHaveTextContent("Last paid Never");
        expect(screen.queryByText(/0\.123456/)).not.toBeInTheDocument();
        expect(screen.getByText(/keeps its slot, so funding with it again has no prize fee/)).toBeInTheDocument();
    });

    it("says so when no daily prize is running", () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr }));
        renderPanel();

        expect(screen.getByText("No daily prize is running. Add one to start paying TOK stakers.")).toBeInTheDocument();
        expect(screen.queryByRole("table", { name: "Daily prizes" })).not.toBeInTheDocument();
    });
});

describe("HolderRewardsPanel: other states", () => {
    it("never offers to create holder rewards when the state is unknown", async () => {
        const s = state({ hasError: true });
        useDenomRewardMock.mockReturnValue(s);
        renderPanel();

        expect(screen.getByText(/Couldn't load the holder rewards/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Make TOK stakable" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(s.refresh).toHaveBeenCalled();
    });

    it("shows skeletons while loading", () => {
        useDenomRewardMock.mockReturnValue(state({ isLoading: true }));
        renderPanel();

        expect(screen.getByTestId("holder-rewards-loading")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Make TOK stakable" })).not.toBeInTheDocument();
    });

    it("ⓘ opens Which reward fits? for this token", async () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr }));
        renderPanel();

        await userEvent.click(screen.getByRole("button", { name: "Which reward fits?" }));
        const dialog = within(await screen.findByRole("dialog", { name: "Which reward fits?" }));
        expect(dialog.getByText(/Make TOK stakable/)).toBeInTheDocument();
    });
});
