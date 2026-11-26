import type {DaoConfig, DaoCoin, DaoDepositRefundPolicy, DaoFundsDestination, DaoParams, DaoType} from '@bze/bze-ui-kit';
import {formatDuration, formatRatio} from './format';

export interface RuleRow {
    id: 'quorum' | 'threshold' | 'voting-period' | 'expedited' | 'who-proposes' | 'cost' | 'deposit' | 'open-slots';
    label: string;
    value: string;
}

export interface RulesView {
    rows: RuleRow[];
    /** The chain doc's warning, set when a proposal costs nothing to submit. */
    freeProposalsWarning: string | null;
}

const isZero = (coin: DaoCoin | null | undefined): boolean => !coin || !/[1-9]/.test(coin.amount);

const DESTINATION: Record<DaoFundsDestination, string> = {
    BURN: 'burned',
    TREASURY: "sent to the DAO's treasury",
};

const REFUND: Record<DaoDepositRefundPolicy, string> = {
    ALWAYS: 'returned whatever the result',
    ONLY_PASSED: 'returned only when the proposal passes',
    NEVER: 'never returned',
};

/** Seconds of a chain duration ("259200s"); null when it cannot be read. */
export function secondsOf(duration: string): number | null {
    const match = /^(\d+)(?:\.\d+)?s$/.exec(duration);
    return match ? Number(match[1]) : null;
}

const durationText = (duration: string): string => {
    const seconds = secondsOf(duration);
    return seconds === null ? duration : formatDuration(seconds);
};

/**
 * The voting rules of a DAO in plain words. `params` (the module's) is optional: without it the
 * rows that need it (the expedite delay, the open-proposal slots) are left out.
 */
export function describeRules(
    type: DaoType,
    config: DaoConfig,
    params: Pick<DaoParams, 'min_expedite_delay' | 'max_open_proposals'> | null,
    formatCoin: (coin: DaoCoin) => string,
): RulesView {
    const stake = type === 'DAO_TYPE_STAKE';
    const voters = stake ? 'voting power' : 'members';
    const rows: RuleRow[] = [
        {id: 'quorum', label: 'Quorum', value: `At least ${formatRatio(config.min_quorum)} of all ${voters} must vote`},
        {id: 'threshold', label: 'Pass threshold', value: `More than ${formatRatio(config.threshold)} of the yes and no votes must be yes`},
        {id: 'voting-period', label: 'Voting period', value: durationText(config.voting_period)},
    ];

    if (!config.allow_expedite) {
        rows.push({id: 'expedited', label: 'Expedited voting', value: 'Off'});
    } else {
        const parts = [
            `Voting lasts ${durationText(config.expedited_period)}`,
            `ends early once ${formatRatio(config.expedite_quorum)} of all ${voters} has voted and more than ${formatRatio(config.expedite_threshold)} of all ${voters} has voted yes`,
        ];
        const delay = params ? secondsOf(params.min_expedite_delay) : null;
        if (stake && delay !== null) parts.push(`not before ${formatDuration(delay)} after submission`);
        rows.push({id: 'expedited', label: 'Expedited voting', value: parts.join('; ')});
    }

    rows.push({
        id: 'who-proposes',
        label: 'Who can propose',
        value: config.open_submission ? 'Anyone' : stake ? 'Voters only (stakers in the sources)' : 'Members only',
    });

    const cost = isZero(config.proposal_cost) ? null : config.proposal_cost!;
    rows.push({
        id: 'cost',
        label: 'Proposal cost',
        value: cost ? `${formatCoin(cost)}, ${DESTINATION[config.cost_destination]}` : 'None',
    });

    const deposit = isZero(config.proposal_deposit) ? null : config.proposal_deposit!;
    if (!deposit) {
        rows.push({id: 'deposit', label: 'Proposal deposit', value: 'None'});
    } else {
        const kept = config.deposit_refund_policy === 'ALWAYS' ? '' : `; a deposit that is kept is ${DESTINATION[config.kept_deposit_destination]}`;
        rows.push({
            id: 'deposit',
            label: 'Proposal deposit',
            value: `${formatCoin(deposit)}, ${REFUND[config.deposit_refund_policy]}${kept}`,
        });
    }

    if (params) {
        rows.push({id: 'open-slots', label: 'Open proposals at once', value: `Up to ${params.max_open_proposals}`});
    }

    // A deposit that is always returned costs nothing either (chain docs, "MsgCreateDao").
    const free = !cost && (!deposit || config.deposit_refund_policy === 'ALWAYS');
    const slots = params ? `all ${params.max_open_proposals} open-proposal slots` : 'all the open-proposal slots';
    return {
        rows,
        freeProposalsWarning: free
            ? `Proposals are free here: anyone who is allowed to propose can fill ${slots}, and keep them filled, so the DAO's own proposals may find no room.`
            : null,
    };
}
