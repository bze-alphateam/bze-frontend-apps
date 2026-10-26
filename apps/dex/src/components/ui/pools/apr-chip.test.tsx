import {describe, expect, it} from "vitest";
import {render, screen} from "@testing-library/react";
import {ChakraProvider} from "@chakra-ui/react";
import {createHiveGlowSystem} from "@bze/bze-ui-kit";
import {AprChip} from "./apr-chip";

const renderChip = (apr: number) => render(
    <ChakraProvider value={createHiveGlowSystem('dex')}><AprChip apr={apr}/></ChakraProvider>
);

describe("AprChip", () => {
    it.each([
        [15.01, 'success'],
        [15, 'warning'],
        [10.01, 'warning'],
        [10, 'app'],
        [0, 'app'],
    ])("an APR of %s%% takes the %s tone", (apr, tone) => {
        renderChip(apr);
        const chip = screen.getByTestId("apr-chip");
        expect(chip).toHaveAttribute("data-tone", tone);
        expect(chip).toHaveTextContent(`${apr.toFixed(2)}%`);
    });
});
