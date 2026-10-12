import {describe, expect, it, vi} from "vitest";
import {type ReactNode, useState} from "react";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {DenomBranding} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: "dark", setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));

import {TokenSiteTheme, TsDialog, TsDrawer} from "./index";

forbidNetwork();

const KIT: DenomBranding = {
    font: "inter",
    light: {background: "#FFFFFF", text: "#000000", primary: "#123456", secondary: "#654321"},
    dark: {background: "#0A0A0A", text: "#FAFAFA", primary: "#ABCDEF", secondary: "#FEDCBA"},
};

function renderInTheme(ui: ReactNode) {
    return render(<ChakraProvider value={defaultSystem}><TokenSiteTheme kit={KIT}>{ui}</TokenSiteTheme></ChakraProvider>);
}

describe("TsDrawer", () => {
    it("renders outside the themed element and carries the theme variables itself", () => {
        renderInTheme(<TsDrawer open onClose={vi.fn()} title="Your wallet"><p>balance</p></TsDrawer>);

        const dialog = screen.getByRole("dialog", {name: "Your wallet"});
        expect(screen.getByTestId("token-site")).not.toContainElement(dialog);

        const layer = dialog.closest<HTMLElement>("[data-testid='token-site-layer']")!;
        expect(layer.style.getPropertyValue("--ts-bg")).toBe("#0A0A0A");
        expect(layer.style.getPropertyValue("--ts-pri")).toBe("#ABCDEF");
        expect(layer.style.getPropertyValue("--ts-font")).toBe("'Inter', system-ui, sans-serif");
        expect(dialog).toHaveTextContent("balance");
    });

    it("renders nothing while closed", () => {
        renderInTheme(<TsDrawer open={false} onClose={vi.fn()} title="Your wallet"><p>balance</p></TsDrawer>);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes from the close button and with Escape", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        renderInTheme(<TsDrawer open onClose={onClose} title="Your wallet"><p>balance</p></TsDrawer>);

        await user.click(screen.getByRole("button", {name: "Close"}));
        await user.keyboard("{Escape}");

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("closes when the backdrop is clicked", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        renderInTheme(<TsDrawer open onClose={onClose} title="Your wallet"><p>balance</p></TsDrawer>);

        const layer = screen.getByRole("dialog").closest<HTMLElement>("[data-testid='token-site-layer']")!;
        await user.click(layer.firstElementChild as HTMLElement);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps Tab inside the drawer and gives focus back to the opener on close", async () => {
        const user = userEvent.setup();

        function Harness() {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>Open wallet</button>
                    <button type="button">Page link</button>
                    <TsDrawer open={open} onClose={() => setOpen(false)} title="Your wallet" icon={<span data-testid="mark"/>}>
                        <button type="button">Claim all</button>
                        <button type="button">Disconnect</button>
                    </TsDrawer>
                </>
            );
        }
        renderInTheme(<Harness/>);

        const opener = screen.getByRole("button", {name: "Open wallet"});
        await user.click(opener);
        const dialog = screen.getByRole("dialog", {name: "Your wallet"});
        expect(dialog).toContainElement(screen.getByTestId("mark"));
        expect(dialog).toHaveFocus();

        await user.tab();
        expect(screen.getByRole("button", {name: "Close"})).toHaveFocus();
        await user.tab();
        await user.tab();
        expect(screen.getByRole("button", {name: "Disconnect"})).toHaveFocus();
        await user.tab();
        expect(screen.getByRole("button", {name: "Close"})).toHaveFocus();
        await user.tab({shift: true});
        expect(screen.getByRole("button", {name: "Disconnect"})).toHaveFocus();

        await user.keyboard("{Escape}");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(opener).toHaveFocus();
    });
});

describe("TsDialog", () => {
    it("carries the theme variables in its portal too", () => {
        renderInTheme(<TsDialog open onClose={vi.fn()} title="Confirm burn"><p>sure?</p></TsDialog>);

        const layer = screen.getByRole("dialog", {name: "Confirm burn"}).closest<HTMLElement>("[data-testid='token-site-layer']")!;
        expect(layer.style.getPropertyValue("--ts-sec")).toBe("#FEDCBA");
    });
});
