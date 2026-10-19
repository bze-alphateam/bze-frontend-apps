import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { TallyBar, TallyLegend } from "./tally-bar";

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

// Every option has votes, so the bar draws all four segments.
const tally = { yes_count: "60", no_count: "20", no_with_veto_count: "15", abstain_count: "5" };

const colorOf = (root: HTMLElement, option: string) =>
    root.querySelector(`[data-option="${option}"]`)?.getAttribute("data-color");

describe("TallyBar", () => {
    it("draws No with veto in the amber warning token, not orange", () => {
        render(<TallyBar tally={tally} />, { wrapper });
        const bar = screen.getByRole("img", { name: "Tally: Yes 60%, No 20%, No with veto 15%, Abstain 5%" });

        expect(colorOf(bar, "no_with_veto")).toBe("hg.warning");
    });

    it("draws Yes, No and Abstain in the data colours", () => {
        render(<TallyBar tally={tally} />, { wrapper });
        const bar = screen.getByRole("img");

        expect(colorOf(bar, "yes")).toBe("hg.up");
        expect(colorOf(bar, "no")).toBe("hg.down");
        expect(colorOf(bar, "abstain")).toBe("hg.flat");
    });

    it("skips options nobody voted", () => {
        render(<TallyBar tally={{ yes_count: "10", no_count: "0", no_with_veto_count: "0", abstain_count: "0" }} />, { wrapper });
        const bar = screen.getByRole("img");

        expect(bar.querySelectorAll("[data-option]")).toHaveLength(1);
        expect(colorOf(bar, "yes")).toBe("hg.up");
    });
});

describe("TallyLegend", () => {
    it("uses the same tokens as the bar for its swatches", () => {
        const { container } = render(<TallyLegend tally={tally} />, { wrapper });

        expect(colorOf(container, "no_with_veto")).toBe("hg.warning");
        expect(colorOf(container, "yes")).toBe("hg.up");
    });
});
