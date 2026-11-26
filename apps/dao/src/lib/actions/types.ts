import type {EncodeObject} from '@bze/bzejs/types';
import type {Dao, DaoCoin, DaoParams, DaoStakeSource} from '@bze/bze-ui-kit';

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

/** A DAO this DAO administers, with its treasury (null when that could not be read). */
export interface SubDao {
    dao: Pick<Dao, 'id' | 'address' | 'type' | 'config' | 'members' | 'electorate' | 'admin' | 'name' | 'description' | 'pending_admin'>;
    treasury: DaoCoin[] | null;
    /** The staking sources with this sub-DAO's own stake in each (what its electorate checks read); `[]` for a member-list DAO, null when unreadable. */
    sources: ElectorateOption[] | null;
}

/** A staking source a stake DAO could vote with, and what the DAO's own account has staked in it (that stake never votes). */
export interface ElectorateOption extends DaoStakeSource {
    own: string;
}

/** A DAO that nominated this DAO as its new admin (the chain's `pending_admin` is this DAO's address). */
export type IncomingNomination = Pick<Dao, 'id' | 'name' | 'address'>;

/** What the entries read about the DAO the proposal is for. Collaborators are injected, so entries are pure. */
export interface ActionContext {
    dao: Pick<Dao, 'id' | 'address' | 'type' | 'config' | 'members' | 'electorate' | 'admin' | 'name' | 'description' | 'pending_admin'>;
    params: DaoParams;
    /** The chain's native token, the default of a cost or deposit. */
    nativeDenom: string;
    /** The DAOs this DAO administers; null when they could not be read (never "none"). */
    subDaos: SubDao[] | null;
    /** The DAOs that nominated this DAO as admin; null when that is unknown (BZE Scan did not answer). */
    incoming: IncomingNomination[] | null;
    /** Every staking source with the DAO's own stake in it; null when they could not be read. Read for stake DAOs only. */
    sources: ElectorateOption[] | null;
    /** The treasury's coins; null when they could not be read. */
    treasury: DaoCoin[] | null;
    /** The exponent of a token; null when the app does not know the token. */
    decimalsOf: (denom: string) => number | null;
    ticker: (denom: string) => string;
    /**
     * The actions run in the transaction that is signed (an admin's execute), not later: a payment the treasury
     * cannot cover then fails right away instead of at settle time. Absent or false when they run later.
     */
    runsNow?: boolean;
}

/**
 * One kind of action the composer offers (the registry is `lib/actions/registry.ts`). An entry is plain
 * data and functions; its form is a component registered under the same `id` in
 * `components/propose/action-forms.tsx`. A later story adds an action by adding one entry and one form.
 *
 * Every message an entry builds must be signed by the DAO account only: it runs as the DAO, when a proposal
 * passes or when its admin runs it (the chain refuses any other signer, error 1111).
 */
export interface ActionEntry {
    id: string;
    label: string;
    /** One sentence for the "add an action" picker. */
    description: string;
    /**
     * Whether the entry is offered for this DAO (a members action is hidden for a stake DAO, say).
     * `ctx` is passed where it is known: an entry that needs what the page read (the sub-DAOs) is offered
     * only when that is there.
     */
    available(dao: ActionContext['dao'], ctx?: ActionContext): boolean;
    initialFields(ctx: ActionContext): ActionFields;
    /** The first problem as a plain sentence, undefined when the fields make a valid message. */
    validate(fields: ActionFields, ctx: ActionContext): string | undefined;
    /** Things worth a look that do not stop the proposal. */
    warnings?(fields: ActionFields, ctx: ActionContext): string[];
    /** The message the DAO runs. Only called for fields `validate` accepted; throws otherwise. */
    build(fields: ActionFields, ctx: ActionContext): EncodeObject;
}
