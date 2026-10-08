import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// Drive the form off mocked hooks: query params, the DR state, chain params, wallet and the
// affordability engine. The asset picker becomes a plain button per prize denom.
const { STAKING, queryParams, useDenomRewardMock, navigateMock, txMock, affordMock } = vi.hoisted(() => ({
    STAKING: "factory/bze1owner/utok",
    queryParams: new Map<string, string>(),
    useDenomRewardMock: vi.fn(),
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    affordMock: vi.fn(),
}));

vi.mock("@/hooks/useNavigation", () => ({
    useNavigationWithParams: () => ({
        denomParam: queryParams.get("denom") ?? null,
        getQueryParam: (p: string) => queryParams.get(p) ?? null,
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useDenomReward", () => ({ useDenomReward: () => useDenomRewardMock() }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: (fee?: { denom: string; amount: string }) => ({
        canPayFee: Boolean(fee),
        estimate: { resolvedFee: fee },
    }),
}));
vi.mock("@/components/ui/fee-disclosure", () => ({
    FeeDisclosure: ({ label, fee }: { label: string; fee?: { amount: string } }) => (
        <div data-testid="fee-disclosure">{label}: {fee?.amount ?? "unknown"}</div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ onSelect }: { onSelect: (a: { denom: string }) => void }) => (
        <div>
            <button onClick={() => onSelect({ denom: "ubze" })}>pick BZE</button>
            <button onClick={() => onSelect({ denom: "uatom" })}>pick ATOM</button>
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1funder" }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        [STAKING]: { denom: STAKING, ticker: "TOK", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uatom: { denom: "uatom", ticker: "ATOM", decimals: 6, logo: "" },
    };
    const fee = { denom: "ubze", amount: "25000000000" };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: () => ({ balance: { denom: "", amount: actual.toBigNumber(0) }, isLoading: false }),
        useCanAffordTx: (input: unknown) => affordMock(input),
        useCreationFees: () => ({
            fees: { addDenomRewardScheduleFee: fee, createDenomRewardPrizeFee: fee },
            denomRewardLimits: { maxPrizeDenomsPerDr: 2 },
            isLoading: false,
        }),
    };
});

import DenomRewardSchedulePage from "./page";

const DR = { staking_denom: STAKING, lock: 7, min_stake: "0", staked_amount: "0" };
const SCHEDULE = { schedule_id: "000004", staking_denom: STAKING, prize_denom: "ubze", daily_amount: "2000000", duration: 30, payouts: 3 };

function renderPage() {
    return render(<DenomRewardSchedulePage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const drState = (overrides: Record<string, unknown> = {}) => ({
    denomReward: DR,
    schedules: [SCHEDULE],
    prizes: [{ staking_denom: STAKING, prize_denom: "ubze", distributed_stake: "0", last_distribution_epoch: "0" }],
    isLoading: false,
    hasError: false,
    refresh: vi.fn(),
    ...overrides,
});

beforeEach(() => {
    queryParams.clear();
    queryParams.set("denom", STAKING);
    useDenomRewardMock.mockReset().mockReturnValue(drState());
    navigateMock.mockReset();
    txMock.mockReset();
    affordMock.mockReset().mockReturnValue({ canAfford: true, isLoading: false, message: "", shortfalls: [] });
});

const submitButton = () => screen.getByRole("button", { name: /Add schedule|Extend schedule/ });

describe("schedule form — add", () => {
    it("escrows daily × days and charges only the schedule fee for a prize the DR already pays", async () => {
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await userEvent.type(screen.getByLabelText(/Prize per day/), "2");
        await userEvent.type(screen.getByLabelText(/Duration/), "30");

        expect(screen.getByTestId("escrow-amount")).toHaveTextContent("60 BZE");
        expect(screen.getByTestId("fee-disclosure")).toHaveTextContent("Schedule fee: 25000000000");
        expect(screen.getByText(/can.t be cancelled or withdrawn/)).toBeInTheDocument();

        // the affordability engine sees the escrow plus the resolved fee
        expect(affordMock).toHaveBeenLastCalledWith(expect.objectContaining({
            spend: [{ denom: "ubze", amount: "60000000" }],
            moduleFee: { denom: "ubze", amount: "25000000000" },
        }));

        await userEvent.click(submitButton());
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgCreateDenomRewardSchedule");
        expect(msgs[0].value).toMatchObject({
            creator: "bze1funder", denom: STAKING, prizeDenom: "ubze", dailyAmount: "2000000", duration: "30",
        });
    });

    it("adds the new-prize fee (summed) for a prize denom new to the DR", async () => {
        useDenomRewardMock.mockReturnValue(drState({ prizes: [] }));
        renderPage();
        await userEvent.click(screen.getByText("pick ATOM"));

        expect(screen.getByTestId("fee-disclosure")).toHaveTextContent("Schedule fee + New prize token fee: 50000000000");
        expect(screen.getByText(/ATOM is new to this denom reward/)).toBeInTheDocument();
    });

    it("warns and blocks when a new prize denom no longer fits under the cap", async () => {
        useDenomRewardMock.mockReturnValue(drState({
            prizes: [
                { staking_denom: STAKING, prize_denom: "ubze", distributed_stake: "0", last_distribution_epoch: "0" },
                { staking_denom: STAKING, prize_denom: "ufoo", distributed_stake: "0", last_distribution_epoch: "0" },
            ],
        }));
        renderPage();
        await userEvent.click(screen.getByText("pick ATOM"));
        await userEvent.type(screen.getByLabelText(/Prize per day/), "1");
        await userEvent.type(screen.getByLabelText(/Duration/), "10");

        expect(screen.getByText(/the maximum of\s+2/)).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
    });

    it.each(["0", "36501"])("rejects a duration of %s days before signing", async (days) => {
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await userEvent.type(screen.getByLabelText(/Prize per day/), "1");
        await userEvent.type(screen.getByLabelText(/Duration/), days);

        expect(submitButton()).toBeDisabled();
        await userEvent.click(submitButton());
        expect(txMock).not.toHaveBeenCalled();
    });

    it("blocks when the wallet can't cover escrow + fees + gas", async () => {
        affordMock.mockReturnValue({ canAfford: false, isLoading: false, message: "Not enough BZE", shortfalls: [] });
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await userEvent.type(screen.getByLabelText(/Prize per day/), "1");
        await userEvent.type(screen.getByLabelText(/Duration/), "10");

        expect(screen.getByText("Not enough BZE")).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
    });
});

describe("schedule form — extend", () => {
    beforeEach(() => { queryParams.set("schedule", "000004") });

    it("takes extra days only, charges no fee and signs MsgUpdateDenomRewardSchedule", async () => {
        renderPage();

        expect(screen.queryByLabelText(/Prize per day/)).not.toBeInTheDocument();
        expect(screen.queryByTestId("fee-disclosure")).not.toBeInTheDocument();
        expect(screen.getByText("No fee to extend")).toBeInTheDocument();

        await userEvent.type(screen.getByLabelText(/Extra days/), "10");
        expect(screen.getByTestId("escrow-amount")).toHaveTextContent("20 BZE");
        expect(affordMock).toHaveBeenLastCalledWith(expect.objectContaining({
            spend: [{ denom: "ubze", amount: "20000000" }],
            moduleFee: undefined,
        }));

        await userEvent.click(submitButton());
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgUpdateDenomRewardSchedule");
        expect(msgs[0].value).toMatchObject({ creator: "bze1funder", denom: STAKING, scheduleId: "000004", duration: "10" });
    });

    it("rejects extra days that push the total past 36,500", async () => {
        useDenomRewardMock.mockReturnValue(drState({ schedules: [{ ...SCHEDULE, duration: 36400 }] }));
        renderPage();
        await userEvent.type(screen.getByLabelText(/Extra days/), "101");

        expect(submitButton()).toBeDisabled();
    });

    it("explains a schedule that no longer exists", () => {
        useDenomRewardMock.mockReturnValue(drState({ schedules: [] }));
        renderPage();

        expect(screen.getByText("Schedule not found")).toBeInTheDocument();
    });
});

describe("schedule form — no denom reward", () => {
    it("points back to the manage page to create it first", () => {
        useDenomRewardMock.mockReturnValue(drState({ denomReward: undefined, schedules: [], prizes: [] }));
        renderPage();

        expect(screen.getByText("No denom reward yet")).toBeInTheDocument();
    });
});
