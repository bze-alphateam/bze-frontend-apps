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
    holderRewards: { name: 'Holder rewards', tech: 'rewards · denom reward' },
    stakingProgram: { name: 'Staking program', tech: 'rewards · staking reward' },
    airdropToStakers: { name: 'Airdrop to stakers', tech: 'rewards · distribute denom rewards' },
    dailyPrize: { name: 'Daily prize', tech: 'rewards · denom reward schedule' },
    multiSend: { name: 'Send to a list of wallets', tech: 'bank · multi-send' },
    control: { name: 'Control', tech: 'tokenfactory · admin' },
    lockSupply: { name: 'Lock the supply', tech: 'tokenfactory · renounce admin' },
    brandKit: { name: 'Brand kit', tech: 'tokenfactory · denom branding' },
    pool: { name: 'Liquidity pool', tech: 'tradebin · liquidity pool' },
    market: { name: 'Order-book market', tech: 'tradebin · market' },
} as const satisfies Record<string, Term>

export type TermKey = keyof typeof VOCABULARY
