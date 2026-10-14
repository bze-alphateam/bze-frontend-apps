import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// Drive the card off its data hooks; the fee box, tx layer and wallet are stubbed so the test
// asserts the card's state logic (no DR / DR with schedules / query error) only.
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
vi.mock("@/components/ui/fee-disclosure", () => ({
    FeeDisclosure: ({ label }: { label: string }) => <div data-testid="fee-disclosure">{label}</div>,
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => useChainMock() }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
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

import { DenomRewardCard } from "./denom-reward-card";

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

function renderCard() {
    return render(<DenomRewardCard asset={TOKEN} />, {
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

beforeEach(() => {
    useDenomRewardMock.mockReset();
    navigateMock.mockReset();
    txMock.mockReset();
    useChainMock.mockReset().mockReturnValue({ address: "bze1someone" });
});

describe("DenomRewardCard — no denom reward yet", () => {
    it("explains it, shows the values that will be frozen and the creation fee", () => {
        useDenomRewardMock.mockReturnValue(state());
        renderCard();

        expect(screen.getByText(/Reward everyone who holds TOK/)).toBeInTheDocument();
        expect(screen.getByText("7 days")).toBeInTheDocument();
        expect(screen.getByText("No minimum")).toBeInTheDocument();
        expect(screen.getByTestId("fee-disclosure")).toHaveTextContent("Denom reward creation fee");
        expect(screen.getByRole("button", { name: /Create denom reward/ })).toBeEnabled();
    });

    it("signs MsgCreateDenomReward for this denom from any wallet", async () => {
        useDenomRewardMock.mockReturnValue(state());
        renderCard();

        await userEvent.click(screen.getByRole("button", { name: /Create denom reward/ }));

        expect(txMock).toHaveBeenCalledTimes(1);
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgCreateDenomReward");
        expect(msgs[0].value).toMatchObject({ creator: "bze1someone", denom: TOKEN.denom });
    });

    it("asks to connect a wallet instead of creating", () => {
        useChainMock.mockReturnValue({ address: undefined });
        useDenomRewardMock.mockReturnValue(state());
        renderCard();

        expect(screen.getByRole("button", { name: /Create denom reward/ })).toBeDisabled();
        expect(screen.getByText(/Connect your wallet/)).toBeInTheDocument();
    });
});

describe("DenomRewardCard — denom reward exists", () => {
    const dr = { staking_denom: TOKEN.denom, lock: 14, min_stake: "5000000", staked_amount: "123000000" };
    const schedule = {
        schedule_id: "000003",
        staking_denom: TOKEN.denom,
        prize_denom: "ubze",
        daily_amount: "2000000",
        duration: 30,
        payouts: 10,
    };

    it("shows its own frozen values, staked amount and schedules with the remaining budget", () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr, schedules: [schedule] }));
        renderCard();

        expect(screen.getByText("123 TOK")).toBeInTheDocument();
        expect(screen.getByText("14 days")).toBeInTheDocument();
        expect(screen.getByText("5 TOK")).toBeInTheDocument();
        expect(screen.getByText("2 BZE / day")).toBeInTheDocument();
        expect(screen.getByText(/10 of 30 days paid · 20 days left/)).toBeInTheDocument();
        // remaining budget = 2 × (30 − 10)
        expect(screen.getByText("40 BZE")).toBeInTheDocument();
        expect(screen.getByText(/a day nobody is staking is\s+skipped/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Create denom reward/ })).not.toBeInTheDocument();
    });

    it("links Extend and Add schedule to the deep-linkable schedule form", async () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr, schedules: [schedule] }));
        renderCard();

        await userEvent.click(screen.getByRole("button", { name: /Extend/ }));
        expect(navigateMock).toHaveBeenLastCalledWith(
            "/denom-reward/schedule?denom=factory%2Fbze1owner%2Futok&schedule=000003",
        );

        await userEvent.click(screen.getByRole("button", { name: /Add schedule/ }));
        expect(navigateMock).toHaveBeenLastCalledWith("/denom-reward/schedule?denom=factory%2Fbze1owner%2Futok");
    });

    it("lists the prize tokens against the cap with when each was last paid, never the accumulator", () => {
        const prizes = [
            { staking_denom: TOKEN.denom, prize_denom: "ubze", distributed_stake: "0.123456", last_distribution_epoch: "97" },
            { staking_denom: TOKEN.denom, prize_denom: "uatom", distributed_stake: "0", last_distribution_epoch: "0" },
        ];
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr, schedules: [schedule], prizes }));
        renderCard();

        expect(screen.getByTestId("denom-reward-prize-slots")).toHaveTextContent("2 of 50 used");
        const rows = screen.getAllByTestId("denom-reward-prize");
        expect(rows[0]).toHaveTextContent("BZE");
        expect(rows[0]).toHaveTextContent("Last paid: 3 days ago");
        expect(rows[1]).toHaveTextContent("uatom");
        expect(rows[1]).toHaveTextContent("Last paid: Never");
        expect(screen.queryByText(/0\.123456/)).not.toBeInTheDocument();
    });

    it("links Airdrop to the deep-linkable airdrop form", async () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr }));
        renderCard();

        await userEvent.click(screen.getByRole("button", { name: /Airdrop/ }));
        expect(navigateMock).toHaveBeenLastCalledWith("/denom-reward/airdrop?denom=factory%2Fbze1owner%2Futok");
    });

    it("says so when no schedule is running", () => {
        useDenomRewardMock.mockReturnValue(state({ denomReward: dr }));
        renderCard();

        expect(screen.getByText(/No prize schedule is running/)).toBeInTheDocument();
    });
});

describe("DenomRewardCard — query error", () => {
    it("never offers to create a denom reward when the state is unknown", () => {
        useDenomRewardMock.mockReturnValue(state({ hasError: true }));
        renderCard();

        expect(screen.getByText(/Couldn't load the denom reward/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Create denom reward/ })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
    });
});
