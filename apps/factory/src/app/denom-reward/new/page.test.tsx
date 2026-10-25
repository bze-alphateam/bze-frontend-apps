import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: query params, wallet, fees, balances, the fee engine, the token's
// compounded reward and the wallet side of the tx (useFactoryTx). The wizard's tx hook, the pending-tx
// store, the Review step and the Done screen are real. The staked-token picker and the asset picker
// become plain buttons per denom; both have their own coverage.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
};
const { queryParams, wallet, feeState, balances, afford, drState, navigateMock, replaceMock, txMock } = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    feeState: {
        fees: {} as Record<string, { denom: string; amount: string } | undefined>,
        limits: {} as Record<string, unknown>,
    },
    balances: { current: {} as Record<string, string> },
    afford: { canAfford: true, message: "" },
    drState: { current: {} as Record<string, { denomReward?: unknown; hasError?: boolean; isLoading?: boolean }> },
    navigateMock: vi.fn(),
    replaceMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/denom-reward/new",
    useSearchParams: () => queryParams.current,
}));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        denomParam: queryParams.current.get("denom"),
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
        replace: replaceMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock, progressTrack: "" }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({
        canPayFee: true,
        isLoading: false,
        method: "native",
        estimate: { resolvedFee: undefined },
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
        refresh: vi.fn(),
        ...drState.current[denom],
    }),
}));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, feeUnknown }: { rows: { label: string; coin?: { denom: string; amount: string } }[]; feeUnknown?: boolean }) => (
        <div data-testid="pay-panel">{feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin?.amount} ${r.coin?.denom}`).join(", ")}</div>
    ),
}));
vi.mock("@/components/pickers/staked-token-picker", () => ({
    StakedTokenPicker: ({ mode, onChange }: { mode: string; onChange: (a: { denom: string }) => void }) => (
        <div data-testid="staked-picker" data-mode={mode}>
            {["uhoney", "upage"].map(d => <button key={d} onClick={() => onChange({ denom: d })}>{`Stake ${d}`}</button>)}
        </div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label, onSelect }: { label: string; onSelect: (a: { denom: string }) => void }) => (
        <div>
            <span>{label}</span>
            {["ubze", "uwax"].map(d => <button key={d} onClick={() => onSelect({ denom: d })}>{`Prize ${d}`}</button>)}
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        uhoney: { denom: "uhoney", ticker: "HONEY", name: "Honey", decimals: 6, logo: "" },
        upage: { denom: "upage", ticker: "PAGE", name: "Page", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6, logo: "" },
        uwax: { denom: "uwax", ticker: "WAX", name: "Wax", decimals: 6, logo: "" },
    };
    const { default: BN } = await import("bignumber.js");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: (denom: string) => ({ balance: { denom, amount: new BN(balances.current[denom] ?? "0") }, isLoading: false }),
        useAssetPrice: () => ({ hasPrice: false, totalUsdValue: () => new BN(0), uAmountUsdValue: () => new BN(0) }),
        useCanAffordTx: () => ({ ...afford, isLoading: false, shortfalls: [] }),
        useCreationFees: () => ({ fees: feeState.fees, denomRewardLimits: feeState.limits, isLoading: false }),
        getSettings: () => ({ endpoints: { restEndpoint: "https://rest.test" } }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getFactoryApp: () => ({ href: "https://factory.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import CompoundedRewardNewPage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<CompoundedRewardNewPage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];
const FEE = { denom: "ubze", amount: "25000000000" };

async function pickToken(denom = "uhoney") {
    await userEvent.click(within(step("Stake")).getByText(`Stake ${denom}`));
    await userEvent.click(button(step("Stake"), "Continue"));
}

async function fillPrize(daily: string, days: string, denom = "ubze") {
    const q = step("First daily prize");
    await userEvent.click(within(q).getByRole("button", { name: "Add a daily prize" }));
    await userEvent.click(within(q).getByText(`Prize ${denom}`));
    await userEvent.type(within(q).getByLabelText(/Daily reward/), daily);
    await userEvent.type(within(q).getByLabelText("Days"), days);
}

/** Sign on Review, then leave the confirmed tx panel for the Done screen. */
async function signAndContinue() {
    await userEvent.click(button(step("Review"), "Make HONEY stakable"));
    expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

function txSucceeds() {
    txMock.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH1");
        opts.onSuccess?.({ txhash: "HASH1", height: 1234, code: 0 });
        return true;
    });
}

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    feeState.fees = { createDenomRewardFee: FEE, addDenomRewardScheduleFee: FEE, createDenomRewardPrizeFee: FEE };
    feeState.limits = { denomRewardLock: 7, denomRewardMinStake: "0", maxPrizeDenomsPerDr: 50 };
    // 100,000 BZE and 1,000 WAX.
    balances.current = { ubze: "100000000000", uwax: "1000000000" };
    afford.canAfford = true;
    afford.message = "";
    drState.current = {};
    navigateMock.mockReset();
    replaceMock.mockReset();
    txMock.mockReset();
    txSucceeds();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => vi.unstubAllGlobals());

describe("Create a compounded reward (/denom-reward/new)", { timeout: 20_000 }, () => {
    it("shows the three steps with Stake open and the picker in makeStakable mode", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: /Create a compounded reward/ })).toBeInTheDocument();
        expect(screen.getByText("rewards · denom reward")).toBeInTheDocument();
        expect(step("Stake")).toHaveAttribute("data-state", "active");
        expect(within(step("Stake")).getByRole("heading", { name: "Which token?" })).toBeInTheDocument();
        expect(screen.getByTestId("staked-picker")).toHaveAttribute("data-mode", "makeStakable");
        expect(step("First daily prize")).toHaveAttribute("data-state", "todo");
        expect(step("Review")).toHaveAttribute("data-state", "todo");
        expect(screen.queryByRole("region", { name: "What will happen" })).not.toBeInTheDocument();
    });

    describe("Stake", () => {
        it("shows the frozen facts from the params and summarises the pick", async () => {
            feeState.limits = { ...feeState.limits, denomRewardMinStake: "5000000" };
            renderPage();
            await userEvent.click(within(step("Stake")).getByText("Stake uhoney"));
            const facts = within(screen.getByTestId("token-facts"));
            expect(facts.getByText("7 days")).toBeInTheDocument();
            expect(facts.getByText("5 HONEY")).toBeInTheDocument();
            expect(facts.getByText("Unstaking lock")).toBeInTheDocument();
            expect(screen.queryByText(/Set by the chain and fixed when created/)).not.toBeInTheDocument();
            await userEvent.click(button(step("Stake"), "Continue"));
            expect(step("Stake")).toHaveAttribute("data-state", "done");
            expect(step("Stake")).toHaveTextContent("Make HONEY stakable");
            expect(step("First daily prize")).toHaveAttribute("data-state", "active");
        });

        it("is pre-answered by ?denom=", () => {
            queryParams.current = new URLSearchParams({ denom: "uhoney" });
            renderPage();
            expect(step("Stake")).toHaveAttribute("data-state", "done");
            expect(step("First daily prize")).toHaveAttribute("data-state", "active");
        });

        it("a token that already has one continues to adding a prize to it", async () => {
            drState.current = { upage: { denomReward: { staking_denom: "upage", lock: 7, min_stake: "0", staked_amount: "0" } } };
            renderPage();
            await userEvent.click(within(step("Stake")).getByText("Stake upage"));
            expect(screen.queryByTestId("token-facts")).not.toBeInTheDocument();
            expect(screen.getByTestId("already-stakable")).toHaveTextContent("PAGE is already stakable.");
            expect(screen.queryByText("Continue to add a daily prize for its stakers.")).not.toBeInTheDocument();
            expect(replaceMock).not.toHaveBeenCalled();
            await userEvent.click(button(step("Stake"), "Continue to add a prize"));
            expect(replaceMock).toHaveBeenCalledWith("/denom-reward/schedule?denom=upage");
        });

        it("a link to a token that already has one goes straight to adding a prize", () => {
            queryParams.current = new URLSearchParams({ denom: "upage", return: "/tokens/token?denom=upage", returnLabel: "PAGE" });
            drState.current = { upage: { denomReward: { staking_denom: "upage", lock: 7, min_stake: "0", staked_amount: "0" } } };
            renderPage();
            expect(replaceMock).toHaveBeenCalledWith(`/denom-reward/schedule?denom=upage&return=${encodeURIComponent("/tokens/token?denom=upage")}&returnLabel=PAGE`);
        });

        it("a load error is not 'none': nothing is offered, with a retry", async () => {
            queryParams.current = new URLSearchParams({ denom: "uhoney" });
            drState.current = { uhoney: { hasError: true } };
            renderPage();
            expect(step("Stake")).toHaveAttribute("data-state", "active");
            expect(screen.getByText("Couldn't check whether HONEY already has a compounded reward. The node may be down.")).toBeInTheDocument();
            expect(button(step("Stake"), "Continue")).toBeDisabled();
        });
    });

    describe("First daily prize", () => {
        it("Not now is the default, without a hint, and Skip answers it", async () => {
            renderPage();
            await pickToken();
            const q = step("First daily prize");
            expect(within(q).getByRole("button", { name: "Not now" })).toHaveAttribute("aria-pressed", "true");
            expect(within(q).queryByText("Stakers earn nothing until someone adds a prize. You can add one right after.")).not.toBeInTheDocument();
            await userEvent.click(button(q, "Skip"));
            expect(step("First daily prize")).toHaveAttribute("data-state", "done");
            expect(step("First daily prize")).toHaveTextContent("No prize yet");
            expect(step("Review")).toHaveAttribute("data-state", "active");
        });

        it("validates the amount and the days", async () => {
            renderPage();
            await pickToken();
            await fillPrize("0", "0");
            const q = step("First daily prize");
            expect(button(q, "Continue")).toBeDisabled();
            await userEvent.clear(within(q).getByLabelText(/Daily reward/));
            await userEvent.type(within(q).getByLabelText(/Daily reward/), "50");
            await userEvent.clear(within(q).getByLabelText("Days"));
            await userEvent.type(within(q).getByLabelText("Days"), "36501");
            expect(button(q, "Continue")).toBeDisabled();
            await userEvent.clear(within(q).getByLabelText("Days"));
            await userEvent.type(within(q).getByLabelText("Days"), "30");
            expect(within(q).getByText("Min 1 · Max 36500 days")).toBeInTheDocument();
            expect(within(q).getByText("You hold 100,000 BZE")).toBeInTheDocument();
            expect(within(q).queryByTestId("escrow-line")).not.toBeInTheDocument();
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("Rewards: 1500000000 ubze");
            await userEvent.click(button(q, "Continue"));
            expect(step("First daily prize")).toHaveTextContent("50 BZE a day for 30 days");
        });

        it("checks the prize balance", async () => {
            renderPage();
            await pickToken();
            await fillPrize("50", "30", "uwax");
            const q = step("First daily prize");
            expect(within(q).getByRole("alert")).toHaveTextContent("Not enough WAX: you hold 1,000 WAX.");
            expect(button(q, "Continue")).toBeDisabled();
        });

        it("is blocked when the prize slots are capped at zero", async () => {
            feeState.limits = { ...feeState.limits, maxPrizeDenomsPerDr: 0 };
            renderPage();
            await pickToken();
            await fillPrize("50", "30");
            expect(button(step("First daily prize"), "Continue")).toBeDisabled();
        });
    });

    describe("Review", () => {
        it("without a prize: the fee, what you get, the rows, the permanent line, and MsgCreateDenomReward alone", async () => {
            renderPage();
            await pickToken();
            await userEvent.click(button(step("First daily prize"), "Continue"));
            const review = step("Review");
            expect(within(review).getByRole("region", { name: "Leaves your wallet" })).toHaveTextContent("Compounded reward fee");
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("HONEY becomes stakable for everyone");
            expect(review).toHaveTextContent("Unstaking lock7 days");
            expect(review).toHaveTextContent("Daily rewardNone yet");
            expect(within(review).getByRole("region", { name: "Permanent" })).toHaveTextContent("The compounded reward (one per token)");
            expect(within(review).getByRole("region", { name: "Permanent" })).not.toHaveTextContent("Rewards are committed to stakers");
            expect(screen.getByTestId("pay-panel")).toHaveTextContent(`Compounded reward fee: ${FEE.amount} ubze`);

            await userEvent.click(button(review, "Make HONEY stakable"));
            expect(sentMsgs().map(m => m.typeUrl)).toEqual(["/bze.rewards.MsgCreateDenomReward"]);
            expect(sentMsgs()[0].value).toMatchObject({ creator: "bze1me", denom: "uhoney" });
        });

        it("with a prize: three fees, their total, the rewards, and both messages", async () => {
            renderPage();
            await pickToken();
            await fillPrize("50", "30");
            await userEvent.click(button(step("First daily prize"), "Continue"));
            expect(screen.getByTestId("pay-panel")).toHaveTextContent(
                "Compounded reward fee: 25000000000 ubze, Daily prize fee: 25000000000 ubze, New prize fee: 25000000000 ubze, Fees total: 75000000000 ubze, Rewards: 1500000000 ubze",
            );
            const review = step("Review");
            expect(review).toHaveTextContent("Daily reward50 BZE a day for 30 days");
            expect(within(review).getByRole("region", { name: "Permanent" })).toHaveTextContent("Rewards are committed to stakers");

            await userEvent.click(button(review, "Make HONEY stakable"));
            expect(sentMsgs().map(m => m.typeUrl)).toEqual(["/bze.rewards.MsgCreateDenomReward", "/bze.rewards.MsgCreateDenomRewardSchedule"]);
            expect(sentMsgs()[1].value).toMatchObject({ denom: "uhoney", prizeDenom: "ubze", dailyAmount: "50000000", duration: "30" });
        });

        it("an unknown fee blocks it", async () => {
            feeState.fees = { ...feeState.fees, createDenomRewardFee: undefined };
            renderPage();
            await pickToken();
            await userEvent.click(button(step("First daily prize"), "Continue"));
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("fee unknown");
            expect(button(step("Review"), "Make HONEY stakable")).toBeDisabled();
        });

        it("without a wallet, asks to connect", async () => {
            wallet.address = undefined;
            renderPage();
            await pickToken();
            await userEvent.click(button(step("First daily prize"), "Continue"));
            expect(button(step("Review"), "Make HONEY stakable")).toBeDisabled();
            expect(screen.getByText("Connect your wallet.")).toBeInTheDocument();
        });

        it("says what the wallet is short of", async () => {
            afford.canAfford = false;
            afford.message = "Insufficient BZE balance (5 BZE short)";
            renderPage();
            await pickToken();
            await userEvent.click(button(step("First daily prize"), "Continue"));
            expect(button(step("Review"), "Make HONEY stakable")).toBeDisabled();
            expect(screen.getByText("Insufficient BZE balance (5 BZE short)")).toBeInTheDocument();
        });
    });

    describe("Done", () => {
        it("without a prize: the amber line, Stake on DEX recommended, then Add more rewards", async () => {
            renderPage();
            await pickToken();
            await userEvent.click(button(step("First daily prize"), "Continue"));
            await signAndContinue();

            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("HONEY is stakable.");
            expect(screen.getByText("HONEY can be staked now.")).toBeInTheDocument();
            expect(screen.getByText("No daily reward yet.")).toBeInTheDocument();
            expect(screen.getByTestId("done-recommended")).toHaveTextContent("Stake on DEX");
            expect(screen.getByRole("article", { name: "Add more rewards" })).toBeInTheDocument();
        });

        it("with a prize: no amber line, the same next steps", async () => {
            renderPage();
            await pickToken();
            await fillPrize("50", "30");
            await userEvent.click(button(step("First daily prize"), "Continue"));
            await signAndContinue();

            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("HONEY is stakable.");
            expect(screen.queryByText("No daily reward yet.")).not.toBeInTheDocument();
            expect(screen.getByTestId("done-recommended")).toHaveTextContent("Stake on DEX");
        });
    });
});
