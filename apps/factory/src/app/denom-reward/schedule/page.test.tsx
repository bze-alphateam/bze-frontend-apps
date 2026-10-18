import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// Drive the form off mocked hooks: query params, the DR state, chain params, wallet and the
// affordability engine. The asset picker becomes a plain button per prize denom; PayPanel
// has its own coverage and prints its rows here.
const { STAKING, unloaded, queryParams, wallet, useDenomRewardMock, navigateMock, txMock, affordMock, openMock } = vi.hoisted(() => ({
    STAKING: "factory/bze1owner/utok",
    unloaded: new Set<string>(),
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1funder" as string | undefined },
    useDenomRewardMock: vi.fn(),
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    affordMock: vi.fn(),
    openMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => queryParams.current }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        denomParam: queryParams.current.get("denom"),
        getQueryParam: (p: string) => queryParams.current.get(p),
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
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows, moduleFee, feeUnknown }: {
        rows: { label: string; coin?: { denom: string; amount: string }; text?: string }[];
        moduleFee?: { amount: string };
        feeUnknown?: boolean;
    }) => (
        <div data-testid="pay-panel">
            {feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin ? `${r.coin.amount} ${r.coin.denom}` : r.text}`).join(", ")}
            {moduleFee && ` | module ${moduleFee.amount}`}
        </div>
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
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
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
        useAsset: (denom: string) => ({ asset: unloaded.has(denom) ? undefined : assets[denom], isLoading: false }),
        useBalance: () => ({ balance: { denom: "", amount: actual.toBigNumber(0) }, isLoading: false }),
        useCanAffordTx: (input: unknown) => affordMock(input),
        useCreationFees: () => ({
            fees: { addDenomRewardScheduleFee: fee, createDenomRewardPrizeFee: fee },
            denomRewardLimits: { maxPrizeDenomsPerDr: 2 },
            isLoading: false,
        }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        getCommunitiesApp: () => ({ href: "https://communities.test" }),
        useToast: () => ({ toast: { success: vi.fn() } }),
    };
});

import DenomRewardSchedulePage from "./page";

const DR = { staking_denom: STAKING, lock: 7, min_stake: "0", staked_amount: "0" };
const SCHEDULE = { schedule_id: "000004", staking_denom: STAKING, prize_denom: "ubze", daily_amount: "2000000", duration: 30, payouts: 3 };
const HOLDER_REWARDS = `/denom-reward/token?denom=${encodeURIComponent(STAKING)}`;

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

const setParams = (params: Record<string, string>) => {
    queryParams.current = new URLSearchParams({ denom: STAKING, ...params });
};

beforeEach(() => {
    setParams({});
    unloaded.clear();
    wallet.address = "bze1funder";
    useDenomRewardMock.mockReset().mockReturnValue(drState());
    navigateMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: unknown) => void }) => {
        opts.onSuccess({ txhash: "HASH1" });
    });
    affordMock.mockReset().mockReturnValue({ canAfford: true, isLoading: false, message: "", shortfalls: [] });
    openMock.mockReset();
    window.open = openMock as unknown as typeof window.open;
});

const startButton = () => screen.getByRole("button", { name: "Start the daily prize" });
const extendButton = () => screen.getByRole("button", { name: "Extend" });
const question = (title: string) => screen.getByRole("region", { name: title });
const payPanel = () => screen.getByTestId("pay-panel");
const GIVE = "What do you give?";
const DAILY = "How much a day?";
const DAYS = "For how many days?";
const MORE = "How many more days?";

const continueIn = (title: string) => userEvent.click(within(question(title)).getByRole("button", { name: "Continue" }));

async function answerAll(prize: "BZE" | "ATOM", daily: string, days: string) {
    await userEvent.click(screen.getByText(`pick ${prize}`));
    await continueIn(GIVE);
    await userEvent.type(within(question(DAILY)).getByLabelText(/Prize per day/), daily);
    await continueIn(DAILY);
    await userEvent.type(within(question(DAYS)).getByLabelText(/Payout days/), days);
}

describe("Give a little every day — add", { timeout: 20_000 }, () => {
    it("asks prize, amount and days in order, escrows daily × days and signs the create msg", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: /Give a little every day/ })).toBeInTheDocument();
        expect(screen.getByText("Pay a daily prize to everyone staking TOK.")).toBeInTheDocument();
        expect(screen.getByText("rewards · denom reward schedule")).toBeInTheDocument();
        expect(question(GIVE)).toHaveAttribute("data-state", "active");
        expect(question(DAILY)).toHaveAttribute("data-state", "todo");
        expect(question(DAYS)).toHaveAttribute("data-state", "todo");

        await answerAll("BZE", "2", "30");
        expect(question(GIVE)).toHaveTextContent("BZE");
        expect(question(DAILY)).toHaveTextContent("2 BZE a day");
        expect(screen.getByTestId("escrow-amount")).toHaveTextContent("60 BZE");
        expect(within(question(DAYS)).getByText(/can.t be cancelled or withdrawn/)).toBeInTheDocument();

        // Not signable before the last answer is in.
        expect(startButton()).toBeDisabled();
        await continueIn(DAYS);
        expect(question(DAYS)).toHaveTextContent("30 payout days");

        expect(screen.getByText(/leaves your wallet now and is paid as 2 BZE a day to everyone staking TOK, split by stake/)).toBeInTheDocument();
        // A prize the DR already pays: only the daily prize fee.
        expect(payPanel()).toHaveTextContent(
            "Locked for prizes: 60000000 ubze, Daily prize fee: 25000000000 ubze | module 25000000000",
        );

        // The affordability engine sees the escrow plus the resolved fee.
        expect(affordMock).toHaveBeenLastCalledWith(expect.objectContaining({
            spec: "create-denom-reward-schedule",
            spend: [{ denom: "ubze", amount: "60000000" }],
            moduleFee: { denom: "ubze", amount: "25000000000" },
        }));

        await userEvent.click(startButton());
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgCreateDenomRewardSchedule");
        expect(msgs[0].value).toMatchObject({
            creator: "bze1funder", denom: STAKING, prizeDenom: "ubze", dailyAmount: "2000000", duration: "30",
        });
    });

    it("adds the new-prize fee, with the summed total, for a prize denom new to the DR", async () => {
        useDenomRewardMock.mockReturnValue(drState({ prizes: [] }));
        renderPage();
        await userEvent.click(screen.getByText("pick ATOM"));
        expect(screen.getByText(/ATOM is new to TOK's holder rewards/)).toBeInTheDocument();
        await answerAll("ATOM", "1", "10");

        expect(payPanel()).toHaveTextContent(
            "Locked for prizes: 10000000 uatom, Daily prize fee: 25000000000 ubze, New prize fee: 25000000000 ubze, Fees total: 50000000000 ubze | module 50000000000",
        );
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

        expect(screen.getByText(/the maximum of 2/)).toBeInTheDocument();
        expect(within(question(GIVE)).getByRole("button", { name: "Continue" })).toBeDisabled();
        expect(startButton()).toBeDisabled();
    });

    it.each(["0", "36501"])("rejects a duration of %s days before signing", async (days) => {
        renderPage();
        await answerAll("BZE", "1", days);
        await userEvent.tab();

        expect(within(question(DAYS)).getByText("Must be between 1 and 36,500 days.")).toBeInTheDocument();
        expect(within(question(DAYS)).getByRole("button", { name: "Continue" })).toBeDisabled();
        expect(startButton()).toBeDisabled();
        await userEvent.click(startButton());
        expect(txMock).not.toHaveBeenCalled();
    });

    it("shows the amount error only after the field is left", async () => {
        renderPage();
        await userEvent.click(screen.getByText("pick BZE"));
        await continueIn(GIVE);
        const input = within(question(DAILY)).getByLabelText(/Prize per day/);
        await userEvent.type(input, "abc");
        expect(input).not.toHaveAttribute("aria-invalid", "true");
        await userEvent.tab();
        expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("blocks when the wallet can't cover escrow + fees + gas", async () => {
        affordMock.mockReturnValue({ canAfford: false, isLoading: false, message: "Not enough BZE", shortfalls: [] });
        renderPage();
        await answerAll("BZE", "1", "10");
        await continueIn(DAYS);

        expect(screen.getByText("Not enough BZE")).toBeInTheDocument();
        expect(startButton()).toBeDisabled();
    });

    it("asks for a wallet and never signs without one", async () => {
        wallet.address = undefined;
        renderPage();
        await answerAll("BZE", "1", "10");
        await continueIn(DAYS);

        expect(screen.getByText("Connect your wallet to fund this schedule.")).toBeInTheDocument();
        expect(startButton()).toBeDisabled();
    });

    it("on success offers the tx, the Communities page and goes back to the holder rewards page", async () => {
        renderPage();
        await answerAll("BZE", "2", "30");
        await continueIn(DAYS);
        await userEvent.click(startButton());

        expect(screen.getByText("Daily prize started")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("data-app", "explorer");
        expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute("data-app", "communities");
        expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute(
            "href", `https://communities.test/token?denom=${encodeURIComponent(STAKING)}`,
        );

        await userEvent.click(screen.getByRole("button", { name: "Back to TOK's holder rewards" }));
        expect(navigateMock).toHaveBeenCalledWith(HOLDER_REWARDS);
    });

    it("on success the primary button goes to the return path when one is given", async () => {
        setParams({ return: "/manage/token?denom=x&tab=rewards", returnLabel: "the token" });
        renderPage();
        expect(screen.getByRole("button", { name: "Back to the token" })).toBeInTheDocument();

        await answerAll("BZE", "2", "30");
        await continueIn(DAYS);
        await userEvent.click(startButton());

        await userEvent.click(screen.getByRole("button", { name: "Back to the token" }));
        expect(navigateMock).toHaveBeenCalledWith("/manage/token?denom=x&tab=rewards");
    });
});

describe("Extend a daily prize", { timeout: 20_000 }, () => {
    beforeEach(() => setParams({ schedule: "000004" }));

    it("takes extra days only, charges no fee and signs MsgUpdateDenomRewardSchedule", async () => {
        renderPage();

        expect(screen.getByRole("heading", { name: /Extend a daily prize/ })).toBeInTheDocument();
        expect(screen.getByText("2 BZE / day")).toBeInTheDocument();
        expect(screen.getByText(/Runs 30 days, 3 paid,\s+27 left/)).toBeInTheDocument();
        expect(screen.queryByLabelText(/Prize per day/)).not.toBeInTheDocument();

        await userEvent.type(within(question(MORE)).getByLabelText(/Extra days/), "10");
        expect(screen.getByTestId("escrow-amount")).toHaveTextContent("20 BZE");
        expect(affordMock).toHaveBeenLastCalledWith(expect.objectContaining({
            spec: "update-denom-reward-schedule",
            spend: [{ denom: "ubze", amount: "20000000" }],
            moduleFee: undefined,
        }));
        await continueIn(MORE);
        expect(payPanel()).toHaveTextContent("Locked for prizes: 20000000 ubze, Fee: None");
        expect(payPanel()).not.toHaveTextContent("module");
        expect(screen.getByText(/paid as 2 BZE a day for 10 more days to everyone staking TOK/)).toBeInTheDocument();

        await userEvent.click(extendButton());
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgUpdateDenomRewardSchedule");
        expect(msgs[0].value).toMatchObject({ creator: "bze1funder", denom: STAKING, scheduleId: "000004", duration: "10" });
        expect(screen.getByText("Daily prize extended")).toBeInTheDocument();
    });

    it("rejects extra days that push the total past 36,500", async () => {
        useDenomRewardMock.mockReturnValue(drState({ schedules: [{ ...SCHEDULE, duration: 36400 }] }));
        renderPage();
        await userEvent.type(within(question(MORE)).getByLabelText(/Extra days/), "101");

        expect(within(question(MORE)).getByRole("button", { name: "Continue" })).toBeDisabled();
        expect(extendButton()).toBeDisabled();
    });

    it("disables the question when the schedule already runs the maximum", () => {
        useDenomRewardMock.mockReturnValue(drState({ schedules: [{ ...SCHEDULE, duration: 36500 }] }));
        renderPage();

        expect(screen.getByText("This schedule already runs the maximum of 36,500 days.")).toBeInTheDocument();
        expect(within(question(MORE)).getByLabelText(/Extra days/)).toBeDisabled();
        expect(extendButton()).toBeDisabled();
    });

    it("explains a schedule that no longer exists", async () => {
        useDenomRewardMock.mockReturnValue(drState({ schedules: [] }));
        renderPage();

        expect(screen.getByText("Schedule not found")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Back to the token/ }));
        expect(navigateMock).toHaveBeenCalledWith(HOLDER_REWARDS);
    });
});

describe("schedule form — guards", () => {
    it("never prints the raw denom while the asset list is still loading", () => {
        // A factory denom is one unbreakable word; in the nowrap back button it widened the page past a phone.
        unloaded.add(STAKING);
        renderPage();

        expect(screen.getByRole("button", { name: "Back to the token's holder rewards" })).toBeInTheDocument();
        expect(screen.getByText("Pay a daily prize to everyone staking the token.")).toBeInTheDocument();
        expect(document.body.textContent).not.toContain(STAKING);
    });

    it("points back to the denom reward page to create it first", () => {
        useDenomRewardMock.mockReturnValue(drState({ denomReward: undefined, schedules: [], prizes: [] }));
        renderPage();

        expect(screen.getByText("No holder rewards yet")).toBeInTheDocument();
    });

    it("explains a failed chain query", () => {
        useDenomRewardMock.mockReturnValue(drState({ denomReward: undefined, hasError: true }));
        renderPage();

        expect(screen.getByText("Couldn't load the holder rewards")).toBeInTheDocument();
    });

    it("asks for a token without ?denom=", async () => {
        queryParams.current = new URLSearchParams();
        renderPage();

        expect(screen.getByText("No token selected")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Back to the token/ }));
        expect(navigateMock).toHaveBeenCalledWith("/rewards");
    });
});
