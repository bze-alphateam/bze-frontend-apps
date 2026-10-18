import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { OpenProposalsSummary, SummaryProposal } from "@/lib/governance/summary";

const { pathnameMock, summaryMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(), summaryMock: vi.fn() }));

vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ currentPathName: pathnameMock(), navigate: vi.fn() }),
}));
vi.mock("@/hooks/useOpenProposalsSummary", () => ({
    useOpenProposalsSummary: () => summaryMock(),
}));
vi.mock("@bze/bze-ui-kit", () => ({
    AppsMenu: () => null,
}));

import { NavbarLinks } from "./navbar-links";
import { MobileNavbarLinks } from "./mobile-navbar-links";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

function renderLinks(pathname: string) {
    pathnameMock.mockReturnValue(pathname);
    return render(<NavbarLinks />, { wrapper });
}

const yes = { proposal_id: "48", voter: "bze1me", metadata: "", options: [{ option: "VOTE_OPTION_YES", weight: "1" }] } as SummaryProposal["vote"];
const proposal = (id: string, vote: SummaryProposal["vote"] = null): SummaryProposal =>
    ({ id, title: `Proposal ${id}`, votingEndTime: "2026-10-20T10:13:00Z", vote });
const withSummary = (summary: OpenProposalsSummary | undefined, failed = false) =>
    summaryMock.mockReturnValue({ summary, failed, isLoading: false, invalidate: vi.fn() });

beforeEach(() => {
    pathnameMock.mockReset();
    summaryMock.mockReset();
    withSummary(undefined);
});

describe("NavbarLinks", () => {
    it("links to Governance", () => {
        renderLinks("/");

        expect(screen.getByRole("link", { name: "Governance" })).toHaveAttribute("href", "/governance");
        expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: "Governance" })).not.toHaveAttribute("aria-current");
    });

    it.each(["/governance", "/governance/48"])("marks Governance active on %s", (path) => {
        renderLinks(path);

        expect(screen.getByRole("link", { name: "Governance" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    });

    it("does not match a path that only starts with the same letters", () => {
        renderLinks("/governanceship");

        expect(screen.getByRole("link", { name: "Governance" })).not.toHaveAttribute("aria-current");
    });
});

describe("Governance badge", () => {
    it("counts the open proposals the wallet hasn't voted on", () => {
        withSummary({ connected: true, power: new BigNumber(1), proposals: [proposal("48", yes), proposal("49"), proposal("50")] });
        renderLinks("/");

        expect(screen.getByLabelText("2 proposals need your vote")).toHaveTextContent("2");
        expect(screen.getByRole("link", { name: /^Governance 2 proposals need your vote/ })).toHaveAttribute("href", "/governance");
    });

    it("counts every open proposal without a wallet", () => {
        withSummary({ connected: false, power: null, proposals: [proposal("48")] });
        renderLinks("/");

        expect(screen.getByLabelText("1 open proposal")).toHaveTextContent("1");
    });

    it.each([
        ["every open proposal is voted", { connected: true, power: new BigNumber(1), proposals: [proposal("48", yes)] }, false],
        ["nothing is open", { connected: false, power: null, proposals: [] }, false],
        ["the summary failed", undefined, true],
        ["the summary is loading", undefined, false],
    ])("is hidden when %s", (_case, summary, failed) => {
        withSummary(summary as OpenProposalsSummary | undefined, failed);
        renderLinks("/");

        expect(screen.getByRole("link", { name: "Governance" })).toHaveTextContent(/^Governance$/);
    });
});

describe("MobileNavbarLinks", () => {
    it("marks the menu button with a dot while proposals wait", () => {
        withSummary({ connected: false, power: null, proposals: [proposal("48")] });
        render(<MobileNavbarLinks />, { wrapper });

        expect(screen.getByRole("button", { name: "Open Menu" })).toContainElement(screen.getByTestId("menu-badge-dot"));
    });

    it("has no dot when nothing waits", () => {
        withSummary({ connected: true, power: new BigNumber(1), proposals: [proposal("48", yes)] });
        render(<MobileNavbarLinks />, { wrapper });

        expect(screen.queryByTestId("menu-badge-dot")).not.toBeInTheDocument();
    });
});
