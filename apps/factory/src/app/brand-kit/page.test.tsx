import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// The brand kit page on mocked hooks: the query string, the wallet, the live admin and the stored
// kit. The editor itself has its own tests; here it is a stub that shows what the page passes it.
const m = vi.hoisted(() => ({
    denom: "factory/bze1owner/utok" as string | null,
    search: "",
    address: "bze1owner" as string | undefined,
    admin: "bze1owner" as string | undefined,
    branding: null as unknown,
    hasError: false,
    navigate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(m.search) }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: m.navigate }),
    useNavigationWithParams: () => ({ navigate: m.navigate, denomParam: m.denom }),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@/hooks/useDenomAdmin", () => ({ useDenomAdmin: () => ({ admin: m.admin, isLoading: false, refresh: vi.fn() }) }));
vi.mock("@/hooks/useDenomBranding", () => ({
    useDenomBranding: () => ({ branding: m.branding, isLoading: false, hasError: m.hasError, refresh: vi.fn() }),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => ({
        asset: denom === "factory/bze1owner/utok" ? { denom, ticker: "TOK", name: "Tok", decimals: 6 } : undefined,
        isLoading: false,
    }),
}));
vi.mock("@/components/brand-kit/brand-kit-editor", () => ({
    BrandKitEditor: ({ initial, saveBlocker, onCancel, onSaved }: {
        initial: unknown; saveBlocker?: string; onCancel: () => void; onSaved: () => void;
    }) => (
        <div data-testid="editor">
            <span>{initial ? "has kit" : "no kit"}</span>
            <span>{saveBlocker ?? "can save"}</span>
            <button onClick={onCancel}>cancel</button>
            <button onClick={onSaved}>saved</button>
        </div>
    ),
}));

import BrandKitPage from "./page";

const renderPage = () => render(<ChakraProvider value={defaultSystem}><BrandKitPage /></ChakraProvider>);
const TOKEN_PAGE = `/tokens/token?denom=${encodeURIComponent("factory/bze1owner/utok")}`;

beforeEach(() => {
    Object.assign(m, { denom: "factory/bze1owner/utok", search: "", address: "bze1owner", admin: "bze1owner", branding: null, hasError: false });
    m.navigate.mockReset();
});

describe("Brand kit page", () => {
    it("lets the admin edit, and goes back to the token page after saving", async () => {
        renderPage();

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Brand kit for TOK");
        expect(screen.getByText("no kit")).toBeInTheDocument();
        expect(screen.getByText("can save")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "saved" }));
        expect(m.navigate).toHaveBeenCalledWith(TOKEN_PAGE);
    });

    it("uses the return path for Back and Cancel when it has one", async () => {
        m.search = `return=${encodeURIComponent("/tokens/token?denom=x")}&returnLabel=TOK`;
        renderPage();

        await userEvent.click(screen.getByRole("button", { name: /Back to TOK/ }));
        await userEvent.click(screen.getByRole("button", { name: "cancel" }));
        expect(m.navigate).toHaveBeenNthCalledWith(1, "/tokens/token?denom=x");
        expect(m.navigate).toHaveBeenNthCalledWith(2, "/tokens/token?denom=x");
    });

    it("explains who can save to a wallet that isn't the admin, or no wallet at all", () => {
        m.address = "bze1someone";
        const { unmount } = renderPage();
        expect(screen.getByText("Only TOK's admin can save its brand kit.")).toBeInTheDocument();
        unmount();

        m.address = undefined;
        renderPage();
        expect(screen.getByText("Connect your wallet.")).toBeInTheDocument();
    });

    it("shows a renounced token's kit as frozen, with no editor", () => {
        m.admin = "";
        renderPage();

        expect(screen.getByTestId("brand-kit-page-frozen")).toHaveTextContent("The brand kit is frozen");
        expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
    });

    it("reports a failed chain query instead of offering an empty kit", () => {
        m.hasError = true;
        renderPage();

        expect(screen.getByTestId("brand-kit-page-error")).toHaveTextContent("Couldn't load the brand kit");
        expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
    });

    it("sends a link without a Factory token back to the token list", async () => {
        m.denom = "ubze";
        renderPage();

        await userEvent.click(screen.getByRole("button", { name: "Your tokens" }));
        expect(m.navigate).toHaveBeenCalledWith("/tokens");
    });
});
