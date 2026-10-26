import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The Burning raffle wizard on mocked hooks: query params, wallet, assets, the max/afford checks,
// the epoch info, the raffle query, the fee engine and the wallet side of the tx (useFactoryTx).
// The wizard's tx hook, the pending-tx store, the Review step and the Done screen are real. The
// asset picker becomes a plain button per denom; PayPanel is reduced to its rows.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage?: string; txHash?: string; rawLog?: string; code?: number }) => void;
};
const m = vi.hoisted(() => ({
    queryParams: new URLSearchParams(),
    address: "bze1me" as string | undefined,
    raffles: vi.fn(),
    tx: vi.fn(),
    navigate: vi.fn(),
    maxInputs: [] as unknown[],
    afford: { canAfford: true, message: "" },
    stakedAmount: undefined as string | undefined,
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/raffle/new", useSearchParams: () => m.queryParams }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: m.navigate }),
    useNavigationWithParams: () => ({ getQueryParam: (p: string) => m.queryParams.get(p), navigate: m.navigate }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx, progressTrack: "" }) }));
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
        denomReward: m.stakedAmount !== undefined ? { staking_denom: denom, lock: 7, min_stake: "0", staked_amount: m.stakedAmount } : undefined,
        schedules: [],
        prizes: [],
        hasError: false,
        isLoading: false,
        refresh: vi.fn(),
    }),
}));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, txKind }: { rows: { label: string; coin?: { denom: string; amount: string }; text?: string }[]; txKind?: string }) => (
        <div data-testid="pay-panel">
            {rows.map(r => <p key={r.label}>{`${r.label}: ${r.coin ? `${r.coin.amount} ${r.coin.denom}` : r.text}`}</p>)}
            <span data-testid="tx-kind">{txKind}</span>
        </div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label, excludeHalted, onSelect }: { label: string; excludeHalted?: boolean; onSelect: (a: { denom: string }) => void }) => (
        <div data-exclude-halted={String(excludeHalted)} data-testid="asset-picker">
            {["utok", "ubze"].map(d => <button key={d} onClick={() => onSelect({ denom: d })}>{label}: {d}</button>)}
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const { default: BN } = await import("bignumber.js");
    const assets: Record<string, Partial<Asset>> = {
        utok: { denom: "utok", ticker: "TOK", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uhalt: { denom: "uhalt", ticker: "HALT", decimals: 6, logo: "", halted: true },
    };
    // 10,000 TOK and 10 BZE; BZE pays the network fee (0.005 BZE), so its max keeps that back.
    const balances: Record<string, string> = { utok: "10000000000", ubze: "10000000" };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useMaxSpendable: (denom: string, spec?: string) => {
            m.maxInputs.push([denom, spec]);
            const balance = new BN(balances[denom] ?? "0");
            const amount = denom === "ubze" ? balance.minus(5000) : balance;
            return { amount, balance, inputValue: amount.shiftedBy(-6).toFixed(), isLoading: false };
        },
        useCanAffordTx: () => ({ ...m.afford, isLoading: false, shortfalls: [], shortOnFees: false }),
        useAssetPrice: () => ({ hasPrice: false, totalUsdValue: () => new BN(0), uAmountUsdValue: () => new BN(0) }),
        useEpochs: () => ({ hourEpochInfo: { current_epoch: 100n, current_epoch_start_time: "2026-10-15T10:00:00Z" } }),
        getRafflesOrThrow: () => m.raffles(),
        getSettings: () => ({ endpoints: { restEndpoint: "https://rest.test" } }),
        getBurnerApp: () => ({ href: "https://burner.test" }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getFactoryApp: () => ({ href: "https://factory.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import RaffleNewPage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<RaffleNewPage />, { wrapper });
};

const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const startButton = () => button(step("Review"), "Start raffle");
const RUNNING = { denom: "utok", pot: "5000000", ticket_price: "1000000", chances: 10000n, ratio: "0.25", end_at: 148n };

async function pickToken(denom = "utok") {
    await userEvent.click(within(step("Token")).getByText(`Token: ${denom}`));
    await waitFor(() => expect(button(step("Token"), "Continue")).toBeEnabled());
    await userEvent.click(button(step("Token"), "Continue"));
}

async function fillPot(amount = "1000") {
    await userEvent.type(within(step("Starting pot")).getByLabelText(/Starting pot/), amount);
    await userEvent.click(button(step("Starting pot"), "Continue"));
}

async function fillPlay() {
    const q = within(step("How it plays"));
    await userEvent.click(q.getByRole("button", { name: "14 days" }));
    await userEvent.type(q.getByLabelText(/Ticket price/), "10");
    await userEvent.click(q.getByRole("button", { name: "1 in 100" }));
    await userEvent.click(q.getByRole("button", { name: "25%" }));
}

async function toReview() {
    await pickToken();
    await fillPot();
    await fillPlay();
    await userEvent.click(button(step("How it plays"), "Continue"));
}

beforeEach(() => {
    m.queryParams = new URLSearchParams();
    m.address = "bze1me";
    m.raffles.mockReset().mockResolvedValue([]);
    m.tx.mockReset().mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH");
        opts.onSuccess?.({ txhash: "HASH", height: 10, code: 0 });
        return true;
    });
    m.navigate.mockReset();
    m.maxInputs.length = 0;
    m.afford = { canAfford: true, message: "" };
    m.stakedAmount = undefined;
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => vi.unstubAllGlobals());

describe("/raffle/new", { timeout: 20_000 }, () => {
    it("has four steps: Token, Starting pot, How it plays, Review", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Start a burning raffle" })).toBeInTheDocument();
        expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Burning raffle")).toBeInTheDocument();
        expect(step("Token")).toHaveAttribute("data-state", "active");
        expect(screen.getByText("Which token?")).toBeInTheDocument();
        for (const title of ["Starting pot", "How it plays", "Review"]) expect(step(title)).toHaveAttribute("data-state", "todo");
        expect(screen.queryByText("Factory fee: None")).not.toBeInTheDocument();
        expect(screen.queryByText("burner · raffle")).not.toBeInTheDocument();
        expect(screen.getByTestId("tx-kind")).toHaveTextContent("start-raffle");
        expect(screen.getByTestId("asset-picker")).toHaveAttribute("data-exclude-halted", "true");
    });

    it("summarises the token and the pot", async () => {
        renderPage();
        await pickToken();
        expect(step("Token")).toHaveTextContent("TOK");
        await fillPot("5000");
        expect(step("Starting pot")).toHaveTextContent("5,000 TOK in the pot");
        expect(step("How it plays")).toHaveAttribute("data-state", "active");
    });

    describe("Starting pot", () => {
        it("never takes a pot below 0.1", async () => {
            renderPage();
            await pickToken();
            await userEvent.type(within(step("Starting pot")).getByLabelText(/Starting pot/), "0.09");
            await userEvent.tab();
            expect(button(step("Starting pot"), "Continue")).toBeDisabled();
            expect(step("Starting pot")).toHaveTextContent("Min 0.1 TOK.");
        });

        it("keeps the network fee out of Max when the raffled token pays it", async () => {
            renderPage();
            await pickToken("ubze");
            expect(m.maxInputs).toContainEqual(["ubze", "start-raffle"]);
            const pot = within(step("Starting pot"));
            expect(pot.getByText("Min 0.1 · Max 9.995 BZE")).toBeInTheDocument();
            await userEvent.click(pot.getByRole("button", { name: "Max" }));
            expect(pot.getByLabelText(/Starting pot/)).toHaveValue("9.995");
            await userEvent.clear(pot.getByLabelText(/Starting pot/));
            await userEvent.type(pot.getByLabelText(/Starting pot/), "10");
            await userEvent.tab();
            expect(step("Starting pot")).toHaveTextContent("Not enough BZE: you hold 9.995 BZE.");
            expect(pot.getByRole("button", { name: "Continue" })).toBeDisabled();
        });
    });

    describe("How it plays", () => {
        it("the four fields with their min/max hints, the end date and the summary", async () => {
            renderPage();
            await pickToken();
            await fillPot();
            await fillPlay();
            const q = within(step("How it plays"));
            expect(q.getByText("Min 1 · Max 180 days")).toBeInTheDocument();
            expect(q.getByText("Min 5 · Max 1000000")).toBeInTheDocument();
            expect(q.getByText("Min 1 · Max 100%")).toBeInTheDocument();
            expect(q.getByTestId("raffle-end")).toHaveTextContent("End date");
            expect(q.queryByText("Each ticket wins with a chance of 1 %.")).not.toBeInTheDocument();
            expect(q.queryByTestId("raffle-sentence")).not.toBeInTheDocument();
            await userEvent.click(button(step("How it plays"), "Continue"));
            expect(step("How it plays")).toHaveTextContent("14 days · 10 TOK a ticket · 1 in 100 · winner gets 25%");
            expect(step("Review")).toHaveAttribute("data-state", "active");
        });

        it.each([
            ["Days", "181", "Min 1 · Max 180 days."],
            ["Days", "0", "Min 1 · Max 180 days."],
            ["Win chance (1 in N)", "1000001", "Min 5 · Max 1000000."],
            ["Win chance (1 in N)", "4", "Min 5 · Max 1000000."],
            ["Winner gets (%)", "101", "Min 1 · Max 100%."],
            ["Winner gets (%)", "0", "Min 1 · Max 100%."],
        ])("%s %s: %s, and no way on", async (label, value, error) => {
            renderPage();
            await pickToken();
            await fillPot();
            await fillPlay();
            const q = within(step("How it plays"));
            await userEvent.clear(q.getByLabelText(label));
            await userEvent.type(q.getByLabelText(label), value);
            await userEvent.tab();
            expect(q.getByText(error)).toBeInTheDocument();
            expect(button(step("How it plays"), "Continue")).toBeDisabled();
        });

        it("a ticket price below one base unit", async () => {
            renderPage();
            await pickToken();
            await fillPot();
            await fillPlay();
            const q = within(step("How it plays"));
            await userEvent.clear(q.getByLabelText(/Ticket price/));
            await userEvent.type(q.getByLabelText(/Ticket price/), "0.0000001");
            await userEvent.tab();
            expect(step("How it plays")).toHaveTextContent("The smallest ticket price is 0.000001 TOK.");
            expect(button(step("How it plays"), "Continue")).toBeDisabled();
        });
    });

    describe("the running raffle", () => {
        it("stops at Token when the token already has a raffle running, with a Burner link", async () => {
            m.raffles.mockResolvedValue([RUNNING]);
            renderPage();
            await userEvent.click(within(step("Token")).getByText("Token: utok"));

            const running = await screen.findByTestId("raffle-running");
            expect(running).toHaveTextContent("A raffle for TOK is already running. It ends in 2d 0h.");
            expect(within(running).getByRole("link", { name: "Burner" })).toHaveAttribute("href", "https://burner.test/coin?coin=utok");
            expect(within(running).getByRole("link", { name: "Burner" })).toHaveAttribute("data-app", "burner");
            expect(button(step("Token"), "Continue")).toBeDisabled();
        });

        it("a failed lookup is never read as none running: it offers Retry", async () => {
            m.raffles.mockRejectedValueOnce(new Error("node down"));
            renderPage();
            await userEvent.click(within(step("Token")).getByText("Token: utok"));

            expect(await screen.findByText("Couldn't check whether TOK already has a raffle running.")).toBeInTheDocument();
            expect(button(step("Token"), "Continue")).toBeDisabled();
            await userEvent.click(screen.getByRole("button", { name: "Retry" }));
            await waitFor(() => expect(button(step("Token"), "Continue")).toBeEnabled());
        });

        it("a raffle started meanwhile is caught right before signing: back to Token, nothing signed", async () => {
            renderPage();
            await toReview();
            m.raffles.mockResolvedValue([RUNNING]);
            await userEvent.click(startButton());

            expect(await screen.findByTestId("raffle-running")).toHaveTextContent("A raffle for TOK is already running.");
            expect(step("Token")).toHaveAttribute("data-state", "active");
            expect(m.tx).not.toHaveBeenCalled();
        });

        it("a failed check right before signing says so and signs nothing", async () => {
            renderPage();
            await toReview();
            m.raffles.mockRejectedValueOnce(new Error("node down"));
            await userEvent.click(startButton());

            expect(await screen.findByText("Couldn't check whether TOK already has a raffle running. Please try again.")).toBeInTheDocument();
            expect(m.tx).not.toHaveBeenCalled();
            expect(startButton()).toBeEnabled();
        });

        it("maps the chain's 'raffle already running' refusal to the running notice", async () => {
            m.tx.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
                opts.onFailure?.("failed to execute message; message index: 0: raffle already running for this coin", { stage: "prepare" });
                return false;
            });
            renderPage();
            await toReview();
            await userEvent.click(startButton());

            expect(await screen.findByTestId("raffle-running")).toHaveTextContent("A raffle for TOK is already running.");
            expect(within(screen.getByTestId("raffle-running")).getByRole("link", { name: "Burner" })).toHaveAttribute("href", "https://burner.test/coin?coin=utok");
        });
    });

    describe("Review", () => {
        it("the pot leaves, a raffle on Burner, the end date, the pot trend and what is permanent; signs one MsgStartRaffle", async () => {
            renderPage();
            await toReview();
            const review = step("Review");
            expect(within(review).getByRole("region", { name: "You pay" })).toHaveTextContent("Starting pot");
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("TOK raffle on Burner");
            expect(review).toHaveTextContent("End date");
            expect(review).toHaveTextContent("Pot trendGrows on average");
            const permanent = within(review).getByRole("region", { name: "Permanent" });
            expect(permanent).toHaveTextContent("This action can't be undone");
            expect(review).not.toHaveTextContent("Heads up:");
            expect(screen.queryByTestId("raffle-outcome")).not.toBeInTheDocument();

            await userEvent.click(startButton());
            expect(await screen.findByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            expect(m.tx).toHaveBeenCalledTimes(1);
            expect(m.tx.mock.calls[0][0]).toEqual([{
                typeUrl: "/bze.burner.MsgStartRaffle",
                value: { creator: "bze1me", denom: "utok", pot: "1000000000", duration: "14", chances: "10000", ratio: "0.25", ticketPrice: "10000000" },
            }]);
        });

        it("without a wallet the steps work but signing asks to connect", async () => {
            m.address = undefined;
            renderPage();
            await toReview();
            expect(startButton()).toBeDisabled();
            expect(screen.getByText("Connect your wallet.")).toBeInTheDocument();
        });

        it("says what the wallet is short of", async () => {
            m.afford = { canAfford: false, message: "Insufficient TOK balance" };
            renderPage();
            await toReview();
            expect(startButton()).toBeDisabled();
            expect(screen.getByText("Insufficient TOK balance")).toBeInTheDocument();
        });
    });

    it("blocks a halted token opened by link", async () => {
        m.queryParams = new URLSearchParams("denom=uhalt");
        renderPage();
        expect(await screen.findByText("Halted tokens can't be raffled.")).toBeInTheDocument();
        expect(step("Token")).toHaveAttribute("data-state", "active");
    });

    describe("Done", () => {
        async function start() {
            await toReview();
            await userEvent.click(startButton());
            expect(await screen.findByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        }

        it("says the raffle is live and recommends opening it on Burner", async () => {
            renderPage();
            await start();
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The TOK raffle is live.");
            const recommended = screen.getByTestId("done-recommended");
            expect(recommended).toHaveTextContent("Open the raffle");
            expect(within(recommended).getByRole("link", { name: /Open on Burner/ })).toHaveAttribute("href", "https://burner.test/coin?coin=utok");
            expect(screen.getAllByRole("link", { name: /Explorer/ })[0]).toHaveAttribute("href", "https://explorer.test/txs/HASH");
            expect(screen.queryByText("Airdrop to stakers, once")).not.toBeInTheDocument();
        });

        it("proposes only opening the raffle on Burner", async () => {
            m.stakedAmount = "5000000";
            renderPage();
            await start();
            expect(within(screen.getByTestId("done-recommended")).getByRole("link", { name: /Open on Burner/ })).toBeInTheDocument();
            expect(screen.queryByTestId("done-more")).not.toBeInTheDocument();
        });

        it("offers Back to TOK when opened from the token page", async () => {
            const back = "/tokens/token?denom=utok";
            m.queryParams = new URLSearchParams({ denom: "utok", return: back, returnLabel: "TOK" });
            renderPage();
            await waitFor(() => expect(step("Token")).toHaveAttribute("data-state", "done"));
            await fillPot();
            await fillPlay();
            await userEvent.click(button(step("How it plays"), "Continue"));
            await userEvent.click(startButton());
            await userEvent.click(await screen.findByRole("button", { name: "Continue" }));

            await userEvent.click(screen.getByRole("button", { name: /Back to TOK/ }));
            expect(m.navigate).toHaveBeenCalledWith(back);
        });
    });
});
