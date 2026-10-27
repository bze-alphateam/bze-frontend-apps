'use client'

import {LPTokenLogo} from "@bze/bze-ui-kit";

/** Logo size of a pair in the markets and pools lists and on the market page, so all three draw it alike. */
export const PAIR_LOGO_SIZE = "8"

/** The two overlapping token logos naming a pair: in a listing row and in the market page header. */
export const PairLogo = ({baseLogo, quoteLogo, baseTicker, quoteTicker}: {
    baseLogo?: string;
    quoteLogo?: string;
    baseTicker: string;
    quoteTicker: string;
}) => (
    <LPTokenLogo
        data-testid="pair-logo"
        flex="none"
        baseAssetLogo={baseLogo || ''}
        quoteAssetLogo={quoteLogo || ''}
        baseAssetSymbol={baseTicker}
        quoteAssetSymbol={quoteTicker}
        size={PAIR_LOGO_SIZE}
    />
)
