import {describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {ChakraProvider, Grid} from "@chakra-ui/react";
import {createHiveGlowSystem} from "@bze/bze-ui-kit";

import {rulesFor} from "@/test-support/css-rules";
import {AmountField, FeeShare, PillTabs} from "./pool-parts";

const system = createHiveGlowSystem("dex");
const ui = (node: ReactNode) => render(node, {wrapper: ({children}) => <ChakraProvider value={system}>{children}</ChakraProvider>});

describe("PillTabs", () => {
    const tabs = [
        {value: "add" as const, label: "Add Liquidity", short: "Add"},
        {value: "remove" as const, label: "Remove Liquidity", short: "Remove"},
        {value: "lock" as const, label: "Boost Rewards", short: "Boost"},
    ];

    it("keeps the tabs on one row across the card on a phone, with their short labels", () => {
        ui(<PillTabs aria-label="Pool actions" value="add" onChange={() => {}} tabs={tabs}/>);

        expect(rulesFor(screen.getByTestId("pill-tabs"))).toMatch(/flex-wrap:\s*nowrap/);
        const add = screen.getByRole("tab", {name: /Add/});
        expect(add.textContent).toBe("Add LiquidityAdd");
        expect(rulesFor(add)).toMatch(/flex:\s*1/);
        expect(rulesFor(add)).toMatch(/white-space:\s*nowrap/);
    });

    it("shows the one label when a tab has no short form", () => {
        ui(<PillTabs aria-label="Tabs" value="a" onChange={() => {}} tabs={[{value: "a", label: "Alpha"}]}/>);
        expect(screen.getByRole("tab").textContent).toBe("Alpha");
    });
});

describe("AmountField", () => {
    it("puts Max inside the amount field and fills it on click", () => {
        const onMax = vi.fn();
        ui(<AmountField label="LMN Amount" available="5" value="" onChange={() => {}} onMax={onMax}/>);

        const input = screen.getByLabelText("LMN Amount");
        const group = input.parentElement as HTMLElement;
        const max = within(group).getByRole("button", {name: "Max"});
        fireEvent.click(max);
        expect(onMax).toHaveBeenCalledOnce();
    });
});

describe("FeeShare", () => {
    it("fills its grid cell and pins its number to the bottom, so a wrapped label leaves the row level", () => {
        ui(
            <Grid templateColumns="repeat(3, 1fr)">
                <FeeShare label="Buyback & Burn" hint="Fees used to buyback and burn BZE tokens" loading={false}>50%</FeeShare>
            </Grid>,
        );
        const css = rulesFor(screen.getByTestId("fee-share"));
        expect(css).toMatch(/height:\s*(100%|var\(--chakra-sizes-full\))/);
        expect(css).toMatch(/justify-content:\s*space-between/);
    });
});
