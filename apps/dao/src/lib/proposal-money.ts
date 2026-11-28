import type {DaoCoin, DaoDepositRefundPolicy, DaoFundsDestination, DaoProposalStatus} from '@bze/bze-ui-kit';
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

const hasAmount = (coin: DaoCoin | null | undefined): coin is DaoCoin => !!coin && /[1-9]/.test(coin.amount);

export interface MoneyRow {
    label: string;
    value: string;
    testId: string;
}

export interface MoneyRows {
    rows: MoneyRow[];
    /** A sentence instead of (or above) the rows: nothing to pay, or rules that are not known. */
    note: {text: string; testId: string} | null;
}

const WHERE: Record<DaoFundsDestination, string> = {BURN: 'Burned', TREASURY: "Goes to the DAO's treasury"};
const WENT: Record<DaoFundsDestination, string> = {BURN: 'Burned', TREASURY: "Went to the DAO's treasury"};

/**
 * The "Deposit and cost" card as label / value rows. While it votes: the deposit, what happens to it if it passes
 * and if it doesn't, and the cost; once decided: the deposit and where it went (Scan's record first, else the
 * pinned policy). Nothing is guessed: an unknown policy or destination says so.
 */
export function moneyRows(p: Pick<ProposalModel, 'status' | 'config' | 'deposit' | 'outcome'>, formatCoin: (coin: DaoCoin) => string): MoneyRows {
    const config = p.config;
    const policy = config?.deposit_refund_policy ?? null;
    const kept = config?.kept_deposit_destination ?? null;
    const outcome = outcomeOfStatus(p.status);
    const rows: MoneyRow[] = [];
    let unknown = false;

    const fate = (result: Exclude<ProposalOutcome, 'pending'>, words: Record<DaoFundsDestination, string>, back: string): string | null => {
        if (!policy) return null;
        if (depositRefunded(policy, result)) return back;
        return kept ? words[kept] : null;
    };

    const deposit = hasAmount(p.deposit) ? p.deposit : null;
    if (deposit) {
        const amount = formatCoin(deposit);
        if (outcome === 'pending') {
            rows.push({label: 'Deposit', value: `${amount}, held by the module`, testId: 'money-deposit'});
            const passes = fate('passed', WHERE, 'Back to the proposer');
            const fails = fate('rejected', WHERE, 'Back to the proposer');
            if (passes && fails) {
                rows.push({label: 'If it passes', value: passes, testId: 'deposit-if-passes'});
                rows.push({label: "If it doesn't", value: fails, testId: 'deposit-rule'});
            } else unknown = true;
        } else {
            rows.push({label: 'Deposit', value: amount, testId: 'money-deposit'});
            const scan = p.outcome;
            let went: string | null = null;
            if (scan && scan.depositRefunded !== null) {
                went = scan.depositRefunded ? 'Back to the proposer' : scan.depositDestination ? `Kept, sent to ${shortAddress(scan.depositDestination)}` : 'Kept';
                rows.push({label: 'Where it went', value: went, testId: 'deposit-released'});
            } else {
                went = fate(outcome, WENT, 'Back to the proposer');
                if (went) rows.push({label: 'Where it went', value: went, testId: 'deposit-rule'});
                else unknown = true;
            }
        }
    }

    const costCoin = hasAmount(config?.proposal_cost) ? config!.proposal_cost! : null;
    if (costCoin) {
        const where = config!.cost_destination ? `, ${DESTINATION[config!.cost_destination]}` : '';
        if (!config!.cost_destination) unknown = true;
        rows.push({label: 'Proposal cost', value: `${formatCoin(costCoin)}${where}. Never refunded.`, testId: 'money-cost'});
    } else if (config && deposit) {
        rows.push({label: 'Proposal cost', value: 'None', testId: 'money-cost'});
    }

    if (!deposit && !costCoin) {
        return {rows, note: config ? {text: 'None: proposals in this DAO are free.', testId: 'money-none'} : {text: 'The cost and deposit of this proposal are not known.', testId: 'money-none'}};
    }
    if (unknown || (deposit && !config)) {
        return {rows, note: {text: 'The refund and destination rules of this proposal are not known, so what happens to its cost and deposit cannot be told.', testId: 'money-rules-unknown'}};
    }
    return {rows, note: null};
}
