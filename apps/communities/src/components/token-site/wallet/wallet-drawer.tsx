'use client';

import React from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {type Asset, getChainName} from "@bze/bze-ui-kit";

import {useTokenWallet} from "@/hooks/token-site/useTokenWallet";
import {useTokenWalletPositions} from "@/hooks/token-site/useTokenWalletPositions";

import {TsButton, TsDrawer, TsSegmented, ts} from "../kit";
import {TokenMark} from "../token-mark";
import {BalanceCard} from "./balance-card";
import {OtherAssets} from "./other-assets";
import {RewardsReady} from "./rewards-ready";
import {WALLET_TABS} from "./tabs";

function ConnectPrompt({asset}: { asset: Asset }) {
    const {connect} = useTokenWallet();

    return (
        <Flex direction="column" gap="16px" data-testid="wallet-connect-prompt">
            <chakra.p m="0" color={ts.muted} lineHeight="1.55">
                Connect a wallet to see your {asset.ticker} balance, claim your rewards and send {asset.ticker}.
            </chakra.p>
            <TsButton variant="primary" minH="52px" fontSize="16px" onClick={connect}>Connect wallet</TsButton>
        </Flex>
    );
}

function WalletFooter({asset, onSettings}: { asset: Asset; onSettings?: () => void }) {
    const {close} = useTokenWallet();
    const {disconnect} = useChain(getChainName());

    return (
        <Flex direction="column" gap="12px" pt="16px" mt="auto" borderTopWidth="1px" borderStyle="solid" borderColor={ts.border}>
            <OtherAssets asset={asset}/>
            <Flex gap="12px">
                {/* Settings (BFE-128) plugs in here. */}
                {onSettings && <TsButton variant="ghost" flex="1" onClick={onSettings}>Settings</TsButton>}
                <TsButton
                    variant="ghost"
                    flex="1"
                    onClick={() => {
                        disconnect();
                        close();
                    }}
                >
                    Disconnect
                </TsButton>
            </Flex>
        </Flex>
    );
}

function ConnectedWallet({asset, address}: { asset: Asset; address: string }) {
    const {tab, setTab} = useTokenWallet();
    const {positions, reload} = useTokenWalletPositions(asset.denom);
    const active = WALLET_TABS.find((definition) => definition.value === tab) ?? WALLET_TABS[0];

    return (
        <>
            <BalanceCard asset={asset} address={address} positions={positions}/>
            <RewardsReady asset={asset} address={address} positions={positions} onClaimed={reload}/>
            <TsSegmented
                label="Wallet actions"
                options={WALLET_TABS.map((definition) => ({value: definition.value, label: definition.label(asset)}))}
                value={active.value}
                onChange={setTab}
            />
            <div role="tabpanel" aria-label={active.label(asset)}>{active.render(asset)}</div>
            <WalletFooter asset={asset}/>
        </>
    );
}

/**
 * The token site's own wallet (Business Logic R4), dedicated to the page token T: balance and
 * positions, rewards with "Claim all", the action tabs and the wallet's other assets.
 */
export function WalletDrawer({asset}: { asset: Asset }) {
    const {isOpen, close} = useTokenWallet();
    const {status, address} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);

    return (
        <TsDrawer open={isOpen} onClose={close} title={`Your ${asset.name} wallet`} icon={<TokenMark asset={asset} size={32}/>}>
            {connected && address ? <ConnectedWallet asset={asset} address={address}/> : <ConnectPrompt asset={asset}/>}
        </TsDrawer>
    );
}
