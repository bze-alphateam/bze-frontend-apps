import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import {type Asset, CONNECTION_TYPE_POLLING, DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const STORED = {restEndpoint: "https://rest.example.com", rpcEndpoint: "wss://rpc.example.com"};
const DEFAULTS = {restEndpoint: "https://rest.getbze.com", rpcEndpoint: "wss://rpc.getbze.com"};

const updateEndpoints = vi.fn();
const validateEndpoints = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useSettings: () => ({
        settings: {endpoints: STORED, preferredFeeDenom: "ubze"},
        isLoaded: true,
        updateEndpoints,
        defaultSettings: {endpoints: DEFAULTS, preferredFeeDenom: "ubze"},
    }),
    useConnectionType: () => ({connectionType: CONNECTION_TYPE_POLLING}),
    validateEndpoints: (rest: string, rpc: string) => validateEndpoints(rest, rpc),
    useLiquidityPools: () => ({pools: [], isLoading: true}),
    useAssets: () => ({denomTicker: () => "BZE", denomDecimals: () => 6}),
}));

let walletStatus = WalletState.Disconnected;
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status: walletStatus, connect: vi.fn(), disconnect: vi.fn()}),
}));

const setColorMode = vi.fn();
let colorMode = "light";
vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode, setColorMode, toggleColorMode: vi.fn()}),
}));
type FeeMode = {isLoading: boolean; eligible: boolean; needsBze: boolean; feeDenom: string; optOut: boolean; setOptOut: (optOut: boolean) => void};
let feeMode: FeeMode = {isLoading: false, eligible: true, needsBze: false, feeDenom: "", optOut: false, setOptOut: vi.fn()};
vi.mock("@/hooks/token-site/useTokenFeeMode", () => ({
    useFeeMode: () => feeMode,
}));

import {TokenWalletProvider, useTokenWallet} from "@/hooks/token-site/useTokenWallet";
import {TokenSiteTheme} from "../kit";
import {WalletDrawer} from "./index";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: "factory/bze1owner/upage", decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false,
    verified: false, supply: 1n,
};

function OpenButton() {
    const {open} = useTokenWallet();
    return <button type="button" onClick={() => open("get")}>Open</button>;
}

/** Opens the drawer (disconnected: the panel needs no wallet) and goes to Settings. */
async function openSettings() {
    const user = userEvent.setup();
    render(<><OpenButton/><WalletDrawer asset={ASSET}/></>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><TokenWalletProvider>{children}</TokenWalletProvider></TokenSiteTheme>
            </ChakraProvider>
        ),
    });
    await user.click(screen.getByRole("button", {name: "Open"}));
    const drawer = screen.getByRole("dialog", {name: "Your Page wallet"});
    await user.click(within(drawer).getByRole("button", {name: "Settings"}));

    return {user, drawer, panel: within(drawer).getByTestId("wallet-settings")};
}

const field = (name: string) => screen.getByRole("textbox", {name});

beforeEach(() => {
    vi.clearAllMocks();
    walletStatus = WalletState.Disconnected;
    colorMode = "light";
    updateEndpoints.mockReturnValue(true);
    feeMode = {isLoading: false, eligible: true, needsBze: false, feeDenom: ASSET.denom, optOut: false, setOptOut: vi.fn()};
});

describe("SettingsPanel", () => {
    it("opens from the drawer while disconnected and goes back to the wallet view", async () => {
        const {user, drawer} = await openSettings();

        expect(within(drawer).queryByTestId("wallet-connect-prompt")).not.toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Back to wallet"})).toHaveFocus();

        await user.click(screen.getByRole("button", {name: "Back to wallet"}));

        expect(within(drawer).getByTestId("wallet-connect-prompt")).toBeInTheDocument();
        expect(within(drawer).queryByTestId("wallet-settings")).not.toBeInTheDocument();
    });

    it("is also in the connected wallet's footer", async () => {
        walletStatus = WalletState.Connected;
        // Connected without an address the drawer still shows the prompt; the footer is the same.
        const {panel} = await openSettings();

        expect(panel).toBeInTheDocument();
    });

    it("pays network fees in an eligible token by default, and turns it off for that token", async () => {
        const {user} = await openSettings();

        const toggle = screen.getByRole("switch", {name: "Pay network fees in PAGE"});
        expect(toggle).toHaveAttribute("aria-checked", "true");

        await user.click(toggle);
        expect(feeMode.setOptOut).toHaveBeenCalledWith(true);
    });

    it("shows a token's opt-out as off and turns it back on", async () => {
        feeMode = {...feeMode, optOut: true, feeDenom: "ubze"};
        const {user} = await openSettings();

        const toggle = screen.getByRole("switch", {name: "Pay network fees in PAGE"});
        expect(toggle).toHaveAttribute("aria-checked", "false");

        await user.click(toggle);
        expect(feeMode.setOptOut).toHaveBeenCalledWith(false);
    });

    it("has no fee switch for a token that can't pay fees", async () => {
        feeMode = {...feeMode, eligible: false, needsBze: true, feeDenom: "ubze"};
        await openSettings();

        expect(screen.queryByRole("switch", {name: /Pay network fees/})).not.toBeInTheDocument();
    });

    it("switches dark mode through the theme", async () => {
        const {user} = await openSettings();

        const toggle = screen.getByRole("switch", {name: "Dark mode"});
        expect(toggle).toHaveAttribute("aria-checked", "false");
        await user.click(toggle);

        expect(setColorMode).toHaveBeenCalledWith("dark");
    });

    it("shows the stored endpoints and the connection status", async () => {
        await openSettings();

        expect(field("REST endpoint")).toHaveValue(STORED.restEndpoint);
        expect(field("RPC endpoint")).toHaveValue(STORED.rpcEndpoint);
        expect(screen.getByTestId("settings-connection-status")).toHaveTextContent("Polling");
        // Nothing changed yet, so nothing to save.
        expect(screen.getByRole("button", {name: "Save"})).toBeDisabled();
    });

    it("validates the endpoints and shows each result", async () => {
        validateEndpoints.mockResolvedValue({
            isValid: false,
            rest: {isValid: true},
            rpc: {isValid: false, error: "Could not connect"},
        });
        const {user} = await openSettings();

        await user.click(screen.getByRole("button", {name: "Validate"}));

        expect(validateEndpoints).toHaveBeenCalledWith(STORED.restEndpoint, STORED.rpcEndpoint);
        expect(screen.getByRole("status")).toHaveTextContent("REST endpoint is valid");
        expect(screen.getByRole("alert")).toHaveTextContent("Could not connect");
        expect(updateEndpoints).not.toHaveBeenCalled();
    });

    it("does not save endpoints that fail validation", async () => {
        validateEndpoints.mockResolvedValue({
            isValid: false,
            rest: {isValid: false, error: "Invalid URL"},
            rpc: {isValid: true},
        });
        const {user} = await openSettings();

        await user.clear(field("REST endpoint"));
        await user.type(field("REST endpoint"), "nope");
        await user.click(screen.getByRole("button", {name: "Save"}));

        expect(screen.getByRole("alert")).toHaveTextContent("Invalid URL");
        expect(field("REST endpoint")).toHaveAttribute("aria-invalid", "true");
        expect(updateEndpoints).not.toHaveBeenCalled();
    });

    it("saves valid endpoints, turning an https RPC into wss", async () => {
        validateEndpoints.mockResolvedValue({isValid: true, rest: {isValid: true}, rpc: {isValid: true}});
        const {user} = await openSettings();

        await user.clear(field("RPC endpoint"));
        await user.type(field("RPC endpoint"), " https://rpc.other.com ");
        await user.click(screen.getByRole("button", {name: "Save"}));

        expect(validateEndpoints).toHaveBeenCalledWith(STORED.restEndpoint, "https://rpc.other.com");
        expect(updateEndpoints).toHaveBeenCalledWith({restEndpoint: STORED.restEndpoint, rpcEndpoint: "wss://rpc.other.com/"});
        expect(screen.getByText("Settings saved")).toBeInTheDocument();
    });

    it("resets to the default endpoints and stores them", async () => {
        const {user} = await openSettings();

        await user.click(screen.getByRole("button", {name: "Reset to defaults"}));

        expect(updateEndpoints).toHaveBeenCalledWith(DEFAULTS);
        expect(field("REST endpoint")).toHaveValue(DEFAULTS.restEndpoint);
        expect(field("RPC endpoint")).toHaveValue(DEFAULTS.rpcEndpoint);
        expect(validateEndpoints).not.toHaveBeenCalled();
    });
});
