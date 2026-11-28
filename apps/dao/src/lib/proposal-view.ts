import type {ProposalModel} from './proposal-model';
import {settleKind} from './proposal-actions';
import {describeExecutionError} from './proposal-timeline';
import type {TallyView} from './proposal-tally';

// The words of the proposal page that only it shows: its pill, the clock in its header, the dates as the
// page writes them, and the card at the top of the page that says what can happen next.

export type PageTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export interface PagePill {
    /** The same keys as `describeStatus`, plus the two settle states of a proposal still in voting. */
    key: 'voting' | 'ended' | 'early' | 'failed' | 'executed' | 'rejected' | 'expired' | 'cancelled';
    label: string;
    tone: PageTone;
    /** In flight: drawn with the dot. */
    live: boolean;
}

/** The status pill of the page: "Voting", "Ready to settle", "Can settle early", "Passed · executed", … */
export function pagePill(p: Pick<ProposalModel, 'status' | 'votingEnded' | 'expediteSettleable'>): PagePill {
    switch (p.status) {
        case 'VOTING':
            if (p.votingEnded) return {key: 'ended', label: 'Ready to settle', tone: 'warning', live: true};
            if (p.expediteSettleable) return {key: 'early', label: 'Can settle early', tone: 'warning', live: true};
            return {key: 'voting', label: 'Voting', tone: 'accent', live: true};
        case 'EXECUTION_FAILED':
            return {key: 'failed', label: 'Passed · execution failed', tone: 'danger', live: true};
        case 'EXECUTED':
            return {key: 'executed', label: 'Passed · executed', tone: 'success', live: false};
        case 'REJECTED':
            return {key: 'rejected', label: 'Rejected', tone: 'danger', live: false};
        case 'EXPIRED':
            return {key: 'expired', label: 'Expired', tone: 'neutral', live: false};
        case 'CANCELLED':
            return {key: 'cancelled', label: 'Cancelled', tone: 'neutral', live: false};
    }
}

const valid = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
};

const day = (d: Date, year: boolean) => d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', ...(year ? {year: 'numeric'} : {}), timeZone: 'UTC'});
const time = (d: Date) => d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', timeZone: 'UTC'});

/** "15 Nov 2026 13:00 UTC", the timeline's form; empty when unreadable. */
export function stampOf(iso: string | null | undefined): string {
    const d = valid(iso);
    return d ? `${day(d, true)} ${time(d)} UTC` : '';
}

/** "22 Nov, 13:00 UTC", the header's form (no year). */
export function shortStampOf(iso: string | null | undefined): string {
    const d = valid(iso);
    return d ? `${day(d, false)}, ${time(d)} UTC` : '';
}

/** "6 Dec 2026, 13:00 UTC", a deadline in a sentence. */
export function deadlineOf(iso: string | null | undefined): string {
    const d = valid(iso);
    return d ? `${day(d, true)}, ${time(d)} UTC` : '';
}

/** "30 Oct", a day in a sentence. */
export function dayOf(iso: string | null | undefined): string {
    const d = valid(iso);
    return d ? day(d, false) : '';
}

const plural = (n: number, unit: string, short: boolean) => (short && unit === 'hour' ? `${n} h` : `${n} ${unit}${n === 1 ? '' : 's'}`);

/**
 * The time left until `iso`, in its two largest units: "in 3 days 4 hours", "in 22 hours", "in 5 minutes";
 * `short` writes hours as "h" ("in 3 days 4 h"). Empty once it is past or unreadable.
 */
export function countdown(iso: string | null | undefined, nowMs: number, short = false): string {
    const d = valid(iso);
    if (!d) return '';
    const left = Math.floor((d.getTime() - nowMs) / 1000);
    if (left <= 0) return '';
    if (left < 60) return 'in less than a minute';
    const days = Math.floor(left / 86400);
    const hours = Math.floor((left % 86400) / 3600);
    const minutes = Math.floor((left % 3600) / 60);
    if (days > 0) return `in ${plural(days, 'day', short)}${hours > 0 ? ` ${plural(hours, 'hour', short)}` : ''}`;
    if (hours > 0) return `in ${plural(hours, 'hour', short)}`;
    return `in ${plural(minutes, 'minute', short)}`;
}

/** The clock in the header: "Voting ends in 3 days 4 hours · 22 Nov, 13:00 UTC", "Expedited · ends in 22 hours"; empty once voting is over. */
export function headerClock(p: Pick<ProposalModel, 'status' | 'votingEnded' | 'votingEnd' | 'expedited'>, nowMs: number): string {
    if (p.status !== 'VOTING' || !p.votingEnd) return '';
    if (p.votingEnded) return `Voting ended · ${shortStampOf(p.votingEnd)}`;
    const left = countdown(p.votingEnd, nowMs);
    if (p.expedited) return left ? `Expedited · ends ${left}` : `Expedited · ends ${shortStampOf(p.votingEnd)}`;
    return left ? `Voting ends ${left} · ${shortStampOf(p.votingEnd)}` : `Voting ends ${shortStampOf(p.votingEnd)}`;
}

/** "37.7 %", the page's way of writing a share (a space before the sign). */
export const spaced = (percent: string): string => percent.replace(/%$/, ' %');

/** The card at the top of the page: what happens next, or how it ended. */
export interface StateCard {
    kind: 'settle' | 'early' | 'retry' | 'expire' | 'finished' | 'archived';
    tone: PageTone;
    /** The note's title; empty for a finished proposal (its pill says it). */
    title: string;
    text: string;
}

const actionsCount = (n: number) => `${n} ${n === 1 ? 'action' : 'actions'}`;

/** "41 % turnout, 64 % yes" from the bars; empty without them. */
function turnoutAndYes(view: TallyView | null): string {
    const quorum = view?.bars.find((b) => b.id === 'quorum');
    const yes = view?.bars.find((b) => b.id === 'threshold');
    return quorum && yes ? `${spaced(quorum.achieved)} turnout, ${spaced(yes.achieved)} yes` : '';
}

/**
 * The state card of a proposal, or null while it simply votes. `view` is the tally against its pinned bars
 * (null when unknown: the card then says less, never guesses). `memberList` writes the expedite yes as "4 of 5".
 */
export function stateCard(
    p: Pick<ProposalModel, 'status' | 'votingEnded' | 'expediteSettleable' | 'retryDeadline' | 'archived' | 'msgs' | 'outcome' | 'tally'>,
    view: TallyView | null,
    nowMs: number,
    memberList: boolean,
): StateCard | null {
    if (p.archived) {
        return {kind: 'archived', tone: 'neutral', title: '', text: "Cleaned up from the chain after it finished, so this page reads BZE Scan's record."};
    }
    const kind = settleKind(p, nowMs);
    const n = p.msgs.length;
    if (kind === 'settle') {
        const numbers = turnoutAndYes(view);
        const how = numbers ? ` (${numbers})` : '';
        const text = !view
            ? 'Voting has ended. Anyone can settle it now; the chain counts the votes then.'
            : view.passesRegular
                ? `Voting has ended. Anyone can settle it now: it passes${how}${n > 0 ? ` and runs its ${actionsCount(n)} in the same transaction.` : '.'}`
                : `Voting has ended. Anyone can settle it now: it is rejected${how}. Nothing runs.`;
        return {kind, tone: 'warning', title: 'Waiting to be settled', text};
    }
    if (kind === 'early') {
        let said = '';
        if (memberList && p.tally) said = ` (${p.tally.yes} of ${p.tally.denominator} members said yes)`;
        else {
            const yes = view?.bars.find((b) => b.id === 'expedite-yes');
            if (yes) said = ` (${spaced(yes.achieved)} of all voting power said yes)`;
        }
        return {kind, tone: 'warning', title: 'Can settle early', text: `Expedited and already over its bars${said}. Anyone can settle it now instead of waiting for the end of voting.`};
    }
    if (kind === 'retry') {
        const why = p.outcome?.executionError ? describeExecutionError(p.outcome.executionError) : '';
        const until = deadlineOf(p.retryDeadline);
        return {
            kind, tone: 'danger', title: 'Passed · execution failed',
            text: `It passed, but ${n === 1 ? 'its action' : 'its actions'} failed${why ? `: ${why}` : ''}. Anyone can retry${until ? ` until ${until}` : ' until the retry deadline'}; it works once the cause is fixed.`,
        };
    }
    if (kind === 'expire') {
        const closed = dayOf(p.retryDeadline);
        return {kind, tone: 'neutral', title: 'Too late to retry', text: `The retry window closed${closed ? ` on ${closed}` : ''}. Settling it again marks it expired; nothing runs.`};
    }
    if (p.status === 'VOTING') return null;

    const parts: string[] = [];
    const settled = p.outcome?.settledHeight;
    const numbers = turnoutAndYes(view);
    if (p.status !== 'CANCELLED' && (settled || numbers)) {
        parts.push(`${[settled ? `Settled at block ${settled.toLocaleString('en-US')}` : '', numbers.replace(', ', ' · ')].filter(Boolean).join(' · ')}.`);
    }
    if (p.status === 'EXECUTED') parts.push(n === 0 ? 'It passed; it had no actions to run.' : n === 1 ? 'Its action ran.' : 'Its actions ran.');
    if (p.status === 'REJECTED') parts.push('Nothing ran.');
    if (p.status === 'EXPIRED') parts.push('It passed, but its actions kept failing until the retry deadline. Nothing ran.');
    if (p.status === 'CANCELLED') parts.push('Cancelled before the end of voting. Nothing ran.');
    return {kind: 'finished', tone: p.status === 'EXECUTED' ? 'success' : p.status === 'REJECTED' ? 'danger' : 'neutral', title: '', text: parts.join(' ')};
}

/**
 * The tally as it would be with this wallet's YES of `weight`: its old ballot taken out first (a revote replaces
 * it), the way the chain counts a revote. Null when a number cannot be read. The dialog runs ui-kit's rules on it.
 */
export function tallyWithYes(
    tally: {denominator: string; yes: string; no: string; abstain: string} | null,
    ballot: {option: string; weight: string} | null,
    weight: string,
): {denominator: string; yes: string; no: string; abstain: string} | null {
    const digits = /^\d+$/;
    if (!tally || !digits.test(weight) || ![tally.yes, tally.no, tally.abstain].every((v) => digits.test(v))) return null;
    const old = (option: string) => (ballot && ballot.option === option && digits.test(ballot.weight) ? BigInt(ballot.weight) : BigInt(0));
    const left = (v: string, option: string) => {
        const n = BigInt(v) - old(option);
        return n < BigInt(0) ? BigInt(0) : n;
    };
    return {
        denominator: tally.denominator,
        yes: (left(tally.yes, 'YES') + BigInt(weight)).toString(),
        no: left(tally.no, 'NO').toString(),
        abstain: left(tally.abstain, 'ABSTAIN').toString(),
    };
}
