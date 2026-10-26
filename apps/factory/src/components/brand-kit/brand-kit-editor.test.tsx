import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { BRANDING_TEMPLATES, type Asset, type DenomBranding } from "@bze/bze-ui-kit";

// The editor with the tx layer and wallet stubbed: it asserts what templates do to the fields,
// the marks and Undo, and the message Save builds.
const { txMock, onSaved, onCancel } = vi.hoisted(() => ({ txMock: vi.fn(), onSaved: vi.fn(), onCancel: vi.fn() }));

vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1admin" }) }));

import { BrandKitEditor } from "./brand-kit-editor";

const TOKEN = {
    denom: "factory/bze1admin/utok",
    ticker: "TOK",
    name: "TOK Token",
    type: "factory",
    decimals: 6,
    logo: "",
} as unknown as Asset;

const KIT: DenomBranding = {
    font: "roboto",
    light: { background: "#FFFFFF", text: "#101010", primary: "#AA0000", secondary: "#555555" },
    dark: { background: "#000000", text: "#EEEEEE", primary: "#FF4444", secondary: "#999999" },
};

const OCEAN = BRANDING_TEMPLATES.find(t => t.id === "ocean")!;
const HONEY = BRANDING_TEMPLATES.find(t => t.id === "honey")!;

function renderEditor(initial: DenomBranding | null, saveBlocker?: string) {
    return render(<BrandKitEditor asset={TOKEN} initial={initial} saveBlocker={saveBlocker} onCancel={onCancel} onSaved={onSaved} />, {
        wrapper: ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });
}

const field = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const font = () => screen.getByRole("combobox", { name: "Font" }) as HTMLSelectElement;
const templateBox = () => screen.getByRole("button", { name: /Start from a template/ });

beforeEach(() => {
    txMock.mockReset().mockResolvedValue(true);
    onSaved.mockReset();
    onCancel.mockReset();
});

describe("BrandKitEditor", () => {
    it("starts a token without a kit from Honey, with the templates open", () => {
        renderEditor(null);

        expect(templateBox()).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByTestId("brand-kit-template-summary")).toHaveTextContent("Based on Honey");
        expect(font().value).toBe("poppins");
        expect(field("Light primary").value).toBe(HONEY.branding.light.primary);
        expect(screen.getByRole("button", { name: "Save brand kit" })).toBeEnabled();
    });

    it("keeps the templates folded when editing a stored kit, and opens them on click", async () => {
        renderEditor(KIT);

        expect(templateBox()).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("button", { name: "Apply the Ocean template" })).not.toBeInTheDocument();
        expect(screen.getByTestId("brand-kit-template-summary")).toHaveTextContent("20 ready-made colour sets");

        await userEvent.click(templateBox());
        expect(screen.getByRole("button", { name: "Apply the Ocean template" })).toBeInTheDocument();
    });

    it("applies a template to the font and both palettes", async () => {
        renderEditor(KIT);
        await userEvent.click(templateBox());
        await userEvent.click(screen.getByRole("button", { name: "Apply the Ocean template" }));

        expect(font().value).toBe(OCEAN.branding.font);
        for (const palette of ["Light", "Dark"] as const) {
            const colors = OCEAN.branding[palette === "Light" ? "light" : "dark"];
            expect(field(`${palette} background`).value).toBe(colors.background);
            expect(field(`${palette} text`).value).toBe(colors.text);
            expect(field(`${palette} primary`).value).toBe(colors.primary);
            expect(field(`${palette} secondary`).value).toBe(colors.secondary);
        }
        expect(screen.getByRole("button", { name: "Apply the Ocean template" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("brand-kit-template-summary")).toHaveTextContent(/^Based on Ocean$/);
        expect(screen.getByTestId("brand-kit-undo")).toHaveTextContent("Ocean set all eight colours and the font (Inter).");
    });

    it("filters the templates by mood", async () => {
        renderEditor(null);

        await userEvent.click(screen.getByRole("button", { name: "Pastel" }));
        const tiles = within(screen.getByTestId("brand-kit-templates")).getAllByRole("button", { name: /^Apply the / });
        expect(tiles.map(t => t.getAttribute("aria-label"))).toEqual([
            "Apply the Lavender template", "Apply the Blossom template", "Apply the Sage template",
        ]);
    });

    it("marks the fields changed since the template, font included, and counts them", async () => {
        renderEditor(KIT);
        await userEvent.click(templateBox());
        await userEvent.click(screen.getByRole("button", { name: "Apply the Ocean template" }));

        const darkPrimary = field("Dark primary");
        await userEvent.clear(darkPrimary);
        await userEvent.type(darkPrimary, "#123456");
        await userEvent.selectOptions(font(), "montserrat");

        expect(screen.getAllByText("changed from the template")).toHaveLength(2);
        expect(screen.getByTestId("brand-kit-template-summary")).toHaveTextContent("Based on Ocean · edited");
        expect(screen.getByTestId("brand-kit-undo")).toHaveTextContent("You changed 2 fields since.");
    });

    it("undoes back to the kit from before the first template click, font included", async () => {
        renderEditor(KIT);
        await userEvent.click(templateBox());
        await userEvent.click(screen.getByRole("button", { name: "Apply the Ocean template" }));
        await userEvent.click(screen.getByRole("button", { name: "Apply the Honey template" }));
        await userEvent.click(screen.getByRole("button", { name: "Undo" }));

        expect(font().value).toBe("roboto");
        expect(field("Light primary").value).toBe("#AA0000");
        expect(field("Dark text").value).toBe("#EEEEEE");
        expect(screen.queryByTestId("brand-kit-undo")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save brand kit" })).toBeDisabled();
        expect(screen.getByText("Nothing changed yet.")).toBeInTheDocument();
    });

    it("saves the applied template as the whole kit, with no template id", async () => {
        renderEditor(KIT);
        await userEvent.click(templateBox());
        await userEvent.click(screen.getByRole("button", { name: "Apply the Ocean template" }));
        await userEvent.click(screen.getByRole("button", { name: "Save brand kit" }));

        expect(txMock).toHaveBeenCalledTimes(1);
        const [msgs, options] = txMock.mock.calls[0];
        expect(msgs).toEqual([{
            typeUrl: "/bze.tokenfactory.MsgSetDenomBranding",
            value: { creator: "bze1admin", denom: TOKEN.denom, branding: OCEAN.branding },
        }]);
        options.onSuccess();
        expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("refuses bad hex with a field message and hides the preview until it is fixed", async () => {
        renderEditor(KIT);

        const lightBackground = field("Light background");
        await userEvent.clear(lightBackground);
        await userEvent.type(lightBackground, "#12ZZ56");
        expect(screen.getByText("Use a 6-digit hex colour like #1A2B3C.")).toBeInTheDocument();
        expect(screen.getByText("Fix the fields marked in red to see the preview.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save brand kit" })).toBeDisabled();

        await userEvent.clear(lightBackground);
        await userEvent.type(lightBackground, "#123456");
        const preview = within(screen.getByTestId("brand-kit-live-preview"));
        expect(preview.getByTestId("brand-kit-preview-light").querySelector("div")).toHaveStyle({ backgroundColor: "#123456" });
        expect(screen.getByRole("button", { name: "Save brand kit" })).toBeEnabled();
    });

    it("counts a case-only colour change as a change", async () => {
        renderEditor(KIT);

        const lightPrimary = field("Light primary");
        await userEvent.clear(lightPrimary);
        await userEvent.type(lightPrimary, "#aa0000");
        expect(screen.getByRole("button", { name: "Save brand kit" })).toBeEnabled();
    });

    it("explains why this wallet can't save, and still lets it try templates", async () => {
        renderEditor(null, "Connect your wallet.");

        await userEvent.click(screen.getByRole("button", { name: "Apply the Ocean template" }));
        expect(font().value).toBe("inter");
        expect(screen.getByRole("button", { name: "Save brand kit" })).toBeDisabled();
        expect(screen.getByText("Connect your wallet.")).toBeInTheDocument();
    });

    it("cancels without sending anything", async () => {
        renderEditor(KIT);
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(txMock).not.toHaveBeenCalled();
    });
});
