import BigNumber from "bignumber.js";

/** One part of the Holders tab's supply bar. */
export type SupplyPartKey = "staked" | "budgets" | "dex" | "top10" | "rest";

export interface SupplyPart {
    key: SupplyPartKey;
    label: string;
    /** How the part is worked out, under its number. */
    how: string;
    /** Base units, never negative. */
    amount: BigNumber;
    /** Percent of the supply (0–100); 0 without a supply. */
    share: number;
}

/** A holder as the holders snapshot lists it; only the label's kind matters here. */
export interface SplitHolder {
    address: string;
    balance: string;
    label?: { kind?: string | null } | null;
}

export interface SupplySplitInput {
    /** Base units. */
    supply: BigNumber.Value;
    /** T staked in the holders pool (denom reward `staked_amount`), base units. */
    holdersPoolStaked: BigNumber.Value;
    /** `staked_amount` of every fixed-term program whose staking denom is T, base units. */
    programsStaked: BigNumber.Value[];
    /** The rewards module's balance of T, base units. */
    rewardsModuleBalance: BigNumber.Value;
    /** The tradebin (DEX) module's balance of T, base units. */
    dexModuleBalance: BigNumber.Value;
    /** The holders snapshot, biggest first. */
    holders: SplitHolder[];
}

/** Accounts that are no wallet: module accounts and IBC escrows. */
const NOT_A_WALLET = new Set(["module", "ibc_escrow"]);

/** How many wallets the "Top 10" part counts. */
export const TOP_HOLDERS = 10;

const positive = (value: BigNumber.Value): BigNumber => {
    const amount = new BigNumber(value);
    return amount.isFinite() && amount.gt(0) ? amount : new BigNumber(0);
};

/** The biggest wallets of the snapshot, modules and IBC escrows left out. */
export function topWallets(holders: SplitHolder[], count = TOP_HOLDERS): SplitHolder[] {
    return holders.filter((holder) => !NOT_A_WALLET.has(holder.label?.kind ?? "")).slice(0, count);
}

/**
 * Where T is (Holders tab): what is staked, what the reward programs still hold, what sits on the
 * DEX, the ten biggest wallets and everyone else. Every part is clamped at 0, so a snapshot older
 * than the live numbers never draws a negative part.
 */
export function supplySplit(input: SupplySplitInput): SupplyPart[] {
    const supply = positive(input.supply);
    const staked = input.programsStaked.reduce<BigNumber>((sum, amount) => sum.plus(positive(amount)), positive(input.holdersPoolStaked));
    const budgets = BigNumber.max(positive(input.rewardsModuleBalance).minus(staked), 0);
    const dex = positive(input.dexModuleBalance);
    const top10 = topWallets(input.holders).reduce<BigNumber>((sum, holder) => sum.plus(positive(holder.balance)), new BigNumber(0));
    const rest = BigNumber.max(supply.minus(staked).minus(budgets).minus(dex).minus(top10), 0);

    const share = (amount: BigNumber) => (supply.gt(0) ? amount.div(supply).times(100).toNumber() : 0);
    const part = (key: SupplyPartKey, label: string, how: string, amount: BigNumber): SupplyPart => ({key, label, how, amount, share: share(amount)});

    return [
        part("staked", "Staked", "holders pool + programs", staked),
        part("budgets", "Reward budgets", "rewards module − staked", budgets),
        part("dex", "On the DEX", "pools + open orders", dex),
        part("top10", "Top 10", "biggest wallets, no modules", top10),
        part("rest", "Rest", "everyone else", rest),
    ];
}

/** A share of the supply as the page writes it: "0.70 %", "< 0.01 %" for a sliver, "0 %" for none. */
export function formatShare(percent: number): string {
    if (!Number.isFinite(percent) || percent <= 0) return "0 %";
    if (percent < 0.01) return "< 0.01 %";

    return `${percent.toFixed(2)} %`;
}
