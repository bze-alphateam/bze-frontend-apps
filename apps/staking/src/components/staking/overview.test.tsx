import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { NativeStakingData } from "@bze/bze-ui-kit";

// The overview with the asset hooks mocked: where the callout slot sits.
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useAssets: () => ({ nativeAsset: { denom: "ubze", decimals: 6, ticker: "BZE" } }),
    useAssetPrice: () => ({ price: undefined }),
}));

import { StakingOverview } from "./overview";

const balance = (amount: string) => ({ denom: "ubze", amount });
const DATA = {
    averageApr: "10",
    unlockDuration: "14",
    totalStaked: balance("1000000000000"),
    minAmount: balance("1"),
    averageDailyDistribution: balance("1000000000"),
} as unknown as NativeStakingData;

const renderOverview = (callout?: React.ReactNode, isLoading = false) =>
    render(<ChakraProvider value={defaultSystem}><StakingOverview stakingData={DATA} isLoading={isLoading} callout={callout} /></ChakraProvider>);

const follows = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("StakingOverview", () => {
    it("renders the callout under the header and above the stat cards", () => {
        renderOverview(<div data-testid="callout" />);

        const callout = screen.getByTestId("callout");
        expect(follows(screen.getByText("BZE Staking"), callout)).toBe(true);
        expect(follows(callout, screen.getByText("Staking APR"))).toBe(true);
    });

    it("renders as before without a callout", () => {
        renderOverview();

        expect(screen.getByText("BZE Staking")).toBeInTheDocument();
        expect(screen.getByText("Staking APR")).toBeInTheDocument();
    });

    it("leaves the callout out of the loading skeleton", () => {
        renderOverview(<div data-testid="callout" />, true);

        expect(screen.queryByTestId("callout")).not.toBeInTheDocument();
    });
});
