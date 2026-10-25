import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { DEFAULT_FEE_SPLIT, type FeeSplit, FeeSplitSlider, setFeeShare } from "./fee-split-slider";

// The slider measures its thumbs with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

function Harness({ initial = DEFAULT_FEE_SPLIT }: { initial?: FeeSplit }) {
    const [split, setSplit] = useState(initial);
    return (
        <ChakraProvider value={defaultSystem}>
            <FeeSplitSlider value={split} onChange={setSplit} />
            <output data-testid="split">{`${split.providers}/${split.burner}/${split.treasury}`}</output>
        </ChakraProvider>
    );
}

const box = (label: string) => screen.getByRole("textbox", { name: `${label} (%)` });

describe("setFeeShare", () => {
    it("keeps the sum at 100 whichever share is typed", () => {
        expect(setFeeShare({ providers: 30, burner: 36, treasury: 34 }, "providers", 50)).toEqual({ providers: 50, burner: 36, treasury: 14 });
        expect(setFeeShare({ providers: 30, burner: 36, treasury: 34 }, "providers", 80)).toEqual({ providers: 80, burner: 20, treasury: 0 });
        expect(setFeeShare({ providers: 30, burner: 36, treasury: 34 }, "burner", 80)).toEqual({ providers: 20, burner: 80, treasury: 0 });
        expect(setFeeShare({ providers: 30, burner: 36, treasury: 34 }, "treasury", 50)).toEqual({ providers: 30, burner: 20, treasury: 50 });
        expect(setFeeShare({ providers: 30, burner: 36, treasury: 34 }, "treasury", 90)).toEqual({ providers: 10, burner: 0, treasury: 90 });
    });

    it("clamps to 0–100", () => {
        expect(setFeeShare(DEFAULT_FEE_SPLIT, "burner", 250)).toEqual({ providers: 0, burner: 100, treasury: 0 });
        expect(setFeeShare(DEFAULT_FEE_SPLIT, "providers", -5)).toEqual({ providers: 0, burner: 0, treasury: 100 });
    });
});

describe("FeeSplitSlider", () => {
    it("shows each share in its own box", () => {
        render(<Harness initial={{ providers: 30, burner: 36, treasury: 34 }} />);
        expect(box("Providers")).toHaveValue("30");
        expect(box("Burner")).toHaveValue("36");
        expect(box("Treasury")).toHaveValue("34");
    });

    it("typing a share moves the split and the other boxes follow", async () => {
        render(<Harness />);
        await userEvent.clear(box("Burner"));
        await userEvent.type(box("Burner"), "40");
        expect(screen.getByTestId("split")).toHaveTextContent("60/40/0");
        expect(box("Providers")).toHaveValue("60");
        expect(box("Treasury")).toHaveValue("0");
    });

    it("ignores anything but digits", async () => {
        render(<Harness />);
        await userEvent.clear(box("Treasury"));
        await userEvent.type(box("Treasury"), "1a5");
        expect(box("Treasury")).toHaveValue("15");
        expect(screen.getByTestId("split")).toHaveTextContent("85/0/15");
    });
});
