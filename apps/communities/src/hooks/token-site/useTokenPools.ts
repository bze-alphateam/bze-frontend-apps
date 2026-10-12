import {useLiquidityPools} from "@bze/bze-ui-kit";

import {type TokenPoolRow, tokenPoolRows} from "@/lib/token-site/liquidity";

/**
 * The liquidity pools containing `denom`, the most USD liquidity first, with their 24h volume and
 * APR (Business Logic R9). The viewer's position in each comes from ui-kit's `useLiquidityPool`.
 */
export function useTokenPools(denom: string): { rows: TokenPoolRow[]; isLoading: boolean } {
    const {pools, poolsDataMap, isLoading} = useLiquidityPools();

    return {rows: tokenPoolRows(denom, pools, poolsDataMap), isLoading};
}
