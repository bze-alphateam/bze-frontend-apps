import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { getExplorerBaseURL, type Asset } from "@bze/bze-ui-kit";

// The assets page reads the asset list, each row's price and the toast helper from
// ui-kit. Those hooks are fed directly; the explorer link helpers stay real.
const { useAssetsMock } = vi.hoisted(() => ({ useAssetsMock: vi.fn() }));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => useAssetsMock(),
        useAssetPrice: () => ({ price: 1, change: 0, isLoading: false }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
    };
});

vi.mock("@/hooks/useNavigation", () => ({
    assetPagePath: (denom: string) => `/assets/details?denom=${denom}`,
}));

// The expanded details pull markets, pools and supply; here they only mark the row as open.
vi.mock("@/components/ui/assets/asset-details", () => ({ AssetDetails: () => <div>asset details</div> }));

import AssetsPage from "./page";

const BZE: Asset = {
    type: "Native",
    denom: "ubze",
    decimals: 6,
    name: "BeeZee",
    ticker: "BZE",
    logo: "",
    stable: false,
    verified: true,
    supply: BigInt(1000),
};

const HONEY: Asset = { ...BZE, type: "Factory", denom: "factory/bze1abc/uhoney", name: "Honey", ticker: "HONEY", verified: false };

const USDC: Asset = {
    ...BZE,
    type: "IBC",
    denom: "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4",
    name: "USDC",
    ticker: "USDC",
};

// The explorer links open in a new tab; jsdom can't navigate, so the click's default is dropped.
const preventNavigation = (e: MouseEvent) => e.preventDefault();

function renderPage() {
    return render(<AssetsPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

describe("assets page — explorer links", () => {
    beforeEach(() => {
        useAssetsMock.mockReturnValue({ isLoading: false, assetsLpExcluded: [BZE, HONEY, USDC] });
        window.addEventListener("click", preventNavigation, true);
    });

    afterEach(() => {
        window.removeEventListener("click", preventNavigation, true);
    });

    it("links every asset type to its explorer token page in a new tab", () => {
        renderPage();

        const hrefs = screen.getAllByRole("link", { name: "View on explorer" }).map((link) => {
            expect(link).toHaveAttribute("target", "_blank");
            return link.getAttribute("href");
        });
        expect(hrefs).toEqual([
            `${getExplorerBaseURL()}/tokens/ubze`,
            `${getExplorerBaseURL()}/tokens/ibc%2F6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4`,
            `${getExplorerBaseURL()}/tokens/factory%2Fbze1abc%2Fuhoney`,
        ]);
    });

    it("doesn't toggle the row's details when the explorer link is clicked", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getAllByRole("link", { name: "View on explorer" })[0]);

        expect(screen.queryByText("asset details")).not.toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Toggle details" })[0]).toHaveAttribute("aria-expanded", "false");
    });

    it("still toggles the details from the row itself", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getAllByRole("button", { name: "Toggle details" })[0]);

        expect(screen.getByText("asset details")).toBeInTheDocument();
    });
});
