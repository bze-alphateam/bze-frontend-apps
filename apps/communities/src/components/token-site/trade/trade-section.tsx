'use client';

import React from "react";
import {Flex} from "@chakra-ui/react";
import {type Asset, useLiquidityPools} from "@bze/bze-ui-kit";

import {tokenPools} from "@/lib/token-site/chart";

import {TsSection} from "../kit";
import {PoolChart} from "./pool-chart";
import {SwapPanel} from "./swap-panel";

/**
 * "Buy and sell T" (Business Logic R8): the price chart of T's pools next to the Buy/Sell panel.
 * Rendered only while T sits in at least one liquidity pool; no order book here.
 */
export function TradeSection({asset}: { asset: Asset }) {
    const {pools, poolsDataMap} = useLiquidityPools();
    const own = tokenPools(asset.denom, pools, (id) => poolsDataMap.get(id)?.usdValue);
    if (own.length === 0) return null;

    return (
        <TsSection id="trade" eyebrow="Trade" title={`Buy and sell ${asset.ticker}`}>
            <Flex wrap="wrap" gap="20px" align="stretch">
                <PoolChart asset={asset} pools={own}/>
                <SwapPanel asset={asset}/>
            </Flex>
        </TsSection>
    );
}
