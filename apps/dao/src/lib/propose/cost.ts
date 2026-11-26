import BigNumber from 'bignumber.js';
import type {DaoCoin, DaoConfig, DaoFundsDestination} from '@bze/bze-ui-kit';

export interface CostLine {
    /** `cost` is paid and gone; `deposit` is escrowed. */
    kind: 'cost' | 'deposit';
    coin: DaoCoin;
    text: string;
}

export interface Requirement {
    denom: string;
    /** Cost plus deposit in this token, in base units. */
    needed: string;
    /** The wallet's balance of it; null when balances are not loaded. */
    balance: string | null;
    short: boolean;
}

export interface CostSummary {
    lines: CostLine[];
    requirements: Requirement[];
    /** Some token's balance is below what the proposal needs. */
    short: boolean;
}

const positive = (coin: DaoCoin | null | undefined): coin is DaoCoin => !!coin && /[1-9]/.test(coin.amount);

const WHERE: Record<DaoFundsDestination, string> = {
    BURN: 'burned',
    TREASURY: "sent to the DAO's treasury",
};

/**
 * What submitting costs, in words the user reads before signing. The cost leaves the wallet for good;
 * the deposit is held and comes back or is kept by the DAO's own `deposit_refund_policy` and
 * `kept_deposit_destination`. Each is in its own token: nothing is swapped. The sums are exact
 * (BigNumber over base units). `balanceOf` is the wallet's balance of a token, null when unknown.
 */
export function summarizeCost(
    config: Pick<DaoConfig, 'proposal_cost' | 'proposal_deposit' | 'deposit_refund_policy' | 'cost_destination' | 'kept_deposit_destination'>,
    formatCoin: (coin: DaoCoin) => string,
    balanceOf: (denom: string) => BigNumber | null,
): CostSummary {
    const lines: CostLine[] = [];
    const needed = new Map<string, BigNumber>();
    const add = (coin: DaoCoin) => needed.set(coin.denom, (needed.get(coin.denom) ?? new BigNumber(0)).plus(coin.amount));

    const {proposal_cost: cost, proposal_deposit: deposit} = config;
    if (positive(cost)) {
        lines.push({kind: 'cost', coin: cost, text: `${formatCoin(cost)} is paid now and never refunded. It is ${WHERE[config.cost_destination]}.`});
        add(cost);
    }
    if (positive(deposit)) {
        const kept = WHERE[config.kept_deposit_destination];
        const rule = {
            ALWAYS: 'It is held until the proposal is settled and then refunded to you, whatever the result.',
            ONLY_PASSED: `It is held until the proposal is settled and refunded to you only if the proposal passes. If it is rejected or cancelled it is kept and ${kept}.`,
            NEVER: `It is held and never refunded: it is kept and ${kept}.`,
        }[config.deposit_refund_policy];
        lines.push({kind: 'deposit', coin: deposit, text: `${formatCoin(deposit)} is put in escrow. ${rule}`});
        add(deposit);
    }

    const requirements = [...needed].map(([denom, amount]): Requirement => {
        const balance = balanceOf(denom);
        return {denom, needed: amount.toFixed(0), balance: balance ? balance.toFixed(0) : null, short: balance !== null && balance.lt(amount)};
    });

    return {lines, requirements, short: requirements.some((r) => r.short)};
}
