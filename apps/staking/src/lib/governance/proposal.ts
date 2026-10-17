import type {GovProposal, GovProposalMessage, GovProposalStatus} from "@bze/bze-ui-kit";

// What a proposal is, in words: its kind, title, summary and status. The kind
// table is BZE Scan's (backend/internal/statesync/proposals/proposals.go), so
// both apps label a proposal the same way.

export type ProposalKind =
    | "software_upgrade"
    | "community_pool_spend"
    | "parameter_change"
    | "cointrunk_publisher"
    | "ibc_client_update"
    | "text"
    | "other";

const KIND_OF: Record<string, ProposalKind> = {
    "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade": "software_upgrade",
    "/cosmos.upgrade.v1beta1.MsgCancelUpgrade": "software_upgrade",
    "/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal": "software_upgrade",
    "/cosmos.upgrade.v1beta1.CancelSoftwareUpgradeProposal": "software_upgrade",
    "/cosmos.distribution.v1beta1.MsgCommunityPoolSpend": "community_pool_spend",
    "/cosmos.distribution.v1beta1.CommunityPoolSpendProposal": "community_pool_spend",
    "/cosmos.params.v1beta1.ParameterChangeProposal": "parameter_change",
    "/bze.cointrunk.MsgSavePublisher": "cointrunk_publisher",
    "/bze.cointrunk.MsgAcceptDomain": "cointrunk_publisher",
    "/bze.cointrunk.v1.PublisherProposal": "cointrunk_publisher",
    "/bze.cointrunk.v1.AcceptedDomainProposal": "cointrunk_publisher",
    "/ibc.core.client.v1.MsgRecoverClient": "ibc_client_update",
    "/ibc.core.client.v1.MsgIBCSoftwareUpgrade": "ibc_client_update",
    "/ibc.core.client.v1.ClientUpdateProposal": "ibc_client_update",
    "/ibc.core.client.v1.UpgradeProposal": "ibc_client_update",
    "/cosmos.gov.v1beta1.TextProposal": "text",
};

const KIND_LABELS: Record<ProposalKind, string> = {
    software_upgrade: "Software upgrade",
    community_pool_spend: "Community pool spend",
    parameter_change: "Parameter change",
    cointrunk_publisher: "CoinTrunk publisher",
    ibc_client_update: "Cross-chain repair",
    text: "Text",
    other: "Other",
};

const EXEC_LEGACY_CONTENT = "/cosmos.gov.v1.MsgExecLegacyContent";

/** The type a message stands for: the legacy content it carries, or its own. */
const effectiveType = (m: GovProposalMessage): string =>
    m["@type"] === EXEC_LEGACY_CONTENT && m.content?.["@type"] ? m.content["@type"] : m["@type"];

const kindOfType = (typeUrl: string): ProposalKind =>
    KIND_OF[typeUrl] ?? (typeUrl.endsWith(".MsgUpdateParams") ? "parameter_change" : "other");

/** The kind of the first message that has one; `text` without messages. */
export function proposalKind(p: Pick<GovProposal, "messages">): ProposalKind {
    const messages = p.messages ?? [];
    if (messages.length === 0) return "text";
    for (const m of messages) {
        const kind = kindOfType(effectiveType(m));
        if (kind !== "other") return kind;
    }
    return "other";
}

export function kindLabel(kind: ProposalKind): string {
    return KIND_LABELS[kind];
}

const legacyContent = (p: Pick<GovProposal, "messages">) =>
    (p.messages ?? []).find((m) => m["@type"] === EXEC_LEGACY_CONTENT && m.content)?.content;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The proposal's title, else its legacy content's, else `Proposal #<id>`. */
export function proposalTitle(p: Pick<GovProposal, "id" | "title" | "messages">): string {
    return text(p.title) || text(legacyContent(p)?.title) || `Proposal #${p.id}`;
}

/** The proposal's summary, else its legacy content's description; empty when it has neither. */
export function proposalSummary(p: Pick<GovProposal, "summary" | "messages">): string {
    return text(p.summary) || text(legacyContent(p)?.description);
}

export type StatusTone = "purple" | "green" | "red" | "gray";

/** The status badge: `Voting`, `Passed`, `Rejected`, `Failed`. */
export function statusInfo(status: GovProposalStatus): {text: string; tone: StatusTone} {
    switch (status) {
        case "PROPOSAL_STATUS_VOTING_PERIOD":
            return {text: "Voting", tone: "purple"};
        case "PROPOSAL_STATUS_PASSED":
            return {text: "Passed", tone: "green"};
        case "PROPOSAL_STATUS_REJECTED":
            return {text: "Rejected", tone: "red"};
        case "PROPOSAL_STATUS_FAILED":
            return {text: "Failed", tone: "red"};
        default:
            return {text: "Deposit period", tone: "gray"};
    }
}

/** Only proposals in voting or decided are shown; deposit-period ones never are. */
export function isListed(status: GovProposalStatus): boolean {
    return status === "PROPOSAL_STATUS_VOTING_PERIOD"
        || status === "PROPOSAL_STATUS_PASSED"
        || status === "PROPOSAL_STATUS_REJECTED"
        || status === "PROPOSAL_STATUS_FAILED";
}
