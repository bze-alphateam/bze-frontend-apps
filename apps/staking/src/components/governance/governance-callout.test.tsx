import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { OpenProposalsSummary, SummaryProposal } from "@/lib/governance/summary";

// The banner with the summary hook and the clock mocked; the copy comes from
// the real lib/governance/summary.
const { summaryMock } = vi.hoisted(() => ({ summaryMock: vi.fn() }));

vi.mock("@/hooks/useOpenProposalsSummary", () => ({
    useOpenProposalsSummary: () => summaryMock(),
}));
vi.mock("@/hooks/useNow", () => ({ useNow: () => new Date("2026-10-17T12:00:00Z") }));

import { GovernanceCallout } from "./governance-callout";

const yes = { proposal_id: "48", voter: "bze1me", metadata: "", options: [{ option: "VOTE_OPTION_YES", weight: "1" }] } as SummaryProposal["vote"];
const p48: SummaryProposal = { id: "48", title: "Upgrade network to v8.2.0", votingEndTime: "2026-10-20T10:13:00Z", vote: null };
const p49: SummaryProposal = { id: "49", title: "Community pool spend", votingEndTime: "2026-10-21T08:00:00Z", vote: null };

const withSummary = (summary: OpenProposalsSummary | undefined, failed = false) =>
    summaryMock.mockReturnValue({ summary, failed, isLoading: false, invalidate: vi.fn() });
const wallet = (proposals: SummaryProposal[]): OpenProposalsSummary => ({ connected: true, proposals, power: new BigNumber("25400000000") });
const guest = (proposals: SummaryProposal[]): OpenProposalsSummary => ({ connected: false, proposals, power: null });

const renderCallout = () => render(<ChakraProvider value={defaultSystem}><GovernanceCallout /></ChakraProvider>);
const phone = () => vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
}));

beforeEach(() => summaryMock.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe.each([
    ["desktop", () => {}],
    ["phone", phone],
])("GovernanceCallout on %s", (width, setWidth) => {
    beforeEach(() => setWidth());

    it("asks for the vote on one proposal and links Vote now to it", () => {
        withSummary(wallet([p48]));
        renderCallout();

        expect(screen.getByText("1 proposal needs your vote")).toBeInTheDocument();
        expect(screen.getByText("Upgrade network to v8.2.0 · voting ends in 2 days 22 hours")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Vote now/ })).toHaveAttribute("href", "/governance/48");
        expect(screen.getByRole("link", { name: "All proposals" })).toHaveAttribute("href", "/governance");
        const powerLine = screen.queryByText("Until you vote, your validators' votes count for your 25,400 BZE.");
        if (width === "desktop") expect(powerLine).toBeInTheDocument();
        else expect(powerLine).not.toBeInTheDocument();
    });

    it("sends Vote now to the list when two proposals need the vote", () => {
        withSummary(wallet([p48, p49]));
        renderCallout();

        expect(screen.getByText("2 proposals need your vote")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Vote now/ })).toHaveAttribute("href", "/governance");
    });

    it("confirms the wallet voted on everything", () => {
        withSummary(wallet([{ ...p48, vote: yes }]));
        renderCallout();

        expect(screen.getByText("You've voted on every open proposal.")).toBeInTheDocument();
        expect(screen.getByText("Yes on #48 · you can change it until Oct 20, 2026, 10:13 UTC.")).toBeInTheDocument();
        const link = screen.getByRole("link", { name: width === "desktop" ? "Governance →" : /You've voted on every open proposal/ });
        expect(link).toHaveAttribute("href", "/governance");
    });

    it("tells a visitor what is open", () => {
        withSummary(guest([p48]));
        renderCallout();

        expect(screen.getByText("1 proposal is open for voting")).toBeInTheDocument();
        expect(screen.getByText("Upgrade network to v8.2.0 · ends in 2 days 22 hours. Stakers vote with their staked BZE.")).toBeInTheDocument();
        const link = screen.getByRole("link", { name: width === "desktop" ? "See proposal" : /1 proposal is open for voting/ });
        expect(link).toHaveAttribute("href", "/governance/48");
    });

    it("links a visitor to the list when two are open", () => {
        withSummary(guest([p48, p49]));
        renderCallout();

        expect(screen.getByText("2 proposals are open for voting")).toBeInTheDocument();
        expect(screen.getByRole("link")).toHaveAttribute("href", "/governance");
    });

    it.each([
        ["nothing is open", guest([]), false],
        ["the summary failed", undefined, true],
        ["the summary is loading", undefined, false],
    ])("renders nothing when %s", (_case, summary, failed) => {
        withSummary(summary, failed);
        const { container } = renderCallout();

        expect(container).toBeEmptyDOMElement();
    });
});
