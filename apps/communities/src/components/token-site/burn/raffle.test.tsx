import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {act, render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type {RaffleSDKType, RaffleWinnerSDKType} from "@bze/bzejs/bze/burner/raffle";
import {type Asset, DEFAULT_DENOM_BRANDING, truncateAddress} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

// Every chain read and hook the raffle uses is mocked; the values below are per test.
const getRaffles = vi.fn();
const getRaffleWinners = vi.fn();
const checkAddressWonRaffle = vi.fn();
const tx = vi.fn();
const updateBalances = vi.fn();
const connect = vi.fn();
const toast = {success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn()};
let status: WalletState;
let spendable: BigNumber;
let feeMessage: string;

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getRaffles: () => getRaffles(),
    getRaffleWinners: (denom: string) => getRaffleWinners(denom),
    checkAddressWonRaffle: (address: string, denom: string, height: number) => checkAddressWonRaffle(address, denom, height),
    useAsset: () => ({asset: ASSET, isLoading: false}),
    useAssetsContext: () => ({updateBalances}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useToast: () => ({toast}),
    useEpochs: () => ({hourEpochInfo: {current_epoch: 950n}}),
    useMaxSpendable: () => ({amount: spendable, balance: spendable.plus(500_000), inputValue: "", isLoading: false}),
    useCanAffordTx: () => ({canAfford: feeMessage === "", message: feeMessage, isLoading: false}),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status, address: status === WalletState.Connected ? ME : undefined, connect}),
}));

import {TokenSiteTheme} from "../kit";
import {RAFFLE_POLL_MS} from "@/hooks/token-site/useTokenRaffle";
import {BurnRaffle} from "./index";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false,
    supply: 97_659_888_000_000n,
};

// 100 PAGE tickets, 1 in 20 to win half of a 48,300 PAGE pot, ending at hour 1,000 (now 950).
const RAFFLE: RaffleSDKType = {
    pot: "48300000000", duration: 720n, chances: 50_000n, ratio: "0.5", end_at: 1000n, winners: 7n,
    ticket_price: "100000000", denom: T, total_won: "90000000000",
};
const OTHER: RaffleSDKType = {...RAFFLE, denom: "factory/bze1other/uother"};
const winner = (index: string, address: string, amount: string): RaffleWinnerSDKType => ({index, denom: T, amount, winner: address});
const WINNERS = [
    winner("1", "bze1first0000000000000000000000000000000aaaa", "1000000"),
    winner("5", "bze1fifth0000000000000000000000000000000eeee", "5000000"),
    winner("6", "bze1sixth0000000000000000000000000000000ffff", "6000000"),
    winner("7", "bze1seventh000000000000000000000000000000ggg", "24150000000"),
];

function renderRaffle() {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    render(<BurnRaffle asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });
    return user;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", {name: "Buy tickets"}));
    return screen.getByRole("dialog");
}

async function buy(user: ReturnType<typeof userEvent.setup>, tickets: string) {
    const dialog = await openDialog(user);
    const field = within(dialog).getByLabelText("Tickets");
    await user.clear(field);
    await user.type(field, tickets);
    await user.click(within(dialog).getByRole("button", {name: /^Buy /}));
    return dialog;
}

/** Lets the result poll run once. */
const nextPoll = () => act(() => vi.advanceTimersByTimeAsync(RAFFLE_POLL_MS));

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({shouldAdvanceTime: true});
    status = WalletState.Connected;
    spendable = new BigNumber("1000000000"); // 1,000 PAGE after the fee reserve
    feeMessage = "";
    getRaffles.mockResolvedValue([OTHER, RAFFLE]);
    getRaffleWinners.mockResolvedValue(WINNERS);
    checkAddressWonRaffle.mockResolvedValue(undefined);
    // The join is included at block 100, so its tickets are drawn from block 102 on.
    tx.mockImplementation(async (_msgs: unknown, options?: { onSuccess?: (res: { height: number }) => void }) => {
        options?.onSuccess?.({height: 100});
        return true;
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("BurnRaffle", () => {
    it("renders nothing when the burner runs no raffle for the token", async () => {
        getRaffles.mockResolvedValue([OTHER]);
        const {container} = render(<BurnRaffle asset={ASSET}/>, {
            wrapper: ({children}: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
        });

        await waitFor(() => expect(getRaffles).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
        expect(getRaffleWinners).not.toHaveBeenCalled();
    });

    it("shows the raffle's ticket price, pot, odds, prize and end", async () => {
        renderRaffle();

        const card = await screen.findByTestId("raffle-card");
        expect(within(card).getByRole("heading", {name: "Burn raffle"})).toBeInTheDocument();
        expect(within(card).getByText("Live")).toBeInTheDocument();
        expect(screen.getByTestId("raffle-copy")).toHaveTextContent("Each ticket has a 1 in 20 chance to win 50% of the pot.");
        expect(screen.getByTestId("raffle-ticket")).toHaveTextContent("100 PAGE");
        expect(screen.getByTestId("raffle-pot")).toHaveTextContent("48,300 PAGE");
        expect(screen.getByTestId("raffle-odds")).toHaveTextContent("1 in 20");
        expect(screen.getByTestId("raffle-prize")).toHaveTextContent("24,150 PAGE");
        // 50 hours left.
        expect(screen.getByTestId("raffle-ends")).toHaveTextContent("2d 2h");
    });

    it("lists the newest winners first with shortened addresses", async () => {
        renderRaffle();

        const items = within(await screen.findByTestId("raffle-winners")).getAllByRole("listitem");
        expect(getRaffleWinners).toHaveBeenCalledWith(T);
        expect(items.map((item) => item.textContent)).toEqual([
            `${truncateAddress(WINNERS[3].winner)}24,150 PAGE`,
            `${truncateAddress(WINNERS[2].winner)}6 PAGE`,
            `${truncateAddress(WINNERS[1].winner)}5 PAGE`,
        ]);
        // Winner 4 left the chain's list; the list stops at the 5 newest slots (7…3).
        expect(items).toHaveLength(3);
    });

    it("asks to connect a wallet before buying", async () => {
        status = WalletState.Disconnected;
        const user = renderRaffle();

        const dialog = await openDialog(user);
        await user.click(within(dialog).getByRole("button", {name: "Connect wallet"}));
        expect(connect).toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("sends one joinRaffle message with the ticket count", async () => {
        const user = renderRaffle();

        const dialog = await openDialog(user);
        const field = within(dialog).getByLabelText("Tickets");
        await user.clear(field);
        await user.type(field, "3");
        expect(within(dialog).getByText("300 PAGE")).toBeInTheDocument();
        await user.click(within(dialog).getByRole("button", {name: "Buy 3 tickets"}));

        expect(tx).toHaveBeenCalledTimes(1);
        const [msgs] = tx.mock.calls[0];
        expect(msgs).toHaveLength(1);
        expect(msgs[0].typeUrl).toBe("/bze.burner.MsgJoinRaffle");
        expect(msgs[0].value).toEqual({creator: ME, denom: T, tickets: 3n});
        expect(updateBalances).toHaveBeenCalled();
    });

    it("blocks buying more tickets than the balance minus the fee reserve covers", async () => {
        const user = renderRaffle();

        const dialog = await openDialog(user);
        const field = within(dialog).getByLabelText("Tickets");
        await user.clear(field);
        await user.type(field, "11");

        expect(within(dialog).getByRole("alert")).toHaveTextContent("Not enough PAGE for 11 tickets");
        expect(within(dialog).getByRole("button", {name: "Buy 11 tickets"})).toBeDisabled();

        await user.clear(field);
        expect(within(dialog).getByRole("alert")).toHaveTextContent("Buy at least 1 ticket");
        expect(tx).not.toHaveBeenCalled();
    });

    it("blocks the join when the network fee can't be paid", async () => {
        feeMessage = "Not enough BZE for the network fee";
        const user = renderRaffle();

        const dialog = await openDialog(user);
        expect(within(dialog).getByRole("alert")).toHaveTextContent("Not enough BZE for the network fee");
        expect(within(dialog).getByRole("button", {name: "Buy a ticket"})).toBeDisabled();
    });

    it("resolves each ticket as its block is processed, retrying blocks not processed yet", async () => {
        const user = renderRaffle();
        const dialog = await buy(user, "3");

        const ticket = (n: number) => within(dialog).getByTestId(`raffle-ticket-${n}`);
        expect(ticket(1)).toHaveTextContent("Drawing…");
        expect(within(dialog).getByTestId("raffle-results-summary")).toHaveTextContent("Drawing your 3 tickets");

        // Block 102 is processed: ticket 1 lost; 103 not yet.
        checkAddressWonRaffle.mockImplementation(async (_address: string, _denom: string, height: number) =>
            (height === 102 ? {hasWon: false, amount: "0"} : undefined));
        await nextPoll();
        expect(ticket(1)).toHaveTextContent("No win");
        expect(ticket(2)).toHaveTextContent("Drawing…");

        checkAddressWonRaffle.mockImplementation(async (_address: string, _denom: string, height: number) => {
            if (height === 103) return {hasWon: true, amount: "24150000000"};
            if (height === 104) return {hasWon: false, amount: "0"};
            return undefined;
        });
        await nextPoll();
        expect(ticket(2)).toHaveTextContent("Won 24,150 PAGE");
        expect(ticket(3)).toHaveTextContent("No win");
        expect(within(dialog).getByTestId("raffle-results-summary")).toHaveTextContent("1 of 3 won · 24,150 PAGE");

        const checked = checkAddressWonRaffle.mock.calls.map(([address, denom, height]) => [address, denom, height]);
        expect(checked).toContainEqual([ME, T, 102]);
        expect(checked).toContainEqual([ME, T, 104]);
        expect(checked.filter(([, , height]) => height === 102)).toHaveLength(1);
        // Watched results need no toast.
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.info).not.toHaveBeenCalled();

        // Everything is drawn: no more checks.
        checkAddressWonRaffle.mockClear();
        await nextPoll();
        expect(checkAddressWonRaffle).not.toHaveBeenCalled();
    });

    it("reports results as toasts once the dialog is closed", async () => {
        const user = renderRaffle();
        const dialog = await buy(user, "2");

        await user.click(within(dialog).getByRole("button", {name: "Done"}));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        checkAddressWonRaffle.mockImplementation(async (_address: string, _denom: string, height: number) =>
            (height === 102 ? {hasWon: true, amount: "2000000"} : {hasWon: false, amount: "0"}));
        await nextPoll();

        expect(toast.success).toHaveBeenCalledWith("PAGE raffle: ticket 1 won", "You won 2 PAGE.");
        expect(toast.info).toHaveBeenCalledWith("PAGE raffle: all 2 tickets drawn", "1 won, 2 PAGE in total.");
    });

    it("goes back to the form for more tickets", async () => {
        const user = renderRaffle();
        const dialog = await buy(user, "1");

        await user.click(within(dialog).getByRole("button", {name: "Buy more tickets"}));
        expect(within(screen.getByRole("dialog")).getByTestId("raffle-form")).toBeInTheDocument();
    });

    it("stays on the form when the transaction fails", async () => {
        tx.mockResolvedValue(false);
        const user = renderRaffle();
        const dialog = await buy(user, "1");

        expect(within(dialog).getByTestId("raffle-form")).toBeInTheDocument();
        expect(within(dialog).queryByTestId("raffle-results")).not.toBeInTheDocument();
    });
});
