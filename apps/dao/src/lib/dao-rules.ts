import type {DaoConfig, DaoCoin, DaoParams, DaoType} from '@bze/bze-ui-kit';
import {formatDuration, formatRatio} from './format';

export interface RuleRow {
    id: 'quorum' | 'threshold' | 'voting-period' | 'expedited' | 'who-proposes' | 'cost' | 'deposit';
    label: string;
    value: string;
}

export interface RulesView {
    rows: RuleRow[];
}

const isZero = (coin: DaoCoin | null | undefined): boolean => !coin || !/[1-9]/.test(coin.amount);

/** Seconds of a chain duration ("259200s"); null when it cannot be read. */
export function secondsOf(duration: string): number | null {
    const match = /^(\d+)(?:\.\d+)?s$/.exec(duration);
    return match ? Number(match[1]) : null;
}

const durationText = (duration: string): string => {
    const seconds = secondsOf(duration);
    return seconds === null ? duration : formatDuration(seconds);
};

/** "33.4 %": the boards put a space before the sign. */
const pct = (ratio: string): string => formatRatio(ratio).replace(/%$/, ' %');

/** "2-day" from "2 days" for "a 2-day vote"; a compound duration stays as it is ("1 day 6 hours"). */
const asAdjective = (duration: string): string => {
    const simple = /^(\d+) (day|hour|minute|second)s?$/.exec(duration);
    return simple ? `${simple[1]}-${simple[2]}` : duration;
};

/** The deposit sentence of D3: what happens to it, by refund policy and where a kept one goes. */
function depositText(amount: string, config: DaoConfig): string {
    const kept = config.kept_deposit_destination === 'BURN' ? 'it is burned' : 'it goes to the treasury';
    switch (config.deposit_refund_policy) {
        case 'ALWAYS':
            return `${amount}, always given back`;
        case 'ONLY_PASSED':
            return `${amount}, back only if the proposal passes; otherwise ${kept}`;
        case 'NEVER':
            return config.kept_deposit_destination === 'BURN'
                ? `${amount}, never given back: burned when the proposal ends`
                : `${amount}, never given back: it goes to the treasury when the proposal ends`;
    }
}

/**
 * The voting rules of a DAO in the boards' words (D1, D2, D3). `params` (the module's) is optional: without
 * it the expedite delay of a stake DAO is left out.
 */
export function describeRules(
    type: DaoType,
    config: DaoConfig,
    params: Pick<DaoParams, 'min_expedite_delay' | 'max_open_proposals'> | null,
    formatCoin: (coin: DaoCoin) => string,
): RulesView {
    const stake = type === 'DAO_TYPE_STAKE';
    const rows: RuleRow[] = [
        {id: 'quorum', label: 'Quorum', value: stake ? `${pct(config.min_quorum)} of all voting power must vote` : `${pct(config.min_quorum)} of members must vote`},
        {id: 'threshold', label: 'To pass', value: `More than ${pct(config.threshold)} of yes + no`},
        {id: 'voting-period', label: 'Voting', value: durationText(config.voting_period)},
    ];

    if (!config.allow_expedite) {
        rows.push({id: 'expedited', label: 'Expedited', value: 'Not allowed'});
    } else {
        const length = asAdjective(durationText(config.expedited_period));
        const delay = params ? secondsOf(params.min_expedite_delay) : null;
        const value = stake
            ? `Allowed: ${length} vote that settles early when ${pct(config.expedite_quorum)} vote and more than ${pct(config.expedite_threshold)} of all voting power says yes`
                + (delay !== null && delay > 0 ? `, at the earliest ${formatDuration(delay)} after submission` : '')
            : `Allowed: ${length} vote that settles early when ${pct(config.expedite_quorum)} of members vote and more than ${pct(config.expedite_threshold)} of all members vote yes`;
        rows.push({id: 'expedited', label: 'Expedited', value});
    }

    rows.push({
        id: 'who-proposes',
        label: 'Who can propose',
        value: config.open_submission ? 'Anyone' : stake ? 'Stakers in the sources below' : 'Members only',
    });

    const cost = isZero(config.proposal_cost) ? null : config.proposal_cost!;
    rows.push({
        id: 'cost',
        label: 'Proposal cost',
        value: cost
            ? `${formatCoin(cost)}, paid on submit ${config.cost_destination === 'BURN' ? 'and burned' : 'to the treasury'}, never refunded`
            : 'None',
    });

    const deposit = isZero(config.proposal_deposit) ? null : config.proposal_deposit!;
    rows.push({id: 'deposit', label: 'Deposit', value: deposit ? depositText(formatCoin(deposit), config) : 'None'});

    return {rows};
}
