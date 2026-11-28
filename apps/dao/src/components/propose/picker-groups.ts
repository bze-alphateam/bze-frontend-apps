import {ACCEPT_ID} from '@/lib/actions/admin';
import {SUB_ADMIN_ID, SUB_EXECUTE_ID} from '@/lib/actions/sub-dao';

/** The picker's groups, by entry id; an entry in none of them goes to the first. */
export const PICKER_GROUPS: {title: string; ids: readonly string[]}[] = [
    {title: 'Basics', ids: ['pay', 'custom']},
    {title: 'This DAO', ids: ['update-metadata', 'update-rules', 'update-members', 'update-electorate', 'nominate-admin', 'withdraw-nomination']},
    {title: 'Other DAOs', ids: [ACCEPT_ID, SUB_ADMIN_ID, SUB_EXECUTE_ID]},
];

export const SUB_IDS: readonly string[] = [SUB_ADMIN_ID, SUB_EXECUTE_ID];

export const groupOf = (id: string): number => Math.max(0, PICKER_GROUPS.findIndex((g) => g.ids.includes(id)));

export const pickerTestId = (title: string): string => `picker-group-${title.toLowerCase().replace(/ /g, '-')}`;

/** Why a nomination can go stale, said once in the group that lists a nomination. */
export const STALE_NOTE = 'A nomination goes out of date when the DAO that runs the nominating DAO changes its admin: it can no longer be accepted, and that DAO has to nominate again.';
