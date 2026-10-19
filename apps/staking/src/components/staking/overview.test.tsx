import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { NativeStakingData } from "@bze/bze-ui-kit";

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({ nativeAsset: { denom: "ubze", ticker: "BZE", decimals: 6 } }),
        useAssetPrice: () => ({ price: undefined }),
    };
});

import { StakingOverview } from "./overview";

function coin(amount: string) {
    return { amount: new BigNumber(amount), denom: "ubze" };
}

function stakingData(connected: boolean): NativeStakingData {
    return {
        averageApr: "10",
        unlockDuration: "14",
        totalStaked: coin("100000000"),
        minAmount: coin("0"),
        averageDailyDistribution: coin("1000000"),
        currentStaking: connected
            ? {
                staked: coin("5000000"),
                unbonding: { total: coin("0") },
                pendingRewards: { total: coin("1000") },
            }
            : undefined,
    } as unknown as NativeStakingData;
}

function renderOverview(data: NativeStakingData, { callout, isLoading = false }: { callout?: ReactNode; isLoading?: boolean } = {}) {
    return render(<StakingOverview stakingData={data} isLoading={isLoading} callout={callout} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const follows = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("StakingOverview", () => {
    it("shows the unbonding length on the Your Stake card when connected with a stake", () => {
        renderOverview(stakingData(true));

        expect(screen.getByText("Your Stake")).toBeInTheDocument();
        expect(screen.getByText("Unbonding period: 14 days")).toBeInTheDocument();
        expect(screen.queryByText("Unbonding Period")).not.toBeInTheDocument();
    });

    it("keeps the Unbonding Period card when not connected", () => {
        renderOverview(stakingData(false));

        expect(screen.getByText("Unbonding Period")).toBeInTheDocument();
        expect(screen.getByText("14 days")).toBeInTheDocument();
    });

    it("renders the hero with the APR, then the callout beside it, above the stat cards", () => {
        renderOverview(stakingData(false), { callout: <div data-testid="callout" /> });

        const callout = screen.getByTestId("callout");
        expect(screen.getByText("10% APR")).toBeInTheDocument();
        expect(screen.getByText(/^Stake BZE and earn rewards\./)).toBeInTheDocument();
        expect(follows(screen.getByTestId("home-hero"), callout)).toBe(true);
        expect(follows(callout, screen.getByText("Staking APR"))).toBe(true);
    });

    it("leaves the callout and the numbers out of the loading skeleton", () => {
        renderOverview(stakingData(false), { callout: <div data-testid="callout" />, isLoading: true });

        expect(screen.queryByTestId("callout")).not.toBeInTheDocument();
        expect(screen.getByTestId("home-hero")).toBeInTheDocument();
        expect(screen.getAllByTestId("stat-tile-loading")).toHaveLength(4);
        expect(screen.queryByText("10% APR")).not.toBeInTheDocument();
    });
});
