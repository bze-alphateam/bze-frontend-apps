import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

import { RaffleResultAnimation } from "./raffle-result-animation";

const EMOJI = /\p{Extended_Pictographic}/u;

function mockReducedMotion(reduce: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
        matches: reduce && query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

function renderOverlay(props: Partial<Parameters<typeof RaffleResultAnimation>[0]> = {}) {
    return render(<RaffleResultAnimation result="waiting" ticker="NOAD" {...props} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("Raffle result overlay", () => {
    it("draws the rising embers when motion is allowed", () => {
        mockReducedMotion(false);
        renderOverlay();

        expect(screen.getByTestId("raffle-result")).toHaveAttribute("data-motion", "full");
        expect(screen.getAllByTestId("raffle-spark").length).toBeGreaterThan(0);
    });

    it("turns the animation off when the user prefers reduced motion", () => {
        mockReducedMotion(true);
        renderOverlay();

        expect(screen.getByTestId("raffle-result")).toHaveAttribute("data-motion", "reduced");
        expect(screen.queryAllByTestId("raffle-spark")).toHaveLength(0);
    });

    it.each([
        { result: "waiting" as const },
        { result: "win" as const, amount: "12" },
        { result: "lose" as const },
        { result: "summary" as const, totalContributions: 3, winnersCount: 1, losersCount: 2, totalWon: "12", contributionPrice: "1" },
        { result: "summary" as const, totalContributions: 1, winnersCount: 0, losersCount: 1 },
    ])("shows its $result copy without emoji", (props) => {
        vi.useFakeTimers();
        mockReducedMotion(true);
        renderOverlay(props);
        // A win or a loss shows half a second after the overlay opens.
        act(() => {
            vi.advanceTimersByTime(600);
        });

        const text = screen.getByTestId("raffle-result").textContent ?? "";
        expect(text.trim()).not.toBe("");
        expect(text).not.toMatch(EMOJI);
    });
});
