import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useAsset: () => ({ asset: undefined, isLoading: false }),
}));

import { GoalCard } from "./goal-card";
import type { Goal } from "@/lib/goals";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

const GOAL: Goal = { id: "multisend", group: "community", title: "Send to a list of wallets", description: "d", techTag: "Multi-send", synonyms: [] };

describe("GoalCard", () => {
    it("a goal without a target is Coming soon and does nothing", async () => {
        const onOpen = vi.fn();
        render(<GoalCard goal={GOAL} onOpen={onOpen} />, { wrapper });
        expect(screen.getByText("Coming soon")).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("goal-multisend"));
        expect(onOpen).not.toHaveBeenCalled();
    });

    it("a live goal opens", async () => {
        const onOpen = vi.fn();
        render(<GoalCard goal={{ ...GOAL, href: () => "/multisend" }} onOpen={onOpen} />, { wrapper });
        expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
        await userEvent.click(screen.getByTestId("goal-multisend"));
        expect(onOpen).toHaveBeenCalled();
    });
});
