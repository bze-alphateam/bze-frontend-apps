import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { createHiveGlowSystem } from "@bze/bze-ui-kit";
import { TxPanel, TxPanelProps, shortHash } from "./tx-panel";

const system = createHiveGlowSystem("factory");
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={system}>{children}</ChakraProvider>;

const HASH = "ABCDEF0123456789ABCDEF0123456789";

function renderPanel(props: Partial<TxPanelProps> & Pick<TxPanelProps, "status">) {
    const handlers = { onRetry: vi.fn(), onEdit: vi.fn(), onContinue: vi.fn(), onCheckStatus: vi.fn(), onKeepWaiting: vi.fn() };
    render(<TxPanel {...handlers} {...props} />, { wrapper });
    return handlers;
}

describe("TxPanel", () => {
    it("confirm in your wallet: points to the wallet and has no button at all (no Cancel)", () => {
        renderPanel({ status: "confirm" });
        expect(screen.getByRole("heading", { name: "Confirm in your wallet" })).toBeInTheDocument();
        expect(screen.getByText(/To cancel, reject it in your wallet/)).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("submitted: the short hash and an Explorer link, no buttons", () => {
        renderPanel({ status: "submitted", hash: HASH });
        expect(screen.getByRole("heading", { name: "Submitted, waiting for a block" })).toBeInTheDocument();
        expect(screen.getByText(shortHash(HASH))).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("href", expect.stringContaining(`/txs/${HASH}`));
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("confirmed: the block and Continue to the Done screen", async () => {
        const h = renderPanel({ status: "confirmed", hash: HASH, height: 1234567 });
        expect(screen.getByText("Included in block 1,234,567.")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        expect(h.onContinue).toHaveBeenCalledOnce();
    });

    it("declined: nothing left the wallet, Try again or Edit answers", async () => {
        const h = renderPanel({ status: "declined" });
        expect(screen.getByText("Nothing left your wallet. Your answers are still here.")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        await userEvent.click(screen.getByRole("button", { name: "Edit answers" }));
        expect(h.onRetry).toHaveBeenCalledOnce();
        expect(h.onEdit).toHaveBeenCalledOnce();
    });

    it("failed on chain: the plain reason first, the raw log behind Details, only the network fee spent", async () => {
        const h = renderPanel({ status: "failed", hash: HASH, error: { reason: "Out of gas", details: "raw: out of gas in location", feeSpent: true } });
        expect(screen.getByText("Out of gas")).toBeInTheDocument();
        expect(screen.getByText(/Only the network fee was spent/)).toBeInTheDocument();
        expect(screen.queryByText("raw: out of gas in location")).not.toBeInTheDocument();

        const details = screen.getByRole("button", { name: "Details" });
        expect(details).toHaveAttribute("aria-expanded", "false");
        await userEvent.click(details);
        expect(details).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("raw: out of gas in location")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(h.onRetry).toHaveBeenCalledOnce();
    });

    it("failed before the wallet opened: the reason, nothing spent, no Details", () => {
        renderPanel({ status: "failed", error: { reason: "Not enough BZE for the network fee" } });
        expect(screen.getByText("Not enough BZE for the network fee")).toBeInTheDocument();
        expect(screen.getByText("Nothing left your wallet. Your answers are still here.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Details" })).not.toBeInTheDocument();
    });

    it("taking longer: don't send again yet, Check transaction status or Keep waiting", async () => {
        const h = renderPanel({ status: "slow", hash: HASH });
        expect(screen.getByText("That doesn't mean it failed, so don't send it again yet.")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Check transaction status" }));
        await userEvent.click(screen.getByRole("button", { name: "Keep waiting" }));
        expect(h.onCheckStatus).toHaveBeenCalledOnce();
        expect(h.onKeepWaiting).toHaveBeenCalledOnce();
    });
});
