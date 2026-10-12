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
import {NotTradableNotice} from "./get-tab";
import {OtherAssets} from "./other-assets";
import {RewardsReady} from "./rewards-ready";
import {SettingsPanel} from "./settings-panel";
import {WALLET_TABS} from "./tabs";

function ConnectPrompt({asset}: { asset: Asset }) {
    const {connect, tab} = useTokenWallet();

    return (
        <Flex direction="column" gap="16px" data-testid="wallet-connect-prompt">
            {/* Asked for Get on a token nobody can swap into: say so before asking for a wallet. */}
            {tab === "get" && <NotTradableNotice asset={asset}/>}
            <chakra.p m="0" color={ts.muted} lineHeight="1.55">
                Connect a wallet to see your {asset.ticker} balance, claim your rewards and send {asset.ticker}.
            </chakra.p>
            <TsButton variant="primary" minH="52px" fontSize="16px" onClick={connect}>Connect wallet</TsButton>
        </Flex>
    );
}

/** Settings, plus (when connected) the wallet's other assets and Disconnect. */
function WalletFooter({asset, connected}: { asset: Asset; connected: boolean }) {
    const {close, setView} = useTokenWallet();
    const {disconnect} = useChain(getChainName());

    return (
        <Flex direction="column" gap="12px" pt="16px" mt="auto" borderTopWidth="1px" borderStyle="solid" borderColor={ts.border}>
            {connected && <OtherAssets asset={asset}/>}
            <Flex gap="12px">
                <TsButton variant="ghost" flex="1" onClick={() => setView("settings")}>Settings</TsButton>
                {connected && (
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
                )}
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
        </>
    );
}

/**
 * The token site's own wallet (Business Logic R4), dedicated to the page token T: balance and
 * positions, rewards with "Claim all", the action tabs and the wallet's other assets; and the
 * settings panel (R13), reachable connected or not.
 */
export function WalletDrawer({asset}: { asset: Asset }) {
    const {isOpen, close, view, setView} = useTokenWallet();
    const {status, address} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);

    return (
        <TsDrawer open={isOpen} onClose={close} title={`Your ${asset.name} wallet`} icon={<TokenMark asset={asset} size={32}/>}>
            {view === "settings" ? (
                <SettingsPanel onBack={() => setView("wallet")}/>
            ) : (
                <>
                    {connected && address ? <ConnectedWallet asset={asset} address={address}/> : <ConnectPrompt asset={asset}/>}
                    <WalletFooter asset={asset} connected={connected}/>
                </>
            )}
        </TsDrawer>
    );
}
