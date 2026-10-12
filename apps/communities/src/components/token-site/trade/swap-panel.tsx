'use client';

import React, {useState} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {type Asset, getChainName} from "@bze/bze-ui-kit";

import type {SwapDirection} from "@/hooks/token-site/useTokenSwap";

import {TsButton, TsCard, TsSegmented, ts} from "../kit";
import {SwapForm} from "./swap-form";

/**
 * Buy or sell T with an instant swap (Business Logic R8), or a connect prompt without a wallet.
 * `notice` fills the slot above the submit button (the low-liquidity BZE notice).
 */
export function SwapPanel({asset, notice}: { asset: Asset; notice?: React.ReactNode }) {
    const {status, address, connect} = useChain(getChainName());
    const [side, setSide] = useState<SwapDirection>("buy");
    const connected = status === WalletState.Connected && Boolean(address);
    const verb = side === "buy" ? "Buy" : "Sell";

    return (
        <TsCard flex="1 1 340px" minW="0" p="24px" display="flex" flexDirection="column" gap="14px" data-testid="swap-panel">
            <TsSegmented
                label="Side"
                options={[{value: "buy", label: "Buy"}, {value: "sell", label: "Sell"}]}
                value={side}
                onChange={setSide}
            />
            {connected ? (
                // Remounted per side, so the amount and token picked for one don't leak into the other.
                <SwapForm key={side} asset={asset} direction={side} idPrefix="trade" cta={`${verb} ${asset.ticker}`} notice={notice}/>
            ) : (
                <Flex direction="column" gap="16px" flex="1" justify="space-between" data-testid="trade-connect-prompt">
                    <chakra.p m="0" color={ts.muted} lineHeight="1.55">
                        Connect a wallet to {verb.toLowerCase()} {asset.ticker} with an instant swap.
                    </chakra.p>
                    <TsButton variant="primary" w="100%" minH="52px" fontSize="16px" onClick={() => connect()}>Connect wallet</TsButton>
                </Flex>
            )}
        </TsCard>
    );
}
