import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// jsdom has no PointerEvent; the Chakra checkbox (zag) constructs one on blur.
if (!("PointerEvent" in window)) {
    Object.defineProperty(window, "PointerEvent", { value: class PointerEvent extends MouseEvent {}, writable: true });
}

// The page runs on mocked hooks: query params, wallet, assets, the max/afford checks, the epoch
// info, the raffle query and the tx hook. The asset picker becomes a plain button per denom;
// PayPanel has its own coverage and is reduced to its rows.
const m = vi.hoisted(() => ({
    queryParams: new URLSearchParams(),
    address: "bze1me" as string | undefined,
    raffles: vi.fn(),
    tx: vi.fn(),
    navigate: vi.fn(),
    maxInputs: [] as unknown[],
    afford: { canAfford: true, message: "" },
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => m.queryParams }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: m.navigate }),
    useNavigationWithParams: () => ({ getQueryParam: (p: string) => m.queryParams.get(p), navigate: m.navigate }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@/components/guided/pay-panel", () => ({
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
        useEpochs: () => ({ hourEpochInfo: { current_epoch: 100n, current_epoch_start_time: "2026-10-15T10:00:00Z" } }),
        getRafflesOrThrow: () => m.raffles(),
        getBurnerApp: () => ({ href: "https://burner.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
    };
});

import RaffleNewPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<RaffleNewPage />, { wrapper });

const Q = {
    token: "Which token?",
    pot: "How big is the prize pot?",
    days: "How long should it run?",
    ticket: "What does a ticket cost?",
    chance: "How often does a ticket win?",
    prize: "How much does a winner get?",
};
const question = (title: string) => screen.getByRole("region", { name: title });
const continueIn = (title: string) => userEvent.click(within(question(title)).getByRole("button", { name: "Continue" }));
const startButton = () => screen.getByRole("button", { name: "Start the raffle" });
const RUNNING = { denom: "utok", pot: "5000000", ticket_price: "1000000", chances: 10000n, ratio: "0.25", end_at: 148n };

async function pickToken(denom = "utok") {
    await userEvent.click(within(question(Q.token)).getByText(`Token to raffle: ${denom}`));
    await waitFor(() => expect(within(question(Q.token)).getByRole("button", { name: "Continue" })).toBeEnabled());
    await continueIn(Q.token);
}

async function answerAll() {
    await userEvent.type(within(question(Q.pot)).getByLabelText(/Prize pot/), "1000");
    await continueIn(Q.pot);
    await userEvent.click(within(question(Q.days)).getByRole("button", { name: "14 days" }));
    await continueIn(Q.days);
    await userEvent.type(within(question(Q.ticket)).getByLabelText(/Ticket price/), "10");
    await continueIn(Q.ticket);
    await userEvent.click(within(question(Q.chance)).getByRole("button", { name: "1 in 100" }));
    expect(within(question(Q.chance)).getByText("Each ticket wins with a chance of 1 %.")).toBeInTheDocument();
    await continueIn(Q.chance);
    await userEvent.click(within(question(Q.prize)).getByRole("button", { name: "25 %" }));
    expect(within(question(Q.prize)).getByText(/25 % of the pot, 250 TOK right now\./)).toBeInTheDocument();
    await continueIn(Q.prize);
}

beforeEach(() => {
    m.queryParams = new URLSearchParams();
    m.address = "bze1me";
    m.raffles.mockReset().mockResolvedValue([]);
    m.tx.mockReset().mockResolvedValue(true);
    m.navigate.mockReset();
    m.maxInputs.length = 0;
    m.afford = { canAfford: true, message: "" };
});

describe("/raffle/new", () => {
    it("asks the six questions and shows the warnings, no Factory fee and the gas kind", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Run a burning raffle" })).toBeInTheDocument();
        expect(screen.getByText("Burning raffle")).toBeInTheDocument();
        for (const title of Object.values(Q)) expect(question(title)).toBeInTheDocument();
        expect(screen.getByText("The pot leaves your wallet now and can't be taken back.")).toBeInTheDocument();
        expect(screen.getByText("Once started, a raffle can't be stopped or changed.")).toBeInTheDocument();
        expect(screen.getByText("Whatever is left in the pot when it ends is burned. Nothing comes back to you.")).toBeInTheDocument();
        expect(screen.getByText("Factory fee: None")).toBeInTheDocument();
        expect(screen.getByTestId("tx-kind")).toHaveTextContent("start-raffle");
        expect(screen.getByTestId("asset-picker")).toHaveAttribute("data-exclude-halted", "true");
    });

    it("starts a raffle with one MsgStartRaffle once every answer is in and the risk is confirmed", async () => {
        renderPage();
        await pickToken();
        expect(question(Q.token)).toHaveTextContent("Raffle TOK");
        await answerAll();

        expect(screen.getByTestId("raffle-outcome")).toHaveTextContent(
            "You put 1,000 TOK in the pot now. For 14 days, anyone can buy a ticket for 10 TOK. About 1 ticket in 100 wins 25 % of the pot at that moment. Losing tickets add their price to the pot.",
        );
        expect(screen.getByText("On average the pot grows as people play.")).toBeInTheDocument();
        expect(screen.getByText("Prize pot: 1000000000 utok")).toBeInTheDocument();

        expect(startButton()).toBeDisabled();
        await userEvent.click(screen.getByText("I understand the pot can't be taken back and what's left at the end is burned."));
        expect(startButton()).toBeEnabled();
        await userEvent.click(startButton());

        expect(m.tx).toHaveBeenCalledTimes(1);
        expect(m.tx.mock.calls[0][0]).toEqual([{
            typeUrl: "/bze.burner.MsgStartRaffle",
            value: { creator: "bze1me", denom: "utok", pot: "1000000000", duration: "14", chances: "10000", ratio: "0.25", ticketPrice: "10000000" },
        }]);
    });

    it("never signs an invalid answer: the pot below 0.1 keeps its question open", async () => {
        renderPage();
        await pickToken();
        await userEvent.type(within(question(Q.pot)).getByLabelText(/Prize pot/), "0.09");
        await userEvent.tab();
        expect(within(question(Q.pot)).getByRole("button", { name: "Continue" })).toBeDisabled();
        expect(question(Q.pot)).toHaveTextContent("The pot must be at least 0.1 TOK.");
    });

    it("stops at question 1 when the token already has a raffle running, with a Burner link", async () => {
        m.raffles.mockResolvedValue([RUNNING]);
        renderPage();
        await userEvent.click(within(question(Q.token)).getByText("Token to raffle: utok"));

        const running = await screen.findByTestId("raffle-running");
        expect(running).toHaveTextContent("A raffle for TOK is already running. It ends in 2d 0h.");
        expect(within(running).getByRole("link", { name: "Burner" })).toHaveAttribute("href", "https://burner.test/coin?coin=utok");
        expect(within(running).getByRole("link", { name: "Burner" })).toHaveAttribute("data-app", "burner");
        expect(within(question(Q.token)).getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("a failed lookup is never read as none running: it offers Retry", async () => {
        m.raffles.mockRejectedValueOnce(new Error("node down"));
        renderPage();
        await userEvent.click(within(question(Q.token)).getByText("Token to raffle: utok"));

        expect(await screen.findByText("Couldn't check whether TOK already has a raffle running.")).toBeInTheDocument();
        expect(within(question(Q.token)).getByRole("button", { name: "Continue" })).toBeDisabled();
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        await waitFor(() => expect(within(question(Q.token)).getByRole("button", { name: "Continue" })).toBeEnabled());
    });

    it("maps the chain's 'raffle already running' error to the running notice", async () => {
        m.tx.mockImplementation(async (_msgs: unknown, opts: { onFailure: (e: string) => void }) => {
            opts.onFailure("failed to execute message; message index: 0: raffle already running for this coin");
            return false;
        });
        renderPage();
        await pickToken();
        await answerAll();
        await userEvent.click(screen.getByText(/I understand the pot/));
        await userEvent.click(startButton());

        expect(await screen.findByTestId("raffle-running")).toHaveTextContent("A raffle for TOK is already running.");
        expect(question(Q.token)).toHaveAttribute("data-state", "active");
        expect(startButton()).toBeDisabled();
    });

    it("keeps the network fee out of MAX when the raffled token pays it", async () => {
        renderPage();
        await pickToken("ubze");
        expect(m.maxInputs).toContainEqual(["ubze", "start-raffle"]);
        const pot = within(question(Q.pot));
        await userEvent.click(pot.getByRole("button", { name: "MAX" }));
        expect(pot.getByLabelText(/Prize pot/)).toHaveValue("9.995");
        await userEvent.clear(pot.getByLabelText(/Prize pot/));
        await userEvent.type(pot.getByLabelText(/Prize pot/), "10");
        await userEvent.tab();
        expect(question(Q.pot)).toHaveTextContent("You only have 9.995 BZE.");
        expect(pot.getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("without a wallet the questions work but signing asks to connect", async () => {
        m.address = undefined;
        renderPage();
        await pickToken();
        await answerAll();
        await userEvent.click(screen.getByText(/I understand the pot/));
        expect(startButton()).toBeDisabled();
        expect(screen.getByText("Connect your wallet to start the raffle.")).toBeInTheDocument();
    });

    it("blocks a halted token opened by link", async () => {
        m.queryParams = new URLSearchParams("denom=uhalt");
        renderPage();
        expect(await screen.findByText("Halted tokens can't be raffled.")).toBeInTheDocument();
        expect(question(Q.token)).toHaveAttribute("data-state", "active");
    });

    describe("success", () => {
        const succeed = () => m.tx.mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: { txhash: string }) => void }) => {
            opts.onSuccess({ txhash: "HASH" });
            return true;
        });

        it("says the raffle is live and links the Burner; Start another resets the form", async () => {
            succeed();
            renderPage();
            await pickToken();
            await answerAll();
            await userEvent.click(screen.getByText(/I understand the pot/));
            await userEvent.click(startButton());

            expect(await screen.findByRole("heading", { name: "The TOK raffle is live" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Back to the Factory" })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("data-app", "explorer");
            expect(screen.getByRole("link", { name: "Burner" })).toHaveAttribute("href", "https://burner.test/coin?coin=utok");
            expect(screen.getByRole("link", { name: "Burner" })).toHaveAttribute("data-app", "burner");

            await userEvent.click(screen.getByRole("button", { name: "Start another" }));
            expect(question(Q.token)).toHaveAttribute("data-state", "active");
        });

        it("offers Back to TOK when opened from the workspace", async () => {
            const back = "/manage/token?denom=utok&tab=supply";
            m.queryParams = new URLSearchParams({ denom: "utok", return: back, returnLabel: "TOK" });
            succeed();
            renderPage();
            await waitFor(() => expect(question(Q.token)).toHaveAttribute("data-state", "done"));
            await answerAll();
            await userEvent.click(screen.getByText(/I understand the pot/));
            await userEvent.click(startButton());

            await userEvent.click(await screen.findByRole("button", { name: "Back to TOK" }));
            expect(m.navigate).toHaveBeenCalledWith(back);
        });
    });
});
