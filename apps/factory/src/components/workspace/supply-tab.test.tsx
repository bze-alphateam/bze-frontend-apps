import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// The Supply tab with the real mint/burn cards: the wallet, tx layer and spendable/gas hooks
// are mocked, so the tests drive the inputs and read the msgs handed to the tx layer.
const m = vi.hoisted(() => ({
    tx: vi.fn(),
    balance: "2000000",
    max: "1.5",
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1owner" }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: m.tx }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        getBurnerApp: () => ({ href: "https://burner.example" }),
        useMaxSpendable: () => ({
            amount: new BigNumber(m.max).multipliedBy(1_000_000),
            inputValue: m.max,
            balance: new BigNumber(m.balance),
            gasFee: { amount: new BigNumber(4000), displayAmount: new BigNumber("0.004"), ticker: "BZE" },
        }),
    };
});

import { SupplyTab } from "./supply-tab";
import type { WorkspaceTabProps } from "./types";

const DENOM = "factory/bze1owner/utok";
const asset = { denom: DENOM, ticker: "TOK", name: "Tok", decimals: 6, logo: "", supply: 1000000000n } as unknown as WorkspaceTabProps["asset"];

const props = (over: Partial<WorkspaceTabProps> = {}): WorkspaceTabProps => ({
    asset,
    admin: "bze1owner",
    adminState: "admin",
    supplyDisplay: new BigNumber(1000),
    supply: "1000000000",
    isSupplyLoading: false,
    balanceDisplay: new BigNumber(2),
    refreshSupply: vi.fn(),
    refreshAdmins: vi.fn(async () => {}),
    goTo: vi.fn(),
    ...over,
});

const renderTab = (p: WorkspaceTabProps) => render(
    <ChakraProvider value={defaultSystem}>
        <SupplyTab {...p} />
    </ChakraProvider>,
);

const card = (mode: "mint" | "burn") => within(screen.getByTestId(`supply-${mode}-card`));

beforeEach(() => {
    m.tx.mockReset();
    m.tx.mockResolvedValue(true);
    m.balance = "2000000";
    m.max = "1.5";
});

describe("SupplyTab facts", () => {
    it("shows the supply, the wallet's share and who can mint", () => {
        renderTab(props());
        expect(screen.getByText("1,000 TOK")).toBeInTheDocument();
        expect(screen.getByText("0.2% of supply")).toBeInTheDocument();
        expect(screen.getByTestId("who-can-mint")).toHaveTextContent("You");
    });

    it("links every state to the Burner app", () => {
        renderTab(props({ adminState: "renounced", admin: "" }));
        const link = screen.getByRole("link", { name: /Burn with the Burner app/ });
        expect(link).toHaveAttribute("href", "https://burner.example/coin?coin=factory%2Fbze1owner%2Futok");
        expect(screen.getByText(/Anyone can burn TOK they hold in the Burner app/)).toBeInTheDocument();
    });
});

describe("SupplyTab states", () => {
    it.each([
        ["renounced", "", "Nobody, supply is fixed", "Supply is fixed forever. Nobody can mint TOK, you included."],
        ["not-admin", "bze1someoneelseaddress000000000000000000", "bze1so…000000", "Minting is controlled by bze1someoneelseaddress000000000000000000."],
        ["unknown", undefined, "Unknown", "Couldn't load who controls TOK."],
    ] as const)("%s: no mint or burn, a notice instead", (adminState, admin, who, notice) => {
        renderTab(props({ adminState, admin }));
        expect(screen.queryByTestId("supply-mint-card")).not.toBeInTheDocument();
        expect(screen.queryByTestId("supply-burn-card")).not.toBeInTheDocument();
        expect(screen.getByTestId("supply-notice")).toHaveTextContent(notice);
        if (adminState !== "not-admin") expect(screen.getByTestId("who-can-mint")).toHaveTextContent(who);
    });

    it("not-admin: who can mint is the shortened address", () => {
        renderTab(props({ adminState: "not-admin", admin: "bze1someoneelseaddress000000000000000000" }));
        expect(screen.getByTestId("who-can-mint").textContent).not.toBe("bze1someoneelseaddress000000000000000000");
        expect(screen.getByTestId("who-can-mint").textContent).toMatch(/^bze1/);
    });

    it("unknown: Retry reloads the admins", async () => {
        const p = props({ adminState: "unknown", admin: undefined });
        renderTab(p);
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(p.refreshAdmins).toHaveBeenCalled();
    });
});

describe("Mint more", () => {
    it("tells the new total, warns about dilution and shows the network fee", async () => {
        renderTab(props());
        await userEvent.type(card("mint").getByRole("textbox"), "250.5");
        expect(card("mint").getByTestId("supply-mint-sentence")).toHaveTextContent("New total supply 1,250.5 TOK. The new TOK goes to your wallet.");
        expect(card("mint").getByText("Minting more lowers the share every holder owns.")).toBeInTheDocument();
        expect(card("mint").getByTestId("supply-mint-fee")).toHaveTextContent("Network fee ≈ 0.004000 BZE");
        expect(card("mint").getByRole("button", { name: "Mint 250.5 TOK" })).toBeEnabled();
    });

    it("signs MsgMint in base units, then clears and refreshes the supply", async () => {
        const p = props();
        m.tx.mockImplementation(async (_msgs, opts) => { opts?.onSuccess?.({}); return true; });
        renderTab(p);
        const input = card("mint").getByRole("textbox");
        await userEvent.type(input, "1.5");
        await userEvent.click(card("mint").getByRole("button", { name: "Mint 1.5 TOK" }));
        const [msgs] = m.tx.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.tokenfactory.MsgMint");
        expect(msgs[0].value).toMatchObject({ creator: "bze1owner", coins: `1500000${DENOM}` });
        expect(p.refreshSupply).toHaveBeenCalledTimes(1);
        expect(input).toHaveValue("");
    });

    it("does not refresh when the tx fails", async () => {
        const p = props();
        m.tx.mockResolvedValue(false);
        renderTab(p);
        await userEvent.type(card("mint").getByRole("textbox"), "1");
        await userEvent.click(card("mint").getByRole("button", { name: "Mint 1 TOK" }));
        expect(m.tx).toHaveBeenCalled();
        expect(p.refreshSupply).not.toHaveBeenCalled();
    });
});

describe("Burn", () => {
    it("tells the new total and the balance it burns from", async () => {
        renderTab(props());
        expect(card("burn").getByText("of 2 TOK")).toBeInTheDocument();
        expect(card("burn").getByText("You can only burn what you hold.")).toBeInTheDocument();
        await userEvent.type(card("burn").getByRole("textbox"), "0.5");
        expect(card("burn").getByTestId("supply-burn-sentence")).toHaveTextContent("New total supply 999.5 TOK. Burned from your wallet.");
    });

    it("refuses more than the wallet holds", async () => {
        renderTab(props());
        const input = card("burn").getByRole("textbox");
        await userEvent.type(input, "3");
        await userEvent.tab();
        expect(card("burn").getByText("You can only burn tokens you hold — the amount exceeds your balance.")).toBeInTheDocument();
        expect(card("burn").getByRole("button", { name: "Burn TOK" })).toBeDisabled();
    });

    it("Max fills in the spendable amount", async () => {
        renderTab(props());
        await userEvent.click(card("burn").getByRole("button", { name: "Max" }));
        expect(card("burn").getByRole("textbox")).toHaveValue("1.5");
    });

    it("signs MsgBurn in base units, then clears and refreshes the supply", async () => {
        const p = props();
        m.tx.mockImplementation(async (_msgs, opts) => { opts?.onSuccess?.({}); return true; });
        renderTab(p);
        const input = card("burn").getByRole("textbox");
        await userEvent.type(input, "0.25");
        await userEvent.click(card("burn").getByRole("button", { name: "Burn 0.25 TOK" }));
        const [msgs] = m.tx.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.tokenfactory.MsgBurn");
        expect(msgs[0].value).toMatchObject({ creator: "bze1owner", coins: `250000${DENOM}` });
        expect(p.refreshSupply).toHaveBeenCalledTimes(1);
        expect(input).toHaveValue("");
    });
});
