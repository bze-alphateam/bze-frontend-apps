import type {DaoCoin, DaoConfig, DaoDepositRefundPolicy, DaoFundsDestination, DaoProposalStatus} from '@bze/bze-ui-kit';
import type {ProposalModel} from './proposal-model';
import {shortAddress} from './format';

// The money of a proposal: the cost paid at submission and the deposit escrowed until it is settled.
// The pinned `deposit_refund_policy` (chain: x/dao docs, MsgSettleProposal) decides what happens to the deposit:
//   ALWAYS      refunded whatever the result (a cancel included)
//   ONLY_PASSED refunded only when the proposal passes; a rejected or cancelled one keeps it
//   NEVER       always kept
// A kept deposit goes to the pinned `kept_deposit_destination`. A proposal that passed but whose actions
// failed (EXECUTION_FAILED, and EXPIRED after it) still counts as passed: the deposit was released at the settle.

export type ProposalOutcome = 'pending' | 'passed' | 'rejected' | 'cancelled';

export function outcomeOfStatus(status: DaoProposalStatus): ProposalOutcome {
    switch (status) {
        case 'VOTING': return 'pending';
        case 'REJECTED': return 'rejected';
        case 'CANCELLED': return 'cancelled';
        default: return 'passed';
    }
}

/** Whether the deposit goes back to the proposer for a policy and a result (pending: not decided yet). */
export function depositRefunded(policy: DaoDepositRefundPolicy, outcome: Exclude<ProposalOutcome, 'pending'>): boolean {
    if (policy === 'ALWAYS') return true;
    if (policy === 'NEVER') return false;
    return outcome === 'passed';
}

const DESTINATION: Record<DaoFundsDestination, string> = {
    BURN: 'burned',
    TREASURY: "sent to the DAO's treasury",
};

export interface MoneyView {
    /** The proposal cost, one line; null when the DAO charges none. */
    cost: string | null;
    /** The deposit, one line; null when there was none. */
    deposit: string | null;
    /** What the policy means for this proposal (before or after the result); empty without a deposit. */
    depositRule: string;
    /** What Scan saw happen to the deposit after the settle; empty when unknown. */
    released: string;
}

const hasAmount = (coin: DaoCoin | null | undefined): coin is DaoCoin => !!coin && /[1-9]/.test(coin.amount);

/** The cost and deposit text of a proposal; `formatCoin` is the app's coin formatter. */
export function describeMoney(
    p: Pick<ProposalModel, 'status' | 'config' | 'deposit' | 'outcome'>,
    formatCoin: (coin: DaoCoin) => string,
): MoneyView {
    const config: DaoConfig | null = p.config;
    const cost = hasAmount(config?.proposal_cost)
        ? `${formatCoin(config!.proposal_cost!)} paid when it was submitted, ${DESTINATION[config!.cost_destination]}. It is never refunded.`
        : null;

    const deposit = hasAmount(p.deposit) ? p.deposit : null;
    if (!deposit) return {cost, deposit: null, depositRule: '', released: ''};
    const amount = formatCoin(deposit);

    const outcome = outcomeOfStatus(p.status);
    let depositRule = '';
    if (config) {
        const kept = DESTINATION[config.kept_deposit_destination];
        const policy = config.deposit_refund_policy;
        if (outcome === 'pending') {
            depositRule = {
                ALWAYS: 'It is refunded to the proposer whatever the result.',
                ONLY_PASSED: `It is refunded only if the proposal passes; if it is rejected or cancelled it is kept and ${kept}.`,
                NEVER: `It is never refunded: it is kept and ${kept}.`,
            }[policy];
        } else {
            depositRule = depositRefunded(policy, outcome)
                ? 'It was refunded to the proposer.'
                : `It was kept (${policy === 'NEVER' ? 'this DAO never refunds' : 'refunded only when a proposal passes'}) and ${kept}.`;
        }
    }

    let released = '';
    const scan = p.outcome;
    if (scan && scan.depositRefunded !== null && outcome !== 'pending') {
        released = scan.depositRefunded
            ? 'Released at the settle: refunded to the proposer.'
            : `Released at the settle: kept${scan.depositDestination ? `, sent to ${shortAddress(scan.depositDestination)}` : ''}.`;
    }

    return {cost, deposit: `${amount} held in escrow while the proposal is voted on.`, depositRule, released};
}
