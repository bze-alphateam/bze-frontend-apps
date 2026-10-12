import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type {Asset, DenomBranding} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

// The page's data comes from ui-kit hooks and queries; each is mocked.
const useAsset = vi.fn();
const getDenomBranding = vi.fn();
const getFactoryDenomAdmin = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => useAsset(denom),
    getDenomBranding: (denom: string) => getDenomBranding(denom),
    getFactoryDenomAdmin: (denom: string) => getFactoryDenomAdmin(denom),
    useAssetPrice: () => ({price: new BigNumber("0.0412"), change: -1.5, hasPrice: true}),
    useBalance: (denom: string) => ({balance: {denom, amount: new BigNumber(0)}}),
    useFeeTokens: () => ({isLoading: false, isValidFeeDenom: () => true}),
    useLiquidityPools: () => ({pools: [], isLoading: true}),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status: WalletState.Disconnected, connect: vi.fn()}),
}));

const useDenomParam = vi.fn();
const navigate = vi.fn();
vi.mock("@/hooks/useNavigation", () => ({
    useDenomParam: () => useDenomParam(),
    useNavigation: () => ({navigate}),
}));

let colorMode: "light" | "dark" = "light";
vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode, setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));

// Sections with data of their own, covered by their own tests.
vi.mock("@/components/token-site/key-numbers", () => ({KeyNumbers: () => <div data-testid="key-numbers"/>}));
vi.mock("@/components/token-site/stake/holders-pool", () => ({HoldersPool: () => <div data-testid="holders-pool"/>}));
vi.mock("@/components/ui/tokens/token-staking-rewards", () => ({TokenStakingRewards: () => <div data-testid="legacy-stake"/>}));
vi.mock("@/components/token-site/burn/burn-section", () => ({BurnSection: () => <div data-testid="burn-section"/>}));

import TokenPage from "./page";

forbidNetwork();

const KIT: DenomBranding = {
    font: "roboto",
    light: {background: "#FFFFFF", text: "#000000", primary: "#123456", secondary: "#654321"},
    dark: {background: "#0A0A0A", text: "#FAFAFA", primary: "#ABCDEF", secondary: "#FEDCBA"},
};

function makeAsset(denom: string, extra: Partial<Asset> = {}): Asset {
    return {
        type: "factory", denom, decimals: 6, name: "Brand Token", ticker: "BRAND", logo: "", stable: false,
        verified: true, supply: 1_000_000n, description: "The brand's own token.", ...extra,
    };
}

function renderPage(denom: string, asset: Asset | null = makeAsset(denom)) {
    useDenomParam.mockReturnValue(denom);
    useAsset.mockReturnValue({asset: asset ?? undefined, isLoading: false});

    return render(<TokenPage/>, {
        wrapper: ({children}: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });
}

const site = () => screen.getByTestId("token-site");
const siteVar = (name: string) => site().style.getPropertyValue(name);

beforeEach(() => {
    colorMode = "light";
    useAsset.mockReset();
    getDenomBranding.mockReset();
    getFactoryDenomAdmin.mockReset().mockResolvedValue("");
    useDenomParam.mockReset();
});

// Kits are cached per denom for a few minutes, so every test uses its own denom.
describe("Communities token page", () => {
    it("draws the site in the token's kit for the light colour mode", async () => {
        getDenomBranding.mockResolvedValue(KIT);
        renderPage("factory/bze1owner/ulight");

        expect(await screen.findByRole("heading", {level: 1, name: "Brand Token"})).toBeInTheDocument();
        expect(siteVar("--ts-bg")).toBe("#FFFFFF");
        expect(siteVar("--ts-pri")).toBe("#123456");
        expect(siteVar("--ts-font")).toBe("'Roboto', system-ui, sans-serif");
    });

    it("uses the kit's dark palette in dark mode", async () => {
        colorMode = "dark";
        getDenomBranding.mockResolvedValue(KIT);
        renderPage("factory/bze1owner/udark");

        await screen.findByRole("heading", {level: 1, name: "Brand Token"});
        expect(siteVar("--ts-bg")).toBe("#0A0A0A");
        expect(siteVar("--ts-pri")).toBe("#ABCDEF");
    });

    it("draws a token without a kit in the default kit", async () => {
        getDenomBranding.mockResolvedValue(null);
        renderPage("factory/bze1owner/unokit");

        await screen.findByRole("heading", {level: 1, name: "Brand Token"});
        expect(siteVar("--ts-pri")).toBe("#D97706");
    });

    it("still renders, in the default kit, when the branding query fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        getDenomBranding.mockRejectedValue(new Error("501 Not Implemented"));
        renderPage("factory/bze1owner/uold");

        await screen.findByRole("heading", {level: 1, name: "Brand Token"});
        expect(siteVar("--ts-pri")).toBe("#D97706");
    });

    it("shows the hero, key numbers, sections, details and footer with no BeeZee chrome", async () => {
        getDenomBranding.mockResolvedValue(KIT);
        renderPage("factory/bze1owner/ufull");

        await screen.findByRole("heading", {level: 1, name: "Brand Token"});
        expect(screen.getByText("The brand's own token.")).toBeInTheDocument();
        expect(screen.getByText("Verified")).toBeInTheDocument();
        expect(screen.getByText("$0.0412")).toBeInTheDocument();
        expect(screen.getByTestId("token-site-change")).toHaveTextContent("−1.50% today");
        expect(screen.getAllByRole("button", {name: "Get BRAND"}).length).toBeGreaterThan(0);
        // Hero and phone bar both scroll to the Stake section.
        for (const link of screen.getAllByRole("link", {name: "Stake BRAND"})) {
            expect(link).toHaveAttribute("href", "#stake");
        }
        expect(screen.getByTestId("key-numbers")).toBeInTheDocument();
        expect(screen.getByTestId("holders-pool")).toBeInTheDocument();
        expect(screen.getByTestId("legacy-stake")).toBeInTheDocument();
        expect(screen.getByTestId("burn-section")).toBeInTheDocument();
        expect(screen.getByText("factory/bze1owner/ufull")).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId("supply-control")).toHaveTextContent("Admin renounced"));

        expect(screen.queryByAltText("BZE application logo")).not.toBeInTheDocument();
        expect(screen.queryByText(/directory/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/BZE/)).not.toBeInTheDocument();
        expect(screen.queryByText("Runs on BeeZee")).not.toBeInTheDocument();
    });

    it("opens the wallet drawer from the hero's and the phone bar's Get buttons", async () => {
        const user = userEvent.setup();
        getDenomBranding.mockResolvedValue(KIT);
        renderPage("factory/bze1owner/uwallet");

        await screen.findByRole("heading", {level: 1, name: "Brand Token"});
        const getButtons = screen.getAllByRole("button", {name: "Get BRAND"});
        expect(getButtons).toHaveLength(2);

        for (const button of getButtons) {
            await user.click(button);
            expect(screen.getByRole("dialog", {name: "Your Brand Token wallet"})).toBeInTheDocument();
            expect(screen.getByTestId("wallet-connect-prompt")).toBeInTheDocument();

            await user.keyboard("{Escape}");
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        }
    });

    it("shows the admin of a token that still has one", async () => {
        getDenomBranding.mockResolvedValue(KIT);
        getFactoryDenomAdmin.mockResolvedValue("bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l");
        renderPage("factory/bze1owner/uadmin");

        await waitFor(() => expect(screen.getByTestId("supply-control")).toHaveTextContent(/^Admin bze1z3/));
    });

    it("shows not found for a denom that isn't a factory token", () => {
        renderPage("ubze", makeAsset("ubze", {type: "native"}));

        expect(screen.getByRole("heading", {name: "Token not found"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Browse all tokens"})).toBeInTheDocument();
        expect(getDenomBranding).not.toHaveBeenCalled();
    });

    it("shows not found for an unknown denom", () => {
        renderPage("factory/bze1owner/umissing", null);

        expect(screen.getByRole("heading", {name: "Token not found"})).toBeInTheDocument();
    });

    it("shows the loading state while the assets load", () => {
        useDenomParam.mockReturnValue("factory/bze1owner/uslow");
        useAsset.mockReturnValue({asset: undefined, isLoading: true});
        render(<ChakraProvider value={defaultSystem}><TokenPage/></ChakraProvider>);

        expect(screen.getByTestId("token-site-loading")).toBeInTheDocument();
        expect(screen.queryByText("Token not found")).not.toBeInTheDocument();
    });
});
