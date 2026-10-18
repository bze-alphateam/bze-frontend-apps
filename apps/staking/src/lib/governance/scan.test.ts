import { describe, it, expect } from "vitest";
import detail48 from "./fixtures/scan-proposal-48.json";
import page from "./fixtures/scan-proposals-page.json";
import { fromScanDetail, fromScanItem, isFinalScanStatus, isFinalStatus, type ScanProposalDetail, type ScanProposalItem } from "./scan";
import { proposalKind, proposalTitle } from "./proposal";

// Fixtures are BZE Scan's mainnet answers (2026-10-18).
const items = page.items as ScanProposalItem[];

describe("fromScanItem", () => {
    it("maps a list item onto the chain's shape, the kind and tally riding along", () => {
        const p = fromScanItem(items[1])!;

        expect(p).toMatchObject({
            id: "47",
            title: "Upgrade network to v8.1.1",
            kind: "software_upgrade",
            status: "PROPOSAL_STATUS_PASSED",
            voting_end_time: "2026-07-21T10:28:03.533454Z",
            final_tally_result: { yes_count: "106584798486204", no_count: "0", abstain_count: "0", no_with_veto_count: "0" },
            messages: [],
        });
        expect(proposalKind(p)).toBe("software_upgrade");
        expect(proposalTitle(p)).toBe("Upgrade network to v8.1.1");
    });

    it.each(["canceled", "dropped"] as const)("drops a %s proposal, which the chain no longer has", (status) => {
        expect(fromScanItem({ ...items[1], status })).toBeNull();
    });

    it("keeps a deposit-period proposal as such, for the pages to hide", () => {
        expect(fromScanItem({ ...items[1], status: "deposit_period" })?.status).toBe("PROPOSAL_STATUS_DEPOSIT_PERIOD");
    });

    it("has no tally before Scan synced one", () => {
        expect(fromScanItem({ ...items[0], tally: null })?.final_tally_result).toBeNull();
    });
});

describe("fromScanDetail", () => {
    it("adds what the proposal page needs", () => {
        const p = fromScanDetail(detail48 as unknown as ScanProposalDetail)!;

        expect(p.status).toBe("PROPOSAL_STATUS_VOTING_PERIOD");
        expect(p.proposer).toBe("bze1dte8cgjyxnsg4zmrlhfv4h4hnxv5vy8khzfx4f");
        expect(p.summary).toMatch(/^If passed, this proposal will upgrade the blockchain to version 8\.2\.0\./);
        expect(p.messages[0]["@type"]).toBe("/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade");
        expect(p.total_deposit).toEqual([{ denom: "ubze", amount: "100000000000" }]);
        expect(p.metadata).toBe("");
        expect(p.failed_reason).toBe("");
    });
});

describe("final statuses", () => {
    it.each(["passed", "rejected", "failed", "canceled", "dropped"])("treats Scan's %s as final", (s) => {
        expect(isFinalScanStatus(s)).toBe(true);
    });

    it.each(["voting_period", "deposit_period", ""])("treats Scan's %j as changing", (s) => {
        expect(isFinalScanStatus(s)).toBe(false);
    });

    it("treats only decided chain proposals as final", () => {
        expect(isFinalStatus("PROPOSAL_STATUS_PASSED")).toBe(true);
        expect(isFinalStatus("PROPOSAL_STATUS_FAILED")).toBe(true);
        expect(isFinalStatus("PROPOSAL_STATUS_VOTING_PERIOD")).toBe(false);
        expect(isFinalStatus("PROPOSAL_STATUS_DEPOSIT_PERIOD")).toBe(false);
    });
});
