import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        utok: { denom: "utok", ticker: "TOK", decimals: 6 },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6 },
        uatom: { denom: "uatom", ticker: "ATOM", decimals: 6 },
    };
    return { ...actual, useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }) };
});

import { PrizeTokenQuestion } from "./prize-token-question";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const PRIZES = [{ prize_denom: "ubze" }, { prize_denom: "ufoo" }];
const FEE = { denom: "ubze", amount: "25000000000" };

const renderQuestion = (value: string, max?: number) => render(
    <PrizeTokenQuestion
        denomReward={{ staking_denom: "utok" }}
        prizes={PRIZES}
        maxPrizeDenoms={max}
        prizeFee={FEE}
        value={value}
        onSelect={vi.fn()}
    />,
    { wrapper },
);

describe("PrizeTokenQuestion", () => {
    it("labels the picker and says nothing before a pick", () => {
        renderQuestion("", 5);
        expect(screen.getByText("Prize token (paid from your wallet)")).toBeInTheDocument();
        expect(screen.queryByText(/prize fee/)).not.toBeInTheDocument();
    });

    it("a new prize takes the next slot and pays the one-time fee", () => {
        renderQuestion("uatom", 5);
        expect(screen.getByText(
            "ATOM is new to TOK's compounded reward, so the one-time new prize fee (25,000 BZE) applies. It takes prize slot 3 of 5 for good. Paying ATOM here again later is free.",
        )).toBeInTheDocument();
    });

    it("without a known cap the slot has no maximum", () => {
        renderQuestion("uatom");
        expect(screen.getByText(/It takes prize slot 3 for good/)).toBeInTheDocument();
    });

    it("a prize the compounded reward already pays costs no prize fee", () => {
        renderQuestion("ubze", 2);
        expect(screen.getByText("No prize fee: TOK already pays BZE.")).toBeInTheDocument();
        expect(screen.queryByText(/maximum/)).not.toBeInTheDocument();
    });

    it("a new prize past the cap is refused", () => {
        renderQuestion("uatom", 2);
        expect(screen.getByText(
            "This compounded reward already uses 2 prize tokens, the maximum of 2. Pick a prize token it already pays.",
        )).toBeInTheDocument();
        expect(screen.queryByText(/is new to/)).not.toBeInTheDocument();
    });
});
