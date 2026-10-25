import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset, DenomReward } from "@bze/bze-ui-kit";

// The daily prize wizard (add + extend) on mocked hooks: query params, wallet, fees, balances, the
// fee engine, each token's compounded reward and the wallet side of the tx (useFactoryTx). The
// wizard's tx hook, the pending-tx store, the Review step and the Done screen are real. The
// staked-token picker becomes a button per token showing the page's row state; the asset picker a
// button per prize denom. Both have their own coverage.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
};
type DrState = { denomReward?: DenomReward; schedules?: unknown[]; prizes?: unknown[]; hasError?: boolean; isLoading?: boolean };
const { ASSETS, queryParams, wallet, feeState, balances, afford, drState, refreshMock, navigateMock, txMock } = vi.hoisted(() => ({
    ASSETS: {
        uhoney: { denom: "uhoney", ticker: "HONEY", name: "Honey", decimals: 6, logo: "" },
        upage: { denom: "upage", ticker: "PAGE", name: "Page", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6, logo: "" },
        uwax: { denom: "uwax", ticker: "WAX", name: "Wax", decimals: 6, logo: "" },
    } as Record<string, { denom: string; ticker: string; name: string; decimals: number; logo: string }>,
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    feeState: {
        fees: {} as Record<string, { denom: string; amount: string } | undefined>,
        limits: {} as Record<string, unknown>,
    },
    balances: { current: {} as Record<string, string> },
    afford: { canAfford: true, message: "" },
    drState: { current: {} as Record<string, DrState> },
    refreshMock: vi.fn(),
    navigateMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/denom-reward/schedule",
    useSearchParams: () => queryParams.current,
}));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        denomParam: queryParams.current.get("denom"),
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock, progressTrack: "" }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: (fee?: { denom: string; amount: string }) => ({
        canPayFee: true,
        isLoading: false,
        method: "native",
        estimate: { resolvedFee: fee },
        gasFee: { denom: "ubze", amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "BZE", isLoading: false },
    }),
}));
vi.mock("@/hooks/useDenomReward", () => ({
    useDenomReward: (denom: string) => ({
        denomReward: undefined,
        schedules: [],
        prizes: [],
        hasError: false,
        isLoading: false,
        refresh: refreshMock,
        ...drState.current[denom],
    }),
}));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, feeUnknown }: { rows: { label: string; coin?: { denom: string; amount: string }; text?: string }[]; feeUnknown?: boolean }) => (
        <div data-testid="pay-panel">{feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin ? `${r.coin.amount} ${r.coin.denom}` : r.text}`).join(", ")}</div>
    ),
}));
vi.mock("@/components/pickers/staked-token-picker", () => ({
    StakedTokenPicker: ({ mode, onChange, stateOf }: {
        mode: string;
        onChange: (a: { denom: string }) => void;
        stateOf: (a: unknown, dr?: unknown) => { text: string; disabled?: boolean } | undefined;
    }) => (
        <div data-testid="staked-picker" data-mode={mode}>
            {["uhoney", "upage"].map(d => {
                const state = stateOf(ASSETS[d], drState.current[d]?.denomReward)
                return (
                    <button key={d} disabled={state?.disabled} onClick={() => onChange({ denom: d })}>
                        {`Stake ${d}${state ? ` · ${state.text}` : ""}`}
                    </button>
                )
            })}
        </div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ onSelect }: { onSelect: (a: { denom: string }) => void }) => (
        <div>{["ubze", "uwax"].map(d => <button key={d} onClick={() => onSelect({ denom: d })}>{`Prize ${d}`}</button>)}</div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const { default: BN } = await import("bignumber.js");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: ASSETS[denom] as Partial<Asset> | undefined, isLoading: false }),
        useBalance: (denom: string) => ({ balance: { denom, amount: new BN(balances.current[denom] ?? "0") }, isLoading: false }),
        useAssetPrice: () => ({ hasPrice: false, totalUsdValue: () => new BN(0), uAmountUsdValue: () => new BN(0) }),
        useCanAffordTx: () => ({ ...afford, isLoading: false, shortfalls: [] }),
        useCreationFees: () => ({ fees: feeState.fees, denomRewardLimits: feeState.limits, isLoading: false }),
        getSettings: () => ({ endpoints: { restEndpoint: "https://rest.test" } }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getFactoryApp: () => ({ href: "https://factory.test" }),
        getCommunitiesApp: () => ({ href: "https://communities.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import DenomRewardSchedulePage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<DenomRewardSchedulePage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];
const FEE = { denom: "ubze", amount: "25000000000" };
const HONEY_DR: DenomReward = { staking_denom: "uhoney", lock: 7, min_stake: "0", staked_amount: "1250000000" };
const BZE_PRIZE = { staking_denom: "uhoney", prize_denom: "ubze", distributed_stake: "0", last_distribution_epoch: "0" };
const SCHEDULE = { schedule_id: "000000000007", staking_denom: "uhoney", prize_denom: "ubze", daily_amount: "50000000", duration: 30, payouts: 10 };

async function pickToken(denom = "uhoney") {
    await userEvent.click(within(step("Staked token")).getByText(new RegExp(`^Stake ${denom}`)));
    await userEvent.click(button(step("Staked token"), "Continue"));
}

async function fillPrize(daily: string, days: string, denom = "ubze") {
    const q = step("Prize");
    await userEvent.click(within(q).getByText(`Prize ${denom}`));
    await userEvent.type(within(q).getByLabelText(/Prize per day/), daily);
    await userEvent.type(within(q).getByLabelText(/Payout days/), days);
}

async function signAndContinue(label: string) {
    await userEvent.click(button(step("Review"), label));
    expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    feeState.fees = { addDenomRewardScheduleFee: FEE, createDenomRewardPrizeFee: FEE };
    feeState.limits = { maxPrizeDenomsPerDr: 3 };
    // 100,000 BZE and 1,000 WAX.
    balances.current = { ubze: "100000000000", uwax: "1000000000" };
    afford.canAfford = true;
    afford.message = "";
    drState.current = {
        uhoney: { denomReward: HONEY_DR, prizes: [BZE_PRIZE], schedules: [SCHEDULE] },
        upage: { denomReward: { staking_denom: "upage", lock: 7, min_stake: "0", staked_amount: "0" } },
    };
    refreshMock.mockReset();
    navigateMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH1");
        opts.onSuccess?.({ txhash: "HASH1", height: 1234, code: 0 });
        return true;
    });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => vi.unstubAllGlobals());

describe("Daily prize, add (/denom-reward/schedule)", { timeout: 20_000 }, () => {
    it("asks whose stakers first, with the picker in hasCompounded mode and the way to make one stakable", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: /Add a daily prize/ })).toBeInTheDocument();
        expect(screen.getByText("rewards · denom reward schedule")).toBeInTheDocument();
        expect(step("Staked token")).toHaveAttribute("data-state", "active");
        expect(within(step("Staked token")).getByRole("heading", { name: "Whose stakers get it?" })).toBeInTheDocument();
        expect(screen.getByTestId("staked-picker")).toHaveAttribute("data-mode", "hasCompounded");
        expect(screen.getByRole("link", { name: "Make a token stakable" })).toHaveAttribute("href", "/denom-reward/new");
        expect(step("Prize")).toHaveAttribute("data-state", "todo");
        expect(step("Review")).toHaveAttribute("data-state", "todo");
    });

    it("each row shows what is staked; nothing staked still takes a daily prize", async () => {
        renderPage();
        expect(screen.getByText("Stake uhoney · 1,250 staked")).toBeInTheDocument();
        expect(screen.getByText("Stake upage · Nothing staked yet")).toBeEnabled();
        await pickToken("upage");
        expect(step("Staked token")).toHaveTextContent("PAGE stakers");
    });

    it("is pre-answered by ?denom=", () => {
        queryParams.current = new URLSearchParams({ denom: "uhoney" });
        renderPage();
        expect(step("Staked token")).toHaveAttribute("data-state", "done");
        expect(step("Staked token")).toHaveTextContent("HONEY stakers");
        expect(step("Prize")).toHaveAttribute("data-state", "active");
    });

    it("a token without a compounded reward can't continue and points to making it stakable", () => {
        queryParams.current = new URLSearchParams({ denom: "uhoney" });
        drState.current = {};
        renderPage();
        expect(step("Staked token")).toHaveAttribute("data-state", "active");
        expect(screen.getByTestId("no-compounded")).toHaveTextContent("HONEY has no compounded reward yet.");
        expect(screen.getByRole("link", { name: "Make HONEY stakable" })).toHaveAttribute("href", "/denom-reward/new?denom=uhoney");
        expect(button(step("Staked token"), "Continue")).toBeDisabled();
    });

    it("a load error is never 'no reward': it says so, with a retry", async () => {
        queryParams.current = new URLSearchParams({ denom: "uhoney" });
        drState.current = { uhoney: { hasError: true } };
        renderPage();
        expect(screen.getByText("Couldn't load HONEY's compounded reward. The node may be down.")).toBeInTheDocument();
        expect(screen.queryByTestId("no-compounded")).not.toBeInTheDocument();
        expect(button(step("Staked token"), "Continue")).toBeDisabled();
        await userEvent.click(button(step("Staked token"), "Retry"));
        expect(refreshMock).toHaveBeenCalled();
    });

    describe("Prize", () => {
        it("a prize the reward already pays is free; the live sentence and the total", async () => {
            renderPage();
            await pickToken();
            await fillPrize("50", "30");
            const q = step("Prize");
            expect(within(q).getByTestId("prize-slot-note")).toHaveTextContent("No prize fee: HONEY already pays BZE.");
            expect(within(q).getByTestId("prize-sentence")).toHaveTextContent("Everyone staking HONEY shares 50 BZE a day for 30 days.");
            expect(within(q).getByTestId("escrow-amount")).toHaveTextContent("1,500 BZE");
            await userEvent.click(button(q, "Continue"));
            expect(step("Prize")).toHaveTextContent("50 BZE a day for 30 days");
            expect(step("Review")).toHaveAttribute("data-state", "active");
        });

        it("a new prize token: the fee and the slots left", async () => {
            renderPage();
            await pickToken();
            await userEvent.click(within(step("Prize")).getByText("Prize uwax"));
            expect(screen.getByTestId("prize-slot-note")).toHaveTextContent("WAX is a new prize token here: +25,000 BZE, uses 1 of the remaining 2 prize slots.");
        });

        it("a new prize token past the cap is blocked (5017)", async () => {
            feeState.limits = { maxPrizeDenomsPerDr: 1 };
            renderPage();
            await pickToken();
            await fillPrize("1", "30", "uwax");
            expect(within(step("Prize")).getByText(/already uses 1 prize tokens, the maximum of 1/)).toBeInTheDocument();
            expect(button(step("Prize"), "Continue")).toBeDisabled();
        });

        it("caps the days at 36,500", async () => {
            renderPage();
            await pickToken();
            // 0.001 BZE a day: the balance covers the full 36,500 days.
            await fillPrize("0.001", "36501");
            expect(button(step("Prize"), "Continue")).toBeDisabled();
            await userEvent.clear(within(step("Prize")).getByLabelText(/Payout days/));
            await userEvent.type(within(step("Prize")).getByLabelText(/Payout days/), "36500");
            expect(button(step("Prize"), "Continue")).toBeEnabled();
        });

        it("checks the prize balance", async () => {
            renderPage();
            await pickToken();
            await fillPrize("50", "30", "uwax");
            expect(within(step("Prize")).getByRole("alert")).toHaveTextContent("Not enough WAX: you hold 1,000 WAX.");
            expect(button(step("Prize"), "Continue")).toBeDisabled();
        });
    });

    describe("Review", () => {
        it("lists what leaves the wallet, what you get and what is permanent, and signs MsgCreateDenomRewardSchedule", async () => {
            renderPage();
            await pickToken();
            await fillPrize("50", "30", "uwax");
            balances.current = { ...balances.current, uwax: "100000000000" };
            await userEvent.clear(within(step("Prize")).getByLabelText(/Prize per day/));
            await userEvent.type(within(step("Prize")).getByLabelText(/Prize per day/), "5");
            await userEvent.click(button(step("Prize"), "Continue"));

            expect(screen.getByTestId("pay-panel")).toHaveTextContent(
                "Locked for prizes: 150000000 uwax, Daily prize fee: 25000000000 ubze, New prize fee: 25000000000 ubze, Fees total: 50000000000 ubze",
            );
            const review = step("Review");
            expect(within(review).getByRole("region", { name: "Leaves your wallet" })).toHaveTextContent("Daily prize fee");
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("A daily prize for HONEY stakers");
            expect(review).toHaveTextContent("Committed tokens are paid out to stakers");
            expect(review).not.toHaveTextContent("daily amount can't change");
            expect(review).not.toHaveTextContent("doesn't make you the reward's owner");

            await userEvent.click(button(review, "Start daily prize"));
            expect(sentMsgs().map(m => m.typeUrl)).toEqual(["/bze.rewards.MsgCreateDenomRewardSchedule"]);
            expect(sentMsgs()[0].value).toMatchObject({ creator: "bze1me", denom: "uhoney", prizeDenom: "uwax", dailyAmount: "5000000", duration: "30" });
        });

        it("an unknown fee blocks it", async () => {
            feeState.fees = { ...feeState.fees, addDenomRewardScheduleFee: undefined };
            renderPage();
            await pickToken();
            await fillPrize("50", "30");
            await userEvent.click(button(step("Prize"), "Continue"));
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("fee unknown");
            expect(button(step("Review"), "Start daily prize")).toBeDisabled();
        });

        it("without a wallet, asks to connect and never signs", async () => {
            wallet.address = undefined;
            renderPage();
            await pickToken();
            await fillPrize("50", "30");
            await userEvent.click(button(step("Prize"), "Continue"));
            expect(button(step("Review"), "Start daily prize")).toBeDisabled();
            expect(screen.getByText("Connect your wallet to fund this daily prize.")).toBeInTheDocument();
        });

        it("says what the wallet is short of", async () => {
            afford.canAfford = false;
            afford.message = "Insufficient BZE balance (5 BZE short)";
            renderPage();
            await pickToken();
            await fillPrize("50", "30");
            await userEvent.click(button(step("Prize"), "Continue"));
            expect(button(step("Review"), "Start daily prize")).toBeDisabled();
            expect(screen.getByText("Insufficient BZE balance (5 BZE short)")).toBeInTheDocument();
        });
    });

    describe("Done", () => {
        async function startPrize() {
            renderPage();
            await pickToken();
            await fillPrize("50", "30");
            await userEvent.click(button(step("Prize"), "Continue"));
            await signAndContinue("Start daily prize");
        }

        it("the title, Stake on DEX recommended, Add more rewards and the Communities link", async () => {
            await startPrize();
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("50 BZE a day for HONEY stakers.");
            expect(screen.getByTestId("done-recommended")).toHaveTextContent("Stake on DEX");
            await userEvent.click(within(screen.getByRole("article", { name: "Add more rewards" })).getByRole("button", { name: "Add daily prize" }));
            expect(navigateMock).toHaveBeenCalledWith("/denom-reward/schedule?denom=uhoney");
            expect(screen.getAllByRole("link", { name: /Communities/ })[0]).toHaveAttribute("href", "https://communities.test/token?denom=uhoney");
        });

        it("with a return path: Back to <TICKER>", async () => {
            queryParams.current = new URLSearchParams({ return: "/tokens/token?denom=uhoney", returnLabel: "HONEY" });
            await startPrize();
            await userEvent.click(screen.getByRole("button", { name: /Back to HONEY/ }));
            expect(navigateMock).toHaveBeenCalledWith("/tokens/token?denom=uhoney");
        });
    });
});

describe("Daily prize, extend (&schedule=)", { timeout: 20_000 }, () => {
    beforeEach(() => {
        queryParams.current = new URLSearchParams({ denom: "uhoney", schedule: SCHEDULE.schedule_id });
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 9, 21, 12));
    });
    afterEach(() => vi.useRealTimers());

    it("summarises the schedule, then asks for the extra days; no fee, no explainers", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: /Extend a daily prize/ })).toBeInTheDocument();
        expect(step("Daily prize")).toHaveAttribute("data-state", "done");
        expect(step("Daily prize")).toHaveTextContent("50 BZE a day for HONEY stakers · 20 days left");
        expect(step("Extra days")).toHaveAttribute("data-state", "active");
        expect(within(step("Extra days")).getByText("Min 1 · Max 36470 days")).toBeInTheDocument();
        expect(within(step("Extra days")).queryByText(/Anyone can extend|daily amount can't change|No fee/)).not.toBeInTheDocument();
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Fee: None");

        await userEvent.click(within(step("Daily prize")).getByRole("button", { name: /Edit/ }));
        const terms = within(screen.getByTestId("schedule-terms"));
        expect(terms.getByText("Stake")).toBeInTheDocument();
        expect(terms.getByText("Daily reward")).toBeInTheDocument();
        expect(terms.getByText("End date")).toBeInTheDocument();
        expect(terms.getByText("About 10 Nov")).toBeInTheDocument();
        expect(terms.queryByText(/Stays as it is/)).not.toBeInTheDocument();
    });

    it("escrows daily × extra days, moves the end and signs MsgUpdateDenomRewardSchedule", async () => {
        renderPage();
        await userEvent.type(within(step("Extra days")).getByLabelText("Extra days"), "10");
        expect(screen.getByTestId("extend-new-end")).toHaveTextContent("New end dateAbout 20 Nov");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Locked for prizes: 500000000 ubze, Fee: None");
        await userEvent.click(button(step("Extra days"), "Review extension"));

        const review = step("Review");
        expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("10 more days for everyone staking HONEY");
        await userEvent.click(button(review, "Extend"));
        expect(sentMsgs().map(m => m.typeUrl)).toEqual(["/bze.rewards.MsgUpdateDenomRewardSchedule"]);
        expect(sentMsgs()[0].value).toMatchObject({ creator: "bze1me", denom: "uhoney", scheduleId: "000000000007", duration: "10" });
    });

    it("the total can't pass 36,500 days", async () => {
        drState.current.uhoney = { ...drState.current.uhoney, schedules: [{ ...SCHEDULE, duration: 36490 }] };
        renderPage();
        await userEvent.type(within(step("Extra days")).getByLabelText("Extra days"), "11");
        expect(within(step("Extra days")).getByText(/^Add between 1 and 10 days/)).toBeInTheDocument();
        expect(button(step("Extra days"), "Review extension")).toBeDisabled();
    });

    it("checks the prize balance", async () => {
        balances.current = { ubze: "100000000" };
        renderPage();
        await userEvent.type(within(step("Extra days")).getByLabelText("Extra days"), "10");
        expect(within(step("Extra days")).getByRole("alert")).toHaveTextContent("Not enough BZE: you hold 100 BZE.");
        expect(button(step("Extra days"), "Review extension")).toBeDisabled();
    });

    it("Done: N more days, then Stake on DEX", async () => {
        renderPage();
        await userEvent.type(within(step("Extra days")).getByLabelText("Extra days"), "10");
        await userEvent.click(button(step("Extra days"), "Review extension"));
        await signAndContinue("Extend");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("10 more days for HONEY stakers.");
        expect(screen.getByTestId("done-recommended")).toHaveTextContent("Stake on DEX");
    });

    it.each([
        ["a schedule that no longer runs", { schedules: [] }, "Schedule not found"],
        ["a token without a compounded reward", { denomReward: undefined }, "No compounded reward yet"],
        ["a failed chain query", { hasError: true }, "Couldn't load the compounded reward"],
    ])("explains %s", (_name, state, title) => {
        drState.current.uhoney = { ...drState.current.uhoney, ...state };
        renderPage();
        expect(screen.getByText(title)).toBeInTheDocument();
    });

    it("asks for a token without ?denom=", () => {
        queryParams.current = new URLSearchParams({ schedule: "1" });
        renderPage();
        expect(screen.getByText("No token selected")).toBeInTheDocument();
    });
});
