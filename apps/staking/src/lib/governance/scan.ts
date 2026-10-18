import type {GovCoin, GovProposal, GovProposalMessage, GovProposalStatus, GovTally} from "@bze/bze-ui-kit";
import type {ProposalKind} from "./proposal";

// BZE Scan's proposal API (`/api/v1/proposals`, `/api/v1/proposals/{id}`) and
// its mapping onto the chain's gov v1 shapes, so the pages render a proposal
// the same way whichever source answered. Scan indexes every proposal, so
// listing by status doesn't make a node filter its whole archive the way the
// chain's `proposal_status` query does.

export type ScanProposalStatus =
    | "deposit_period"
    | "voting_period"
    | "passed"
    | "rejected"
    | "failed"
    | "canceled"
    | "dropped";

export interface ScanTally {
    yes: string;
    no: string;
    abstain: string;
    no_with_veto: string;
}

/** An item of `GET /api/v1/proposals`. */
export interface ScanProposalItem {
    id: number;
    title: string;
    kind: ProposalKind;
    status: ScanProposalStatus;
    expedited: boolean;
    submit_time: string | null;
    deposit_end_time: string | null;
    voting_start_time: string | null;
    voting_end_time: string | null;
    tally: ScanTally | null;
}

/** `GET /api/v1/proposals/{id}`: the list item plus what the proposal page needs. */
export interface ScanProposalDetail extends ScanProposalItem {
    summary: string | null;
    metadata: string | null;
    proposer: string | null;
    messages: GovProposalMessage[] | null;
    total_deposit: GovCoin[] | null;
}

export interface ScanPage<T> {
    items: T[];
    next_cursor: string | null;
}

/** A proposal from either source. Scan's list carries the kind instead of the messages. */
export type ListedProposal = GovProposal & {kind?: ProposalKind};

/** Statuses after which a proposal never changes again. */
const FINAL: ReadonlySet<string> = new Set<ScanProposalStatus>(["passed", "rejected", "failed", "canceled", "dropped"]);

/** Whether a Scan proposal is decided (or gone), so its answer can be kept forever. */
export const isFinalScanStatus = (status: string): boolean => FINAL.has(status);

/** Whether a chain proposal is decided, so it never changes again. */
export const isFinalStatus = (status: GovProposalStatus): boolean =>
    status === "PROPOSAL_STATUS_PASSED" || status === "PROPOSAL_STATUS_REJECTED" || status === "PROPOSAL_STATUS_FAILED";

// Canceled and dropped proposals are deleted from the chain: the app never shows them.
const STATUS: Partial<Record<ScanProposalStatus, GovProposalStatus>> = {
    deposit_period: "PROPOSAL_STATUS_DEPOSIT_PERIOD",
    voting_period: "PROPOSAL_STATUS_VOTING_PERIOD",
    passed: "PROPOSAL_STATUS_PASSED",
    rejected: "PROPOSAL_STATUS_REJECTED",
    failed: "PROPOSAL_STATUS_FAILED",
};

const tallyOf = (t: ScanTally | null): GovTally | null =>
    t ? {yes_count: t.yes, no_count: t.no, abstain_count: t.abstain, no_with_veto_count: t.no_with_veto} : null;

/** A list item as a chain proposal (no messages, so the kind rides along); null for canceled or dropped. */
export function fromScanItem(item: ScanProposalItem): ListedProposal | null {
    const status = STATUS[item.status];
    if (!status) return null;

    return {
        id: String(item.id),
        title: item.title,
        kind: item.kind,
        status,
        expedited: item.expedited,
        submit_time: item.submit_time,
        deposit_end_time: item.deposit_end_time,
        voting_start_time: item.voting_start_time,
        voting_end_time: item.voting_end_time,
        // Scan's tally is the final one once decided, its last sync while voting.
        final_tally_result: tallyOf(item.tally),
        messages: [],
        total_deposit: [],
        metadata: "",
        summary: "",
        proposer: "",
        failed_reason: "",
    };
}

/** A proposal page's data as a chain proposal; null for canceled or dropped. */
export function fromScanDetail(detail: ScanProposalDetail): ListedProposal | null {
    const proposal = fromScanItem(detail);
    if (!proposal) return null;

    return {
        ...proposal,
        messages: detail.messages ?? [],
        total_deposit: detail.total_deposit ?? [],
        metadata: detail.metadata ?? "",
        summary: detail.summary ?? "",
        proposer: detail.proposer ?? "",
    };
}
