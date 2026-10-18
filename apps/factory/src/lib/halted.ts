import type { Asset } from '@bze/bze-ui-kit'

/**
 * Form error for a pair that includes a governance-halted denom (tradebin HaltedDenoms): the chain
 * refuses new markets, pools and liquidity with it. `''` when no side is halted. Covers deep links
 * (`?base=`, `?pool=`) that bypass the pickers, which already hide halted denoms.
 */
export const haltedPairError = (...assets: (Asset | undefined)[]): string => {
    const halted = assets.filter((asset): asset is Asset => !!asset?.halted)
    if (halted.length === 0) return ''

    const names = halted.map(asset => asset.ticker).join(' and ')
    return `${names} ${halted.length > 1 ? 'are' : 'is'} no longer tradeable on BZE — support ended, so the chain refuses new markets, pools and liquidity with ${halted.length > 1 ? 'them' : 'it'}.`
}
