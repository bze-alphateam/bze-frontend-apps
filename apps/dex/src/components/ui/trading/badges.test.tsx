import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { createHiveGlowSystem } from "@bze/bze-ui-kit";

import { PriceImpactBadge, SideBadge } from "./badges";

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem("dex")}>{children}</ChakraProvider>
);

const impact = (percent: string) => {
    const { unmount } = render(<PriceImpactBadge percent={percent} />, { wrapper });
    const badge = screen.getByTestId("price-impact");
    const result = { text: badge.textContent, tone: badge.getAttribute("data-tone") };
    unmount();
    return result;
};

describe("PriceImpactBadge", () => {
    it("is green up to 0.5 % included", () => {
        expect(impact("0")).toEqual({ text: "0.00%", tone: "success" });
        expect(impact("0.5")).toEqual({ text: "0.50%", tone: "success" });
    });

    it("turns amber above 0.5 %, up to 1 % included", () => {
        expect(impact("0.51").tone).toBe("warning");
        expect(impact("1").tone).toBe("warning");
    });

    it("turns red above 1 %", () => {
        expect(impact("1.01")).toEqual({ text: "1.01%", tone: "danger" });
        expect(impact("37.5").tone).toBe("danger");
    });
});

describe("SideBadge", () => {
    it("labels a buy and a sell with their side", () => {
        render(
            <>
                <SideBadge orderType="buy" />
                <SideBadge orderType="sell" />
            </>,
            { wrapper },
        );
        const [buy, sell] = screen.getAllByTestId("side-badge");
        expect(buy.textContent).toBe("BUY");
        expect(buy.getAttribute("data-side")).toBe("buy");
        expect(sell.textContent).toBe("SELL");
        expect(sell.getAttribute("data-side")).toBe("sell");
    });
});
