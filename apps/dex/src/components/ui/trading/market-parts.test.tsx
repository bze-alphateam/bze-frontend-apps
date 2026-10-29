import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { rulesFor } from "@/test-support/css-rules";
import { OrderBookRow, OrderField } from "./market-parts";

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

describe("OrderField", () => {
    // regression: the order amount took any number of decimals, so "1.0000001" of a 6-decimal
    // base went into MsgCreateOrder as "1000000.1" and failed ValidateBasic after signing
    it("drops typed digits past the asset decimals", () => {
        const onChange = vi.fn();
        render(
            <ChakraProvider value={defaultSystem}>
                <OrderField label="Amount" unit="BZE" value="" onChange={onChange} maxDecimals={6} />
            </ChakraProvider>,
        );

        fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1.0000001" } });
        expect(onChange).toHaveBeenLastCalledWith("1.000000");
    });

    it("leaves a price field uncapped", () => {
        const onChange = vi.fn();
        render(
            <ChakraProvider value={defaultSystem}>
                <OrderField label="Price" unit="USDC" value="" onChange={onChange} />
            </ChakraProvider>,
        );

        fireEvent.change(screen.getByLabelText("Price"), { target: { value: "0.00000000123" } });
        expect(onChange).toHaveBeenLastCalledWith("0.00000000123");
    });
});
