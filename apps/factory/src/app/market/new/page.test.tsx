import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: query params, wallet, markets, fees, the fee engine and the
// tx hook. The asset picker becomes a plain button per denom; PayPanel has its own tests.
const { queryParams, wallet, existingMarkets, feeState, canPayFee, navigateMock, txMock, updateMarketsMock } = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    existingMarkets: { current: new Set<string>() },
    feeState: { fee: { denom: "ubze", amount: "25000000000" } as { denom: string; amount: string } | undefined, isLoading: false },
    canPayFee: { current: true },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    updateMarketsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => queryParams.current }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({ canPayFee: canPayFee.current, isLoading: false }),
}));
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows, feeUnknown }: { rows: { label: string; coin?: { amount: string } }[]; feeUnknown?: boolean }) => (
        <div data-testid="pay-panel">{feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin?.amount}`).join(", ")}</div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label, onSelect }: { label: string; onSelect: (a: { denom: string }) => void }) => (
        <div>
            <span>{label}</span>
            {["utok", "ubze", "uhalt"].map(d => <button key={d} onClick={() => onSelect({ denom: d })}>pick {d}</button>)}
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        utok: { denom: "utok", ticker: "TOK", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uhalt: { denom: "uhalt", ticker: "HALT", decimals: 6, logo: "", halted: true },
    };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useMarkets: () => ({
            marketExists: (id: string) => existingMarkets.current.has(id),
            updateMarkets: updateMarketsMock,
            isLoading: false,
        }),
        useCreationFees: () => ({ fees: { createMarketFee: feeState.fee }, isLoading: feeState.isLoading }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
    };
});

import MarketNewPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<MarketNewPage />, { wrapper });
const createButton = () => screen.getByRole("button", { name: "Create market" });
const question = (title: string) => screen.getByRole("region", { name: title });

async function pickPair(base: string, quote: string) {
    await userEvent.click(within(question("What is being traded?")).getByText(`pick ${base}`));
    await userEvent.click(within(question("What is it priced in?")).getByText(`pick ${quote}`));
}

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    existingMarkets.current = new Set();
    feeState.fee = { denom: "ubze", amount: "25000000000" };
    feeState.isLoading = false;
    canPayFee.current = true;
    navigateMock.mockReset();
    updateMarketsMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: { txhash: string }) => void }) => {
        opts.onSuccess({ txhash: "HASH1" });
    });
});

describe("Allow limit orders (/market/new)", () => {
    it("asks the questions in order and shows the outcome and the market fee", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Allow limit orders" })).toBeInTheDocument();
        expect(screen.getByText("tradebin · order-book market")).toBeInTheDocument();
        expect(question("What is being traded?")).toHaveAttribute("data-state", "active");
        expect(question("What is it priced in?")).toHaveAttribute("data-state", "todo");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Market creation fee: 25000000000");
        expect(createButton()).toBeDisabled();

        await pickPair("utok", "ubze");
        expect(question("What is being traded?")).toHaveAttribute("data-state", "done");
        expect(question("What is it priced in?")).toHaveAttribute("data-state", "done");
        expect(screen.getByRole("region", { name: "What will happen" })).toHaveTextContent(
            "A TOK/BZE order book opens on the DEX. Anyone can place buy and sell orders on it; 1 TOK will cost whatever BZE traders agree on.",
        );
        expect(screen.getByText(/"1 TOK costs X BZE"/)).toBeInTheDocument();
        expect(createButton()).toBeEnabled();
    });

    it("rejects the same asset on both sides and keeps question 2 open", async () => {
        queryParams.current = new URLSearchParams({ base: "ubze", quote: "ubze" });
        renderPage();
        expect(question("What is it priced in?")).toHaveAttribute("data-state", "active");
        expect(screen.getByRole("alert")).toHaveTextContent("Base and quote must be different assets.");
        expect(createButton()).toBeDisabled();
    });

    it("rejects a halted asset reached by deep link", () => {
        queryParams.current = new URLSearchParams({ base: "uhalt", quote: "ubze" });
        renderPage();
        expect(screen.getByRole("alert")).toHaveTextContent(/HALT is no longer tradeable on BZE/);
        expect(createButton()).toBeDisabled();
    });

    it.each([
        ["same direction", "utok/ubze"],
        ["reversed direction", "ubze/utok"],
    ])("rejects a pair whose market exists (%s) and links to it", async (_name, existingId) => {
        existingMarkets.current = new Set([existingId]);
        renderPage();
        await pickPair("utok", "ubze");

        expect(question("What is it priced in?")).toHaveAttribute("data-state", "active");
        expect(screen.getByRole("alert")).toHaveTextContent(/already exists on the DEX — every pair can have only one order book/);
        const link = screen.getByRole("link", { name: "View on DEX" });
        expect(link).toHaveAttribute("data-app", "dex");
        expect(link).toHaveAttribute("href", `https://dex.test/exchange/market?id=${encodeURIComponent(existingId)}`);
        expect(link).toHaveAttribute("target", "_blank");
        expect(createButton()).toBeDisabled();
    });

    it("reopens question 1 with Change, keeping the quote", async () => {
        renderPage();
        await pickPair("utok", "ubze");
        await userEvent.click(screen.getByRole("button", { name: "Change What is being traded?" }));
        expect(question("What is being traded?")).toHaveAttribute("data-state", "active");
        expect(question("What is it priced in?")).toHaveAttribute("data-state", "done");

        await userEvent.click(within(question("What is being traded?")).getByText("pick uhalt"));
        // the halted pair invalidates the quote answer, so question 2 opens with the error
        expect(question("What is it priced in?")).toHaveAttribute("data-state", "active");
    });

    it("asks to connect a wallet", async () => {
        wallet.address = undefined;
        renderPage();
        await pickPair("utok", "ubze");
        expect(screen.getByText("Connect your wallet to create this market.")).toBeInTheDocument();
        expect(createButton()).toBeDisabled();
    });

    it("blocks when the fee can't be paid", async () => {
        canPayFee.current = false;
        renderPage();
        await pickPair("utok", "ubze");
        expect(screen.getByText("Not enough balance to cover the creation fee.")).toBeInTheDocument();
        expect(createButton()).toBeDisabled();
    });

    it("blocks when the fee could not be loaded", async () => {
        feeState.fee = undefined;
        renderPage();
        await pickPair("utok", "ubze");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("fee unknown");
        expect(createButton()).toBeDisabled();
    });

    it("signs the pair in the user's order and shows the success panel", async () => {
        renderPage();
        // ubze < utok alphabetically: the message must keep the user's order, not sort it
        await pickPair("utok", "ubze");
        await userEvent.click(createButton());

        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.tradebin.MsgCreateMarket");
        expect(msgs[0].value).toMatchObject({ creator: "bze1me", base: "utok", quote: "ubze" });
        expect(updateMarketsMock).toHaveBeenCalledOnce();

        expect(screen.getByRole("heading", { name: "The TOK/BZE market is live!" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "View on DEX" })).toHaveAttribute("href", `https://dex.test/exchange/market?id=${encodeURIComponent("utok/ubze")}`);
        expect(screen.getByRole("link", { name: "View on DEX" })).toHaveAttribute("data-app", "dex");
        expect(screen.getByRole("link", { name: "View transaction" })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
        expect(screen.getByRole("link", { name: "View transaction" })).toHaveAttribute("data-app", "explorer");

        await userEvent.click(screen.getByRole("button", { name: "Create a liquidity pool" }));
        expect(navigateMock).toHaveBeenCalledWith("/pool/new?base=utok&quote=ubze");

        await userEvent.click(screen.getByRole("button", { name: "Back to the Factory" }));
        expect(navigateMock).toHaveBeenLastCalledWith("/");

        await userEvent.click(screen.getByRole("button", { name: "Create another market" }));
        expect(question("What is being traded?")).toHaveAttribute("data-state", "active");
    });

    it("carries the return path to the next step and back", async () => {
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze", return: "/manage/token?denom=utok&tab=trading", returnLabel: "TOK" });
        renderPage();
        expect(screen.getByRole("button", { name: /Back to TOK/ })).toBeInTheDocument();
        await userEvent.click(createButton());

        await userEvent.click(screen.getByRole("button", { name: "Create a liquidity pool" }));
        const href = navigateMock.mock.calls[0][0] as string;
        const params = new URLSearchParams(href.split("?")[1]);
        expect(params.get("base")).toBe("utok");
        expect(params.get("return")).toBe("/manage/token?denom=utok&tab=trading");

        await userEvent.click(screen.getByRole("button", { name: "Back to TOK" }));
        expect(navigateMock).toHaveBeenLastCalledWith("/manage/token?denom=utok&tab=trading");
    });
});
