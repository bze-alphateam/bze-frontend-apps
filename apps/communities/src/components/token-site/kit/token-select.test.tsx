import {describe, expect, it, vi} from "vitest";
import {useState} from "react";
import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import {TsTokenSelect, type TsTokenOption} from "./index";

forbidNetwork();

const OPTIONS: TsTokenOption[] = [
    {denom: "ubze", ticker: "BZE", logo: "https://example.test/bze.svg"},
    {denom: "uusdc", ticker: "TUSDC"},
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
        expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["BZE", "TUSDC"]);
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
});
