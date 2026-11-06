import {describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {type Asset, DEFAULT_DENOM_BRANDING, TOKEN_LOGO_PLACEHOLDER} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: "dark", setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));

import {ScanClientProvider} from "@/hooks/token-activity";
import {MSG, type ScanClient, ScanError, type ScanToken, type ScanTransfer, type ScanTx} from "@/lib/token-activity";

import {TokenSiteTheme} from "../kit";
import {activityPulse, ActivitySnippet} from "./activity-snippet";

forbidNetwork();

const DENOM = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const ENCODED = encodeURIComponent(DENOM);
const TRADER = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
const BURNER = "bze1v7uw4xhrcv0vk7qp8jf9lu3hm5d8uu5yjp5qun";

const ASSET: Asset = {
    type: "factory", denom: DENOM, decimals: 6, name: "NoAdminToken", ticker: "NOAD",
    logo: TOKEN_LOGO_PLACEHOLDER, stable: false, verified: false, supply: 1n,
};

const hash = (n: number) => n.toString(16).toUpperCase().padStart(64, "0");

const burn = (n: number): ScanTransfer => ({
    height: 1000 - n, tx_index: 0, tx_hash: hash(n), time: "2026-11-05T21:09:16Z", seq: 1, msg_index: 0,
    msg_type: MSG.fundBurner, kind: "transfer", sender: TRADER, sender_label: null, recipient: BURNER,
    recipient_label: {name: "Burner", kind: "module"}, denom: DENOM, amount: "14000000", symbol: "NOAD", exponent: 6,
});

const txOf = (txHash: string): ScanTx => ({
    height: 1, tx_index: 0, hash: txHash, time: "", success: true, msg_count: 2, msg_types: [], fee: [{denom: "ubze", amount: "930"}],
    signer: TRADER, signers: [TRADER], fee_payer: TRADER, memo: null, code: 0, error_log: null, gas_wanted: 0, gas_used: 0, messages: [],
    transfers: [{seq: 0, msg_index: null, kind: "transfer", sender: TRADER, sender_label: null, recipient: "bze1fee", recipient_label: null, denom: "ubze", amount: "930", symbol: "BZE", exponent: 6}],
    dex: null, ibc_transfers: null,
});

const STATS = {holders_count: 8, transfers_24h: {count: 9, amount: "1"}} as ScanToken;

function client(over: Partial<ScanClient> = {}): ScanClient {
    return {
        token: vi.fn(async () => STATS),
        tokenTransfers: vi.fn(async () => ({items: [1, 2, 3, 4, 5, 6].map(burn), next_cursor: null})),
        tx: vi.fn(async (txHash: string) => txOf(txHash)),
        tokenEvents: vi.fn(), tokenHolders: vi.fn(), account: vi.fn(), accountActivity: vi.fn(), modules: vi.fn(),
        ...over,
    } as ScanClient;
}

function renderSnippet(scan: ScanClient) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false, retryDelay: 0}}});

    return render(<ActivitySnippet asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <QueryClientProvider client={queryClient}>
                    <ScanClientProvider client={scan}>
                        <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme>
                    </ScanClientProvider>
                </QueryClientProvider>
            </ChakraProvider>
        ),
    });
}

describe("ActivitySnippet", () => {
    it("shows the last five transactions with their fee, linking inside the token site", async () => {
        renderSnippet(client());

        expect(screen.getByRole("heading", {level: 2, name: "NOAD right now"})).toBeInTheDocument();
        const list = await screen.findByRole("list", {name: "Latest NOAD activity"});
        const rows = within(list).getAllByRole("listitem");
        expect(rows).toHaveLength(5);

        await waitFor(() => expect(within(rows[0]).getByText("Fee 0.00093 BZE")).toBeInTheDocument());
        expect(within(rows[0]).getByText("Burn")).toBeInTheDocument();
        expect(within(rows[0]).getByText("Sent to the burner")).toBeInTheDocument();
        expect(within(rows[0]).getByText("14 NOAD")).toBeInTheDocument();
        expect(within(rows[0]).getByLabelText("1 more message in this transaction")).toHaveTextContent("+1");
        expect(within(rows[0]).getByRole("link", {name: "bze1fk…y3y5k"})).toHaveAttribute("href", `/token/holder?denom=${ENCODED}&address=${TRADER}`);
        expect(within(rows[0]).getByRole("link", {name: "0000…0001"})).toHaveAttribute("href", `/token/tx?denom=${ENCODED}&hash=${hash(1)}`);

        expect(screen.getByText("8 holders · 9 transfers in the last 24 hours")).toBeInTheDocument();
        for (const link of screen.getAllByRole("link", {name: "See all activity"})) {
            expect(link).toHaveAttribute("href", `/token/activity?denom=${ENCODED}`);
        }
    });

    it("shows five placeholder rows while Scan answers", () => {
        renderSnippet(client({tokenTransfers: vi.fn(() => new Promise(() => undefined))}));

        expect(screen.getByLabelText("Loading NOAD activity")).toHaveAttribute("aria-busy", "true");
        expect(screen.getAllByTestId("activity-row-skeleton")).toHaveLength(5);
    });

    it("says nothing is indexed yet when the token has no transactions", async () => {
        renderSnippet(client({tokenTransfers: vi.fn(async () => ({items: [], next_cursor: null}))}));

        expect(await screen.findByRole("heading", {name: "No activity indexed yet"})).toBeInTheDocument();
        expect(screen.getByText("Trades, stakes, burns and transfers of NOAD show up here as soon as they happen.")).toBeInTheDocument();
    });

    it("reports Scan not answering and loads again on Retry", async () => {
        // Scan stays down (through the hook's own retries) until the test brings it back.
        let down = true;
        const tokenTransfers = vi.fn(async () => {
            if (down) throw new ScanError("BZE Scan unreachable", 0);
            return {items: [burn(1)], next_cursor: null};
        });
        renderSnippet(client({tokenTransfers, token: vi.fn(async () => { throw new ScanError("down", 502); })}));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Couldn't load NOAD activity. BZE Scan didn't answer.");
        // Without the token's stats the lead line is left out.
        expect(screen.queryByText(/in the last 24 hours/)).not.toBeInTheDocument();

        down = false;
        await userEvent.setup().click(within(alert).getByRole("button", {name: "Retry"}));
        expect(await screen.findAllByRole("listitem")).toHaveLength(1);
    });
});

describe("activityPulse", () => {
    it("counts holders only once Scan has a snapshot", () => {
        expect(activityPulse({holders_count: 1, transfers_24h: {count: 1, amount: "1"}})).toBe("1 holder · 1 transfer in the last 24 hours");
        expect(activityPulse({holders_count: null, transfers_24h: {count: 1200, amount: "1"}})).toBe("1,200 transfers in the last 24 hours");
    });
});
