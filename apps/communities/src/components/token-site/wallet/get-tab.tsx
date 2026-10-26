'use client';

import React from "react";
import {chakra} from "@chakra-ui/react";
import {type Asset, useLiquidityPools} from "@bze/bze-ui-kit";

import {isTradable} from "@/lib/token-site/swap";

import {TsNotice, ts} from "../kit";
import {SwapForm} from "../trade/swap-form";
import {BzeFeeNotice} from "./bze-fee";

/** "Not tradable yet" when T sits in no pool (R8); nothing while it does or the pools are loading. */
export function NotTradableNotice({asset}: { asset: Asset }) {
    const {pools, isLoading} = useLiquidityPools();
    if (isLoading || isTradable(asset.denom, pools)) return null;

    return (
        <TsNotice data-testid="get-not-tradable">
            <chakra.strong display="block">Not tradable yet</chakra.strong>
            {`${asset.ticker} isn't in any liquidity pool, so it can't be swapped into for now.`}
        </TsNotice>
    );
}

/**
 * Get T (Business Logic R8): an instant swap into T, paying with any held token that has a route
 * of at most 3 hops; the swap form is the one the Trade section uses for Buy. In low-liquidity
 * mode it says the swap's fee is paid in BZE (R12).
 */
export function GetTab({asset}: { asset: Asset }) {
    const {pools, isLoading} = useLiquidityPools();

    if (!isTradable(asset.denom, pools)) {
        return isLoading ? <chakra.p m="0" color={ts.muted}>Loading pools…</chakra.p> : <NotTradableNotice asset={asset}/>;
    }

    return <SwapForm asset={asset} direction="buy" idPrefix="get" cta={`Get ${asset.ticker}`} notice={<BzeFeeNotice asset={asset}/>}/>;
}
