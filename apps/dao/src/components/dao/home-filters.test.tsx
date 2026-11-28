import {describe, expect, it, vi} from "vitest";
import {useState} from "react";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {MineSwitch} from "./home-filters";

function Controlled({onChange}: {onChange: (checked: boolean) => void}) {
    const [checked, setChecked] = useState(false);
    return <MineSwitch checked={checked} onChange={(next) => { setChecked(next); onChange(next); }} />;
}

const renderSwitch = (onChange = vi.fn()) => {
    render(<ChakraProvider value={defaultSystem}><Controlled onChange={onChange} /></ChakraProvider>);
    return {onChange, toggle: screen.getByRole("switch", {name: "My DAOs"})};
};

describe("MineSwitch", () => {
    it("is a switch named My DAOs that starts off", () => {
        const {toggle} = renderSwitch();
        expect(toggle).toHaveAttribute("aria-checked", "false");
        expect(toggle).not.toBeChecked();
    });

    it("toggles on and off with a click", async () => {
        const {toggle, onChange} = renderSwitch();
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-checked", "true");
        expect(onChange).toHaveBeenLastCalledWith(true);
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-checked", "false");
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it("toggles with Space and with Enter from the keyboard", async () => {
        const {toggle, onChange} = renderSwitch();
        await userEvent.tab();
        expect(toggle).toHaveFocus();
        await userEvent.keyboard(" ");
        expect(toggle).toHaveAttribute("aria-checked", "true");
        await userEvent.keyboard("{Enter}");
        expect(toggle).toHaveAttribute("aria-checked", "false");
        expect(onChange).toHaveBeenCalledTimes(2);
    });
});
