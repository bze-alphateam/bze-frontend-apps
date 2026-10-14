import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { getFromLocalStorage, setInLocalStorage } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: wallet, assets, fees, the fee engine and the tx hook.
// The browser draft goes through the real ui-kit storage helpers (jsdom localStorage).
// PayPanel has its own tests.
const { wallet, assetDenoms, feeState, canPayFee, navigateMock, txMock } = vi.hoisted(() => ({
    wallet: { address: "bze1me" as string | undefined },
    assetDenoms: { current: [] as string[] },
    feeState: { fee: { denom: "ubze", amount: "25000000000" } as { denom: string; amount: string } | undefined },
    canPayFee: { current: true },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: navigateMock }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({ canPayFee: canPayFee.current, isLoading: false }),
}));
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows, txKind, feeUnknown }: { rows: { label: string; coin?: { amount: string } }[]; txKind: string[]; feeUnknown?: boolean }) => (
        <div data-testid="pay-panel">
            {feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin?.amount}`).join(", ")} | {txKind.join(",")}
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({ assets: assetDenoms.current.map(denom => ({ denom })) }),
        useCreationFees: () => ({ fees: { createDenomFee: feeState.fee }, isLoading: false }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getChainExplorerURL: () => "https://explorer.test",
        useToast: () => ({ toast: { success: vi.fn() } }),
    };
});

import TokenNewPage from "./page";
import { TOKEN_DRAFT_KEY } from "@/lib/token-draft";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<TokenNewPage />, { wrapper });
const question = (title: string | RegExp) => screen.getByRole("region", { name: title });
const createButton = () => screen.getByRole("button", { name: /^Create / });
const savedDraft = () => {
    const raw = getFromLocalStorage(TOKEN_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
};

async function answerIdentity(name = "Honey Coin", symbol = "honey") {
    const q = question("Name and ticker");
    await userEvent.type(within(q).getByPlaceholderText("e.g. Honey Coin"), name);
    await userEvent.type(within(q).getByPlaceholderText("e.g. HONEY"), symbol);
    await userEvent.click(within(q).getByRole("button", { name: "Continue" }));
}

async function answerAll() {
    await answerIdentity();
    await userEvent.type(within(question("Describe it")).getByRole("textbox"), "Sweet token");
    await userEvent.click(within(question("Describe it")).getByRole("button", { name: "Continue" }));
    const q3 = question(/How many HONEY to create/);
    await userEvent.click(within(q3).getByRole("button", { name: "1 million" }));
    await userEvent.click(within(q3).getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
    localStorage.clear();
    wallet.address = "bze1me";
    assetDenoms.current = [];
    feeState.fee = { denom: "ubze", amount: "25000000000" };
    canPayFee.current = true;
    navigateMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: { txhash: string }) => void }) => {
        opts.onSuccess({ txhash: "HASH1" });
    });
});

// Each test types through several questions; CI runners need more than the 5 s default.
describe("Create my token (/token/new)", { timeout: 20_000 }, () => {
    it("asks the three questions in order and shows the fee for the three messages", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Create my token" })).toBeInTheDocument();
        expect(screen.getByText("tokenfactory · create denom")).toBeInTheDocument();
        expect(question("Name and ticker")).toHaveAttribute("data-state", "active");
        expect(question("Describe it")).toHaveAttribute("data-state", "todo");
        expect(question("How many tokens to create?")).toHaveAttribute("data-state", "todo");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Token creation fee: 25000000000 | create-denom,mint,set-denom-metadata");
        expect(screen.getByText(/lock the supply forever from the token's page/)).toBeInTheDocument();
        expect(createButton()).toBeDisabled();
    });

    it("uppercases the ticker, shows the token ID and updates the preview as you type", async () => {
        renderPage();
        const q = question("Name and ticker");
        await userEvent.type(within(q).getByPlaceholderText("e.g. Honey Coin"), "Honey Coin");
        await userEvent.type(within(q).getByPlaceholderText("e.g. HONEY"), "honey");
        expect(within(q).getByPlaceholderText("e.g. HONEY")).toHaveValue("HONEY");
        expect(within(q).getByText("Token ID: factory/bze1me/uhoney")).toBeInTheDocument();
        expect(within(q).getByText("6 decimals: 1 HONEY = 1,000,000 base units")).toBeInTheDocument();

        const preview = screen.getByRole("region", { name: "Preview" });
        expect(within(preview).getByTestId("preview-name")).toHaveTextContent("Honey Coin");
        expect(within(preview).getByText("HONEY · Mintable")).toBeInTheDocument();
        expect(within(preview).getByText("HC")).toBeInTheDocument();
    });

    it("uses the address placeholder in the token ID without a wallet", async () => {
        wallet.address = undefined;
        renderPage();
        await userEvent.type(screen.getByPlaceholderText("e.g. HONEY"), "hny");
        expect(screen.getByText("Token ID: factory/<your address>/uhny")).toBeInTheDocument();
        expect(screen.getByText("Connect your wallet to create this token.")).toBeInTheDocument();
    });

    it("shows field errors only after blur", async () => {
        renderPage();
        const nameInput = screen.getByPlaceholderText("e.g. Honey Coin");
        await userEvent.type(nameInput, "H");
        expect(screen.queryByText("Name must be at least 2 characters.")).not.toBeInTheDocument();
        await userEvent.tab();
        expect(screen.getByText("Name must be at least 2 characters.")).toBeInTheDocument();
        expect(within(question("Name and ticker")).getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("rejects a symbol already created by this wallet", async () => {
        assetDenoms.current = ["factory/bze1me/uhoney"];
        renderPage();
        await userEvent.type(screen.getByPlaceholderText("e.g. HONEY"), "honey");
        await userEvent.tab();
        expect(screen.getByText("A token with this symbol already exists in your account — pick another one.")).toBeInTheDocument();
    });

    it("collapses answered questions to summaries and reopens them with Change", async () => {
        renderPage();
        await answerIdentity();
        expect(question("Name and ticker")).toHaveAttribute("data-state", "done");
        expect(question("Name and ticker")).toHaveTextContent("Honey Coin (HONEY)");
        expect(question("Describe it")).toHaveAttribute("data-state", "active");

        await userEvent.click(within(question("Describe it")).getByRole("button", { name: "Skip" }));
        expect(question("Describe it")).toHaveTextContent("No description");
        expect(question("How many HONEY to create?")).toHaveAttribute("data-state", "active");

        await userEvent.click(screen.getByRole("button", { name: "Change Name and ticker" }));
        expect(question("Name and ticker")).toHaveAttribute("data-state", "active");
        expect(question("Describe it")).toHaveAttribute("data-state", "done");
    });

    it("summarises a long description to its first 80 characters", async () => {
        renderPage();
        await answerIdentity();
        // Pasted, not typed: 100 keystrokes are slow on CI runners.
        await userEvent.click(within(question("Describe it")).getByRole("textbox"));
        await userEvent.paste("a".repeat(100));
        expect(within(question("Describe it")).getByText("100 / 512")).toBeInTheDocument();
        await userEvent.click(within(question("Describe it")).getByRole("button", { name: "Continue" }));
        expect(question("Describe it")).toHaveTextContent(`${"a".repeat(80)}…`);
    });

    it("presets fill the supply and the preview", async () => {
        renderPage();
        await answerIdentity();
        await userEvent.click(within(question("Describe it")).getByRole("button", { name: "Skip" }));
        const q3 = question("How many HONEY to create?");
        await userEvent.click(within(q3).getByRole("button", { name: "100 million" }));
        expect(within(q3).getByPlaceholderText("e.g. 1000000")).toHaveValue("100000000");
        expect(screen.getByTestId("preview-supply")).toHaveTextContent("100,000,000 HONEY");
        await userEvent.click(within(q3).getByRole("button", { name: "Continue" }));
        expect(q3).toHaveTextContent("100,000,000 HONEY to your wallet");
    });

    it("signs exactly create denom, mint and metadata, in order, never an admin change", async () => {
        renderPage();
        await answerAll();
        expect(createButton()).toHaveTextContent("Create HONEY");
        await userEvent.click(createButton());

        expect(txMock).toHaveBeenCalledTimes(1);
        const msgs = txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];
        expect(msgs.map(m => m.typeUrl)).toEqual([
            "/bze.tokenfactory.MsgCreateDenom",
            "/bze.tokenfactory.MsgMint",
            "/bze.tokenfactory.MsgSetDenomMetadata",
        ]);
        expect(msgs.some(m => m.typeUrl.includes("ChangeAdmin"))).toBe(false);
        expect(msgs[0].value).toEqual({ creator: "bze1me", subdenom: "uhoney" });
        expect(msgs[1].value).toEqual({ creator: "bze1me", coins: "1000000000000factory/bze1me/uhoney" });
        expect(msgs[2].value).toEqual({
            creator: "bze1me",
            metadata: {
                description: "Sweet token",
                denomUnits: [
                    { denom: "factory/bze1me/uhoney", exponent: 0, aliases: ["uhoney"] },
                    { denom: "honey", exponent: 6, aliases: [] },
                ],
                base: "factory/bze1me/uhoney",
                display: "honey",
                name: "Honey Coin",
                symbol: "HONEY",
                uri: "",
                uriHash: "",
            },
        });

        expect(screen.getByText("Honey Coin (HONEY) is live!")).toBeInTheDocument();
        expect(screen.getByText("Your token was created, and the initial supply was minted to your address.")).toBeInTheDocument();
        expect(screen.getByText("factory/bze1me/uhoney")).toBeInTheDocument();
        expect(savedDraft()).toBeNull();
    });

    it("keeps the values when the transaction fails", async () => {
        txMock.mockImplementation(async () => undefined);
        renderPage();
        await answerAll();
        await userEvent.click(createButton());
        expect(screen.queryByText(/is live!/)).not.toBeInTheDocument();
        expect(question("Name and ticker")).toHaveTextContent("Honey Coin (HONEY)");
        expect(savedDraft()?.form).toMatchObject({ name: "Honey Coin", symbol: "HONEY" });
        expect(createButton()).toBeEnabled();
    });

    it.each([
        ["no wallet", () => { wallet.address = undefined; }],
        ["the fee is unknown", () => { feeState.fee = undefined; }],
        ["the fee can't be paid", () => { canPayFee.current = false; }],
    ])("keeps Create disabled when %s", async (_name, setup) => {
        setup();
        renderPage();
        await answerAll();
        expect(createButton()).toBeDisabled();
    });

    it("says when the balance can't cover the fee", async () => {
        canPayFee.current = false;
        renderPage();
        await answerAll();
        expect(screen.getByText("Not enough balance to cover the creation fee.")).toBeInTheDocument();
    });

    it("saves the draft on every change and restores it on load", async () => {
        const { unmount } = renderPage();
        await answerIdentity();
        expect(savedDraft()).toEqual({
            form: { name: "Honey Coin", symbol: "HONEY", description: "", initialSupply: "" },
            answered: ["identity"],
        });
        expect(screen.getByText("Draft saved in this browser")).toBeInTheDocument();
        unmount();

        renderPage();
        expect(question("Name and ticker")).toHaveAttribute("data-state", "done");
        expect(question("Name and ticker")).toHaveTextContent("Honey Coin (HONEY)");
        expect(question("Describe it")).toHaveAttribute("data-state", "active");
    });

    it("keeps the draft for 30 days", async () => {
        const now = Date.now();
        renderPage();
        await userEvent.type(screen.getByPlaceholderText("e.g. Honey Coin"), "Hi");
        const stored = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith(`:${TOKEN_DRAFT_KEY}`))!)!);
        expect(stored.expiry - now).toBeGreaterThanOrEqual(30 * 24 * 3600 * 1000 - 1000);
        expect(stored.expiry - now).toBeLessThan(30 * 24 * 3600 * 1000 + 60_000);
    });

    it("Start over clears the draft and the form", async () => {
        setInLocalStorage(TOKEN_DRAFT_KEY, JSON.stringify({
            form: { name: "Old", symbol: "OLD", description: "", initialSupply: "5" },
            answered: ["identity", "description", "supply"],
        }), 60);
        renderPage();
        expect(question("Name and ticker")).toHaveTextContent("Old (OLD)");

        await userEvent.click(screen.getByRole("button", { name: "Start over" }));
        expect(savedDraft()).toBeNull();
        expect(question("Name and ticker")).toHaveAttribute("data-state", "active");
        expect(screen.getByPlaceholderText("e.g. Honey Coin")).toHaveValue("");
        expect(screen.queryByText("Draft saved in this browser")).not.toBeInTheDocument();
    });
});
