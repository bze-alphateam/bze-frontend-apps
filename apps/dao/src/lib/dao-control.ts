import type {Dao, DaoControllerResponse} from '@bze/bze-ui-kit';

/** A DAO known by its account address (resolved from the chain), as the control chain names it. */
export interface KnownDao {
    id: string;
    name: string;
}

export type ControlStep =
    | {kind: 'dao'; address: string; dao?: KnownDao}
    | {kind: 'account'; address: string}
    | {kind: 'voters'; of: ControlStep & {kind: 'dao'}}
    /** The walk came back to a DAO it had already passed through. */
    | {kind: 'loop'; address: string; dao?: KnownDao}
    /** The walk stopped at its depth cap on this DAO. */
    | {kind: 'cap'; address: string; dao?: KnownDao};

export interface ControlState {
    kind: 'self-owned' | 'account' | 'dao' | 'unknown';
    /** One line: who is in charge ("No admin", "Admin is an account", "Admin is the DAO <name>"). */
    headline: string;
    /** Set when an outside party can spend the treasury. */
    warning: string | null;
    /** The chain walked, from this DAO to whoever ultimately decides ("DAO A → DAO B → voters of DAO B"). */
    steps: ControlStep[];
    /** Why the walk stopped, when it stopped on a problem (a loop, the depth cap). */
    note: string | null;
    pending: {nominee: string; nomineeDao?: KnownDao; text: string} | null;
}

const EXTERNAL_ADMIN_WARNING = 'An external admin can run any message as the DAO, including spending its treasury.';

/**
 * Who controls a DAO. `admin` / `pending_admin` come from the DAO, `controller` from
 * `dao_controller/{id}` (null when that query failed), and `known` names the DAOs among the
 * addresses involved (an address that is no DAO is simply absent).
 */
export function describeControl(dao: Pick<Dao, 'address' | 'admin' | 'pending_admin'>, controller: DaoControllerResponse | null, known: ReadonlyMap<string, KnownDao>, unresolved: ReadonlySet<string> = new Set()): ControlState {
    const pending = dao.pending_admin
        ? {
            nominee: dao.pending_admin,
            nomineeDao: known.get(dao.pending_admin),
            text: `${known.get(dao.pending_admin)?.name ?? dao.pending_admin} is nominated as the new admin. The current admin stays in charge until the nominee accepts.`,
        }
        : null;

    if (dao.admin === dao.address) {
        return {kind: 'self-owned', headline: 'No admin', warning: null, steps: [], note: null, pending};
    }

    // Neither the walk nor the by-address lookup answered: it is not known whether the admin is a person or a DAO.
    if (controller === null && !known.has(dao.admin) && unresolved.has(dao.admin)) {
        return {
            kind: 'unknown',
            headline: 'Admin (could not check whether it is an account or a DAO)',
            warning: null,
            steps: [],
            note: null,
            pending,
        };
    }

    const adminIsDao = known.has(dao.admin) || (controller !== null && controller.path.length > 1);
    if (!adminIsDao) {
        return {
            kind: 'account',
            headline: 'Admin is an account',
            warning: EXTERNAL_ADMIN_WARNING,
            steps: [{kind: 'account', address: dao.admin}],
            note: null,
            pending,
        };
    }

    const path = controller && controller.path.length > 1 ? controller.path : [dao.address, dao.admin];
    const steps: ControlStep[] = path.map((address) => ({kind: 'dao', address, dao: known.get(address)}));
    const last = steps[steps.length - 1] as ControlStep & {kind: 'dao'};
    const adminName = known.get(dao.admin)?.name ?? dao.admin;
    let note: string | null = null;
    let warning: string | null = null;

    switch (controller?.end_reason) {
        case 'ACCOUNT':
            steps.push({kind: 'account', address: controller.controller});
            warning = `${EXTERNAL_ADMIN_WARNING} Here that is the account at the end of the chain.`;
            break;
        case 'SELF_OWNED':
            steps.push({kind: 'voters', of: last});
            break;
        case 'CYCLE':
            steps.push({kind: 'loop', address: controller.controller, dao: known.get(controller.controller)});
            note = `The admin chain loops back to ${known.get(controller.controller)?.name ?? controller.controller}, so control stays with these DAOs.`;
            break;
        case 'DEPTH_CAP':
            steps.push({kind: 'cap', address: controller.controller, dao: known.get(controller.controller)});
            note = 'The admin chain is too long to follow to its end; the walk stopped at the 16th DAO.';
            break;
        default:
            // The walk is unknown (the query failed): only the direct admin DAO is named.
            break;
    }

    return {kind: 'dao', headline: `Admin is the DAO ${adminName}`, warning, steps, note, pending};
}
