export interface PotCoin {
    denom: string;
    amount: string;
}

export interface SplitPot {
    /** Native and factory coins: burned at the next periodic burn. */
    toBurn: PotCoin[];
    /** Every other coin (IBC coins, LP shares): locked forever in the black hole address, not burned. */
    toLock: PotCoin[];
}

/** Chain v8.3.0 `splitBurnableCoins`: native or `factory/…` coins burn, everything else is locked. */
export const splitPotCoins = (coins: PotCoin[], nativeDenom: string): SplitPot => {
    const toBurn: PotCoin[] = [];
    const toLock: PotCoin[] = [];
    for (const coin of coins) {
        if (coin.denom === nativeDenom || coin.denom.startsWith('factory/')) toBurn.push(coin);
        else toLock.push(coin);
    }

    return {toBurn, toLock};
};
