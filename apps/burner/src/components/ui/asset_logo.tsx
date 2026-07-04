import {Asset, isLpDenom, useLiquidityPools, useAsset, TokenLogo, LPTokenLogo} from "@bze/bze-ui-kit";
import {useMemo} from "react";

interface AssetLogoProps {
    asset: Asset;
    size?: string;
}

export const AssetLogo = ({asset, size}: AssetLogoProps) => {
    const isLP = useMemo(() => isLpDenom(asset.denom), [asset]);
    const { getPoolByLpDenom } = useLiquidityPools();
    const pool = useMemo(() => (isLP ? getPoolByLpDenom(asset.denom) : undefined), [asset, isLP, getPoolByLpDenom]);
    const { asset: baseAsset } = useAsset(pool?.base || '');
    const { asset: quoteAsset } = useAsset(pool?.quote || '');

    return (
        <>
            {
                isLP ? (
                    <LPTokenLogo
                        baseAssetLogo={baseAsset?.logo || asset.logo}
                        quoteAssetLogo={quoteAsset?.logo || asset.logo}
                        baseAssetSymbol={baseAsset?.ticker || asset.ticker}
                        quoteAssetSymbol={quoteAsset?.ticker || asset.ticker}
                        size={size}
                    />
                ) : (
                    <TokenLogo src={asset.logo} symbol={asset.ticker} size={size} />
                )
            }
        </>
    )
}