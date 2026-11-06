import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {type Asset, DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";

const useAsset = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => useAsset(denom),
    useLiquidityPools: () => ({pools: [], isLoading: false}),
}));
vi.mock("@/hooks/token-site/useTokenBrandKit", () => ({useTokenBrandKit: () => DEFAULT_DENOM_BRANDING}));
vi.mock("@/hooks/token-site/useEarnOpportunities", () => ({useEarnOpportunities: () => ({opportunities: [], isLoading: false})}));
vi.mock("@/hooks/token-site/useTokenFeeMode", () => ({TokenFeeModeProvider: ({children}: { children: ReactNode }) => <>{children}</>}));
vi.mock("@/hooks/token-site/useTokenWallet", () => ({TokenWalletProvider: ({children}: { children: ReactNode }) => <>{children}</>}));
vi.mock("@/hooks/useNavigation", () => ({
    tokenPagePath: (denom: string) => `/token?denom=${encodeURIComponent(denom)}`,
    useNavigation: () => ({navigate: vi.fn()}),
}));
vi.mock("@/components/ui/color-mode", () => ({useColorMode: () => ({colorMode: "dark", setColorMode: vi.fn(), toggleColorMode: vi.fn()})}));
// The frame's own chrome is covered by the token page tests.
vi.mock("../site-header", () => ({SiteHeader: () => <header/>}));
vi.mock("../site-footer", () => ({SiteFooter: () => <footer/>}));
vi.mock("../wallet", () => ({WalletDrawer: () => null}));

import {InnerSite} from "./inner-site";

const DENOM = "factory/bze1owner/uinner";
const ASSET = {type: "factory", denom: DENOM, decimals: 6, name: "Inner Token", ticker: "INR", logo: "", stable: false, verified: true} as Asset;

const renderSite = () => render(
    <ChakraProvider value={defaultSystem}>
        <InnerSite denom={DENOM}>{(asset) => <p>Activity of {asset.ticker}</p>}</InnerSite>
    </ChakraProvider>,
);

beforeEach(() => useAsset.mockReset());

describe("InnerSite", () => {
    it("keeps showing a known token while the wallet balances reload", () => {
        useAsset.mockReturnValue({asset: ASSET, isLoading: true});
        renderSite();

        expect(screen.getByText("Activity of INR")).toBeInTheDocument();
        expect(screen.queryByTestId("token-site-loading")).not.toBeInTheDocument();
    });

    it("shows the loading state, not \"Token not found\", while the assets load", () => {
        useAsset.mockReturnValue({asset: undefined, isLoading: true});
        renderSite();

        expect(screen.getByTestId("token-site-loading")).toBeInTheDocument();
        expect(screen.queryByText("Token not found")).not.toBeInTheDocument();
    });

    it("shows not found once the assets loaded without the token", () => {
        useAsset.mockReturnValue({asset: undefined, isLoading: false});
        renderSite();

        expect(screen.getByRole("heading", {name: "Token not found"})).toBeInTheDocument();
    });
});
