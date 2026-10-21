import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import { getFromLocalStorage, setInLocalStorage, truncateAddress } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: wallet, assets, fees, the fee engine, the token's chain facts
// and the wallet side of the tx (useFactoryTx). The wizard's tx hook, the pending-tx store, the
// Review step and the Done screen are real. The browser draft goes through the real ui-kit
// storage helpers (jsdom localStorage). PayPanel has its own tests.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage: string }) => void;
};
const { wallet, assetDenoms, feeState, payment, setupState, navigateMock, txMock } = vi.hoisted(() => ({
    wallet: { address: "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l" as string | undefined },
    assetDenoms: { current: [] as string[] },
    feeState: { fee: { denom: "ubze", amount: "25000000000" } as { denom: string; amount: string } | undefined },
    payment: { canPayFee: true },
    setupState: { pools: [] as { id: string; base: string; quote: string }[] },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/token/new",
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: navigateMock }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock, progressTrack: "" }) }));
vi.mock("@/hooks/useTokenSetup", () => ({
    useTokenSetup: () => ({ isLoading: false, items: [], pools: setupState.pools, hasMarket: false, hasStakers: false }),
}));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({
        canPayFee: payment.canPayFee,
        isLoading: false,
        method: payment.canPayFee ? "native" : "insufficient",
        gasFee: { amount: new BigNumber(4000), displayAmount: new BigNumber("0.004"), ticker: "BZE", isLoading: false },
    }),
}));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
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
        useAssets: () => ({ assets: assetDenoms.current.map(denom => ({ denom })), denomTicker: (d: string) => d }),
        useAsset: (denom: string) => ({
            asset: denom === "ubze" ? { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" } : undefined,
            isLoading: false,
        }),
        useAssetPrice: () => ({ hasPrice: false, uAmountUsdValue: () => new BigNumber(0) }),
        useCreationFees: () => ({ fees: { createDenomFee: feeState.fee }, isLoading: false }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import TokenNewPage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";
import { TOKEN_DRAFT_KEY } from "@/lib/token-draft";

const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const OTHER = "bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk";
const DENOM = `factory/${ME}/uhoney`;

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<TokenNewPage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const createButton = () => button(step("Review"), "Create token");
const savedDraft = () => {
    const raw = getFromLocalStorage(TOKEN_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
};
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];

async function answerDetails(name = "Honey", symbol = "honey") {
    const q = step("Details");
    await userEvent.type(within(q).getByPlaceholderText("e.g. Honey"), name);
    await userEvent.type(within(q).getByPlaceholderText("e.g. HONEY"), symbol);
    await userEvent.click(button(q, "Continue"));
}

async function answerSupply(preset = "1,000,000") {
    const q = step("Supply");
    await userEvent.click(button(q, preset));
    await userEvent.click(button(q, "Continue"));
}

async function answerPermissions(admin?: string) {
    const q = step("Permissions");
    if (admin) {
        await userEvent.click(within(q).getByRole("radio", { name: /Another address/ }));
        await userEvent.type(within(q).getByPlaceholderText("bze1…"), admin);
    }
    await userEvent.click(button(q, "Review token"));
}

async function answerAll(admin?: string) {
    await answerDetails();
    await answerSupply();
    await answerPermissions(admin);
}

/** The wallet signs and the chain includes the tx. */
function txSucceeds() {
    txMock.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH1");
        opts.onSuccess?.({ txhash: "HASH1", height: 1234, code: 0 });
        return true;
    });
}

beforeEach(() => {
    localStorage.clear();
    wallet.address = ME;
    assetDenoms.current = [];
    feeState.fee = { denom: "ubze", amount: "25000000000" };
    payment.canPayFee = true;
    setupState.pools = [];
    navigateMock.mockReset();
    txMock.mockReset();
    txSucceeds();
    // A pending hash is looked up on the chain's REST: never reach the network.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => vi.unstubAllGlobals());

// Each test types through several steps; CI runners need more than the 5 s default.
describe("Create a token (/token/new)", { timeout: 20_000 }, () => {
    it("shows the four steps with Details open, and the fee for the three messages", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Create a token" })).toBeInTheDocument();
        expect(step("Details")).toHaveAttribute("data-state", "active");
        expect(within(step("Details")).getByText("Step 1 of 4 ·", { exact: false })).toBeInTheDocument();
        expect(within(step("Details")).getByRole("heading", { name: "What is it called?" })).toBeInTheDocument();
        expect(step("Supply")).toHaveAttribute("data-state", "todo");
        expect(step("Permissions")).toHaveAttribute("data-state", "todo");
        expect(step("Review")).toHaveAttribute("data-state", "todo");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Token creation fee: 25000000000 | create-denom,mint,set-denom-metadata");
        expect(screen.getByText("Click a finished step to change it. Scrolling only scrolls.")).toBeInTheDocument();
    });

    describe("Details", () => {
        it("uppercases the ticker, previews the denom and summarises name · ticker", async () => {
            renderPage();
            const q = step("Details");
            expect(within(q).getByText(`factory/${ME}/u<ticker>`)).toBeInTheDocument();
            expect(within(q).getByText("The ticker is permanent.")).toBeInTheDocument();
            await userEvent.type(within(q).getByPlaceholderText("e.g. Honey"), "Honey");
            await userEvent.type(within(q).getByPlaceholderText("e.g. HONEY"), "honey");
            expect(within(q).getByPlaceholderText("e.g. HONEY")).toHaveValue("HONEY");
            expect(within(q).getByText(DENOM)).toBeInTheDocument();

            const outcome = screen.getByRole("region", { name: "What will happen" });
            expect(within(outcome).getByTestId("preview-name")).toHaveTextContent("Honey");
            expect(within(outcome).getByTestId("preview-ticker")).toHaveTextContent("HONEY");
            expect(within(outcome).getByText("H")).toBeInTheDocument();

            await userEvent.click(button(q, "Continue"));
            expect(step("Details")).toHaveAttribute("data-state", "done");
            expect(step("Details")).toHaveTextContent("Honey · HONEY");
            expect(step("Supply")).toHaveAttribute("data-state", "active");
        });

        it("uses a placeholder for the address without a wallet", async () => {
            wallet.address = undefined;
            renderPage();
            await userEvent.type(screen.getByPlaceholderText("e.g. HONEY"), "hny");
            expect(screen.getByText("factory/<you>/uhny")).toBeInTheDocument();
        });

        it("shows field errors after blur and keeps Continue disabled", async () => {
            renderPage();
            const q = step("Details");
            expect(button(q, "Continue")).toBeDisabled();
            await userEvent.type(within(q).getByPlaceholderText("e.g. Honey"), "H");
            expect(screen.queryByText("Name must be at least 2 characters.")).not.toBeInTheDocument();
            await userEvent.tab();
            expect(screen.getByText("Name must be at least 2 characters.")).toBeInTheDocument();
            await userEvent.type(within(q).getByPlaceholderText("e.g. HONEY"), "1ab");
            await userEvent.tab();
            expect(screen.getByText("Symbol must start with a letter and contain only letters and digits.")).toBeInTheDocument();
            expect(button(q, "Continue")).toBeDisabled();
        });

        it("rejects a ticker this wallet already created", async () => {
            assetDenoms.current = [DENOM];
            renderPage();
            await userEvent.type(screen.getByPlaceholderText("e.g. HONEY"), "honey");
            await userEvent.tab();
            expect(screen.getByText("A token with this symbol already exists in your account — pick another one.")).toBeInTheDocument();
        });

        it("takes an optional description up to 512 characters", async () => {
            renderPage();
            const q = step("Details");
            expect(within(q).getByText("(optional)")).toBeInTheDocument();
            await userEvent.type(within(q).getByPlaceholderText("e.g. Honey"), "Honey");
            await userEvent.type(within(q).getByPlaceholderText("e.g. HONEY"), "honey");
            // Pasted, not typed: 513 keystrokes are slow on CI runners.
            await userEvent.click(within(q).getByRole("textbox", { name: /Description/ }));
            await userEvent.paste("a".repeat(513));
            await userEvent.tab();
            expect(within(q).getByText("513 / 512")).toBeInTheDocument();
            expect(screen.getByText("Description must be at most 512 characters.")).toBeInTheDocument();
            expect(button(q, "Continue")).toBeDisabled();
        });
    });

    describe("Supply", () => {
        it("offers three presets, says where the tokens go and summarises the amount", async () => {
            renderPage();
            await answerDetails();
            const q = step("Supply");
            expect(within(q).getByRole("heading", { name: "How many to start with?" })).toBeInTheDocument();
            expect(within(q).getByText("Minted to your wallet. 6 decimals.")).toBeInTheDocument();
            expect(button(q, "Continue")).toBeDisabled();
            await userEvent.click(button(q, "21,000,000"));
            expect(within(q).getByPlaceholderText("e.g. 1000000")).toHaveValue("21000000");
            expect(screen.getByTestId("outcome")).toHaveTextContent("You receive 21,000,000 HONEY.");
            await userEvent.click(button(q, "Continue"));
            expect(step("Supply")).toHaveTextContent("21,000,000 HONEY to your wallet");
        });

        it("validates a typed amount", async () => {
            renderPage();
            await answerDetails();
            const q = step("Supply");
            await userEvent.type(within(q).getByPlaceholderText("e.g. 1000000"), "0");
            await userEvent.tab();
            expect(screen.getByText("Initial supply must be greater than zero.")).toBeInTheDocument();
            expect(button(q, "Continue")).toBeDisabled();
        });

        it("goes back to Details with Back", async () => {
            renderPage();
            await answerDetails();
            await userEvent.click(button(step("Supply"), "Back"));
            expect(step("Details")).toHaveAttribute("data-state", "active");
            expect(step("Details")).toHaveAttribute("data-direction", "back");
        });
    });

    describe("Permissions", () => {
        it("keeps the admin in the creator's wallet by default", async () => {
            renderPage();
            await answerDetails();
            await answerSupply();
            const q = step("Permissions");
            expect(within(q).getByRole("radio", { name: /My wallet/ })).toHaveAttribute("aria-checked", "true");
            expect(within(q).getByRole("radio", { name: /Another address/ })).toHaveAttribute("aria-checked", "false");
            expect(within(q).getByText("You can transfer or renounce admin later on the token's page, under Permissions.")).toBeInTheDocument();
            expect(within(q).queryByText(/renounce now/i)).not.toBeInTheDocument();
            expect(screen.getByTestId("outcome")).toHaveTextContent(
                "You receive 1,000,000 HONEY. Your wallet keeps permission to mint more and update its details.",
            );
            await userEvent.click(button(q, "Review token"));
            expect(step("Permissions")).toHaveTextContent("Admin: your wallet");
            expect(step("Review")).toHaveAttribute("data-state", "active");
        });

        it("refuses the connected wallet as the other admin", async () => {
            renderPage();
            await answerDetails();
            await answerSupply();
            const q = step("Permissions");
            await userEvent.click(within(q).getByRole("radio", { name: /Another address/ }));
            expect(button(q, "Review token")).toBeDisabled();
            await userEvent.type(within(q).getByPlaceholderText("bze1…"), ME);
            await userEvent.tab();
            expect(within(q).getByText("That's your own wallet. Pick My wallet instead.")).toBeInTheDocument();
            expect(button(q, "Review token")).toBeDisabled();
        });

        it("hands the admin to another address and says so", async () => {
            renderPage();
            await answerDetails();
            await answerSupply();
            await answerPermissions(OTHER);
            expect(step("Permissions")).toHaveTextContent(`Admin: ${truncateAddress(OTHER)}`);
            expect(screen.getByTestId("outcome")).toHaveTextContent("The address you choose gets permission to mint more and update its details.");
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("create-denom,mint,set-denom-metadata,change-admin");
        });
    });

    describe("Review", () => {
        it("lists what leaves the wallet, what you get, the admin and what is permanent", async () => {
            renderPage();
            await answerAll();
            const q = step("Review");
            expect(within(q).getByRole("heading", { name: "Everything right?" })).toBeInTheDocument();
            const leaves = within(q).getByRole("region", { name: "Leaves your wallet" });
            expect(leaves).toHaveTextContent("Creation fee");
            expect(leaves).toHaveTextContent("25,000 BZE");
            expect(leaves).toHaveTextContent("Network fee");
            expect(leaves).toHaveTextContent("0.004000 BZE");
            expect(within(q).getByRole("region", { name: "You get" })).toHaveTextContent("1,000,000 HONEY");
            expect(q).toHaveTextContent("Adminyour wallet · can mint more and edit details");
            expect(within(q).getByRole("region", { name: "Permanent" })).toHaveTextContent("The ticker in its address");
            expect(createButton()).toBeEnabled();
        });

        it("shows the other admin's full address", async () => {
            renderPage();
            await answerAll(OTHER);
            expect(step("Review")).toHaveTextContent(`Admin${OTHER} · can mint more and edit details`);
        });

        it.each([
            ["no wallet", () => { wallet.address = undefined; }, "Connect your wallet to create this token."],
            ["the fee is unknown", () => { feeState.fee = undefined; }, "Could not load the current fee from the chain. Please refresh and try again."],
            ["the fee can't be paid", () => { payment.canPayFee = false; }, "Not enough balance to cover the creation fee."],
        ])("keeps Create token disabled when %s", async (_name, setup, note) => {
            setup();
            renderPage();
            await answerAll();
            expect(createButton()).toBeDisabled();
            expect(within(step("Review")).getByText(note)).toBeInTheDocument();
        });
    });

    describe("the transaction", () => {
        it("signs create denom, mint and metadata, in order, for My wallet", async () => {
            renderPage();
            await answerAll();
            await userEvent.click(createButton());

            expect(txMock).toHaveBeenCalledTimes(1);
            const msgs = sentMsgs();
            expect(msgs.map(m => m.typeUrl)).toEqual([
                "/bze.tokenfactory.MsgCreateDenom",
                "/bze.tokenfactory.MsgMint",
                "/bze.tokenfactory.MsgSetDenomMetadata",
            ]);
            expect(msgs[0].value).toEqual({ creator: ME, subdenom: "uhoney" });
            expect(msgs[1].value).toEqual({ creator: ME, coins: `1000000000000${DENOM}` });
            expect(msgs[2].value).toEqual({
                creator: ME,
                metadata: {
                    description: "",
                    denomUnits: [
                        { denom: DENOM, exponent: 0, aliases: ["uhoney"] },
                        { denom: "honey", exponent: 6, aliases: [] },
                    ],
                    base: DENOM,
                    display: "honey",
                    name: "Honey",
                    symbol: "HONEY",
                    uri: "",
                    uriHash: "",
                },
            });
        });

        it("adds MsgChangeAdmin to the other address as the 4th message", async () => {
            renderPage();
            await answerAll(OTHER);
            await userEvent.click(createButton());

            const msgs = sentMsgs();
            expect(msgs.map(m => m.typeUrl)).toEqual([
                "/bze.tokenfactory.MsgCreateDenom",
                "/bze.tokenfactory.MsgMint",
                "/bze.tokenfactory.MsgSetDenomMetadata",
                "/bze.tokenfactory.MsgChangeAdmin",
            ]);
            expect(msgs[3].value).toEqual({ creator: ME, denom: DENOM, newAdmin: OTHER });
        });

        it("keeps the answers when the wallet declines", async () => {
            txMock.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
                opts.onFailure?.("Request rejected", { stage: "sign" });
                return false;
            });
            renderPage();
            await answerAll();
            await userEvent.click(createButton());
            expect(screen.getByRole("heading", { name: "You declined in the wallet" })).toBeInTheDocument();
            expect(savedDraft()?.form).toMatchObject({ name: "Honey", symbol: "HONEY", initialSupply: "1000000" });

            await userEvent.click(screen.getByRole("button", { name: "Edit answers" }));
            expect(step("Review")).toHaveAttribute("data-state", "active");
            expect(step("Details")).toHaveTextContent("Honey · HONEY");
        });

        it("clears the draft and shows the Done screen once confirmed", async () => {
            renderPage();
            await answerAll();
            await userEvent.click(createButton());
            expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            expect(savedDraft()).toBeNull();

            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("HONEY is live.");
            expect(screen.getByText("1,000,000 HONEY just landed in your wallet. Nice work.")).toBeInTheDocument();
            expect(screen.getByText(DENOM)).toBeInTheDocument();
            expect(screen.getByTestId("done-confetti")).toBeInTheDocument();
            expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
            expect(screen.getByRole("link", { name: /DEX/ })).toHaveAttribute("href", `https://dex.test/assets/details?denom=${encodeURIComponent(DENOM)}`);

            // The recommended pool first, then brand kit, registry and stakable.
            expect(screen.getByText("Let people buy HONEY")).toBeInTheDocument();
            expect(screen.getByText("Make HONEY stakable")).toBeInTheDocument();
            expect(screen.getByText("Get your logo in every wallet")).toBeInTheDocument();
            expect(screen.getByText("Give it a look")).toBeInTheDocument();
            expect(screen.getByText(/Not now\? Every one of these waits for you on/)).toBeInTheDocument();
            expect(screen.getByText("HONEY's token page")).toBeInTheDocument();
            expect(savedDraft()).toBeNull();
        });

        it("skips the pool when a HONEY/BZE pool already exists", async () => {
            setupState.pools = [{ id: "7", base: DENOM, quote: "ubze" }];
            renderPage();
            await answerAll();
            await userEvent.click(createButton());
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
            expect(screen.queryByText("Let people buy HONEY")).not.toBeInTheDocument();
            expect(screen.getByText("Make HONEY stakable")).toBeInTheDocument();
        });
    });

    describe("the browser draft", () => {
        it("saves the answers and the admin choice, and reopens on the next step", async () => {
            const { unmount } = renderPage();
            await answerDetails();
            await answerSupply();
            await userEvent.click(within(step("Permissions")).getByRole("radio", { name: /Another address/ }));
            expect(savedDraft()).toEqual({
                form: { name: "Honey", symbol: "HONEY", description: "", initialSupply: "1000000", adminChoice: "other", adminAddress: "" },
                answered: ["details", "supply"],
            });
            expect(screen.getByText("Draft saved in this browser")).toBeInTheDocument();
            unmount();

            renderPage();
            expect(step("Details")).toHaveAttribute("data-state", "done");
            expect(step("Supply")).toHaveAttribute("data-state", "done");
            expect(step("Permissions")).toHaveAttribute("data-state", "active");
            expect(within(step("Permissions")).getByRole("radio", { name: /Another address/ })).toHaveAttribute("aria-checked", "true");
        });

        it("lands on Review when every step was finished", () => {
            setInLocalStorage(TOKEN_DRAFT_KEY, JSON.stringify({
                form: { name: "Old", symbol: "OLD", description: "", initialSupply: "5", adminChoice: "mine", adminAddress: "" },
                answered: ["details", "supply", "permissions"],
            }), 60);
            renderPage();
            expect(step("Permissions")).toHaveTextContent("Admin: your wallet");
            expect(step("Review")).toHaveAttribute("data-state", "active");
        });

        it("reads a draft saved by the three-question form", () => {
            setInLocalStorage(TOKEN_DRAFT_KEY, JSON.stringify({
                form: { name: "Old", symbol: "OLD", description: "", initialSupply: "5" },
                answered: ["identity", "description", "supply"],
            }), 60);
            renderPage();
            expect(step("Details")).toHaveTextContent("Old · OLD");
            expect(step("Supply")).toHaveTextContent("5 OLD to your wallet");
            expect(step("Permissions")).toHaveAttribute("data-state", "active");
        });

        it("keeps the draft for 30 days", async () => {
            const now = Date.now();
            renderPage();
            await userEvent.type(screen.getByPlaceholderText("e.g. Honey"), "Hi");
            const stored = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith(`:${TOKEN_DRAFT_KEY}`))!)!);
            expect(stored.expiry - now).toBeGreaterThanOrEqual(30 * 24 * 3600 * 1000 - 1000);
            expect(stored.expiry - now).toBeLessThan(30 * 24 * 3600 * 1000 + 60_000);
        });

        it("Start over clears the draft and the form", async () => {
            setInLocalStorage(TOKEN_DRAFT_KEY, JSON.stringify({
                form: { name: "Old", symbol: "OLD", description: "", initialSupply: "5", adminChoice: "mine", adminAddress: "" },
                answered: ["details", "supply"],
            }), 60);
            renderPage();
            expect(step("Details")).toHaveTextContent("Old · OLD");

            await userEvent.click(screen.getByRole("button", { name: "Start over" }));
            expect(savedDraft()).toBeNull();
            expect(step("Details")).toHaveAttribute("data-state", "active");
            expect(screen.getByPlaceholderText("e.g. Honey")).toHaveValue("");
            expect(screen.queryByText("Draft saved in this browser")).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Start over" })).not.toBeInTheDocument();
        });
    });
});
