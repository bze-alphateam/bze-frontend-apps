// Plain names for the Factory's features and the technical tag shown next to
// each in small grey text, so experienced users still recognise the module.
// Every redesigned screen takes its wording from here (BFE-142).

export interface Term {
    /** What creators read. */
    name: string;
    /** The chain module and feature behind it. */
    tech: string;
}

export const VOCABULARY = {
    holderRewards: { name: 'Compounded reward', tech: 'rewards · denom reward' },
    stakingProgram: { name: 'Simple reward', tech: 'rewards · staking reward' },
    dailyPrize: { name: 'Daily prize', tech: 'rewards · denom reward schedule' },
    multiSend: { name: 'Send to a list of wallets', tech: 'bank · multi-send' },
    control: { name: 'Permissions', tech: 'tokenfactory · admin' },
    transferAdmin: { name: 'Transfer admin', tech: 'tokenfactory · change admin' },
    lockSupply: { name: 'Renounce admin', tech: 'tokenfactory · renounce admin' },
    brandKit: { name: 'Brand kit', tech: 'tokenfactory · denom branding' },
    pool: { name: 'Liquidity pool', tech: 'tradebin · liquidity pool' },
    market: { name: 'Order-book market', tech: 'tradebin · market' },
} as const satisfies Record<string, Term>

export type TermKey = keyof typeof VOCABULARY
