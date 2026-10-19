import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { UnbondingTag } from "./unbonding-delegations";

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

describe("UnbondingTag", () => {
    it("shows the days left in the amber warning tone while unbonding", () => {
        render(<UnbondingTag completed={false} daysLeft={12} />, { wrapper });

        const tag = screen.getByTestId("status-pill");
        expect(tag).toHaveTextContent("12d left");
        expect(tag).toHaveAttribute("data-tone", "warning");
    });

    it("shows Ready in the success tone once complete", () => {
        render(<UnbondingTag completed daysLeft={0} />, { wrapper });

        const tag = screen.getByTestId("status-pill");
        expect(tag).toHaveTextContent("Ready");
        expect(tag).toHaveAttribute("data-tone", "success");
    });
});
