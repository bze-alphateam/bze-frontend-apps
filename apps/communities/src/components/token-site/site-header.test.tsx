import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {type Asset, DEFAULT_DENOM_BRANDING, TOKEN_LOGO_PLACEHOLDER} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const useBalance = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useBalance: (denom: string) => useBalance(denom),
    useSettings: () => ({
        settings: {endpoints: {restEndpoint: "https://rest.example.com", rpcEndpoint: "wss://rpc.example.com"}},
        updateEndpoints: vi.fn(),
        defaultSettings: {endpoints: {restEndpoint: "https://rest.example.com", rpcEndpoint: "wss://rpc.example.com"}},
    }),
    useConnectionType: () => ({connectionType: 2}),
}));

const connect = vi.fn();
let walletStatus = WalletState.Disconnected;
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status: walletStatus, connect, disconnect: vi.fn()}),
}));

const toggleColorMode = vi.fn();
vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: "light", setColorMode: vi.fn(), toggleColorMode}),
}));

import {TokenWalletProvider} from "@/hooks/token-site/useTokenWallet";
import {TokenSiteTheme} from "./kit";
import {SiteHeader} from "./site-header";
import {WalletDrawer} from "./wallet";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: "factory/bze1owner/upage", decimals: 6, name: "Page Token", ticker: "page",
    logo: TOKEN_LOGO_PLACEHOLDER, stable: false, verified: false, supply: 1n,
};

const SECTIONS = [{id: "stake", label: "Stake"}, {id: "burn", label: "Burn"}];

function renderHeader(asset: Asset = ASSET) {
    return render(<><SiteHeader asset={asset} sections={SECTIONS}/><WalletDrawer asset={asset}/></>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><TokenWalletProvider>{children}</TokenWalletProvider></TokenSiteTheme>
            </ChakraProvider>
        ),
    });
}

beforeEach(() => {
    walletStatus = WalletState.Disconnected;
    connect.mockReset();
    useBalance.mockReturnValue({balance: {denom: ASSET.denom, amount: new BigNumber(12_480_000_000)}});
});

describe("SiteHeader", () => {
    it("shows the ticker's first two letters in a circle when the token has no logo", () => {
        renderHeader();

        expect(screen.getByTestId("token-initials")).toHaveTextContent("PA");
        expect(screen.getByText("Page Token")).toBeInTheDocument();
    });

    it("shows the token's logo when it has one", () => {
        const {container} = renderHeader({...ASSET, logo: "https://example.com/page.svg"});

        expect(screen.queryByTestId("token-initials")).not.toBeInTheDocument();
        expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/page.svg");
    });

    // jsdom matches no media query, so the phone layout is the one rendered: links sit in the menu.
    it("links to the sections on the page and nowhere else", async () => {
        const user = userEvent.setup();
        renderHeader();

        await user.click(screen.getByRole("button", {name: "Open menu"}));

        const nav = screen.getByRole("navigation", {name: "Sections"});
        expect([...nav.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["#stake", "#burn"]);
    });

    it("opens the wallet drawer with a connect prompt while disconnected", async () => {
        const user = userEvent.setup();
        renderHeader();

        await user.click(screen.getByRole("button", {name: "Connect wallet"}));

        const drawer = screen.getByRole("dialog", {name: "Your Page Token wallet"});
        expect(drawer).toContainElement(screen.getByTestId("wallet-connect-prompt"));
        expect(connect).not.toHaveBeenCalled();
    });

    it("shows the wallet's balance of the token once connected", () => {
        walletStatus = WalletState.Connected;
        renderHeader();

        expect(screen.getByRole("button", {name: "Open wallet"})).toHaveTextContent("12.48K page");
        expect(useBalance).toHaveBeenCalledWith(ASSET.denom);
    });

    it("switches the colour mode", async () => {
        const user = userEvent.setup();
        renderHeader();

        await user.click(screen.getByRole("button", {name: "Open menu"}));
        await user.click(screen.getByRole("button", {name: "Switch to dark mode"}));

        expect(toggleColorMode).toHaveBeenCalled();
    });

    it("opens the settings panel from the phone menu", async () => {
        const user = userEvent.setup();
        renderHeader();

        await user.click(screen.getByRole("button", {name: "Open menu"}));
        await user.click(screen.getByRole("button", {name: "Settings"}));

        const drawer = screen.getByRole("dialog", {name: "Your Page Token wallet"});
        expect(drawer).toContainElement(screen.getByTestId("wallet-settings"));
        expect(screen.queryByRole("navigation", {name: "Sections"})).not.toBeInTheDocument();
    });
});
