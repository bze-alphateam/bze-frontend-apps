import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {type Asset, type BurnHistoryItem, DEFAULT_DENOM_BRANDING, type NextBurn} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

// Every hook the section reads is mocked; the values below are per test.
const tx = vi.fn();
const updateBalances = vi.fn();
const reloadNextBurn = vi.fn();
const connect = vi.fn();
let history: BurnHistoryItem[];
let historyLoading = false;
let nextBurn: NextBurn | undefined;
let hasPrice = true;
let status: WalletState = WalletState.Connected;
let balance: BigNumber;
let maxSpendable: BigNumber;
let feeMessage = "";

vi.mock("@/hooks/useBurningHistory", () => ({
    useBurningHistory: () => ({burnHistory: history, isLoading: historyLoading}),
}));
vi.mock("@/hooks/useNextBurning", () => ({
    useNextBurning: () => ({nextBurn, isLoading: false, reload: reloadNextBurn}),
}));

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAsset: () => ({asset: ASSET, isLoading: false}),
    useAssetPrice: () => ({price: new BigNumber("0.5"), change: 0, hasPrice}),
    useAssetsContext: () => ({updateBalances}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useMaxSpendable: () => ({
        amount: maxSpendable, balance, inputValue: maxSpendable.dividedBy(1e6).toFixed(), isLoading: false,
    }),
    useCanAffordTx: () => ({
        canAfford: feeMessage === "", message: feeMessage, isLoading: false,
        gasFee: {displayAmount: new BigNumber("0.5"), ticker: "PAGE"},
    }),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status, address: status === WalletState.Connected ? ME : undefined, connect}),
}));

import {TokenSiteTheme} from "../kit";
import {BurnSection} from "./index";

forbidNetwork();

// 97,659,888 PAGE left in circulation.
const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false,
    supply: 97_659_888_000_000n,
};

const burn = (amount: string, blockHeight: string, timestamp: string): BurnHistoryItem => ({
    denom: T, amount: new BigNumber(amount), usdValue: new BigNumber(0), blockHeight, timestamp,
});

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

function renderSection() {
    const user = userEvent.setup();
    render(<BurnSection asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });
    return user;
}

async function openBurnDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(screen.getByTestId("burn-total")).getByRole("button", {name: "Burn PAGE"}));
    return screen.getByRole("dialog", {name: "Burn PAGE"});
}

const historyRows = () => within(screen.getByTestId("burn-history")).getAllByRole("row").slice(1)
    .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));

beforeEach(() => {
    vi.clearAllMocks();
    // Newest first, as useBurningHistory sorts them.
    history = [
        burn("1340112", "18204551", "10/03/26, 14:00"),
        burn("1000000", "17102977", "08/22/26, 09:30"),
    ];
    historyLoading = false;
    nextBurn = undefined;
    hasPrice = true;
    status = WalletState.Connected;
    balance = new BigNumber("2000000000"); // 2,000 PAGE
    maxSpendable = new BigNumber("1999500000"); // minus the 0.5 PAGE fee reserve
    feeMessage = "";
    tx.mockResolvedValue(true);
});

describe("BurnSection", () => {
    it("is titled for the token and anchored for the header's Burn link", () => {
        renderSection();

        expect(screen.getByRole("heading", {level: 2, name: "Every burn makes PAGE scarcer"})).toBeInTheDocument();
        expect(document.getElementById("burn")).not.toBeNull();
    });

    it("shows a placeholder while the history loads", () => {
        historyLoading = true;
        renderSection();

        expect(screen.getByTestId("burn-loading")).toBeInTheDocument();
        expect(screen.queryByTestId("burn-total")).not.toBeInTheDocument();
    });

    it("sums the burns with their USD value and share of the original supply", () => {
        renderSection();

        // 2,340,112 ÷ (97,659,888 + 2,340,112) = 2.34%; × $0.5 = $1,170,056.
        expect(screen.getByTestId("burn-total-amount")).toHaveTextContent("2,340,112");
        expect(screen.getByTestId("burn-total-details")).toHaveTextContent("PAGE · $1,170,056.00 · 2.34% of the original supply");
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2.34");
    });

    it("lists the history newest first with amount, value, block and date", () => {
        renderSection();

        expect(historyRows()).toEqual([
            ["1,340,112 PAGE", "$670,056.00", "18,204,551", "10/03/26, 14:00"],
            ["1,000,000 PAGE", "$500,000.00", "17,102,977", "08/22/26, 09:30"],
        ]);
    });

    it("hides every USD value when the token has no price", () => {
        hasPrice = false;
        renderSection();

        expect(screen.getByTestId("burn-total-details")).toHaveTextContent(/^PAGE · 2.34% of the original supply$/);
        expect(historyRows().map((row) => row[1])).toEqual(["—", "—"]);
    });

    it("shows 0 and the empty history when nothing was burned", () => {
        history = [];
        renderSection();

        expect(screen.getByTestId("burn-total-amount")).toHaveTextContent("0");
        expect(screen.getByTestId("burn-total-details")).toHaveTextContent(/^PAGE · 0% of the original supply$/);
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
        expect(screen.getByTestId("burn-history-empty")).toHaveTextContent("No PAGE has been burned yet.");
        expect(within(screen.getByTestId("burn-history")).queryByRole("table")).not.toBeInTheDocument();
    });

    it("counts down to the next burn and shows the queued T when T is in it", () => {
        nextBurn = {date: inMinutes(2 * 1440 + 14 * 60 + 30), coins: [{denom: "ubze", amount: "9"}, {denom: T, amount: "50000000000"}]};
        renderSection();

        expect(screen.getByTestId("next-burn-countdown")).toHaveTextContent("2d 14h");
        expect(screen.getByTestId("next-burn-amount")).toHaveTextContent("50,000 PAGE queued");
        expect(screen.queryByTestId("next-burn-none")).not.toBeInTheDocument();
    });

    it("says no burn is scheduled when the next burn holds no T", () => {
        nextBurn = {date: inMinutes(60), coins: [{denom: "ubze", amount: "9"}]};
        renderSection();

        expect(screen.getByTestId("next-burn-none")).toHaveTextContent("No burn scheduled");
        expect(screen.queryByTestId("next-burn-countdown")).not.toBeInTheDocument();
    });

    it("says no burn is scheduled when the burner holds nothing", () => {
        renderSection();

        expect(screen.getByTestId("next-burn-none")).toBeInTheDocument();
    });

    it("renders the raffle slot under the next burn", () => {
        render(<BurnSection asset={ASSET} raffle={<div data-testid="raffle"/>}/>, {
            wrapper: ({children}: { children: ReactNode }) => (
                <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
            ),
        });

        expect(within(screen.getByTestId("next-burn")).getByTestId("raffle")).toBeInTheDocument();
    });
});

describe("the Burn dialog", () => {
    it("asks a disconnected visitor to connect, closing itself first", async () => {
        status = WalletState.Disconnected;
        const user = renderSection();

        const dialog = await openBurnDialog(user);
        expect(within(dialog).getByTestId("burn-connect-prompt")).toHaveTextContent("Connect a wallet to burn PAGE.");

        await user.click(within(dialog).getByRole("button", {name: "Connect wallet"}));
        expect(connect).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("says when the burn happens and that it cannot be undone", async () => {
        nextBurn = {date: inMinutes(5 * 60 + 12.5), coins: [{denom: "ubze", amount: "9"}]};
        const user = renderSection();

        const dialog = await openBurnDialog(user);
        expect(within(dialog).getByTestId("burn-queued")).toHaveTextContent("Queued for the next burn, in 5h 12m. This cannot be undone.");
    });

    it("drops the countdown when no burn date is known", async () => {
        const user = renderSection();

        const dialog = await openBurnDialog(user);
        expect(within(dialog).getByTestId("burn-queued")).toHaveTextContent(/^Queued for the next burn\. This cannot be undone\.$/);
    });

    it("needs a confirmation, then sends exactly one fundBurner with the coin string", async () => {
        const user = renderSection();
        const dialog = await openBurnDialog(user);

        await user.type(within(dialog).getByLabelText("Amount to burn"), "1250");
        await user.click(within(dialog).getByRole("button", {name: "Burn PAGE"}));

        expect(tx).not.toHaveBeenCalled();
        expect(within(dialog).getByTestId("burn-confirm")).toHaveTextContent("You burn1,250 PAGE");

        await user.click(within(dialog).getByRole("button", {name: "Confirm burn"}));

        expect(tx).toHaveBeenCalledTimes(1);
        const msgs = tx.mock.calls[0][0];
        expect(msgs).toHaveLength(1);
        expect(msgs[0].typeUrl).toBe("/bze.burner.MsgFundBurner");
        expect(msgs[0].value).toEqual({creator: ME, amount: `1250000000${T}`});
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(updateBalances).toHaveBeenCalledTimes(1);
        expect(reloadNextBurn).toHaveBeenCalledTimes(1);
    });

    it("goes back to the amount from the confirmation without sending", async () => {
        const user = renderSection();
        const dialog = await openBurnDialog(user);

        await user.type(within(dialog).getByLabelText("Amount to burn"), "10");
        await user.click(within(dialog).getByRole("button", {name: "Burn PAGE"}));
        await user.click(within(dialog).getByRole("button", {name: "Back"}));

        expect(within(dialog).getByLabelText("Amount to burn")).toHaveValue("10");
        expect(tx).not.toHaveBeenCalled();
    });

    it("stays open when the transaction fails", async () => {
        tx.mockResolvedValue(false);
        const user = renderSection();
        const dialog = await openBurnDialog(user);

        await user.type(within(dialog).getByLabelText("Amount to burn"), "10");
        await user.click(within(dialog).getByRole("button", {name: "Burn PAGE"}));
        await user.click(within(dialog).getByRole("button", {name: "Confirm burn"}));

        await waitFor(() => expect(within(dialog).getByRole("button", {name: "Confirm burn"})).toBeEnabled());
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(updateBalances).not.toHaveBeenCalled();
    });

    it("fills Max with the balance minus the fee reserve", async () => {
        const user = renderSection();
        const dialog = await openBurnDialog(user);

        expect(within(dialog).getByText("Balance 2,000 PAGE")).toBeInTheDocument();
        await user.click(within(dialog).getByRole("button", {name: "Max"}));

        expect(within(dialog).getByLabelText("Amount to burn")).toHaveValue("1999.5");
    });

    it("refuses more than the balance", async () => {
        const user = renderSection();
        const dialog = await openBurnDialog(user);

        await user.type(within(dialog).getByLabelText("Amount to burn"), "2001");

        expect(within(dialog).getByRole("alert")).toHaveTextContent("You only have 2,000 PAGE");
        expect(within(dialog).getByRole("button", {name: "Burn PAGE"})).toBeDisabled();
    });

    it("refuses an amount that leaves nothing for the network fee", async () => {
        feeMessage = "Not enough PAGE left for the network fee (≈ 0.5 PAGE)";
        const user = renderSection();
        const dialog = await openBurnDialog(user);

        await user.type(within(dialog).getByLabelText("Amount to burn"), "2000");

        expect(within(dialog).getByRole("alert")).toHaveTextContent("Not enough PAGE left for the network fee");
        expect(within(dialog).getByRole("button", {name: "Burn PAGE"})).toBeDisabled();
    });
});
