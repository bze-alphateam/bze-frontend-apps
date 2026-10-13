'use client'

import {
    Badge,
    Box,
    Button,
    Field,
    Group,
    HStack,
    Input,
    Text,
    VStack,
} from '@chakra-ui/react';
import {LuX, LuInfo} from 'react-icons/lu';
import {Tooltip} from '../tooltip';
import {TokenLogo} from '../token-logo';
import {useBuyBze} from '../../hooks/useBuyBze';
import {formatDuration} from '../../utils/cross_chain';
import {prettyAmount, uAmountToBigNumberAmount, toBigNumber} from '../../utils/amount';
import {shortNumberFormat} from '../../utils/formatter';
import type {UseSkipTxTrackerReturn} from '../../hooks/useSkipTxTracker';

interface BuyFormProps {
    accentColor: string;
    onClose?: () => void;
    addTransaction?: UseSkipTxTrackerReturn['addTransaction'];
}

export const BuyForm = ({accentColor, onClose, addTransaction}: BuyFormProps) => {
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
        <VStack gap="4" align="stretch">
            {/* Header */}
            <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="medium">Buy BZE</Text>
                {onClose && (
                    <Button size="xs" variant="ghost" onClick={onClose}><LuX size="14"/></Button>
                )}
            </HStack>

            <Text fontSize="sm" color="fg.muted">Swap assets from other networks to BZE</Text>

            <Box p="2" bg={`${accentColor}.500/10`} borderRadius="md" borderWidth="1px" borderColor={`${accentColor}.500/20`}>
                <Text fontSize="xs" color="fg.muted">
                    Get your BZE! Pick any coin from any supported network and we&apos;ll find the
                    best route to get you BZE in minutes — sometimes even seconds. Not every route
                    is available yet, but feel free to explore and try different options.
                </Text>
            </Box>

            {/* ── Chain picker ──────────────────────────────────────────────── */}
            {chainsError && <Text fontSize="sm" color="red.500">{chainsError}</Text>}

            {!selectedChain && !isLoadingChains && skipChains.length > 0 && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Pay with assets from</Text>
                    <Input size="sm" placeholder="Search network..." value={chainSearch}
                           onChange={(e) => setChainSearch(e.target.value)} mb="2"/>
                    <Box maxH="200px" overflowY="auto" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md">
                        {filteredChains.map(c => (
                            <HStack key={c.chain_id} gap="2" px="3" py="1.5"
                                    cursor={c.canSign ? "pointer" : "not-allowed"}
                                    opacity={c.canSign ? 1 : 0.5}
                                    _hover={c.canSign ? {bg: `${accentColor}.500/10`} : {}}
                                    onClick={() => onChainSelect(c)} justify="space-between">
                                <HStack gap="2">
                                    <TokenLogo src={c.logo_uri || ''} symbol={c.pretty_name || c.chain_name || '?'} size="16px"/>
                                    <Text fontSize="sm">{c.pretty_name || c.chain_name}</Text>
                                </HStack>
                                {!c.canSign && <Badge size="xs" variant="subtle" colorPalette="gray">Soon</Badge>}
                            </HStack>
                        ))}
                        {filteredChains.length === 0 && (
                            <Text fontSize="xs" color="fg.muted" p="3">No chains match your search</Text>
                        )}
                    </Box>
                </Box>
            )}

            {isLoadingChains && (
                <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                    <Text fontSize="xs" color="fg.muted">Loading available networks...</Text>
                    <Box h="3" w="70%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                    <Box h="3" w="50%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                </VStack>
            )}

            {/* Selected chain */}
            {selectedChain && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Network</Text>
                    <HStack gap="2" p="2" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md" justify="space-between">
                        <HStack gap="2">
                            <TokenLogo src={selectedChain.logo_uri || ''} symbol={sourceDisplayName} size="16px"/>
                            <Text fontSize="sm">{sourceDisplayName}</Text>
                        </HStack>
                        <Button size="xs" variant="ghost" onClick={clearChain}>Change</Button>
                    </HStack>
                </Box>
            )}

            {/* ── Asset picker ──────────────────────────────────────────────── */}
            {selectedChain && !selectedAsset && (
                <Box>
                    {isLoadingAssets && (
                        <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                            <Text fontSize="xs" color="fg.muted">Loading assets on {sourceDisplayName}...</Text>
                            <Box h="3" w="60%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                            <Box h="3" w="45%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                        </VStack>
                    )}
                    {assetsError && <Text fontSize="sm" color="red.500">{assetsError}</Text>}
                    {!isLoadingAssets && assetsWithBalances.length > 0 && (
                        <>
                            <Text fontSize="xs" fontWeight="medium" mb="1">Asset to swap</Text>
                            <Input size="sm" placeholder="Search asset..." value={assetSearch}
                                   onChange={(e) => setAssetSearch(e.target.value)} mb="2"/>
                            <Box maxH="200px" overflowY="auto" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md">
                                {filteredAssets.map(a => (
                                    <HStack key={a.denom} gap="2" px="3" py="1.5" cursor="pointer"
                                            _hover={{bg: `${accentColor}.500/10`}}
                                            onClick={() => onAssetSelect(a)} justify="space-between">
                                        <HStack gap="2">
                                            <TokenLogo src={a.logo_uri || ''} symbol={a.symbol || '?'} size="16px"/>
                                            <Text fontSize="sm">{a.symbol}</Text>
                                        </HStack>
                                        {a.balanceDisplay ? (
                                            <Text fontSize="xs" fontFamily="mono" color="fg.muted">{a.balanceDisplay}</Text>
                                        ) : (
                                            <Text fontSize="xs" color="fg.muted">{a.name}</Text>
                                        )}
                                    </HStack>
                                ))}
                                {filteredAssets.length === 0 && (
                                    <Text fontSize="xs" color="fg.muted" p="3">No assets match your search</Text>
                                )}
                            </Box>
                        </>
                    )}
                </Box>
            )}

            {/* Selected asset */}
            {selectedAsset && (
                <Box>
                    <Text fontSize="xs" fontWeight="medium" mb="1">Asset</Text>
                    <HStack gap="2" p="2" borderWidth="1px" borderColor={`${accentColor}.500/20`} borderRadius="md" justify="space-between">
                        <HStack gap="2">
                            <TokenLogo src={selectedAsset.logo_uri || ''} symbol={selectedAsset.symbol || '?'} size="16px"/>
                            <Text fontSize="sm">{selectedAsset.symbol}</Text>
                        </HStack>
                        <Button size="xs" variant="ghost" onClick={clearAsset}>Change</Button>
                    </HStack>
                </Box>
            )}

            {/* ── Amount input ───────────────────────────────────────────────── */}
            {selectedChain && selectedAsset && (
                <Box>
                    <Field.Root invalid={amountError !== ''}>
                        <Field.Label>You pay</Field.Label>
                        <Group attached w="full">
                            <Input size="sm" placeholder="0.00" value={amount}
                                   onChange={(e) => onAmountChange(e.target.value)}/>
                            {assetBalances.get(selectedAsset.denom) && (
                                <Button variant="outline" size="sm" onClick={setMaxAmount}>Max</Button>
                            )}
                        </Group>
                        <Field.ErrorText>{amountError}</Field.ErrorText>
                    </Field.Root>

                    {allChainsConnected && isLoadingBalances && (
                        <Text fontSize="xs" color="fg.muted" mt="1.5">Fetching your balance...</Text>
                    )}
                    {allChainsConnected && !isLoadingBalances && assetBalances.get(selectedAsset.denom) && selectedAsset.decimals && (
                        <HStack justify="space-between" mt="1.5">
                            <Text fontSize="xs" color="fg.muted">Available on {sourceDisplayName}</Text>
                            <Text fontSize="xs" fontFamily="mono">
                                {prettyAmount(uAmountToBigNumberAmount(assetBalances.get(selectedAsset.denom)!, selectedAsset.decimals))} {selectedAsset.symbol}
                            </Text>
                        </HStack>
                    )}
                </Box>
            )}

            {/* ── Route preview ──────────────────────────────────────────────── */}
            {routePreview && amount && !isLoadingRoute && (
                <Box p="3" bgGradient="to-br" gradientFrom={`${accentColor}.500/8`} gradientTo={`${accentColor}.600/8`}
                     borderRadius="md" borderWidth="1px" borderColor={`${accentColor}.500/20`}>
                    <VStack gap="2" align="stretch">
                        <HStack justify="space-between">
                            <HStack gap="1">
                                <Text fontSize="sm" color="fg.muted">Estimated output</Text>
                                <Tooltip
                                    showArrow
                                    openDelay={100}
                                    content="This is an estimate based on current prices. The final amount may vary slightly due to price changes during the transfer. A 3% slippage protection is applied — if the price moves beyond that, the transaction will be reverted and your funds returned."
                                    contentProps={{maxW: '250px', fontSize: 'xs'}}
                                >
                                    <Box as="span" cursor="help" color="fg.muted" display="inline-flex" alignItems="center">
                                        <LuInfo size="12"/>
                                    </Box>
                                </Tooltip>
                            </HStack>
                            <Text fontSize="sm" fontWeight="medium" fontFamily="mono">~{shortNumberFormat(toBigNumber(routePreview.estimatedOutput))} BZE</Text>
                        </HStack>
                        <HStack justify="space-between">
                            <Text fontSize="xs" color="fg.muted">Estimated time</Text>
                            <Text fontSize="xs">{formatDuration(routePreview.estimatedDurationSeconds)}</Text>
                        </HStack>
                        {rawRoute && rawRoute.txs_required > 1 && (
                            <HStack justify="space-between">
                                <Text fontSize="xs" color="fg.muted">Steps</Text>
                                <Text fontSize="xs">{rawRoute.txs_required} (approval + bridge)</Text>
                            </HStack>
                        )}
                        {feeDisplay && (
                            <HStack justify="space-between">
                                <Text fontSize="xs" color="fg.muted">Fee</Text>
                                <Text fontSize="xs">{feeDisplay}</Text>
                            </HStack>
                        )}
                        {routePreview.warning && (
                            <Text fontSize="xs" color="orange.500">{routePreview.warning}</Text>
                        )}
                    </VStack>
                </Box>
            )}

            {isLoadingRoute && amount && (
                <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                    <Text fontSize="xs" color="fg.muted">Finding the best route to BZE...</Text>
                    <Box h="3" w="65%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                    <Box h="3" w="45%" bg={`${accentColor}.500/10`} borderRadius="sm" animation="pulse"/>
                </VStack>
            )}

            {routeError && amount && !isLoadingRoute && (
                <Text fontSize="sm" color="red.500">{routeError}</Text>
            )}

            {/* ── Connect wallets ────────────────────────────────────────────── */}
            {needsConnect && (
                <VStack gap="2" p="3" bg={`${accentColor}.500/5`} borderRadius="md">
                    {isSourceEvm ? (
                        <>
                            <Text fontSize="sm" color="fg.muted">
                                Connect your EVM wallet to complete this swap on {sourceDisplayName}.
                            </Text>
                            {evmState.isAvailable && !evmWallet.isConnected && (
                                <HStack gap="2" w="full">
                                    {evmWallet.hasInjected && (
                                        <Button flex="1" size="sm" colorPalette={accentColor}
                                                onClick={() => connectEvm('injected')}
                                                loading={isConnecting}>
                                            MetaMask
                                        </Button>
                                    )}
                                    <Button flex="1" size="sm" variant="outline" colorPalette={accentColor}
                                            onClick={() => connectEvm('walletconnect')}
                                            loading={isConnecting}>
                                        WalletConnect
                                    </Button>
                                </HStack>
                            )}
                            {!evmState.isAvailable && (
                                <Text fontSize="xs" color="orange.500">
                                    EVM wallet support is not configured in this app.
                                </Text>
                            )}
                        </>
                    ) : (
                        <>
                            <Text fontSize="sm" color="fg.muted">
                                To complete this swap, your wallet needs access to{' '}
                                <Text as="span" fontWeight="medium">{requiredChainNames.join(', ')}</Text>.
                                This lets us sign and route the transaction on your behalf.
                            </Text>
                            <Button size="sm" w="full" colorPalette={accentColor}
                                    onClick={handleConnectAll} loading={isConnecting} loadingText="Connecting...">
                                Approve connections
                            </Button>
                        </>
                    )}
                </VStack>
            )}

            {/* ── Buy BZE button ─────────────────────────────────────────────── */}
            {!needsConnect && (
                <Button size="sm" w="full" colorPalette={accentColor}
                        disabled={!canExecute} loading={isExecuting}
                        loadingText={progressMessage || "Swapping..."}
                        onClick={handleExecute}>
                    Buy BZE
                </Button>
            )}
        </VStack>
    );
};
