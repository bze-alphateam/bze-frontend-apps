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
const OTHER_WALLET = "bze1other00000000000000000000000000000000zz";

// Every chain read and hook the raffle uses is mocked; the values below are per test.
const getRaffles = vi.fn();
const getRaffleWinners = vi.fn();
const checkAddressWonRaffle = vi.fn();
const tx = vi.fn();
const updateBalances = vi.fn();
const connect = vi.fn();
const toast = {success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn()};
const reloadNextBurn = vi.fn();
let status: WalletState;
let wallet: string;

// The shared chain feed: NewBlock handlers and status listeners the test drives.
const blockHandlers = new Set<(result: unknown) => void>();
const statusListeners = new Set<(status: string) => void>();
let feedStatus: string;
let spendable: BigNumber;
let feeMessage: string;

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getRaffles: () => getRaffles(),
    getRaffleWinners: (denom: string) => getRaffleWinners(denom),
    checkAddressWonRaffle: (address: string, denom: string, height: number) => checkAddressWonRaffle(address, denom, height),
    getSettings: () => ({endpoints: {rpcEndpoint: "wss://rpc.e2e.test"}}),
    getChainFeed: () => ({
        subscribe: (query: string, handler: (result: unknown) => void) => {
            if (query === "tm.event='NewBlock'") blockHandlers.add(handler);
            return () => blockHandlers.delete(handler);
        },
        onStatus: (listener: (status: string) => void) => {
            statusListeners.add(listener);
            listener(feedStatus);
            return () => statusListeners.delete(listener);
        },
    }),
    useAsset: () => ({asset: ASSET, isLoading: false}),
    useAssetsContext: () => ({updateBalances}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useToast: () => ({toast}),
    useEpochs: () => ({hourEpochInfo: {current_epoch: 950n}}),
    useMaxSpendable: () => ({amount: spendable, balance: spendable.plus(500_000), inputValue: "", isLoading: false}),
    useCanAffordTx: () => ({canAfford: feeMessage === "", message: feeMessage, isLoading: false}),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status, address: status === WalletState.Connected ? wallet : undefined, connect}),
}));

vi.mock("@/hooks/useNextBurning", () => ({useNextBurning: () => ({reload: reloadNextBurn})}));

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
    const view = render(<BurnRaffle asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });
    return Object.assign(user, {view});
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

/** Lets the result poll run once (the fallback while the chain feed is down). */
const nextPoll = () => act(() => vi.advanceTimersByTimeAsync(RAFFLE_POLL_MS));

/** The chain feed starts reporting events. */
const goLive = () => act(() => {
    feedStatus = "live";
    statusListeners.forEach((listener) => listener("live"));
});

/** A NewBlock notification at `height`, as CometBFT sends it, then lets the checks it starts finish. */
const newBlock = (height: number) => act(async () => {
    const result = {query: "tm.event='NewBlock'", data: {type: "tendermint/event/NewBlock", value: {block: {header: {height: String(height)}}}}};
    blockHandlers.forEach((handler) => handler(result));
    await vi.advanceTimersByTimeAsync(0);
});

/** Answers the draw of each block in `draws` (true = won 2 PAGE); other blocks aren't processed yet. */
const draws = (results: Record<number, boolean>) =>
    checkAddressWonRaffle.mockImplementation(async (_address: string, _denom: string, height: number) =>
        (height in results ? {hasWon: results[height], amount: results[height] ? "2000000" : "0"} : undefined));

const stripStatus = (n: number) => within(screen.getByTestId(`raffle-strip-ticket-${n}`)).getByTestId("raffle-strip-status");

async function buyAndClose(user: ReturnType<typeof renderRaffle>, tickets: string) {
    const dialog = await buy(user, tickets);
    await user.click(within(dialog).getByRole("button", {name: "Done"}));
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({shouldAdvanceTime: true});
    localStorage.clear();
    blockHandlers.clear();
    statusListeners.clear();
    feedStatus = "down";
    status = WalletState.Connected;
    wallet = ME;
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
    vi.restoreAllMocks();
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
    describe("your tickets", () => {
        it("counts the strip down block by block from the chain feed, the drawing ticket pulsing", async () => {
            const user = renderRaffle();
            await goLive();
            await buyAndClose(user, "3");

            // Joined in block 100: ticket 1 is drawn in 102.
            expect(screen.getByTestId("raffle-tickets-progress")).toHaveTextContent("0 of 3 drawn");
            expect(stripStatus(1)).toHaveTextContent("in 1 block");
            expect(stripStatus(2)).toHaveTextContent("in 2 blocks");
            expect(stripStatus(3)).toHaveTextContent("in 3 blocks");

            await newBlock(101);
            expect(stripStatus(1)).toHaveTextContent("Drawing…");
            expect(screen.getByTestId("raffle-strip-ticket-1")).toHaveClass("ts-raffle-drawing");
            expect(stripStatus(2)).toHaveTextContent("in 1 block");
            expect(screen.getByTestId("raffle-strip-ticket-2")).not.toHaveClass("ts-raffle-drawing");

            draws({102: false});
            await newBlock(102);
            expect(screen.queryByTestId("raffle-strip-ticket-1")).not.toBeInTheDocument();
            expect(screen.getByTestId("raffle-drawn-ticket-1")).toHaveTextContent("#1 No win");
            // A result that lands while the page is open flashes once.
            expect(screen.getByTestId("raffle-drawn-ticket-1")).toHaveClass("ts-raffle-flash-lost");
            expect(stripStatus(2)).toHaveTextContent("Drawing…");
            expect(screen.getByTestId("raffle-tickets-progress")).toHaveTextContent("1 of 3 drawn");
            expect(screen.getByTestId("raffle-tickets-summary")).toHaveTextContent("No win yet");
        });

        it("checks on new blocks, not on the timer, while the feed is live", async () => {
            const user = renderRaffle();
            await goLive();
            await buyAndClose(user, "2");

            await nextPoll();
            await nextPoll();
            expect(checkAddressWonRaffle).not.toHaveBeenCalled();

            await newBlock(101);
            expect(checkAddressWonRaffle).toHaveBeenCalledWith(ME, T, 102);
        });

        it("shows the next five tickets and how many more wait", async () => {
            const user = renderRaffle();
            await buyAndClose(user, "8");

            expect(within(screen.getByTestId("raffle-strip")).getAllByTestId("raffle-strip-status")).toHaveLength(5);
            expect(screen.getByTestId("raffle-strip-more")).toHaveTextContent("+3 more");
            expect(screen.getByTestId("raffle-tickets-progress")).toHaveTextContent("0 of 8 drawn");
        });

        it("picks the draw up from storage after a reload", async () => {
            const user = renderRaffle();
            await buyAndClose(user, "2");
            user.view.unmount();

            renderRaffle();
            expect(await screen.findByTestId("raffle-tickets-progress")).toHaveTextContent("0 of 2 drawn");
            expect(stripStatus(1)).toHaveTextContent("in 1 block");

            draws({102: true, 103: false});
            await nextPoll();
            expect(checkAddressWonRaffle).toHaveBeenCalledWith(ME, T, 102);
            expect(screen.getByTestId("raffle-drawn-ticket-1")).toHaveTextContent("#1 Won 2 PAGE");
            expect(screen.getByTestId("raffle-drawn-ticket-2")).toHaveTextContent("#2 No win");
            expect(screen.getByTestId("raffle-tickets-summary")).toHaveTextContent("1 ticket won · 2 PAGE");
            // Nobody watches a restored join: the final toast still comes.
            expect(toast.info).toHaveBeenCalledWith("PAGE raffle: all 2 tickets drawn", "1 won, 2 PAGE in total.");
        });

        it("doesn't flash or toast again results restored from storage", async () => {
            const user = renderRaffle();
            await buyAndClose(user, "1");
            draws({102: true});
            await nextPoll();
            expect(toast.info).toHaveBeenCalledTimes(1);
            user.view.unmount();

            renderRaffle();
            await nextPoll();
            expect(await screen.findByTestId("raffle-drawn-ticket-1")).not.toHaveClass("ts-raffle-flash-won");
            expect(toast.info).toHaveBeenCalledTimes(1);
            expect(toast.success).toHaveBeenCalledTimes(1);
        });

        it("keeps drawn results for an hour, then drops them from the page and storage", async () => {
            const user = renderRaffle();
            await buyAndClose(user, "1");
            draws({102: false});
            await nextPoll();
            expect(screen.getByTestId("raffle-tickets-summary")).toHaveTextContent("No winning ticket this time");
            expect(screen.queryByTestId("raffle-strip")).not.toBeInTheDocument();

            await act(() => vi.advanceTimersByTimeAsync(55 * 60_000));
            expect(screen.getByTestId("raffle-drawn-ticket-1")).toBeInTheDocument();

            await act(() => vi.advanceTimersByTimeAsync(6 * 60_000));
            expect(screen.queryByTestId("raffle-tickets")).not.toBeInTheDocument();
            const stored = Object.keys(localStorage).filter((key) => key.includes("communities:raffle:"));
            expect(stored.map((key) => JSON.parse(localStorage.getItem(key)!).data)).toEqual(["[]"]);
        });

        it("shows only the connected wallet's tickets", async () => {
            const user = renderRaffle();
            await buyAndClose(user, "2");
            expect(screen.getByTestId("raffle-tickets")).toBeInTheDocument();

            wallet = OTHER_WALLET;
            user.view.rerender(<BurnRaffle asset={ASSET}/>);
            expect(screen.queryByTestId("raffle-tickets")).not.toBeInTheDocument();
            // Its draw isn't checked for the other wallet either.
            await nextPoll();
            expect(checkAddressWonRaffle).not.toHaveBeenCalled();

            status = WalletState.Disconnected;
            user.view.rerender(<BurnRaffle asset={ASSET}/>);
            expect(screen.queryByTestId("raffle-tickets")).not.toBeInTheDocument();

            status = WalletState.Connected;
            wallet = ME;
            user.view.rerender(<BurnRaffle asset={ASSET}/>);
            expect(screen.getByTestId("raffle-tickets-progress")).toHaveTextContent("0 of 2 drawn");
        });

        it("works without browser storage", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
                throw new Error("storage disabled");
            });
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("storage disabled");
            });
            const user = renderRaffle();
            await buyAndClose(user, "2");
            expect(screen.getByTestId("raffle-tickets-progress")).toHaveTextContent("0 of 2 drawn");

            draws({102: false, 103: true});
            await nextPoll();
            expect(screen.getByTestId("raffle-tickets-progress")).toHaveTextContent("2 of 2 drawn");
            expect(screen.getByTestId("raffle-tickets-summary")).toHaveTextContent("1 ticket won · 2 PAGE");
        });

        it("reads the raffle and the next burn again right away on a win", async () => {
            const user = renderRaffle();
            await buyAndClose(user, "2");
            const loads = getRaffles.mock.calls.length;

            draws({102: false});
            await nextPoll();
            expect(reloadNextBurn).not.toHaveBeenCalled();

            // The draw's new pot and winner show without waiting for another poll.
            getRaffles.mockResolvedValue([OTHER, {...RAFFLE, pot: "46300000000", winners: 8n}]);
            draws({102: false, 103: true});
            await nextPoll();
            expect(reloadNextBurn).toHaveBeenCalledTimes(1);
            expect(getRaffles.mock.calls.length).toBeGreaterThan(loads + 1);
            await waitFor(() => expect(screen.getByTestId("raffle-pot")).toHaveTextContent("46,300 PAGE"));
            expect(getRaffleWinners).toHaveBeenLastCalledWith(T);
        });
    });
});
