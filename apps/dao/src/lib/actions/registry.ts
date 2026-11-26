import {customEntry} from './custom';
import {payEntry} from './pay';
import type {ActionContext, ActionEntry} from './types';

/**
 * The actions a proposal can carry, in the order the picker lists them. "Text only" is not an entry:
 * a signalling proposal is a proposal with no action at all.
 *
 * **Extension point (BFE-376, BFE-377):** add an `ActionEntry` here and its form to
 * `components/propose/action-forms.tsx` under the same `id`. The composer, the size meter, the review,
 * the draft and the submit need no change. An entry's `build` takes the signer from `ctx.dao.address`;
 * admin-execute reuses the entries with the sub-DAO as `ctx.dao`.
 */
export const ACTION_ENTRIES: readonly ActionEntry[] = [payEntry, customEntry];

export const findAction = (id: string): ActionEntry | undefined => ACTION_ENTRIES.find((entry) => entry.id === id);

/** The entries offered for a DAO. */
export const availableActions = (dao: ActionContext['dao']): ActionEntry[] => ACTION_ENTRIES.filter((entry) => entry.available(dao));
