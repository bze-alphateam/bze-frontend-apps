import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import ChooseGrowPage from "./page";

// Choose how to grow a community (BFE-260): four cards, each a link with its chips.
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

describe("Choose how to grow a community", () => {
    it("asks who to reach, under Create / Community", () => {
        render(<ChooseGrowPage />, { wrapper });
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Who do you want to reach?");
        expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Community")).toBeInTheDocument();
    });

    it.each([
        ["Airdrop to stakers", "/denom-reward/airdrop", ["Compounded reward", "Any token's stakers"]],
        ["Send to a list of wallets", "/multisend", ["Multi-send", "No fee", "CSV"]],
        ["Run a burning raffle", "/raffle/new", ["Burner raffle", "No fee"]],
        ["Reach another community", "/reach", ["Airdrop or daily prize", "On their token"]],
    ])("%s links to its form with its chips", (title, href, chips) => {
        render(<ChooseGrowPage />, { wrapper });
        const link = screen.getByRole("link", { name: new RegExp(title) });
        expect(link).toHaveAttribute("href", href);
        for (const chip of chips) expect(within(link).getByText(chip)).toBeInTheDocument();
    });

    it("never promises a free airdrop: a new prize token may pay the prize fee", () => {
        render(<ChooseGrowPage />, { wrapper });
        expect(screen.queryByText("No extra fee")).not.toBeInTheDocument();
    });
});
