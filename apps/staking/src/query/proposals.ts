import {getOpenProposals, getProposal, type GovProposal} from "@bze/bze-ui-kit";
import {
    fromScanDetail, fromScanItem, isFinalStatus,
    type ListedProposal, type ScanPage, type ScanProposalDetail, type ScanProposalItem,
} from "@/lib/governance/scan";

// Where the pages read proposals from. The list and the proposal pages come
// from BZE Scan's API (through this app's `/api/scan` route): filtering by
// status on a node scans its whole proposal archive and can take seconds. The
// open proposals fall back to the chain's REST when Scan is down, so voting
// never depends on Scan; a proposal page does too. A decided proposal never
// changes, so its page is kept for the session.

const SCAN_API = "/api/scan";
const TIMEOUT_MS = 10_000;
const OPEN_LIMIT = 50;
const FINISHED_PAGE_SIZE = 10;
// Deposit-period proposals cost nothing to submit, so a page can be all of
// them: stop refilling after this many requests and let "older" continue.
const FINISHED_MAX_REQUESTS = 10;

/** Scan's answer; null on 404. Throws on anything else. */
async function scanGet<T>(path: string): Promise<T | null> {
    const response = await fetch(`${SCAN_API}/${path}`, {signal: AbortSignal.timeout(TIMEOUT_MS)});
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`BZE Scan answered ${response.status} for ${path}`);
    return (await response.json()) as T;
}

const listed = (items: ScanProposalItem[]): ListedProposal[] =>
    items.map(fromScanItem).filter((p): p is ListedProposal => p !== null);

/** Every proposal in its voting period: from Scan, else from the chain. */
export async function loadOpenProposals(): Promise<ListedProposal[]> {
    try {
        const page = await scanGet<ScanPage<ScanProposalItem>>(`proposals?status=voting_period&limit=${OPEN_LIMIT}`);
        return listed(page?.items ?? []).filter((p) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD");
    } catch (e) {
        console.warn("BZE Scan unavailable, reading open proposals from the chain", e);
        return getOpenProposals();
    }
}

export interface FinishedPage {
    proposals: ListedProposal[];
    /** Pass back for the older page; null on the last one. */
    nextCursor: string | null;
}

/** Decided proposals (passed, rejected, failed), newest first, ten per page. Throws when Scan is down. */
export async function loadFinishedProposals(cursor?: string | null): Promise<FinishedPage> {
    const proposals: ListedProposal[] = [];
    let nextCursor = cursor ?? null;

    for (let requests = 0; requests < FINISHED_MAX_REQUESTS; requests++) {
        const query = new URLSearchParams({limit: String(FINISHED_PAGE_SIZE)});
        if (nextCursor) query.set("cursor", nextCursor);
        const page = await scanGet<ScanPage<ScanProposalItem>>(`proposals?${query}`);
        proposals.push(...listed(page?.items ?? []).filter((p) => isFinalStatus(p.status)));
        nextCursor = page?.next_cursor ?? null;
        if (proposals.length >= FINISHED_PAGE_SIZE || !nextCursor) break;
    }

    return {proposals, nextCursor};
}

const decided = new Map<string, GovProposal>();

/** One proposal for its page: from Scan, else from the chain; null when neither has it. */
export async function loadProposal(id: string): Promise<GovProposal | null> {
    const kept = decided.get(id);
    if (kept) return kept;

    let proposal: GovProposal | null = null;
    try {
        const detail = await scanGet<ScanProposalDetail>(`proposals/${id}`);
        proposal = detail && fromScanDetail(detail);
    } catch (e) {
        console.warn("BZE Scan unavailable, reading the proposal from the chain", e);
    }
    // Scan may not have indexed a brand-new proposal yet, so ask the chain too.
    proposal ??= await getProposal(id);
    // Scan doesn't keep why a passed proposal's messages failed; the chain does.
    if (proposal?.status === "PROPOSAL_STATUS_FAILED" && !proposal.failed_reason) {
        const chain = await getProposal(id).catch(() => null);
        if (chain?.failed_reason) proposal = {...proposal, failed_reason: chain.failed_reason};
    }

    if (proposal && isFinalStatus(proposal.status)) decided.set(id, proposal);
    return proposal;
}
