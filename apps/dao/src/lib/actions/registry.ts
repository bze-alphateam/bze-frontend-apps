import {acceptEntry, nominateEntry, withdrawEntry} from './admin';
import {customEntry} from './custom';
import {electorateEntry} from './electorate';
import {membersEntry} from './members';
import {metadataEntry} from './metadata';
import {payEntry} from './pay';
import {rulesEntry} from './rules';
import {createSubExecuteEntry, subAdminEntry} from './sub-dao';
import type {ActionContext, ActionEntry} from './types';

/**
 * The actions a proposal can carry, in the order the picker lists them. "Text only" is not an entry:
 * a signalling proposal is a proposal with no action at all.
 *
 * **Extension point (BFE-377):** add an `ActionEntry` here and its form to
 * `components/propose/action-forms.tsx` under the same `id`. The composer, the size meter, the review,
 * the draft and the submit need no change. An entry's `build` takes the signer from `ctx.dao.address`;
 * admin-execute reuses the entries with the sub-DAO as `ctx.dao`.
 */
export const ACTION_ENTRIES: readonly ActionEntry[] = [
    payEntry,
    metadataEntry,
    rulesEntry,
    membersEntry,
    electorateEntry,
    nominateEntry,
    withdrawEntry,
    acceptEntry,
    subAdminEntry,
    // the entry that runs other entries as a sub-DAO looks them up here, once the list exists
    createSubExecuteEntry((id) => findAction(id)),
    customEntry,
];

export const findAction = (id: string): ActionEntry | undefined => ACTION_ENTRIES.find((entry) => entry.id === id);

/** The entries offered for a DAO; pass `ctx` where it is known, for the entries that need what the page read. */
export const availableActions = (dao: ActionContext['dao'], ctx?: ActionContext): ActionEntry[] => ACTION_ENTRIES.filter((entry) => entry.available(dao, ctx));
