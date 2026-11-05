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

/** The background the plain `:hover` rule of the element's classes sets (Chakra puts the styles in the document). */
function hoverBackground(element: HTMLElement): string | undefined {
    // Chakra nests its rules in @layer blocks.
    const flatten = (list: CSSRuleList): CSSRule[] => Array.from(list).flatMap((r) => ("cssRules" in r ? flatten((r as CSSGroupingRule).cssRules) : [r]));
    const rules = Array.from(document.styleSheets).flatMap((sheet) => flatten(sheet.cssRules)) as CSSStyleRule[];
    const rule = rules.find((r) => Array.from(element.classList).some((c) => r.selectorText?.startsWith(`.${c}:is(:hover`)));
    return rule?.style.getPropertyValue("background") || rule?.style.getPropertyValue("background-color") || undefined;
}

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

    it("hovers a network row with the site's floored hover surface, not a raw text mix", () => {
        useBuyBze.mockReturnValue({
            skipChains: [{chain_id: "osmosis-1", pretty_name: "Osmosis", canSign: true}],
            filteredChains: [{chain_id: "osmosis-1", pretty_name: "Osmosis", canSign: true}],
            assetBalances: new Map(), isLoadingChains: false, chainSearch: "", setChainSearch: vi.fn(),
        });
        render(<GetBzePanel onBack={vi.fn()}/>, {wrapper});

        expect(hoverBackground(screen.getByRole("button", {name: "Osmosis"}))).toBe("var(--ts-hover)");
    });

    it("starts the Skip flow for Keplr", () => {
        render(<GetBzePanel onBack={vi.fn()}/>, {wrapper});

        expect(screen.queryByTestId("get-bze-beezee-only")).toBeNull();
        expect(useBuyBze).toHaveBeenCalled();
        expect(screen.getByText("Loading networks…")).toBeInTheDocument();
    });
});
