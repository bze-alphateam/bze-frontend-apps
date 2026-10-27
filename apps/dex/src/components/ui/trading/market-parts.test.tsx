import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { rulesFor } from "@/test-support/css-rules";
import { OrderBookRow } from "./market-parts";

describe("OrderBookRow", () => {
    it("stays about as dense as the old book, so 15 orders a side fit beside the chart", () => {
        render(
            <ChakraProvider value={defaultSystem}>
                <OrderBookRow side="sell" price="0.000341" amount="1151.769474" depth={50} onClick={() => {}} />
            </ChakraProvider>,
        );

        const css = rulesFor(screen.getByRole("button"));
        expect(css).toMatch(/padding-block:\s*1px/);
        expect(css).toMatch(/line-height:\s*16px/);
    });
});
