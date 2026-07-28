import {describe, it, expect, vi, beforeEach} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {Asset} from "@bze/bze-ui-kit";

// The directory page only reads assetsMap + isLoading off the context, so we
// mock the typed wrapper hook and drive those two fields directly.
const useCommunitiesContext = vi.fn();
vi.mock("@/hooks/useCommunitiesContext", () => ({
    useCommunitiesContext: () => useCommunitiesContext(),
}));

import Home from "./page";

function makeAsset(ticker: string, denom: string): Asset {
    return {
        type: "factory",
        denom,
        decimals: 6,
        name: `${ticker} Token`,
        ticker,
        logo: "",
        stable: false,
        verified: false,
        supply: 1_000_000n,
    };
}

function factoryAssets(count: number): Map<string, Asset> {
    const map = new Map<string, Asset>();
    for (let i = 0; i < count; i++) {
        // Zero-padded so ticker sort order matches creation order (TKN000, TKN001…).
        const ticker = `TKN${String(i).padStart(3, "0")}`;
        const denom = `factory/bze1owner/u${ticker.toLowerCase()}`;
        map.set(denom, makeAsset(ticker, denom));
    }
    return map;
}

function renderHome() {
    return render(<Home/>, {
        wrapper: ({children}: {children: ReactNode}) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    useCommunitiesContext.mockReset();
});

describe("Communities token directory page", () => {
    it("shows the directory heading while loading, without empty or list content", () => {
        useCommunitiesContext.mockReturnValue({assetsMap: new Map(), isLoading: true});
        renderHome();

        expect(screen.getByText("Token directory")).toBeInTheDocument();
        expect(screen.queryByText("No tokens yet")).not.toBeInTheDocument();
    });

    it("shows the empty state when there are no factory tokens", () => {
        // A non-factory denom must still be filtered out, leaving an empty list.
        const map = new Map<string, Asset>([["ubze", makeAsset("BZE", "ubze")]]);
        useCommunitiesContext.mockReturnValue({assetsMap: map, isLoading: false});
        renderHome();

        expect(screen.getByText("No tokens yet")).toBeInTheDocument();
    });

    it("renders a card per factory token and hides pagination for a single page", () => {
        useCommunitiesContext.mockReturnValue({assetsMap: factoryAssets(3), isLoading: false});
        renderHome();

        expect(screen.getByText("TKN000")).toBeInTheDocument();
        expect(screen.getByText("TKN002")).toBeInTheDocument();
        expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
    });

    it("paginates at 20 per page and advances on Next", async () => {
        const user = userEvent.setup();
        useCommunitiesContext.mockReturnValue({assetsMap: factoryAssets(25), isLoading: false});
        renderHome();

        // Page 1: first 20 tokens, last 5 not yet shown.
        expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
        expect(screen.getByText("TKN000")).toBeInTheDocument();
        expect(screen.queryByText("TKN024")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", {name: /Next/}));

        // Page 2: the remaining tokens appear, page-1 tokens are gone.
        expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
        expect(screen.getByText("TKN024")).toBeInTheDocument();
        expect(screen.queryByText("TKN000")).not.toBeInTheDocument();
    });

    it("links each card to the token page with the denom URL-encoded", () => {
        useCommunitiesContext.mockReturnValue({assetsMap: factoryAssets(1), isLoading: false});
        renderHome();

        const link = screen.getByRole("link", {name: /TKN000/});
        expect(link).toHaveAttribute("href", "/token?denom=factory%2Fbze1owner%2Futkn000");
    });
});
