import {rangeCount} from './pagination';
import type {ScanOptionCounts} from './proposal-types';

/** A ballot share's source key (`sr/{reward id}` or `dr/{staking denom}`) in words. */
export function sourceLabel(source: string): string {
    if (source.startsWith('sr/')) return `Staking reward ${Number(source.slice(3)) || source.slice(3)}`;
    if (source.startsWith('dr/')) return `Denom Reward of ${source.slice(3)}`;
    return source;
}

/** The votes panel's option filter. */
export type VotesFilter = 'all' | 'YES' | 'NO' | 'ABSTAIN';

/** The count of each filter segment from Scan's ballots per option (All is their sum); every one null without them. */
export function filterCounts(counts: ScanOptionCounts | null): Record<VotesFilter, number | null> {
    if (!counts) return {all: null, YES: null, NO: null, ABSTAIN: null};
    return {all: counts.yes + counts.no + counts.abstain, YES: counts.yes, NO: counts.no, ABSTAIN: counts.abstain};
}

/**
 * The count line under the votes: "1–20 of 214 votes", or "4 votes" when they fit on one page. A member
 * list whose every vote fits on one page adds "· one vote per member", judged on `allVotes`, the votes of
 * every option (not the filtered `total`); null when it is not known, and then nothing is added.
 */
export function votesCount(args: {page: number; pageSize: number; rows: number; total: number; memberList: boolean; allVotes: number | null}): string {
    const {memberList, allVotes, ...range} = args;
    const text = rangeCount({...range, one: 'vote', many: 'votes'});
    return memberList && allVotes !== null && allVotes <= range.pageSize ? `${text} · one vote per member` : text;
}
