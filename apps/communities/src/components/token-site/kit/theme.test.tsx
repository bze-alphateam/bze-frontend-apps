import {afterEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {type DenomBranding, Toaster, useToast} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const colorMode = vi.hoisted(() => ({value: "dark"}));
vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: colorMode.value, setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));

import {TokenSiteTheme} from "./index";

forbidNetwork();

const KIT: DenomBranding = {
    font: "inter",
    light: {background: "#FFFFFF", text: "#000000", primary: "#123456", secondary: "#654321"},
    dark: {background: "#0A0A0A", text: "#FAFAFA", primary: "#ABCDEF", secondary: "#FEDCBA"},
};

const rootVar = (name: string) => document.documentElement.style.getPropertyValue(name);

/** Raises a success toast the way the token page's transactions do. */
function StakeButton() {
    const {toast} = useToast();
    return <button type="button" onClick={() => toast.success("Staked")}>Stake</button>;
}

function renderPage() {
    return render(
        <ChakraProvider value={defaultSystem}>
            <Toaster/>
            <TokenSiteTheme kit={KIT}><StakeButton/></TokenSiteTheme>
        </ChakraProvider>,
    );
}

afterEach(() => {
    colorMode.value = "dark";
});

describe("TokenSiteTheme toasts", () => {
    it("themes the toaster with the kit while the token page is mounted", async () => {
        renderPage();
        await userEvent.click(screen.getByRole("button", {name: "Stake"}));

        // The toast renders in the toaster's portal, outside the themed element, so the values sit on the document root.
        const toast = await screen.findByText("Staked");
        expect(screen.getByTestId("token-site")).not.toContainElement(toast);
        expect(rootVar("--hg-toast-fg")).toBe("#FAFAFA");
        expect(rootVar("--hg-toast-bg")).toBe("#151515");
        expect(rootVar("--hg-toast-muted")).toBe("color-mix(in oklab, #FAFAFA 64%, #0A0A0A)");
        expect(rootVar("--hg-toast-border")).toBe("#252525");
        expect(rootVar("--hg-toast-font")).toBe("'Inter', system-ui, sans-serif");
        expect(rootVar("--hg-toast-shadow")).toContain("color-mix(in oklab, #ABCDEF 55%, transparent)");
    });

    it("follows the colour mode", () => {
        const {rerender} = renderPage();
        expect(rootVar("--hg-toast-fg")).toBe("#FAFAFA");

        colorMode.value = "light";
        rerender(
            <ChakraProvider value={defaultSystem}>
                <Toaster/>
                <TokenSiteTheme kit={KIT}><StakeButton/></TokenSiteTheme>
            </ChakraProvider>,
        );
        expect(rootVar("--hg-toast-fg")).toBe("#000000");
        expect(rootVar("--hg-toast-shadow")).toContain("#123456");
    });

    it("hands the toaster back to the app look after the token page unmounts", () => {
        const {unmount} = renderPage();
        expect(rootVar("--hg-toast-bg")).not.toBe("");

        unmount();
        for (const name of ["bg", "fg", "muted", "faint", "border", "hover", "line", "radius", "shadow", "font"]) {
            expect(rootVar(`--hg-toast-${name}`)).toBe("");
        }
    });
});

describe("TokenSiteTheme colour mode", () => {
    const siteMarkup = () => {
        const {container, unmount} = render(<ChakraProvider value={defaultSystem}><TokenSiteTheme kit={KIT}><p>page</p></TokenSiteTheme></ChakraProvider>);
        const html = container.innerHTML;
        unmount();
        return html;
    };

    it("renders the same markup in either mode, so the server's HTML never disagrees with the browser", () => {
        colorMode.value = "light";
        const light = siteMarkup();
        colorMode.value = "dark";
        const dark = siteMarkup();
        colorMode.value = undefined as unknown as string;
        const unknown = siteMarkup();

        expect(dark).toBe(light);
        expect(unknown).toBe(light);
    });

    it("carries both palettes on the element", () => {
        render(<ChakraProvider value={defaultSystem}><TokenSiteTheme kit={KIT}><p>page</p></TokenSiteTheme></ChakraProvider>);
        const site = screen.getByTestId("token-site");

        expect(site.style.getPropertyValue("--ts-light-bg")).toBe("#FFFFFF");
        expect(site.style.getPropertyValue("--ts-dark-bg")).toBe("#0A0A0A");
        expect(site.style.getPropertyValue("--ts-light-pri")).toBe("#123456");
        expect(site.style.getPropertyValue("--ts-dark-pri")).toBe("#ABCDEF");
        // The values never sit on the unprefixed names: those come from the mode rule in CSS.
        expect(site.style.getPropertyValue("--ts-bg")).toBe("");
    });
});
