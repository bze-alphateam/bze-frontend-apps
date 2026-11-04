import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {act, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {RaffleSDKType} from "@bze/bzejs/bze/burner/raffle";
import {type Asset, DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import NEW_BLOCK from "./__fixtures__/new-block.json";
import BLOCK_RESULTS from "./__fixtures__/raffle-block-results.json";

// The raffle against what the chain really sends: a NewBlock notification recorded from the
// testnet WebSocket and the block_results of real draws (trimmed). Only the network and the
// wallet are faked; the ticket checks read block_results through the real query layer.

const T = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/uctr";
const ME = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
/** The real join: 10 tickets included at 4,084,165, drawn (all lost) in 4,084,167…4,084,176. */
const JOIN_HEIGHT = 4_084_165;
/** A real single-ticket join at 4,083,543 whose ticket won 91.84 in block 4,083,545. */
const WIN_JOIN_HEIGHT = 4_083_543;

const tx = vi.fn();
const toast = {success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn()};
const blockHandlers = new Set<(result: unknown) => void>();
const statusListeners = new Set<(status: string) => void>();
let feedStatus: string;

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getRafflesOrThrow: async () => [RAFFLE],
    getRaffleWinners: async () => [],
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
    useAssetsContext: () => ({updateBalances: vi.fn()}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useToast: () => ({toast}),
    useEpochs: () => ({hourEpochInfo: {current_epoch: 950n}}),
    useMaxSpendable: () => ({amount: new BigNumber("1000000000"), balance: new BigNumber("1000000000"), inputValue: "", isLoading: false}),
    useCanAffordTx: () => ({canAfford: true, message: "", isLoading: false}),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status: "Connected", address: ME, connect: vi.fn()}),
}));

vi.mock("@/hooks/useNextBurning", () => ({useNextBurning: () => ({reload: vi.fn()})}));

import {TokenSiteTheme} from "../kit";
import {RAFFLE_POLL_MS} from "@/hooks/token-site/useTokenRaffle";
import {BurnRaffle} from "./index";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Cointrunk", ticker: "CTR", logo: "", stable: false, verified: false,
    supply: 1_000_000_000_000n,
};

const RAFFLE: RaffleSDKType = {
    pot: "183680000", duration: 720n, chances: 100_000n, ratio: "0.5", end_at: 1000n, winners: 1n,
    ticket_price: "1000000", denom: T, total_won: "91840000",
};

/** The chain's head as the fake RPC sees it: block_results of later blocks answer like CometBFT does. */
let head: number;

/** block_results from the recorded fixtures; a block past the head is the node's 500. */
function stubRpc() {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const height = Number(/block_results\?height=(\d+)/.exec(url)?.[1]);
        if (!Number.isFinite(height)) throw new Error(`unexpected request ${url}`);

        if (height > head) {
            return new Response(JSON.stringify({
                jsonrpc: "2.0", id: -1,
                error: {code: -32603, message: "Internal error", data: `height ${height} must be less than or equal to the current blockchain height ${head}`},
            }), {status: 500});
        }
        const recorded = (BLOCK_RESULTS as Record<string, unknown>)[String(height)];
        if (!recorded) throw new Error(`no block_results fixture for ${height}`);

        return new Response(JSON.stringify(recorded), {status: 200});
    });
}

/** The recorded NewBlock notification, as the feed hands it over, moved to `height`. */
function newBlockAt(height: number): unknown {
    const recorded = structuredClone(NEW_BLOCK);
    recorded.data.value.block.header.height = String(height);
    return recorded;
}

/** The chain reaches `height`: the node processed it and the feed reports it. */
const newBlock = (height: number) => act(async () => {
    head = height;
    blockHandlers.forEach((handler) => handler(newBlockAt(height)));
    await vi.advanceTimersByTimeAsync(0);
});

/** The chain reaches `height` without the feed saying so. */
const chainAt = (height: number) => {
    head = height;
};

const goLive = () => act(() => {
    feedStatus = "live";
    statusListeners.forEach((listener) => listener("live"));
});

function renderRaffle() {
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
    render(<BurnRaffle asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });
    return user;
}

async function buyAndClose(user: ReturnType<typeof userEvent.setup>, tickets: string) {
    await user.click(await screen.findByRole("button", {name: "Buy tickets"}));
    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByLabelText("Tickets");
    await user.clear(field);
    await user.type(field, tickets);
    await user.click(within(dialog).getByRole("button", {name: /^Buy /}));
    await user.click(within(dialog).getByRole("button", {name: "Done"}));
}

const progress = () => screen.getByTestId("raffle-tickets-progress");
const drawing = () => document.querySelectorAll(".ts-raffle-drawing");

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({shouldAdvanceTime: true});
    localStorage.clear();
    blockHandlers.clear();
    statusListeners.clear();
    feedStatus = "down";
    head = JOIN_HEIGHT + 1;
    tx.mockImplementation(async (_msgs: unknown, options?: { onSuccess?: (res: { height: number }) => void }) => {
        options?.onSuccess?.({height: JOIN_HEIGHT});
        return true;
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("BurnRaffle against recorded chain data", () => {
    it("draws the strip down as real NewBlock notifications arrive", async () => {
        stubRpc();
        const user = renderRaffle();
        await goLive();
        await buyAndClose(user, "10");

        expect(progress()).toHaveTextContent("0 of 10 drawn");
        expect(screen.getByTestId("raffle-strip-more")).toHaveTextContent("+5 more");

        await newBlock(JOIN_HEIGHT + 2);
        expect(progress()).toHaveTextContent("1 of 10 drawn");
        expect(screen.getByTestId("raffle-drawn-ticket-1")).toHaveTextContent("#1 No win");
        expect(drawing()).toHaveLength(1);

        for (let height = JOIN_HEIGHT + 3; height <= JOIN_HEIGHT + 11; height++) await newBlock(height);
        expect(progress()).toHaveTextContent("10 of 10 drawn");
        expect(screen.queryByTestId("raffle-strip")).not.toBeInTheDocument();
        expect(screen.getByTestId("raffle-tickets-summary")).toHaveTextContent("No winning ticket this time");
    });

    it("reads a real win from block_results", async () => {
        stubRpc();
        tx.mockImplementation(async (_msgs: unknown, options?: { onSuccess?: (res: { height: number }) => void }) => {
            options?.onSuccess?.({height: WIN_JOIN_HEIGHT});
            return true;
        });
        head = WIN_JOIN_HEIGHT + 1;
        const user = renderRaffle();
        await goLive();
        await buyAndClose(user, "1");

        await newBlock(WIN_JOIN_HEIGHT + 2);
        expect(screen.getByTestId("raffle-drawn-ticket-1")).toHaveTextContent("#1 Won 91.84 CTR");
    });

    it("keeps drawing on the timer while the feed says live but no block arrives", async () => {
        stubRpc();
        const user = renderRaffle();
        await goLive();
        await buyAndClose(user, "10");

        chainAt(JOIN_HEIGHT + 4);
        await act(() => vi.advanceTimersByTimeAsync(RAFFLE_POLL_MS * 3));
        expect(progress()).toHaveTextContent("3 of 10 drawn");
    });

    it("moves the strip on from the results while no block height arrived yet", async () => {
        stubRpc();
        const user = renderRaffle();
        await buyAndClose(user, "10");

        chainAt(JOIN_HEIGHT + 3);
        await act(() => vi.advanceTimersByTimeAsync(RAFFLE_POLL_MS));
        expect(progress()).toHaveTextContent("2 of 10 drawn");
        // Ticket 3 is drawn in the next block: it is the one drawing, and only it pulses.
        expect(within(screen.getByTestId("raffle-strip-ticket-3")).getByTestId("raffle-strip-status")).toHaveTextContent("Drawing…");
        expect(drawing()).toHaveLength(1);
    });

    it("tracks no join whose inclusion height is unknown, so no ticket waits on blocks long gone", async () => {
        const rpc = stubRpc();
        tx.mockImplementation(async (_msgs: unknown, options?: { onSuccess?: (res: { height: number }) => void }) => {
            options?.onSuccess?.({height: 0});
            return true;
        });
        const user = renderRaffle();
        await user.click(await screen.findByRole("button", {name: "Buy tickets"}));
        const dialog = screen.getByRole("dialog");
        await user.click(within(dialog).getByRole("button", {name: /^Buy /}));

        await act(() => vi.advanceTimersByTimeAsync(RAFFLE_POLL_MS * 2));
        expect(screen.queryByTestId("raffle-tickets")).not.toBeInTheDocument();
        expect(rpc).not.toHaveBeenCalled();
    });
});
