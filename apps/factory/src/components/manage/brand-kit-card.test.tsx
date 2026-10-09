import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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
    it("shows a non-admin the kit in both palettes with no inputs", () => {
        renderCard("not-admin", { branding: KIT });

        expect(screen.getByTestId("brand-kit-preview-light")).toBeInTheDocument();
        expect(screen.getByTestId("brand-kit-preview-dark")).toBeInTheDocument();
        expect(screen.getByText("Poppins")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.queryByTestId("brand-kit-frozen")).not.toBeInTheDocument();
    });

    it("marks the kit of a renounced token as frozen, or its absence as permanent", () => {
        const { unmount } = renderCard("renounced", { branding: KIT });
        expect(screen.getByTestId("brand-kit-frozen")).toHaveTextContent("this kit can never change");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        unmount();

        renderCard("renounced");
        expect(screen.getByText("This token has no brand kit.")).toBeInTheDocument();
        expect(screen.getByTestId("brand-kit-frozen")).toHaveTextContent("will never have a brand kit");
    });

    it("reports a failed query instead of 'no kit' and offers no edit", async () => {
        renderCard("admin", { hasError: true });

        expect(screen.getByText("Couldn't load the brand kit")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Set brand kit/ })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(refreshMock).toHaveBeenCalled();
    });

    it("lets the admin save a full kit, refusing bad hex with a field message first", async () => {
        renderCard("admin");

        await userEvent.click(screen.getByRole("button", { name: "Set brand kit" }));
        const save = screen.getByRole("button", { name: "Save brand kit" });
        expect(save).toBeEnabled();

        const darkPrimary = screen.getByRole("textbox", { name: "Dark primary" });
        await userEvent.clear(darkPrimary);
        await userEvent.type(darkPrimary, "#12ZZ56");
        expect(screen.getByText("Use a 6-digit hex colour like #1A2B3C.")).toBeInTheDocument();
        expect(save).toBeDisabled();

        await userEvent.clear(darkPrimary);
        expect(screen.getByText("Required.")).toBeInTheDocument();
        await userEvent.type(darkPrimary, "#123456");
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "Font" }), "space-grotesk");
        await userEvent.click(save);

        expect(txMock).toHaveBeenCalledTimes(1);
        const [msgs, options] = txMock.mock.calls[0];
        expect(msgs).toEqual([{
            typeUrl: "/bze.tokenfactory.MsgSetDenomBranding",
            value: expect.objectContaining({
                creator: "bze1admin",
                denom: TOKEN.denom,
                branding: expect.objectContaining({
                    font: "space-grotesk",
                    dark: expect.objectContaining({ primary: "#123456" }),
                }),
            }),
        }]);
        options.onSuccess();
        expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it("keeps Save disabled until the loaded kit actually changes", async () => {
        renderCard("admin", { branding: KIT });

        await userEvent.click(screen.getByRole("button", { name: "Edit" }));
        expect(screen.getByRole("button", { name: "Save brand kit" })).toBeDisabled();
        expect(screen.getByText("Nothing changed yet.")).toBeInTheDocument();
    });

    it("removes the kit with an empty branding after a confirm step", async () => {
        renderCard("admin", { branding: KIT });

        await userEvent.click(screen.getByRole("button", { name: "Remove brand kit" }));
        expect(screen.getByTestId("brand-kit-remove-panel")).toBeInTheDocument();
        expect(txMock).not.toHaveBeenCalled();

        const buttons = screen.getAllByRole("button", { name: "Remove brand kit" });
        await userEvent.click(buttons[buttons.length - 1]);

        expect(txMock).toHaveBeenCalledTimes(1);
        const [[msg]] = txMock.mock.calls[0];
        expect(msg.typeUrl).toBe("/bze.tokenfactory.MsgSetDenomBranding");
        expect(msg.value.branding).toBeUndefined();
    });
});
