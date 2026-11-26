import type {Dao} from '@bze/bze-ui-kit';

/**
 * The actions of other stories this page links to. A flag turns on when its story has shipped, so
 * until then the page shows no button that leads nowhere: the proposal composer (BFE-375), the
 * members composer (BFE-376, "Request to join" and "Leave") and the admin console (BFE-377).
 * `proposalActions` is the proposal page's action area (BFE-374: vote, settle, retry, cancel, clean up).
 */
export interface DaoFeatures {
    newProposal: boolean;
    memberComposer: boolean;
    adminConsole: boolean;
    proposalActions: boolean;
}

export const DAO_FEATURES: DaoFeatures = {newProposal: false, memberComposer: false, adminConsole: false, proposalActions: true};

export interface DaoActions {
    newProposal: boolean;
    adminConsole: boolean;
    requestToJoin: boolean;
    leave: boolean;
}

/** Which action buttons the page shows for `wallet` (null when none is connected). */
export function actionsFor(features: DaoFeatures, dao: Pick<Dao, 'address' | 'admin' | 'pending_admin' | 'type' | 'members' | 'config'>, wallet: string | null): DaoActions {
    const connected = !!wallet;
    const isMember = connected && dao.type === 'DAO_TYPE_STATIC_LIST' && dao.members.includes(wallet);
    const externalAdmin = connected && dao.admin !== dao.address && dao.admin === wallet;
    const nominee = connected && !!dao.pending_admin && dao.pending_admin === wallet;
    const staticList = dao.type === 'DAO_TYPE_STATIC_LIST';

    return {
        newProposal: features.newProposal && connected,
        adminConsole: features.adminConsole && (externalAdmin || nominee),
        requestToJoin: features.memberComposer && staticList && dao.config.open_submission && connected && !isMember,
        leave: features.memberComposer && isMember,
    };
}

/** The text of "How to join" for a static-list DAO; a stake DAO's rules are fixed text in the component. */
export function staticJoinText(dao: Pick<Dao, 'config'>, member: boolean): string[] {
    const lines = ['Members are added and removed by the DAO: a proposal that passes, or its admin.'];
    if (member) {
        lines.push('You are a member. To step down, a proposal removing you has to pass (or the admin removes you).');
    } else if (dao.config.open_submission) {
        lines.push('Anyone can propose adding themselves; the members then vote on it.');
    } else {
        lines.push('Ask a member to propose adding you.');
    }
    return lines;
}
