import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {act, renderHook} from "@testing-library/react";

const ME = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
const FAILING = "factory/bze1failing/ufail";
const WORKING = "factory/bze1working/uwork";

// The provider's start-up reads never answer: these tests only drive the raffle contributions.
const {checkAddressWonRaffle, toast, never} = vi.hoisted(() => ({
    checkAddressWonRaffle: vi.fn(),
    toast: {success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn()},
    never: () => new Promise<never>(() => {}),
}));

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getChainAssets: never,
    getMarkets: never,
    getAllTickers: never,
    getEpochsInfo: never,
    getLiquidityPools: never,
    getNextBurning: never,
    getAllBurnedCoins: never,
    getRaffles: never,
    getAddressBalances: never,
    addDebounce: () => {},
    checkAddressWonRaffle: (address: string, denom: string, height: number) => checkAddressWonRaffle(address, denom, height),
    useToast: () => ({toast}),
}));

vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: ME})}));

import {useAssetsContext} from "@bze/bze-ui-kit";
import {AssetsProvider, type AssetsContextType} from "./assets_context";

const wrapper = ({children}: { children: ReactNode }) => <AssetsProvider>{children}</AssetsProvider>;

beforeEach(() => {
    vi.clearAllMocks();
});

describe("processPendingRaffleContributions", () => {
    it("keeps checking the other contributions when one block can't be read", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        checkAddressWonRaffle.mockImplementation(async (_address: string, denom: string) => {
            if (denom === FAILING) throw new Error("block_results at 102: HTTP 502");
            return {hasWon: false, amount: "0", denom, address: ME};
        });
        const {result} = renderHook(() => useAssetsContext() as AssetsContextType, {wrapper});

        act(() => {
            result.current.addPendingRaffleContribution(FAILING, 100, 2, false);
            result.current.addPendingRaffleContribution(WORKING, 200, 2, false);
        });
        await act(() => result.current.processPendingRaffleContributions());

        expect(checkAddressWonRaffle).toHaveBeenCalledWith(ME, FAILING, 102);
        expect(checkAddressWonRaffle).toHaveBeenCalledWith(ME, WORKING, 202);
        expect(result.current.pendingRaffleContributions.get(WORKING)).toMatchObject({
            currentTicket: 1,
            results: [{hasWon: false, amount: "0", ticketIndex: 0}],
        });
        // The failed one is left as it was, for the next cycle to retry.
        expect(result.current.pendingRaffleContributions.get(FAILING)).toMatchObject({currentTicket: 0, results: []});
        expect(error).toHaveBeenCalled();

        checkAddressWonRaffle.mockImplementation(async (_address: string, denom: string) => ({hasWon: true, amount: "5000000", denom, address: ME}));
        await act(() => result.current.processPendingRaffleContributions());
        expect(result.current.pendingRaffleContributions.get(FAILING)).toMatchObject({
            currentTicket: 1,
            results: [{hasWon: true, amount: "5000000", ticketIndex: 0}],
        });
    });
});
