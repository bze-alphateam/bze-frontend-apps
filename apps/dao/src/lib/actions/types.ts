import type {EncodeObject} from '@bze/bzejs/types';
import type {Dao, DaoCoin, DaoParams} from '@bze/bze-ui-kit';

/** The form values of one action: every input is text, so a draft can be stored and checked field by field. */
export type ActionFields = Record<string, string>;

/** One action of a proposal being written: which entry of the registry it is, and what was typed. */
export interface ActionDraft {
    /** Stable id of the row in the list (never sent anywhere). */
    key: string;
    /** `ActionEntry.id`. */
    type: string;
    fields: ActionFields;
}

/** What the entries read about the DAO the proposal is for. Collaborators are injected, so entries are pure. */
export interface ActionContext {
    dao: Pick<Dao, 'id' | 'address' | 'type' | 'config' | 'members' | 'electorate' | 'admin'>;
    params: DaoParams;
    /** The treasury's coins; null when they could not be read. */
    treasury: DaoCoin[] | null;
    /** The exponent of a token; null when the app does not know the token. */
    decimalsOf: (denom: string) => number | null;
    ticker: (denom: string) => string;
}

/**
 * One kind of action the composer offers (the registry is `lib/actions/registry.ts`). An entry is plain
 * data and functions; its form is a component registered under the same `id` in
 * `components/propose/action-forms.tsx`. A later story adds an action by adding one entry and one form.
 *
 * Every message an entry builds must be signed by the DAO account only: it runs as the DAO when the
 * proposal passes (the chain refuses a proposal with any other signer, error 1111).
 */
export interface ActionEntry {
    id: string;
    label: string;
    /** One sentence for the "add an action" picker. */
    description: string;
    /** Whether the entry is offered for this DAO (a members action is hidden for a stake DAO, say). */
    available(dao: ActionContext['dao']): boolean;
    initialFields(ctx: ActionContext): ActionFields;
    /** The first problem as a plain sentence, undefined when the fields make a valid message. */
    validate(fields: ActionFields, ctx: ActionContext): string | undefined;
    /** Things worth a look that do not stop the proposal. */
    warnings?(fields: ActionFields, ctx: ActionContext): string[];
    /** The message the DAO runs. Only called for fields `validate` accepted; throws otherwise. */
    build(fields: ActionFields, ctx: ActionContext): EncodeObject;
}
