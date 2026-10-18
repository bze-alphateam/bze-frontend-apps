import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: navigateMock }) }));
vi.mock("@bze/bze-ui-kit", () => ({
    useAsset: (denom: string) => ({ asset: denom === "factory/bze1x/honey" ? { ticker: "HONEY" } : undefined }),
}));

import { RewardGuideModal } from "./reward-guide-modal";
import { RewardInfoButton } from "./reward-info-button";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

beforeEach(() => {
    navigateMock.mockReset();
});

describe("RewardGuideModal", () => {
    it("renders the three cards and the comparison table", async () => {
        render(<RewardGuideModal open={true} onClose={() => {}} />, { wrapper });

        const dialog = await screen.findByRole("dialog", { name: "Which reward fits?" });
        expect(dialog).toHaveTextContent("Three ways to reward people. Pick the sentence that sounds like you.");
        expect(screen.getByText("Most creators start here")).toBeInTheDocument();
        expect(screen.getByText("Campaigns")).toBeInTheDocument();
        expect(screen.getByText("One-off")).toBeInTheDocument();

        const table = screen.getByRole("table", { name: "Rewards compared", hidden: true });
        expect(table).toHaveTextContent("How long");
        expect(table).toHaveTextContent("A lock you choose (0 days or more)");
        expect(table).toHaveTextContent("Thank-yous and reaching new people");
        expect(screen.getByTestId("reward-comparison-stacked")).toBeInTheDocument();
    });

    it.each([
        ["holder", "→ Holder rewards"],
        ["program", "→ Staking program"],
        ["airdrop", "→ Airdrop"],
    ] as const)("calls onPick with %s and closes", async (kind, action) => {
        const onPick = vi.fn();
        const onClose = vi.fn();
        render(<RewardGuideModal open={true} onClose={onClose} onPick={onPick} />, { wrapper });

        await userEvent.click(await screen.findByRole("button", { name: new RegExp(action) }));
        expect(onPick).toHaveBeenCalledWith(kind);
        expect(onClose).toHaveBeenCalled();
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("navigates to each kind's page without onPick", async () => {
        render(<RewardGuideModal open={true} onClose={() => {}} />, { wrapper });
        await userEvent.click(await screen.findByTestId("reward-guide-program"));
        expect(navigateMock).toHaveBeenCalledWith("/reward/new");
        await userEvent.click(screen.getByTestId("reward-guide-airdrop"));
        expect(navigateMock).toHaveBeenLastCalledWith("/rewards");
    });

    it("offers to browse holder rewards without a denom", async () => {
        render(<RewardGuideModal open={true} onClose={() => {}} />, { wrapper });
        await userEvent.click(await screen.findByRole("button", { name: "Browse holder rewards" }));
        expect(navigateMock).toHaveBeenCalledWith("/rewards");
    });

    it("offers to make the token stakable with a denom", async () => {
        render(<RewardGuideModal open={true} onClose={() => {}} denom="factory/bze1x/honey" />, { wrapper });
        await userEvent.click(await screen.findByRole("button", { name: "Make HONEY stakable" }));
        expect(navigateMock).toHaveBeenCalledWith("/denom-reward/token?denom=factory%2Fbze1x%2Fhoney");
    });
});

describe("RewardInfoButton", () => {
    it("opens with a click and closes with Close", async () => {
        render(<RewardInfoButton />, { wrapper });
        await userEvent.click(screen.getByRole("button", { name: "Which reward fits?" }));
        expect(await screen.findByRole("dialog", { name: "Which reward fits?" })).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Close" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("opens from the keyboard, closes on Esc and gives the focus back", async () => {
        render(<RewardInfoButton withLabel={true} />, { wrapper });
        const button = screen.getByRole("button", { name: "Which reward fits?" });
        expect(button).toHaveTextContent("Which one?");

        button.focus();
        await userEvent.keyboard("{Enter}");
        expect(await screen.findByRole("dialog", { name: "Which reward fits?" })).toBeInTheDocument();

        await userEvent.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        await waitFor(() => expect(button).toHaveFocus());
    });

    it("keeps clicks away from a clickable parent", async () => {
        const parentClick = vi.fn();
        render(<div onClick={parentClick}><RewardInfoButton /></div>, { wrapper });
        await userEvent.click(screen.getByRole("button", { name: "Which reward fits?" }));
        await userEvent.click(await screen.findByRole("button", { name: "Close" }));
        expect(parentClick).not.toHaveBeenCalled();
    });
});
