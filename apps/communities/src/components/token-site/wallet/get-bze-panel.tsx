'use client';

import React, {useEffect, useRef} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {LuArrowLeft} from "react-icons/lu";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {
    formatDuration,
    getChainName,
    getChainNativeAssetDenom,
    prettyAmount,
    shortNumberFormat,
    toBigNumber,
    uAmountToBigNumberAmount,
    useAssets,
    useBuyBze,
} from "@bze/bze-ui-kit";

import {useTokenWallet} from "@/hooks/token-site/useTokenWallet";

import {TsButton, TsField, TsNotice, ts, tsMix} from "../kit";

interface PickOption {
    key: string;
    label: string;
    logo?: string;
    note?: string;
    disabled?: boolean;
}

/** A searchable list to pick the source network or asset from. */
function PickList({title, search, onSearch, options, empty, onPick}: {
    title: string;
    search: string;
    onSearch: (value: string) => void;
    options: PickOption[];
    empty: string;
    onPick: (key: string) => void;
}) {
    return (
        <Flex direction="column" gap="10px">
            <TsField label={title} placeholder="Search" fontSize="16px" autoComplete="off" value={search} onChange={(event) => onSearch(event.target.value)}/>
            <Flex as="ul" role="list" aria-label={title} direction="column" m="0" p="4px" maxH="240px" overflowY="auto" borderRadius="14px" borderWidth="1px" borderStyle="solid" borderColor={ts.border}>
                {options.map((option) => (
                    <chakra.li key={option.key} listStyleType="none">
                        <chakra.button
                            type="button"
                            disabled={option.disabled}
                            onClick={() => onPick(option.key)}
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            gap="10px"
                            w="100%"
                            minH="44px"
                            px="10px"
                            border="0"
                            borderRadius="10px"
                            bg="transparent"
                            color={ts.fg}
                            font="inherit"
                            textAlign="left"
                            cursor="pointer"
                            _hover={{bg: tsMix(ts.fg, 6)}}
                            _disabled={{opacity: 0.5, cursor: "not-allowed", _hover: {bg: "transparent"}}}
                        >
                            <Flex align="center" gap="10px" minW="0">
                                {option.logo && <chakra.img src={option.logo} alt="" w="20px" h="20px" borderRadius="50%" flexShrink={0}/>}
                                <chakra.span fontWeight={600} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{option.label}</chakra.span>
                            </Flex>
                            {option.note && <chakra.span color={ts.muted} fontSize="13px" flexShrink={0}>{option.note}</chakra.span>}
                        </chakra.button>
                    </chakra.li>
                ))}
                {options.length === 0 && <chakra.li listStyleType="none" color={ts.muted} fontSize="14px" p="10px">{empty}</chakra.li>}
            </Flex>
        </Flex>
    );
}

/** A picked network or asset, with "Change" to pick again. */
function Picked({label, name, logo, onChange}: { label: string; name: string; logo?: string; onChange: () => void }) {
    return (
        <Flex align="center" justify="space-between" gap="10px" borderRadius="14px" px="16px" py="10px" borderWidth="1px" borderStyle="solid" borderColor={ts.border}>
            <Flex direction="column" gap="2px" minW="0">
                <chakra.span color={ts.muted} fontSize="13px">{label}</chakra.span>
                <Flex align="center" gap="8px" minW="0">
                    {logo && <chakra.img src={logo} alt="" w="20px" h="20px" borderRadius="50%" flexShrink={0}/>}
                    <chakra.span fontWeight={700}>{name}</chakra.span>
                </Flex>
            </Flex>
            <TsButton variant="ghost" minH="36px" onClick={onChange} aria-label={`Change ${label.toLowerCase()}`}>Change</TsButton>
        </Flex>
    );
}

function Row({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Flex justify="space-between" gap="12px" fontSize="14px">
            <chakra.span color={ts.muted}>{label}</chakra.span>
            <chakra.span fontWeight={600} textAlign="right" fontVariantNumeric="tabular-nums">{children}</chakra.span>
        </Flex>
    );
}

function Loading({children}: { children: React.ReactNode }) {
    return <chakra.p m="0" color={ts.muted} fontSize="14px" role="status">{children}</chakra.p>;
}

function Problem({children}: { children: React.ReactNode }) {
    return <chakra.p m="0" color={ts.danger} fontSize="14px" role="alert">{children}</chakra.p>;
}

/** The Skip flow itself, once a BeeZee wallet is connected. */
function GetBzeForm({ticker, onDone}: { ticker: string; onDone: () => void }) {
    const buy = useBuyBze({onDone});
    const {selectedChain, selectedAsset} = buy;
    const balance = selectedAsset ? buy.assetBalances.get(selectedAsset.denom) : undefined;

    return (
        <Flex direction="column" gap="14px">
            {buy.chainsError && <Problem>{buy.chainsError}</Problem>}
            {buy.isLoadingChains && <Loading>Loading networks…</Loading>}
            {!selectedChain && !buy.isLoadingChains && buy.skipChains.length > 0 && (
                <PickList
                    title="Pay from network"
                    search={buy.chainSearch}
                    onSearch={buy.setChainSearch}
                    options={buy.filteredChains.map((chain) => ({
                        key: chain.chain_id,
                        label: chain.pretty_name || chain.chain_name || chain.chain_id,
                        logo: chain.logo_uri,
                        note: chain.canSign ? undefined : "Soon",
                        disabled: !chain.canSign,
                    }))}
                    empty="No network matches your search"
                    onPick={(id) => {
                        const chain = buy.filteredChains.find((candidate) => candidate.chain_id === id);
                        if (chain) void buy.onChainSelect(chain);
                    }}
                />
            )}
            {selectedChain && <Picked label="Network" name={buy.sourceDisplayName} logo={selectedChain.logo_uri} onChange={buy.clearChain}/>}

            {selectedChain && !selectedAsset && (
                <>
                    {buy.isLoadingAssets && <Loading>Loading assets on {buy.sourceDisplayName}…</Loading>}
                    {buy.assetsError && <Problem>{buy.assetsError}</Problem>}
                    {!buy.isLoadingAssets && buy.assetsWithBalances.length > 0 && (
                        <PickList
                            title="Asset to pay with"
                            search={buy.assetSearch}
                            onSearch={buy.setAssetSearch}
                            options={buy.filteredAssets.map((asset) => ({
                                key: asset.denom,
                                label: asset.symbol || asset.denom,
                                logo: asset.logo_uri,
                                note: asset.balanceDisplay ?? asset.name,
                            }))}
                            empty="No asset matches your search"
                            onPick={(denom) => {
                                const asset = buy.filteredAssets.find((candidate) => candidate.denom === denom);
                                if (asset) buy.onAssetSelect(asset);
                            }}
                        />
                    )}
                </>
            )}
            {selectedAsset && <Picked label="Asset" name={selectedAsset.symbol || selectedAsset.denom} logo={selectedAsset.logo_uri} onChange={buy.clearAsset}/>}

            {selectedChain && selectedAsset && (
                <Flex direction="column" gap="8px">
                    <TsField
                        label="You pay"
                        placeholder="0"
                        inputMode="decimal"
                        autoComplete="off"
                        value={buy.amount}
                        onChange={(event) => buy.onAmountChange(event.target.value)}
                        suffix={selectedAsset.symbol}
                        aria-invalid={buy.amountError !== "" || undefined}
                    />
                    {buy.allChainsConnected && buy.isLoadingBalances && <Loading>Fetching your balance…</Loading>}
                    {balance && selectedAsset.decimals && (
                        <Flex justify="space-between" align="center" gap="8px" fontSize="13px" color={ts.muted}>
                            <chakra.span>
                                Available on {buy.sourceDisplayName}: {prettyAmount(uAmountToBigNumberAmount(balance, selectedAsset.decimals))} {selectedAsset.symbol}
                            </chakra.span>
                            <chakra.button type="button" onClick={buy.setMaxAmount} bg="transparent" border="0" color={ts.fg} cursor="pointer" minH="32px" textDecoration="underline" font="inherit">
                                Max
                            </chakra.button>
                        </Flex>
                    )}
                    {buy.amountError && <Problem>{buy.amountError}</Problem>}
                </Flex>
            )}

            {buy.isLoadingRoute && buy.amount && <Loading>Finding the best route to {ticker}…</Loading>}
            {buy.routeError && buy.amount && !buy.isLoadingRoute && <Problem>{buy.routeError}</Problem>}
            {buy.routePreview && buy.amount && !buy.isLoadingRoute && (
                <Flex direction="column" gap="8px" borderRadius="14px" px="16px" py="14px" bg={tsMix(ts.fg, 4)} data-testid="get-bze-route">
                    <chakra.span color={ts.muted} fontSize="13px">You get about</chakra.span>
                    <chakra.span fontSize="22px" fontWeight={600} fontVariantNumeric="tabular-nums">
                        {shortNumberFormat(toBigNumber(buy.routePreview.estimatedOutput))} {ticker}
                    </chakra.span>
                    <Row label="Arrives in">{formatDuration(buy.routePreview.estimatedDurationSeconds)}</Row>
                    {buy.rawRoute && buy.rawRoute.txs_required > 1 && <Row label="Steps">{buy.rawRoute.txs_required} (approval + transfer)</Row>}
                    {buy.feeDisplay && <Row label="Fee">{buy.feeDisplay}</Row>}
                    <chakra.span color={ts.muted} fontSize="13px">
                        An estimate: if the price moves more than 3% on the way, the transfer is reverted and you get your coins back.
                    </chakra.span>
                    {buy.routePreview.warning && <TsNotice tone="danger">{buy.routePreview.warning}</TsNotice>}
                </Flex>
            )}

            {buy.needsConnect ? (
                <Flex direction="column" gap="10px">
                    {buy.isSourceEvm ? (
                        <>
                            <chakra.p m="0" color={ts.muted} fontSize="14px" lineHeight="1.55">
                                Connect your EVM wallet to pay from {buy.sourceDisplayName}.
                            </chakra.p>
                            {buy.evmState.isAvailable ? (
                                !buy.evmWallet.isConnected && (
                                    <Flex gap="10px">
                                        {buy.evmWallet.hasInjected && (
                                            <TsButton variant="primary" flex="1" disabled={buy.isConnecting} onClick={() => buy.connectEvm("injected")}>MetaMask</TsButton>
                                        )}
                                        <TsButton variant="ghost" flex="1" disabled={buy.isConnecting} onClick={() => buy.connectEvm("walletconnect")}>WalletConnect</TsButton>
                                    </Flex>
                                )
                            ) : (
                                <Problem>Paying from EVM networks isn&apos;t available here.</Problem>
                            )}
                        </>
                    ) : (
                        <>
                            <chakra.p m="0" color={ts.muted} fontSize="14px" lineHeight="1.55">
                                Your wallet needs access to <chakra.strong color={ts.fg}>{buy.requiredChainNames.join(", ")}</chakra.strong> to sign and route this transfer.
                            </chakra.p>
                            <TsButton variant="primary" minH="52px" disabled={buy.isConnecting} onClick={buy.handleConnectAll}>
                                {buy.isConnecting ? "Connecting…" : "Approve connections"}
                            </TsButton>
                        </>
                    )}
                </Flex>
            ) : (
                <TsButton variant="primary" minH="52px" fontSize="16px" disabled={!buy.canExecute} onClick={buy.handleExecute}>
                    {buy.isExecuting ? (buy.progressMessage || "Transferring…") : `Get ${ticker}`}
                </TsButton>
            )}
        </Flex>
    );
}

/**
 * Get BZE (Business Logic R12): buy BZE for network fees with a coin from another network,
 * routed by Skip. A view of the wallet drawer, opened from the low-liquidity notices; the drawer
 * hides every way in while Skip is off.
 */
export function GetBzePanel({onBack}: { onBack: () => void }) {
    const {denomTicker} = useAssets();
    const {connect} = useTokenWallet();
    const {status, address} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);
    const ticker = denomTicker(getChainNativeAssetDenom());

    // The button that opened the panel is gone: keep the keyboard inside the drawer.
    const panel = useRef<HTMLDivElement>(null);
    useEffect(() => panel.current?.querySelector<HTMLButtonElement>("button[aria-label='Back to wallet']")?.focus(), []);

    return (
        <Flex ref={panel} direction="column" gap="16px" data-testid="get-bze-panel">
            <Flex align="center" gap="10px">
                <TsButton variant="ghost" onClick={onBack} aria-label="Back to wallet" w="44px" px="0">
                    <LuArrowLeft aria-hidden="true"/>
                </TsButton>
                <chakra.h3 m="0" fontSize="18px" fontWeight={700}>Get {ticker}</chakra.h3>
            </Flex>
            <chakra.p m="0" color={ts.muted} lineHeight="1.55">
                Pay with a coin from another network and receive {ticker} for network fees, usually within minutes.
            </chakra.p>
            {connected ? (
                <GetBzeForm ticker={ticker} onDone={onBack}/>
            ) : (
                <Flex direction="column" gap="14px">
                    <chakra.p m="0" color={ts.muted} lineHeight="1.55">Connect a wallet to receive the {ticker}.</chakra.p>
                    <TsButton variant="primary" minH="52px" fontSize="16px" onClick={connect}>Connect wallet</TsButton>
                </Flex>
            )}
        </Flex>
    );
}
