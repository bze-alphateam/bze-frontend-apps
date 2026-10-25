import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label }: { label: string }) => <div>{label}</div>,
}));

import { PrizeTokenQuestion } from "./prize-token-question";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const PRIZES = [{ prize_denom: "ubze" }, { prize_denom: "ufoo" }];

const renderQuestion = (value: string, max?: number) => render(
    <PrizeTokenQuestion prizes={PRIZES} maxPrizeDenoms={max} value={value} onSelect={vi.fn()} />,
    { wrapper },
);

describe("PrizeTokenQuestion", () => {
    it("labels the picker \"Reward token\" and explains nothing", () => {
        renderQuestion("uatom", 5);
        expect(screen.getByText("Reward token")).toBeInTheDocument();
        expect(screen.queryByText(/prize fee/)).not.toBeInTheDocument();
        expect(screen.queryByText(/prize slot/)).not.toBeInTheDocument();
    });

    it("a reward token the compounded reward already pays shows no note", () => {
        renderQuestion("ubze", 2);
        expect(screen.queryByText(/No prize fee/)).not.toBeInTheDocument();
        expect(screen.queryByText(/reached/)).not.toBeInTheDocument();
    });

    it("a new reward token past the cap is refused", () => {
        renderQuestion("uatom", 2);
        expect(screen.getByText("Max 2 reward tokens reached.")).toBeInTheDocument();
    });
});
