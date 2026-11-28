import {describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {FlowState} from "@/hooks/useActionFlow";
import {TxPanel} from "./tx-panel";

const renderPanel = (state: FlowState) => {
    const onRecheck = vi.fn();
    render(
        <ChakraProvider value={defaultSystem}>
            <TxPanel state={state} progress="" status="VOTING" onRecheck={onRecheck} />
        </ChakraProvider>,
    );
    return {onRecheck};
};

describe("TxPanel (the transaction states)", () => {
    it("declined in the wallet: not sent, the choices kept", () => {
        renderPanel({phase: "failed", kind: "vote", error: "Request rejected", batches: 0, stage: "sign"});
        const panel = screen.getByTestId("action-error");
        expect(panel).toHaveAttribute("data-kind", "declined");
        expect(panel).toHaveTextContent("Not sent");
        expect(panel).toHaveTextContent("You declined in the wallet");
        expect(panel).toHaveTextContent("Nothing was sent. Your choices are still here.");
    });

    it("refused by the simulation: refused before signing, the plain reason first", () => {
        renderPanel({phase: "failed", kind: "settle", error: "Too early to settle.", batches: 0, stage: "prepare"});
        const panel = screen.getByTestId("action-error");
        expect(panel).toHaveAttribute("data-kind", "refused");
        expect(panel).toHaveTextContent("Refused before signing");
        expect(panel).toHaveTextContent("The chain would refuse it");
        expect(panel).toHaveTextContent("Too early to settle.");
        expect(panel).toHaveTextContent("nothing was signed or paid");
    });

    it("read again after an unconfirmed transaction: says the page shows the chain's answer", () => {
        renderPanel({phase: "rechecked", kind: "vote", txHash: "ABCDEF0123456789"});
        const panel = screen.getByTestId("action-rechecked");
        expect(panel).toHaveTextContent("The proposal was read again");
        expect(screen.getByTestId("tx-hash")).toHaveTextContent("ABCDEF0123456789");
        expect(panel).toHaveTextContent("Tx ABCD…6789");
    });

    it("confirmed but the proposal could not be read again: Read it again re-reads it", async () => {
        const {onRecheck} = renderPanel({phase: "sent", kind: "vote", txHash: "H1", reread: "failed", batches: 0});
        expect(screen.getByTestId("action-sent")).toHaveTextContent("could not be read again");
        await userEvent.click(screen.getByTestId("action-recheck"));
        expect(onRecheck).toHaveBeenCalledTimes(1);
    });
});
