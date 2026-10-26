import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset, DenomBranding } from "@bze/bze-ui-kit";

// Drive the card off its data hook; the tx layer and wallet are stubbed so the test asserts the
// card states (admin / non-admin / renounced / query error) and the messages it builds only.
const { useDenomBrandingMock, txMock, refreshMock } = vi.hoisted(() => ({
    useDenomBrandingMock: vi.fn(),
    txMock: vi.fn(),
    refreshMock: vi.fn(),
}));

vi.mock("@/hooks/useDenomBranding", () => ({ useDenomBranding: () => useDenomBrandingMock() }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1admin" }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    getCommunitiesApp: () => ({ href: "https://communities.example" }),
}));

import { BrandKitCard, BrandKitAccess } from "./brand-kit-card";

const TOKEN = {
    denom: "factory/bze1admin/utok",
    ticker: "TOK",
    name: "TOK Token",
    type: "factory",
    decimals: 6,
    logo: "",
} as unknown as Asset;

const KIT: DenomBranding = {
    font: "poppins",
    light: { background: "#FFFFFF", text: "#101010", primary: "#AA0000", secondary: "#555555" },
    dark: { background: "#000000", text: "#EEEEEE", primary: "#FF4444", secondary: "#999999" },
};

function renderCard(access: BrandKitAccess, state: Record<string, unknown> = {}) {
    useDenomBrandingMock.mockReturnValue({
        branding: null, isLoading: false, hasError: false, refresh: refreshMock, ...state,
    });
    return render(<BrandKitCard asset={TOKEN} access={access} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    useDenomBrandingMock.mockReset();
    txMock.mockReset().mockResolvedValue(true);
    refreshMock.mockReset();
});

describe("BrandKitCard", () => {
    it("shows the preview without suspending the page while the font stylesheet loads", async () => {
        // The manage page renders inside a Suspense boundary and the kit arrives from a promise,
        // like the real hook. A `<link precedence>` stylesheet would then hold the page on the
        // fallback until Google Fonts answers (forever in jsdom).
        useDenomBrandingMock.mockImplementation(function useLoadedKit() {
            const [branding, setBranding] = useState<DenomBranding | null>(null);
            useEffect(() => { void Promise.resolve(KIT).then(setBranding); }, []);
            return { branding, isLoading: branding === null, hasError: false, refresh: refreshMock };
        });
        render(
            <ChakraProvider value={defaultSystem}>
                <Suspense fallback={<p>page loading</p>}>
                    <BrandKitCard asset={TOKEN} access="not-admin" />
                </Suspense>
            </ChakraProvider>,
        );

        expect(await screen.findByTestId("brand-kit-preview-light")).toBeVisible();
        expect(screen.queryByText("page loading")).not.toBeInTheDocument();
    });

    it("shows a non-admin the kit in both palettes with no inputs", () => {
        renderCard("not-admin", { branding: KIT });

        expect(screen.getByTestId("brand-kit-preview-light")).toBeInTheDocument();
        expect(screen.getByTestId("brand-kit-preview-dark")).toBeInTheDocument();
        expect(screen.getByText("Poppins")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.queryByTestId("brand-kit-frozen")).not.toBeInTheDocument();
    });

    it("links to the token's Communities page with the denom encoded", () => {
        renderCard("not-admin", { branding: KIT });

        expect(screen.getByRole("link", { name: "Communities" }))
            .toHaveAttribute("href", "https://communities.example/token?denom=factory%2Fbze1admin%2Futok");
        expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute("data-app", "communities");
    });

    it("words the empty state the same for the admin and for everyone else", () => {
        const { unmount } = renderCard("admin");
        expect(screen.getByText("No brand kit yet.")).toBeInTheDocument();
        unmount();

        renderCard("not-admin");
        expect(screen.getByText("No brand kit yet.")).toBeInTheDocument();
    });

    it("marks a renounced token's kit, or its absence, as frozen", () => {
        const { unmount } = renderCard("renounced", { branding: KIT });
        expect(screen.getByTestId("brand-kit-frozen")).toHaveTextContent(/^Frozen$/);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        unmount();

        renderCard("renounced");
        expect(screen.getByText("No brand kit yet.")).toBeInTheDocument();
        expect(screen.getByTestId("brand-kit-frozen")).toHaveTextContent(/^Frozen$/);
    });

    it("reports a failed query instead of 'no kit' and offers no edit", async () => {
        renderCard("admin", { hasError: true });

        expect(screen.getByText("Couldn't load the brand kit")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Remove brand kit" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(refreshMock).toHaveBeenCalled();
    });

    it("offers the admin Remove only when there is a kit, and never an inline editor", () => {
        const { unmount } = renderCard("admin");
        expect(screen.queryByRole("button", { name: "Remove brand kit" })).not.toBeInTheDocument();
        unmount();

        renderCard("admin", { branding: KIT });
        expect(screen.getByRole("button", { name: "Remove brand kit" })).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("labels the sample button black or white, whichever reads on primary", () => {
        renderCard("not-admin", { branding: KIT });

        expect(within(screen.getByTestId("brand-kit-preview-light")).getByText("Buy TOK")).toHaveStyle({ color: "#FFFFFF" });
        expect(within(screen.getByTestId("brand-kit-preview-dark")).getByText("Buy TOK")).toHaveStyle({ color: "#000000" });
    });

    it("removes the kit with an empty branding after a confirm step", async () => {
        renderCard("admin", { branding: KIT });

        await userEvent.click(screen.getByRole("button", { name: "Remove brand kit" }));
        expect(screen.getByTestId("brand-kit-remove-panel")).toBeInTheDocument();
        expect(txMock).not.toHaveBeenCalled();

        await userEvent.click(within(screen.getByTestId("brand-kit-remove-panel")).getByRole("button", { name: "Remove brand kit" }));

        expect(txMock).toHaveBeenCalledTimes(1);
        const [[msg]] = txMock.mock.calls[0];
        expect(msg.typeUrl).toBe("/bze.tokenfactory.MsgSetDenomBranding");
        expect(msg.value.branding).toBeUndefined();
    });
});
