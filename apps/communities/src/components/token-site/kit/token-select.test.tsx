import {describe, expect, it, vi} from "vitest";
import {useState} from "react";
import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import {TsTokenSelect, type TsTokenOption} from "./index";

forbidNetwork();

const LONG_TICKER = "SUPERLONGTICKERNAME";
const OPTIONS: TsTokenOption[] = [
    {denom: "ubze", ticker: "BZE", logo: "https://example.test/bze.svg"},
    {denom: "uusdc", ticker: "TUSDC"},
    {denom: "ulong", ticker: LONG_TICKER},
];

function Picker({onChange = vi.fn()}: { onChange?: (denom: string) => void }) {
    const [value, setValue] = useState("ubze");
    return (
        <TsTokenSelect
            label="Pay with"
            value={value}
            options={OPTIONS}
            onChange={(denom) => {
                setValue(denom);
                onChange(denom);
            }}
        />
    );
}

function renderPicker(onChange?: (denom: string) => void) {
    return render(<ChakraProvider value={defaultSystem}><Picker onChange={onChange}/></ChakraProvider>);
}

describe("TsTokenSelect", () => {
    it("lists every token and selects one", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderPicker(onChange);

        const select = screen.getByRole("combobox", {name: "Pay with"});
        expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["BZE", "TUSDC", LONG_TICKER]);
        expect(select).toHaveValue("ubze");

        await user.selectOptions(select, "uusdc");

        expect(onChange).toHaveBeenCalledWith("uusdc");
        expect(select).toHaveValue("uusdc");
    });

    it("is a native select reachable with Tab, named by its label only", async () => {
        const user = userEvent.setup();
        const {container} = renderPicker();

        await user.tab();

        const select = screen.getByRole("combobox", {name: "Pay with"});
        expect(select.tagName).toBe("SELECT");
        expect(select).toHaveFocus();
        // The logo and chevron are decoration: hidden from assistive tech, never focusable.
        const decoration = [...container.querySelectorAll("svg, img")];
        expect(decoration.length).toBeGreaterThanOrEqual(2);
        expect(decoration.every((node) => node.closest("[aria-hidden='true']"))).toBe(true);
        expect(screen.getAllByRole("combobox")).toHaveLength(1);
    });

    it("shows the picked token's logo, and its initials when it has none", async () => {
        const user = userEvent.setup();
        renderPicker();

        const mark = screen.getByTestId("token-select-logo");
        expect(mark.querySelector("img")).toHaveAttribute("src", "https://example.test/bze.svg");

        await user.selectOptions(screen.getByRole("combobox", {name: "Pay with"}), "uusdc");

        expect(within(screen.getByTestId("token-select-logo")).getByTestId("token-initials")).toHaveTextContent("TU");
    });

    it("shows the full picked ticker beside the logo, not under it, and follows a change", async () => {
        const user = userEvent.setup();
        renderPicker();

        const ticker = screen.getByTestId("token-select-ticker");
        expect(ticker).toHaveTextContent(/^BZE$/);
        // The ticker is its own box in the row after the logo: never the select's padded text.
        expect(screen.getByTestId("token-select-logo").nextElementSibling).toBe(ticker);

        await user.selectOptions(screen.getByRole("combobox", {name: "Pay with"}), "uusdc");

        expect(screen.getByTestId("token-select-ticker")).toHaveTextContent(/^TUSDC$/);
    });

    it("keeps one accessible name and picks with the keyboard focus on the select", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderPicker(onChange);

        await user.tab();
        const select = screen.getByRole("combobox", {name: "Pay with"});
        expect(select).toHaveFocus();
        // The visible ticker is drawn for sight only: the select announces the picked option.
        expect(screen.getByTestId("token-select-ticker")).toHaveAttribute("aria-hidden", "true");

        await user.selectOptions(select, "ulong");

        expect(select).toHaveFocus();
        expect(onChange).toHaveBeenCalledWith("ulong");
        expect(select).toHaveDisplayValue(LONG_TICKER);
    });

    it("ends a ticker longer than the pill's cap in an ellipsis", async () => {
        const user = userEvent.setup();
        renderPicker();

        await user.selectOptions(screen.getByRole("combobox", {name: "Pay with"}), "ulong");

        const ticker = screen.getByTestId("token-select-ticker");
        expect(ticker).toHaveTextContent(LONG_TICKER);
        expect(ticker).toHaveStyle({overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: "0"});
        expect(ticker.parentElement).toHaveStyle({maxWidth: "11rem"});
    });

    it("drops the keyboard ring for a mouse press and brings it back on a key press", async () => {
        const user = userEvent.setup();
        renderPicker();

        const select = screen.getByRole("combobox", {name: "Pay with"});
        const pill = select.parentElement!;
        await user.tab();
        expect(pill).not.toHaveAttribute("data-pointer");

        await user.click(select);
        expect(select).toHaveFocus();
        expect(pill).toHaveAttribute("data-pointer");

        await user.keyboard("{ArrowDown}");
        expect(pill).not.toHaveAttribute("data-pointer");
    });
});
