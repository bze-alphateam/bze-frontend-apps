import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";

// The connected wallet and the Skip flow are fed directly; only the panel's choice is under test.
const {connected, useBuyBze} = vi.hoisted(() => ({
    connected: {name: "keplr-extension"},
    useBuyBze: vi.fn(),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({
        status: WalletState.Connected,
        address: "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l",
        wallet: {info: {name: connected.name}},
    }),
}));
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAssets: () => ({denomTicker: () => "BZE"}),
    useBuyBze: (...args: unknown[]) => useBuyBze(...args),
}));
vi.mock("@/hooks/token-site/useTokenWallet", () => ({useTokenWallet: () => ({connect: vi.fn()})}));

import {GetBzePanel} from "./get-bze-panel";

const wrapper = ({children}: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

describe("GetBzePanel", () => {
    beforeEach(() => {
        connected.name = "keplr-extension";
        useBuyBze.mockReset().mockReturnValue({
            skipChains: [], filteredChains: [], assetBalances: new Map(), isLoadingChains: true,
        });
    });

    it("tells a BeePocket user it supports BeeZee only and never starts the Skip flow", () => {
        connected.name = "beepocket-extension";
        render(<GetBzePanel onBack={vi.fn()}/>, {wrapper});

        expect(screen.getByTestId("get-bze-beezee-only")).toHaveTextContent("BeePocket supports BeeZee only");
        expect(useBuyBze).not.toHaveBeenCalled();
    });

    it("starts the Skip flow for Keplr", () => {
        render(<GetBzePanel onBack={vi.fn()}/>, {wrapper});

        expect(screen.queryByTestId("get-bze-beezee-only")).toBeNull();
        expect(useBuyBze).toHaveBeenCalled();
        expect(screen.getByText("Loading networks…")).toBeInTheDocument();
    });
});
