'use client'

import {
    Box,
    Button,
    Field,
    HStack,
    Input,
    Text,
    VStack,
} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {LuCircleAlert, LuInfo} from 'react-icons/lu';
import {Tooltip} from '../tooltip';
import {TokenLogo} from '../token-logo';
import {useBuyBze} from '../../hooks/useBuyBze';
import {formatDuration} from '../../utils/cross_chain';
import {prettyAmount, uAmountToBigNumberAmount, toBigNumber} from '../../utils/amount';
import {shortNumberFormat} from '../../utils/formatter';
import type {UseSkipTxTrackerReturn} from '../../hooks/useSkipTxTracker';
import {LoadingRow, StatusPill} from '../hive-glow/status';
import {hgVariant} from '../../theme/variants';
import {DrawerChosenRow, DrawerInset, DrawerKV, DrawerMono, DrawerPickList, DrawerPickRow, DrawerRoute, DrawerViewHeader} from './drawer-kit';
import {MaxInputGroup} from '../max-input-group';

/** A route or lookup error: red text with its icon. */
const ErrorText = ({children}: { children: ReactNode }) => (
    <HStack role="alert" align="flex-start" gap="6px" fontSize="13px" lineHeight="1.4" color="hg.danger.text">
        <Box as="span" flex="none" mt="1px"><LuCircleAlert size="14"/></Box>
        <Text>{children}</Text>
    </HStack>
);

interface BuyFormProps {
    onClose?: () => void;
    addTransaction?: UseSkipTxTrackerReturn['addTransaction'];
}

export const BuyForm = ({onClose, addTransaction}: BuyFormProps) => {
    const {
        skipChains, isLoadingChains, chainsError, filteredChains, chainSearch, setChainSearch,
        selectedChain, onChainSelect, clearChain, sourceDisplayName,
        assetsWithBalances, isLoadingAssets, assetsError, filteredAssets, assetSearch, setAssetSearch,
        selectedAsset, onAssetSelect, clearAsset,
        amount, amountError, onAmountChange, setMaxAmount, assetBalances, isLoadingBalances,
        routePreview, rawRoute, isLoadingRoute, routeError, feeDisplay,
        isSourceEvm, needsConnect, requiredChainNames, allChainsConnected,
        isConnecting, handleConnectAll, connectEvm, evmState, evmWallet,
        canExecute, handleExecute, isExecuting, progressMessage,
    } = useBuyBze({onDone: onClose, addTransaction});

    return (
        <VStack gap="14px" align="stretch">
            <DrawerViewHeader title="Buy BZE" onClose={onClose}/>

            <Text fontSize="14px" color="fg.muted">Swap assets from other networks to BZE</Text>

            <DrawerInset px="12px" py="10px">
                <Text fontSize="13px" lineHeight="1.5" color="fg.muted">
                    Get your BZE! Pick any coin from any supported network and we&apos;ll find the
                    best route to get you BZE in minutes — sometimes even seconds. Not every route
                    is available yet, but feel free to explore and try different options.
                </Text>
            </DrawerInset>

            {/* ── Chain picker ──────────────────────────────────────────────── */}
            {chainsError && <ErrorText>{chainsError}</ErrorText>}

            {!selectedChain && !isLoadingChains && skipChains.length > 0 && (
                <VStack gap="6px" align="stretch">
                    <Text fontSize="13px" fontWeight="600" color="hg.text.secondary">Pay with assets from</Text>
                    <Input size="sm" placeholder="Search network..." aria-label="Search network" value={chainSearch}
                           onChange={(e) => setChainSearch(e.target.value)}/>
                    <DrawerPickList>
                        {filteredChains.map(c => (
                            <DrawerPickRow key={c.chain_id} onClick={() => onChainSelect(c)} disabled={!c.canSign}
                                           right={!c.canSign && <StatusPill tone="neutral">Soon</StatusPill>}>
                                <TokenLogo src={c.logo_uri || ''} symbol={c.pretty_name || c.chain_name || '?'} size="18px"/>
                                {c.pretty_name || c.chain_name}
                            </DrawerPickRow>
                        ))}
                        {filteredChains.length === 0 && (
                            <Text fontSize="13px" color="hg.text.faint" p="12px">No chains match your search</Text>
                        )}
                    </DrawerPickList>
                </VStack>
            )}

            {isLoadingChains && <LoadingRow>Loading available networks...</LoadingRow>}

            {/* Selected chain */}
            {selectedChain && (
                <DrawerChosenRow label="Network" onChange={clearChain}>
                    <TokenLogo src={selectedChain.logo_uri || ''} symbol={sourceDisplayName} size="18px"/>
                    {sourceDisplayName}
                </DrawerChosenRow>
            )}

            {/* ── Asset picker ──────────────────────────────────────────────── */}
            {selectedChain && !selectedAsset && (
                <Box>
                    {isLoadingAssets && <LoadingRow>Loading assets on {sourceDisplayName}...</LoadingRow>}
                    {assetsError && <ErrorText>{assetsError}</ErrorText>}
                    {!isLoadingAssets && assetsWithBalances.length > 0 && (
                        <VStack gap="6px" align="stretch">
                            <Text fontSize="13px" fontWeight="600" color="hg.text.secondary">Asset to swap</Text>
                            <Input size="sm" placeholder="Search asset..." aria-label="Search asset" value={assetSearch}
                                   onChange={(e) => setAssetSearch(e.target.value)}/>
                            <DrawerPickList>
                                {filteredAssets.map(a => (
                                    <DrawerPickRow key={a.denom} onClick={() => onAssetSelect(a)}
                                                   right={a.balanceDisplay
                                                       ? <DrawerMono size={12} color="hg.text.faint">{a.balanceDisplay}</DrawerMono>
                                                       : <Text fontSize="12px" color="hg.text.faint">{a.name}</Text>}>
                                        <TokenLogo src={a.logo_uri || ''} symbol={a.symbol || '?'} size="18px"/>
                                        {a.symbol}
                                    </DrawerPickRow>
                                ))}
                                {filteredAssets.length === 0 && (
                                    <Text fontSize="13px" color="hg.text.faint" p="12px">No assets match your search</Text>
                                )}
                            </DrawerPickList>
                        </VStack>
                    )}
                </Box>
            )}

            {/* Selected asset */}
            {selectedAsset && (
                <DrawerChosenRow label="Asset" onChange={clearAsset}>
                    <TokenLogo src={selectedAsset.logo_uri || ''} symbol={selectedAsset.symbol || '?'} size="18px"/>
                    {selectedAsset.symbol}
                </DrawerChosenRow>
            )}

            {/* ── Amount input ───────────────────────────────────────────────── */}
            {selectedChain && selectedAsset && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>You pay</Field.Label>
                        <MaxInputGroup w="full" onMax={setMaxAmount} maxDisabled={!assetBalances.get(selectedAsset.denom)}>
                            <Input size="sm" fontFamily="mono" placeholder="0.00" value={amount}
                                   onChange={(e) => onAmountChange(e.target.value)}/>
                        </MaxInputGroup>
                        <Field.ErrorText>{amountError}</Field.ErrorText>
                    </Field.Root>

                    {allChainsConnected && isLoadingBalances && (
                        <Text fontSize="12px" color="hg.text.faint" mt="6px">Fetching your balance...</Text>
                    )}
                    {allChainsConnected && !isLoadingBalances && assetBalances.get(selectedAsset.denom) && selectedAsset.decimals && (
                        <HStack justify="space-between" mt="6px" fontSize="12px">
                            <Text color="hg.text.faint">Available on {sourceDisplayName}</Text>
                            <DrawerMono size={12}>
                                {prettyAmount(uAmountToBigNumberAmount(assetBalances.get(selectedAsset.denom)!, selectedAsset.decimals))} {selectedAsset.symbol}
                            </DrawerMono>
                        </HStack>
                    )}
                </Box>
            )}

            {/* ── Route preview ──────────────────────────────────────────────── */}
            {routePreview && amount && !isLoadingRoute && (
                <DrawerRoute>
                    <DrawerKV size={14} label={
                        <HStack as="span" gap="4px">
                            Estimated output
                            <Tooltip
                                showArrow
                                openDelay={100}
                                content="This is an estimate based on current prices. The final amount may vary slightly due to price changes during the transfer. A 3% slippage protection is applied — if the price moves beyond that, the transaction will be reverted and your funds returned."
                                contentProps={{maxW: '250px', fontSize: 'xs'}}
                            >
                                <Box as="span" cursor="help" display="inline-flex" alignItems="center">
                                    <LuInfo size="12"/>
                                </Box>
                            </Tooltip>
                        </HStack>
                    }>
                        <DrawerMono size={14}><b>~{shortNumberFormat(toBigNumber(routePreview.estimatedOutput))} BZE</b></DrawerMono>
                    </DrawerKV>
                    <DrawerKV label="Estimated time" size={12}>{formatDuration(routePreview.estimatedDurationSeconds)}</DrawerKV>
                    {rawRoute && rawRoute.txs_required > 1 && (
                        <DrawerKV label="Steps" size={12}>{rawRoute.txs_required} (approval + bridge)</DrawerKV>
                    )}
                    {feeDisplay && <DrawerKV label="Fee" size={12}>{feeDisplay}</DrawerKV>}
                    {routePreview.warning && (
                        <Text fontSize="12px" color="hg.warning.text">{routePreview.warning}</Text>
                    )}
                </DrawerRoute>
            )}

            {isLoadingRoute && amount && <LoadingRow>Finding the best route to BZE...</LoadingRow>}

            {routeError && amount && !isLoadingRoute && (
                <ErrorText>{routeError}</ErrorText>
            )}

            {/* ── Connect wallets ────────────────────────────────────────────── */}
            {needsConnect && (
                <DrawerInset gap="12px">
                    {isSourceEvm ? (
                        <>
                            <Text fontSize="14px" lineHeight="1.5" color="fg.muted">
                                Connect your EVM wallet to complete this swap on {sourceDisplayName}.
                            </Text>
                            {evmState.isAvailable && !evmWallet.isConnected && (
                                <HStack gap="2" w="full">
                                    {evmWallet.hasInjected && (
                                        <Button flex="1" size="md" variant={hgVariant('primary')}
                                                onClick={() => connectEvm('injected')}
                                                loading={isConnecting}>
                                            MetaMask
                                        </Button>
                                    )}
                                    <Button flex="1" size="md" variant={hgVariant('secondary')}
                                            onClick={() => connectEvm('walletconnect')}
                                            loading={isConnecting}>
                                        WalletConnect
                                    </Button>
                                </HStack>
                            )}
                            {!evmState.isAvailable && (
                                <Text fontSize="12px" color="hg.warning.text">
                                    EVM wallet support is not configured in this app.
                                </Text>
                            )}
                        </>
                    ) : (
                        <>
                            <Text fontSize="14px" lineHeight="1.5" color="fg.muted">
                                To complete this swap, your wallet needs access to{' '}
                                <Text as="span" fontWeight="600" color="fg">{requiredChainNames.join(', ')}</Text>.
                                This lets us sign and route the transaction on your behalf.
                            </Text>
                            <Button size="lg" w="full" variant={hgVariant('primary')}
                                    onClick={handleConnectAll} loading={isConnecting} loadingText="Connecting...">
                                Approve connections
                            </Button>
                        </>
                    )}
                </DrawerInset>
            )}

            {/* ── Buy BZE button ─────────────────────────────────────────────── */}
            {!needsConnect && (
                <Button size="lg" w="full" variant={hgVariant('primary')}
                        disabled={!canExecute} loading={isExecuting}
                        loadingText={progressMessage || "Swapping..."}
                        onClick={handleExecute}>
                    Buy BZE
                </Button>
            )}
        </VStack>
    );
};
