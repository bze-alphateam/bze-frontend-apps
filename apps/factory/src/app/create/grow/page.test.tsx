import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import ChooseGrowPage from "./page";

// Choose how to grow a community: two cards, Airdrop coins and the burning raffle.
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

describe("Choose how to grow a community", () => {
    it("asks how to grow, under Create / Community", () => {
        render(<ChooseGrowPage />, { wrapper });
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How do you want to grow?");
        expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Community")).toBeInTheDocument();
    });

    it("has exactly the two options, each with its button", () => {
        render(<ChooseGrowPage />, { wrapper });
        expect(screen.getAllByTestId("option-card")).toHaveLength(2);
        expect(within(screen.getByRole("region", { name: "Airdrop coins" })).getByRole("link", { name: /Airdrop coins/ })).toHaveAttribute("href", "/airdrop");
        expect(within(screen.getByRole("region", { name: "Run a burning raffle" })).getByRole("link", { name: /Run a raffle/ })).toHaveAttribute("href", "/raffle/new");
    });

    it("never promises a free airdrop: a new prize coin may pay the prize fee", () => {
        render(<ChooseGrowPage />, { wrapper });
        expect(screen.queryByText(/No fee|No extra fee/)).not.toBeInTheDocument();
    });
});
