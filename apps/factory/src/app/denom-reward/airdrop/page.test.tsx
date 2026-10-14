import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// The airdrop form off mocked hooks: query params, the DR state, chain params, wallet and the
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

import DenomRewardAirdropPage from "./page";

const DR = { staking_denom: STAKING, lock: 7, min_stake: "0", staked_amount: "500000000" };
const BZE_PRIZE = { staking_denom: STAKING, prize_denom: "ubze", distributed_stake: "0.5", last_distribution_epoch: "10" };

function renderPage() {
    return render(<DenomRewardAirdropPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const drState = (overrides: Record<string, unknown> = {}) => ({
    denomReward: DR,
    schedules: [],
    prizes: [BZE_PRIZE],
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

const submitButton = () => screen.getByRole("button", { name: /Airdrop now/ });

describe("airdrop form", () => {
    it("discloses the irreversible split, charges no fee for a prize the DR already pays and signs MsgDistributeDenomRewards", async () => {
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await userEvent.type(screen.getByLabelText(/Amount/), "12.5");

        expect(screen.getByTestId("airdrop-amount")).toHaveTextContent("12.5 BZE");
        expect(screen.getByText(/split among the current stakers of TOK\s+pro\s+rata to their stake; this cannot be undone/)).toBeInTheDocument();
        expect(screen.queryByTestId("fee-disclosure")).not.toBeInTheDocument();
        expect(screen.getByText("No fee for this prize token")).toBeInTheDocument();
        expect(affordMock).toHaveBeenLastCalledWith(expect.objectContaining({
            spec: "distribute-denom-rewards",
            spend: [{ denom: "ubze", amount: "12500000" }],
            moduleFee: undefined,
        }));

        await userEvent.click(submitButton());
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgDistributeDenomRewards");
        expect(msgs[0].value).toEqual({ creator: "bze1funder", denom: STAKING, prizeDenom: "ubze", amount: "12500000" });
    });

    it("charges the one-time prize fee for a prize token new to the DR, counted in the balance check", async () => {
        renderPage();
        await userEvent.click(screen.getByText("pick ATOM"));
        await userEvent.type(screen.getByLabelText(/Amount/), "3");

        expect(screen.getByTestId("fee-disclosure")).toHaveTextContent("New prize token fee: 25000000000");
        expect(screen.getByText(/ATOM is new to this denom reward/)).toBeInTheDocument();
        expect(affordMock).toHaveBeenLastCalledWith(expect.objectContaining({
            spend: [{ denom: "uatom", amount: "3000000" }],
            moduleFee: { denom: "ubze", amount: "25000000000" },
        }));
        expect(submitButton()).toBeEnabled();
    });

    it("refuses a DR nobody is staking, with the chain's reason", async () => {
        useDenomRewardMock.mockReturnValue(drState({ denomReward: { ...DR, staked_amount: "0" } }));
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await userEvent.type(screen.getByLabelText(/Amount/), "1");

        expect(screen.getByTestId("airdrop-blocker")).toHaveTextContent(/no one to pay/);
        expect(submitButton()).toBeDisabled();
        await userEvent.click(submitButton());
        expect(txMock).not.toHaveBeenCalled();
    });

    it("blocks a new prize token once the cap is reached", async () => {
        useDenomRewardMock.mockReturnValue(drState({
            prizes: [BZE_PRIZE, { ...BZE_PRIZE, prize_denom: "ufoo" }],
        }));
        renderPage();
        await userEvent.click(screen.getByText("pick ATOM"));
        await userEvent.type(screen.getByLabelText(/Amount/), "1");

        expect(screen.getByTestId("airdrop-blocker")).toHaveTextContent(/maximum number of prize tokens/);
        expect(submitButton()).toBeDisabled();
    });

    it("blocks when the wallet can't cover amount + fee + gas", async () => {
        affordMock.mockReturnValue({ canAfford: false, isLoading: false, message: "Not enough BZE", shortfalls: [] });
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await userEvent.type(screen.getByLabelText(/Amount/), "1");

        expect(screen.getByText("Not enough BZE")).toBeInTheDocument();
        expect(submitButton()).toBeDisabled();
    });

    it("explains a token without a denom reward", () => {
        useDenomRewardMock.mockReturnValue(drState({ denomReward: undefined, prizes: [] }));
        renderPage();

        expect(screen.getByText("No denom reward yet")).toBeInTheDocument();
    });
});
