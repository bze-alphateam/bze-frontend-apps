import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset, BlockedIbcInbound } from "@bze/bze-ui-kit";

// The details page reads the asset, its price, the toast helper and the chain's IBC
// inbound block list from ui-kit. Those hooks are fed directly; the notice lookup
// (getLegacyAssetNotice + LEGACY_ASSET_NOTICES) and the notice box stay real.
const { useAssetMock, useBlockedIbcInboundMock } = vi.hoisted(() => ({
    useAssetMock: vi.fn(),
    useBlockedIbcInboundMock: vi.fn(),
}));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAsset: () => useAssetMock(),
        useAssetPrice: () => ({ price: 1, change: 0, isLoading: false }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
        useBlockedIbcInbound: () => useBlockedIbcInboundMock(),
    };
});

vi.mock("@/hooks/useNavigation", () => ({
    useNavigationWithParams: () => ({ toAssetsPage: vi.fn(), denomParam: "denom-from-url" }),
    assetPagePath: (denom: string) => `/assets/details?denom=${denom}`,
}));

// The details card pulls markets, pools and supply; it is not what this test is about.
vi.mock("@/components/ui/assets/asset-details", () => ({ AssetDetails: () => null }));

import AssetDetailsPage from "./page";

const USDC_N: Asset = {
    type: "IBC",
    denom: "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4",
    decimals: 6,
    name: "USDC",
    ticker: "USDC.n",
    logo: "",
    stable: true,
    verified: true,
    supply: BigInt(1000),
    IBCData: {
        chain: { channelId: "channel-3" },
        counterparty: { chainName: "noble", chainPrettyName: "Noble", channelId: "channel-95", baseDenom: "uusdc" },
    },
};

const BZE: Asset = { ...USDC_N, type: "Native", denom: "ubze", name: "BeeZee", ticker: "BZE", IBCData: undefined };

const NOBLE_BLOCK: BlockedIbcInbound[] = [{ channelId: "channel-3", baseDenom: "uusdc" }];

const NOTICE = /Circle is retiring/;

function renderPage() {
    return render(<AssetDetailsPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

describe("asset details page — legacy asset notice", () => {
    beforeEach(() => {
        useAssetMock.mockReset();
        useBlockedIbcInboundMock.mockReset();
    });

    it("explains the USDC.n wind-down while the chain blocks its deposits", () => {
        useAssetMock.mockReturnValue({ asset: USDC_N, isLoading: false });
        useBlockedIbcInboundMock.mockReturnValue(NOBLE_BLOCK);

        renderPage();

        expect(screen.getByText("USDC.n is being retired")).toBeInTheDocument();
        expect(screen.getByText(NOTICE)).toBeInTheDocument();
    });

    it("shows no notice before the block is live", () => {
        useAssetMock.mockReturnValue({ asset: USDC_N, isLoading: false });
        useBlockedIbcInboundMock.mockReturnValue([]);

        renderPage();

        expect(screen.getByText("USDC.n")).toBeInTheDocument();
        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });

    it("shows no notice when the params query failed", () => {
        useAssetMock.mockReturnValue({ asset: USDC_N, isLoading: false });
        useBlockedIbcInboundMock.mockReturnValue(undefined);

        renderPage();

        expect(screen.getByText("USDC.n")).toBeInTheDocument();
        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });

    it("shows no notice on other assets", () => {
        useAssetMock.mockReturnValue({ asset: BZE, isLoading: false });
        useBlockedIbcInboundMock.mockReturnValue(NOBLE_BLOCK);

        renderPage();

        expect(screen.getByText("BeeZee")).toBeInTheDocument();
        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });
});
