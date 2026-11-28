import {describe, expect, it, vi} from "vitest";
import {render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {DAO} from "@/test/composer-fixtures";
import type {ProposerStatus} from "@/lib/propose/eligibility";
import type {CostRow, Requirement} from "@/lib/propose/cost";
import {SubmitArea} from "./submit-area";

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getExplorerTxURL: (hash: string) => `https://explorer.test/tx/${hash}`,
}));

const ROWS: CostRow[] = [
    {label: "Deposit", text: "9 BZE, held while voting", short: "9 BZE"},
    {label: "Back to you", text: "Only if it passes; otherwise it is burned", short: "Only if it passes"},
    {label: "Cost", text: "None", short: "None"},
];

const area = (over: {status?: ProposerStatus | null; wallet?: string | null; requirements?: Requirement[]; slots?: string | null; stakeHref?: string | null; stakeTicker?: string | null; rows?: CostRow[]} = {}) => render(
    <ChakraProvider value={defaultSystem}>
        <SubmitArea
            dao={DAO}
            wallet={over.wallet === undefined ? "bze1me" : over.wallet}
            status={over.status === undefined ? {kind: "allowed", reason: "You can propose: you're a member of this DAO."} : over.status}
            ready
            short={false}
            problem={undefined}
            state={{phase: "idle"}}
            rows={over.rows ?? ROWS}
            requirements={over.requirements ?? [{denom: "ubze", needed: "9", balance: "12", short: false}]}
            balancesKnown
            formatCoin={(c) => `${c.amount} BZE`}
            slots={over.slots === undefined ? "2 of 10 proposal slots are in use." : over.slots}
            stakeHref={over.stakeHref ?? null}
            stakeTicker={over.stakeTicker ?? null}
            onSubmit={() => {}}
            onCheck={() => {}}
            onAllowResubmit={() => {}}
        />
    </ChakraProvider>,
);

describe("Before you submit", () => {
    it("lists the deposit, what comes back, the cost and what the wallet holds, then the slots and the button", () => {
        area();
        const panel = screen.getByTestId("submit-panel");
        expect(panel).toHaveTextContent("Before you submit");
        expect(screen.getByTestId("proposer-note")).toHaveTextContent("You can propose: you're a member of this DAO.");
        expect(within(screen.getByTestId("cost-deposit")).getByTestId("cost-full")).toHaveTextContent(/^9 BZE, held while voting$/);
        expect(within(screen.getByTestId("cost-back")).getByTestId("cost-full")).toHaveTextContent("Only if it passes; otherwise it is burned");
        expect(within(screen.getByTestId("cost-cost")).getByTestId("cost-full")).toHaveTextContent(/^None$/);
        // the phone's short values (board I5)
        expect(within(screen.getByTestId("cost-deposit")).getByTestId("cost-short")).toHaveTextContent(/^9 BZE$/);
        expect(within(screen.getByTestId("cost-back")).getByTestId("cost-short")).toHaveTextContent(/^Only if it passes$/);
        expect(screen.getByTestId("cost-balance")).toHaveTextContent("You hold12 BZE ✓");
        expect(screen.getByTestId("proposal-slots")).toHaveTextContent("2 of 10 proposal slots are in use.");
        expect(screen.getByTestId("submit-proposal")).not.toBeDisabled();
    });

    it("a balance below the need says how much is needed", () => {
        area({requirements: [{denom: "ubze", needed: "14", balance: "12", short: true}]});
        expect(screen.getByTestId("cost-balance")).toHaveTextContent("12 BZE · not enough, you need 14 BZE");
    });

    it("no slots line while the open proposals are unknown", () => {
        area({slots: null});
        expect(screen.queryByTestId("proposal-slots")).toBeNull();
    });

    it("Not a member: the note, and no button", () => {
        area({status: {kind: "not-a-voter", cause: "not-member", message: "Proposals here are for members. Ask a member to propose adding you."}});
        const gate = screen.getByTestId("gate-not-a-voter");
        expect(gate).toHaveTextContent("Not a member");
        expect(gate).toHaveTextContent("Ask a member to propose adding you.");
        expect(within(gate).queryAllByRole("link")).toHaveLength(0);
        expect(screen.queryByTestId("submit-proposal")).toBeNull();
    });

    it("No stake: the note with a link to stake on the DEX", () => {
        area({status: {kind: "not-a-voter", cause: "no-stake", message: "Proposals here are for stakers."}, stakeHref: "https://dex.test/staking/details?id=simple%3A17", stakeTicker: "HONEY"});
        const gate = screen.getByTestId("gate-not-a-voter");
        expect(gate).toHaveTextContent("No stake");
        expect(gate).toHaveTextContent("Proposals here are for stakers. Stake HONEY in one of its rewards on the DEX; you can propose from the next block on.");
        expect(within(gate).getByTestId("stake-on-dex")).toHaveAttribute("href", "https://dex.test/staking/details?id=simple%3A17");
    });

    it("No voters and Full are warnings with their titles", () => {
        const none = area({status: {kind: "blocked", cause: "no-voters", message: "This DAO has nobody who can vote yet (1119)."}});
        expect(screen.getByTestId("gate-blocked")).toHaveTextContent("No voters");
        none.unmount();
        area({status: {kind: "blocked", cause: "full", message: "10 of 10 proposal slots are in use. Wait for one to be settled (1120)."}});
        expect(screen.getByTestId("gate-blocked")).toHaveTextContent("Full");
        expect(screen.getByTestId("gate-blocked")).toHaveTextContent("Wait for one to be settled (1120).");
        expect(screen.queryByTestId("submit-proposal")).toBeNull();
    });

    it("without a wallet asks to connect one", () => {
        area({wallet: null, status: null});
        expect(screen.getByTestId("gate-wallet")).toHaveTextContent("Connect your wallet to submit this proposal.");
        expect(screen.queryByTestId("cost-balance")).toBeNull();
    });
});
