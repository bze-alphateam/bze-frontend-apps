import BigNumber from "bignumber.js";
import type {GovVote} from "@bze/bze-ui-kit";
import {endsIn, formatDateTimeUtc} from "./format";
import {wholeBze} from "./details";
import {voteSummary} from "./voter";

// The open proposals at a glance, for the nav badge and the dashboard banner:
// what the badge counts and what the banner says. Pure; the clock is passed in
// and useOpenProposalsSummary fetches.

export interface SummaryProposal {
    id: string;
    title: string;
    votingEndTime: string;
    /** The wallet's own vote; null when it hasn't voted (always null without a wallet). */
    vote: GovVote | null;
}

export interface OpenProposalsSummary {
    connected: boolean;
    /** Open proposals, the one whose voting ends first first. */
    proposals: SummaryProposal[];
    /** The wallet's voting power in ubze; null without a wallet. */
    power: BigNumber | null;
}

export const GOVERNANCE_HREF = "/governance";
export const proposalHref = (id: string) => `${GOVERNANCE_HREF}/${id}`;

/** `1 proposal`, `2 proposals`. */
export const proposalsText = (n: number) => `${n} ${n === 1 ? "proposal" : "proposals"}`;

/** The open proposals the wallet hasn't voted on itself. */
export const unvoted = (summary: OpenProposalsSummary): SummaryProposal[] =>
    summary.proposals.filter((p) => p.vote === null);

/** The nav badge: proposals that need the wallet's vote, or every open one without a wallet. */
export function badgeCount(summary: OpenProposalsSummary | undefined): number {
    if (!summary) return 0;
    return summary.connected ? unvoted(summary).length : summary.proposals.length;
}

/** The badge's accessible name: `1 proposal needs your vote`, `2 open proposals`. */
export function badgeLabel(summary: OpenProposalsSummary, count: number): string {
    if (!summary.connected) return `${count} open ${count === 1 ? "proposal" : "proposals"}`;
    return `${proposalsText(count)} ${count === 1 ? "needs" : "need"} your vote`;
}

export type Callout =
    | {
        variant: "needs-vote";
        title: string;
        detail: string;
        powerLine: string;
        /** Vote now: the proposal's page when only one needs a vote, else the list. */
        voteHref: string;
    }
    | {variant: "voted"; detail: string}
    | {
        variant: "not-connected";
        title: string;
        /** The first proposal's title and end. */
        detail: string;
        /** See proposal: the proposal's page when only one is open, else the list. */
        href: string;
    };

const firstHref = (list: SummaryProposal[]) => (list.length === 1 ? proposalHref(list[0].id) : GOVERNANCE_HREF);

/** What the dashboard banner says; null when nothing is open (no banner). */
export function callout(summary: OpenProposalsSummary | undefined, now: Date): Callout | null {
    if (!summary || summary.proposals.length === 0) return null;

    if (!summary.connected) {
        const [first] = summary.proposals;
        const n = summary.proposals.length;
        return {
            variant: "not-connected",
            title: `${proposalsText(n)} ${n === 1 ? "is" : "are"} open for voting`,
            detail: `${first.title} · ends in ${endsIn(first.votingEndTime, now)}. Stakers vote with their staked BZE.`,
            href: firstHref(summary.proposals),
        };
    }

    const pending = unvoted(summary);
    if (pending.length > 0) {
        const [first] = pending;
        const power = summary.power ?? new BigNumber(0);
        return {
            variant: "needs-vote",
            title: `${proposalsText(pending.length)} ${pending.length === 1 ? "needs" : "need"} your vote`,
            detail: `${first.title} · voting ends in ${endsIn(first.votingEndTime, now)}`,
            powerLine: power.gt(0)
                ? `Until you vote, your validators' votes count for your ${wholeBze(power)} BZE.`
                : "Votes count with the BZE you have staked when voting ends.",
            voteHref: firstHref(pending),
        };
    }

    const [first] = summary.proposals;
    const more = summary.proposals.length - 1;
    const option = first.vote ? voteSummary(first.vote) : "";
    return {
        variant: "voted",
        detail: `${option} on #${first.id} · you can change it until ${formatDateTimeUtc(first.votingEndTime)}.${more > 0 ? ` +${more} more` : ""}`,
    };
}
