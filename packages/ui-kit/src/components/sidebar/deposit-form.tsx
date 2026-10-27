'use client'

import {useCallback, useMemo, useState} from 'react';
import {
    Box,
    Button,
    createListCollection,
    Field,
    HStack,
    Input,
    Portal,
    Select,
    Text,
    VStack,
} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import {TokenLogo} from '../token-logo';
import {hgVariant} from '../../theme/variants';
import {DrawerChosenRow, DrawerKV, DrawerMono, DrawerRoute} from './drawer-kit';
import {useBridgeableAssets, type BridgeableAsset} from '../../hooks/useBridgeableAssets';
import {useBridgeTransfer} from '../../hooks/useBridgeTransfer';
import {useCounterpartyBalance} from '../../hooks/useCounterpartyBalance';
import {sanitizeNumberInput} from '../../utils/number';
import {formatDuration} from '../../utils/cross_chain';
import {prettyAmount, uAmountToBigNumberAmount} from '../../utils/amount';
import {getChainName} from '../../constants/chain';
import {LEGACY_ASSET_NOTICES} from '../../constants/assets';
import {LegacyAssetNoticeBox} from '../legacy-asset-notice';
import {MaxInputGroup} from '../max-input-group';

/**
 * Deposit flow: move an asset from a foreign chain onto BeeZee.
 *
 * Asset-first picker mirroring the withdraw form. The list holds every BZE IBC
 * voucher with a complete trace (1-hop native assets from direct
 * counterparties) plus BZE's own coins (BZE + factory tokens) coming back.
 * A voucher has exactly one source chain, shown read-only after selection;
 * a BZE coin can come back from any chain BZE has a channel with, so it gets
 * a source picker (Osmosis preselected).
 */
export const DepositForm = () => {
    const [selectedAsset, setSelectedAsset] = useState<BridgeableAsset | undefined>();
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');

    const {assets: bridgeableAssets, blockedAssets, isLoading: isLoadingAssets} = useBridgeableAssets();

    // Assets the chain stopped accepting (e.g. USDC.n) vanish from the picker; when one
    // has a wind-down notice, show it so users looking for it learn why it's gone.
    const blockedNotices = useMemo(() => {
        return blockedAssets
            .filter(a => LEGACY_ASSET_NOTICES[a.denom] !== undefined)
            .map(a => ({denom: a.denom, notice: LEGACY_ASSET_NOTICES[a.denom]}));
    }, [blockedAssets]);

    // Routes grouped by BZE denom, in the hook's order: one per voucher, one per
    // counterparty for a BZE coin (Osmosis first).
    const routesByDenom = useMemo(() => {
        const map = new Map<string, BridgeableAsset[]>();
        for (const a of bridgeableAssets) {
            const routes = map.get(a.bzeAsset.denom);
            if (routes) routes.push(a);
            else map.set(a.bzeAsset.denom, [a]);
        }
        return map;
    }, [bridgeableAssets]);

    // ─── Asset picker collection (one row per asset) ───────────────────────
    const assetsCollection = useMemo(() => {
        return createListCollection({
            items: Array.from(routesByDenom.values()).map(routes => {
                const a = routes[0];
                return {
                    label: a.bzeAsset.ticker,
                    value: a.bzeAsset.denom,
                    logo: a.bzeAsset.logo,
                    displayName: a.bzeAsset.name,
                    chainDisplayName: routes.length === 1 ? a.counterparty.displayName : `${routes.length} networks`,
                };
            }),
        });
    }, [routesByDenom]);

    // ─── Source picker collection (BZE coins only) ─────────────────────────
    const selectedRoutes = useMemo(
        () => (selectedAsset ? routesByDenom.get(selectedAsset.bzeAsset.denom) ?? [] : []),
        [selectedAsset, routesByDenom],
    );
    const sourcesCollection = useMemo(() => {
        return createListCollection({
            items: selectedRoutes.map(r => ({
                label: r.counterparty.displayName,
                value: r.counterparty.chainName,
                logo: r.counterparty.logo,
            })),
        });
    }, [selectedRoutes]);

    // ─── Counterparty wallet ───────────────────────────────────────────────
    const sourceChainName = selectedAsset?.counterparty.chainName ?? getChainName();
    const {
        status: sourceWalletStatus,
        connect: openWalletPicker,
        wallet: sourceWallet,
        address: sourceAddress,
    } = useChain(sourceChainName);

    // ─── Live balance on source chain (via REST) ───────────────────────────
    const {
        amount: depositRawBalance,
        status: depositBalanceStatus,
        refetch: refetchDepositBalance,
    } = useCounterpartyBalance(
        selectedAsset?.counterparty.chainName,
        sourceAddress,
        selectedAsset?.sourceDenom,
    );

    const sourceBalance = useMemo(() => {
        if (!selectedAsset) return undefined;
        return {
            display: uAmountToBigNumberAmount(depositRawBalance, selectedAsset.bzeAsset.decimals),
            decimals: selectedAsset.bzeAsset.decimals,
            status: depositBalanceStatus,
        };
    }, [selectedAsset, depositRawBalance, depositBalanceStatus]);

    const handleConnectSource = useCallback(async () => {
        const ws: any = sourceWallet;
        if (ws && typeof ws.connect === 'function') {
            try {
                await ws.connect();
                return;
            } catch (e) {
                console.error('[bridge] source connect failed:', e);
            }
        }
        openWalletPicker();
    }, [sourceWallet, openWalletPicker]);

    // ─── Route preview (IBC-only: output = input, ~30s, no fee) ────────────
    const routePreview = useMemo(() => {
        if (!selectedAsset || !amount || parseFloat(amount) <= 0) return undefined;
        return {
            estimatedOutput: amount,
            estimatedOutputTicker: selectedAsset.bzeAsset.ticker,
            estimatedDurationSeconds: 30,
            fees: [] as { amount: string; ticker: string; usdValue?: string }[],
            txsRequired: 1,
            mechanism: 'ibc' as const,
            warning: undefined,
            rawRoute: undefined,
        };
    }, [selectedAsset, amount]);

    // ─── Transfer ──────────────────────────────────────────────────────────
    const {executeTransfer, isExecuting, progressMessage} = useBridgeTransfer({
        direction: 'deposit',
        asset: selectedAsset,
        amount,
        routePreview,
    });

    // Balance gate
    const balanceAllowsTransfer = useMemo(() => {
        if (!sourceBalance) return false;
        if (sourceBalance.status === 'unsupported') return true;
        if (sourceBalance.status !== 'ready') return false;
        return sourceBalance.display.isGreaterThan(0);
    }, [sourceBalance]);

    const canExecute = useMemo(() => {
        return selectedAsset
            && amount !== ''
            && amountError === ''
            && routePreview !== undefined
            && !isExecuting
            && sourceWalletStatus === WalletState.Connected
            && balanceAllowsTransfer;
    }, [selectedAsset, amount, amountError, routePreview, isExecuting, sourceWalletStatus, balanceAllowsTransfer]);

    const handleExecute = useCallback(async () => {
        const success = await executeTransfer();
        if (success) {
            setAmount('');
            setSelectedAsset(undefined);
            setTimeout(() => refetchDepositBalance(), 4000);
            setTimeout(() => refetchDepositBalance(), 10000);
        }
    }, [executeTransfer, refetchDepositBalance]);

    // ─── Callbacks ─────────────────────────────────────────────────────────
    const onAssetChange = useCallback((denom: string) => {
        if (!denom) return;
        setSelectedAsset(routesByDenom.get(denom)?.[0]);
        setAmount('');
        setAmountError('');
    }, [routesByDenom]);

    const onSourceChange = useCallback((chainName: string) => {
        if (!chainName) return;
        const route = selectedRoutes.find(r => r.counterparty.chainName === chainName);
        if (!route) return;
        setSelectedAsset(route);
        setAmount('');
        setAmountError('');
    }, [selectedRoutes]);

    const onAmountChange = useCallback((value: string) => {
        setAmount(sanitizeNumberInput(value));
        setAmountError('');
    }, []);

    // MAX fills the full balance on the source chain on purpose: the deposit is signed on
    // that chain and its gas is paid in that chain's own coin by the wallet (letWalletSetFee),
    // so BeeZee's gas engine (useMaxSpendable) has nothing to reserve here.
    const setMaxAmount = useCallback(() => {
        if (!sourceBalance || sourceBalance.status !== 'ready') return;
        setAmount(sourceBalance.display.toString());
        setAmountError('');
    }, [sourceBalance]);

    const validateAmount = useCallback(() => {
        if (!amount || !sourceBalance || sourceBalance.status !== 'ready') return;
        if (sourceBalance.display.isLessThan(amount)) {
            setAmountError('Insufficient balance');
        }
    }, [amount, sourceBalance]);

    const sourceDisplayName = selectedAsset?.counterparty.displayName ?? '';

    const feeDisplay = useMemo(() => {
        if (!routePreview || routePreview.fees.length === 0) return undefined;
        return routePreview.fees
            .map(f => (f.usdValue ? `$${prettyAmount(f.usdValue)}` : `${f.amount} ${f.ticker}`))
            .join(' + ');
    }, [routePreview]);

    return (
        <VStack gap="14px" align="stretch">
            <Text fontSize="14px" color="fg.muted">
                Deposit assets from other networks to BeeZee
            </Text>

            {/* Empty state */}
            {!isLoadingAssets && bridgeableAssets.length === 0 && (
                <Box px="12px" py="10px" bg="hg.inset" borderRadius="14px">
                    <Text fontSize="14px" color="fg.muted">
                        No depositable assets found. IBC assets will appear here once BeeZee
                        has active connections in the chain registry.
                    </Text>
                </Box>
            )}

            {/* Asset picker — flat list of all depositable assets */}
            {bridgeableAssets.length > 0 && (
                <Box>
                    <Select.Root
                        collection={assetsCollection}
                        size="sm"
                        value={selectedAsset ? [selectedAsset.bzeAsset.denom] : []}
                        onValueChange={(details) => onAssetChange(details.value[0] || '')}
                    >
                        <Select.Label>Asset</Select.Label>
                        <Select.HiddenSelect/>
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder="Select asset to deposit"/>
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator/>
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {assetsCollection.items.map((item) => (
                                        <Select.Item key={item.value} item={item}>
                                            <HStack gap="2" w="full" justify="space-between">
                                                <HStack gap="2">
                                                    <TokenLogo src={item.logo} symbol={item.label} size="16px"/>
                                                    <Text>{item.label}</Text>
                                                </HStack>
                                                <Text fontSize="xs" color="fg.muted">
                                                    {(item as any).chainDisplayName}
                                                </Text>
                                            </HStack>
                                            <Select.ItemIndicator/>
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                </Box>
            )}

            {/* Wind-down notices for assets whose deposits the chain refuses */}
            {!selectedAsset && blockedNotices.map(({denom, notice}) => (
                <LegacyAssetNoticeBox key={denom} notice={notice}/>
            ))}

            {/* Source chain — read-only for a voucher, picker for a BZE coin */}
            {selectedAsset && selectedRoutes.length <= 1 && (
                <DrawerChosenRow label="Source">
                    <TokenLogo src={selectedAsset.counterparty.logo} symbol={sourceDisplayName} size="18px"/>
                    {sourceDisplayName}
                </DrawerChosenRow>
            )}

            {selectedAsset && selectedRoutes.length > 1 && (
                <Box>
                    <Select.Root
                        collection={sourcesCollection}
                        size="sm"
                        value={[selectedAsset.counterparty.chainName]}
                        onValueChange={(details) => onSourceChange(details.value[0] || '')}
                    >
                        <Select.Label>Source</Select.Label>
                        <Select.HiddenSelect/>
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder="Select source network"/>
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator/>
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {sourcesCollection.items.map((item) => (
                                        <Select.Item key={item.value} item={item}>
                                            <HStack gap="2">
                                                <TokenLogo src={item.logo} symbol={item.label} size="16px"/>
                                                <Text>{item.label}</Text>
                                            </HStack>
                                            <Select.ItemIndicator/>
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                </Box>
            )}

            {/* Transfer direction label */}
            {selectedAsset && (
                <Text fontSize="13px" color="hg.text.faint">
                    From {sourceDisplayName} → BeeZee
                </Text>
            )}

            {/* Amount input */}
            {selectedAsset && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>Amount to deposit</Field.Label>
                        <MaxInputGroup w="full" onMax={setMaxAmount} maxDisabled={!sourceBalance || sourceBalance.status !== 'ready'}>
                            <Input
                                size="sm"
                                fontFamily="mono"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => onAmountChange(e.target.value)}
                                onBlur={validateAmount}
                            />
                        </MaxInputGroup>
                        <Field.ErrorText>{amountError}</Field.ErrorText>
                    </Field.Root>

                    {/* Balance on source chain */}
                    {sourceBalance && (
                        <HStack justify="space-between" mt="6px" fontSize="12px">
                            <Text color="hg.text.faint">
                                Available on {sourceDisplayName}
                            </Text>
                            {sourceBalance.status === 'loading' && (
                                <Text fontSize="xs" color="fg.muted">Loading…</Text>
                            )}
                            {sourceBalance.status === 'ready' && (
                                <Text fontSize="xs" fontFamily="mono">
                                    {prettyAmount(sourceBalance.display)} {selectedAsset.bzeAsset.ticker}
                                </Text>
                            )}
                            {sourceBalance.status === 'error' && (
                                <Text fontSize="xs" color="hg.warning.text">Couldn&apos;t fetch</Text>
                            )}
                            {sourceBalance.status === 'unsupported' && (
                                <Text fontSize="xs" color="fg.muted">Unavailable</Text>
                            )}
                        </HStack>
                    )}

                    {sourceBalance?.status === 'ready' && sourceBalance.display.isZero() && (
                        <Text fontSize="xs" color="hg.warning.text" mt="1">
                            You have no {selectedAsset.bzeAsset.ticker} on {sourceDisplayName}.
                        </Text>
                    )}

                    {sourceBalance?.status === 'unsupported' && (
                        <Text fontSize="xs" color="fg.muted" mt="1">
                            We couldn&apos;t connect to {sourceDisplayName} to check your balance.
                            The transfer might still work — double-check in your wallet before signing.
                        </Text>
                    )}
                </Box>
            )}

            {/* Route preview */}
            {routePreview && amount && (
                <DrawerRoute>
                    <DrawerKV label="You receive on BeeZee" size={14}><DrawerMono size={14}><b>{routePreview.estimatedOutput} {routePreview.estimatedOutputTicker}</b></DrawerMono></DrawerKV>
                    <DrawerKV label="Estimated time" size={12}>{formatDuration(routePreview.estimatedDurationSeconds)}</DrawerKV>
                    {feeDisplay && (
                        <DrawerKV label="Fee" size={12}>{feeDisplay}</DrawerKV>
                    )}
                </DrawerRoute>
            )}

            {/* Wallet connect prompt */}
            {selectedAsset && sourceWalletStatus !== WalletState.Connected && (
                <VStack gap="10px" align="stretch">
                    <Text fontSize="14px" color="fg.muted" textAlign="center">
                        Connect your wallet on {sourceDisplayName} to continue
                    </Text>
                    <Button size="lg" w="full" variant={hgVariant('primary')} onClick={handleConnectSource}>
                        Connect to {sourceDisplayName}
                    </Button>
                </VStack>
            )}

            {/* Execute */}
            <Button
                size="lg"
                w="full"
                variant={hgVariant('primary')}
                disabled={!canExecute}
                loading={isExecuting}
                loadingText={progressMessage || "Transferring..."}
                onClick={handleExecute}
            >
                Transfer
            </Button>
        </VStack>
    );
};
