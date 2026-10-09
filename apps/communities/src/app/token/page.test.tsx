import {describe, it, expect, vi, beforeEach} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {Asset, DenomBranding} from "@bze/bze-ui-kit";

import {TokenBrandingProvider, useTokenBranding} from "@/contexts/token_branding_context";

const useAsset = vi.fn();
const getDenomBranding = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => useAsset(denom),
    getDenomBranding: (denom: string) => getDenomBranding(denom),
    useToast: () => ({toast: {success: vi.fn(), error: vi.fn()}}),
}));

const useDenomParam = vi.fn();
vi.mock("@/hooks/useNavigation", () => ({
    useDenomParam: () => useDenomParam(),
    useNavigation: () => ({navigate: vi.fn()}),
}));

vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: "dark"}),
}));

// The reward and burn sections fetch chain data of their own; they're not under test here.
vi.mock("@/components/ui/tokens/token-staking-rewards", () => ({TokenStakingRewards: () => null}));
vi.mock("@/components/ui/tokens/token-burn-stats", () => ({TokenBurnStats: () => null}));

import TokenPage from "./page";

const KIT: DenomBranding = {
    font: "roboto",
    light: {background: "#FFFFFF", text: "#000000", primary: "#123456", secondary: "#654321"},
    dark: {background: "#0A0A0A", text: "#FAFAFA", primary: "#ABCDEF", secondary: "#FEDCBA"},
};

function makeAsset(denom: string): Asset {
    return {
        type: "factory",
        denom,
        decimals: 6,
        name: "Brand Token",
        ticker: "BRAND",
        logo: "",
        stable: false,
        verified: false,
        supply: 1_000_000n,
    };
}

// Shows what the navbar would read from the branding context.
const BrandProbe = () => {
    const {brand} = useTokenBranding();
    return <span data-testid="probe">{brand ? `${brand.name}:${brand.kit === undefined ? "loading" : brand.kit?.font ?? "none"}` : "none"}</span>;
};

function renderPage(denom: string) {
    useDenomParam.mockReturnValue(denom);
    useAsset.mockReturnValue({asset: makeAsset(denom), isLoading: false});

    return render(<><TokenPage/><BrandProbe/></>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <TokenBrandingProvider>{children}</TokenBrandingProvider>
            </ChakraProvider>
        ),
    });
}

beforeEach(() => {
    useAsset.mockReset();
    getDenomBranding.mockReset();
    useDenomParam.mockReset();
});

// The page caches kits per denom for a few minutes, so every test uses its own denom.
describe("Communities token page brand kit", () => {
    it("applies the token's kit in the active colour mode and hands it to the chrome", async () => {
        getDenomBranding.mockResolvedValue(KIT);
        renderPage("factory/bze1owner/ukit");

        const scope = await screen.findByTestId("brand-scope");
        expect(scope.style.getPropertyValue("--brand-bg")).toBe("#0A0A0A");
        expect(scope.style.getPropertyValue("--brand-primary")).toBe("#ABCDEF");
        expect(screen.getByText("Brand Token", {selector: "p"})).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("Brand Token:roboto"));
        expect(getDenomBranding).toHaveBeenCalledWith("factory/bze1owner/ukit");
    });

    it("keeps the default theme for a token without a kit", async () => {
        getDenomBranding.mockResolvedValue(null);
        renderPage("factory/bze1owner/unokit");

        await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("Brand Token:none"));
        expect(screen.queryByTestId("brand-scope")).not.toBeInTheDocument();
    });

    it("fails open to the default theme when the query fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        getDenomBranding.mockRejectedValue(new Error("501 Not Implemented"));
        renderPage("factory/bze1owner/uold");

        await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("Brand Token:none"));
        expect(screen.queryByTestId("brand-scope")).not.toBeInTheDocument();
        expect(screen.getByText("Brand Token", {selector: "p"})).toBeInTheDocument();
    });
});
