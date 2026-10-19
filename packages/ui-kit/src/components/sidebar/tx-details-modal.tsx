'use client'

import {useState} from 'react';
import {
    Box,
    Button,
    chakra,
    Collapsible,
    Flex,
    HStack,
    IconButton,
    Spinner,
    Text,
    VStack,
} from '@chakra-ui/react';
import {LuCheck, LuChevronRight, LuCopy, LuExternalLink} from 'react-icons/lu';
import type {CrossChainTxRecord, SkipTransferEvent} from '../../types/cross_chain';
import {openExternalLink} from '../../utils/functions';
import {getChainId, getExplorerTxURL} from '../../constants/chain';
import {AppIconButton, AppLink} from '../app-identity/app-button';
import {txStateLabel, isPendingState} from '../../utils/tx_state';
import {Notice, StatusPill, type NoticeStatus} from '../hive-glow/status';
import {hgVariant} from '../../theme/variants';
import {DrawerInset, DrawerKV, DrawerMono, DrawerViewHeader, txStateTone} from './drawer-kit';

interface TxDetailsModalProps {
    tx: CrossChainTxRecord;
    onClose: () => void;
}

const hopStateLabel = (state: string): string => {
    switch (state) {
        case 'TRANSFER_UNKNOWN': return 'Waiting';
        case 'TRANSFER_PENDING': return 'Pending';
        case 'TRANSFER_RECEIVED': return 'Received';
        case 'TRANSFER_SUCCESS': return 'Success';
        case 'TRANSFER_FAILURE': return 'Failed';
        default: return state.replace('TRANSFER_', '').toLowerCase();
    }
};

const hopStateTone = (state: string): NoticeStatus | 'neutral' => {
    switch (state) {
        case 'TRANSFER_SUCCESS': case 'TRANSFER_RECEIVED': return 'success';
        case 'TRANSFER_FAILURE': return 'danger';
        case 'TRANSFER_PENDING': return 'info';
        default: return 'neutral';
    }
};

const formatTime = (timestamp: number): string => {
    const d = new Date(timestamp);
    return d.toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

const truncateHash = (hash: string, chars = 8): string => {
    if (hash.length <= chars * 2 + 3) return hash;
    return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
};

/** Copy text to clipboard and show brief feedback. */
const CopyableHash = ({hash, label}: { hash: string; label?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(hash);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* fallback: ignore */ }
    };

    return (
        <HStack gap="6px">
            {label && <Text fontSize="12px" color="hg.text.faint" w="52px">{label}</Text>}
            <DrawerMono size={12} color="hg.text.secondary">{truncateHash(hash)}</DrawerMono>
            <IconButton aria-label="Copy hash" size="2xs" variant="ghost" color={copied ? 'hg.success.text' : 'hg.text.muted'} onClick={handleCopy}>
                {copied ? <LuCheck/> : <LuCopy/>}
            </IconButton>
        </HStack>
    );
};

/** Explorer link button */
const ExplorerLink = ({link}: { link?: string }) => {
    if (!link) return null;
    return (
        <IconButton aria-label="Open in chain explorer" size="2xs" variant="ghost" color="hg.text.muted" onClick={() => openExternalLink(link)}>
            <LuExternalLink/>
        </IconButton>
    );
};

/** A single IBC/bridge hop with its tx hashes. */
const HopDetail = ({event}: { event: SkipTransferEvent }) => {
    const ibc = event.ibc_transfer;
    if (!ibc) return null;

    const txEntries = [
        {label: 'Send', tx: ibc.packet_txs?.send_tx},
        {label: 'Receive', tx: ibc.packet_txs?.receive_tx},
        {label: 'Ack', tx: ibc.packet_txs?.acknowledge_tx},
    ].filter(e => e.tx?.tx_hash);

    return (
        <Flex direction="column" gap="6px" px="12px" py="10px" borderWidth="1px" borderColor="hg.hairline" borderRadius="12px">
            <HStack justify="space-between">
                <Text fontSize="13px" fontWeight="600" color="fg">
                    {ibc.src_chain_id} → {ibc.dst_chain_id}
                </Text>
                <StatusPill tone={hopStateTone(ibc.state)}>{hopStateLabel(ibc.state)}</StatusPill>
            </HStack>
            {txEntries.map(({label, tx}) => (
                <HStack key={label} justify="space-between">
                    <CopyableHash hash={tx!.tx_hash} label={label}/>
                    <ExplorerLink link={tx!.explorer_link}/>
                </HStack>
            ))}
        </Flex>
    );
};

/**
 * Transaction details view. Replaces the sidebar content when a user clicks
 * on a pending transaction in "Recent Buys". Shows overall status, amounts,
 * error info, and collapsible per-hop details with copyable tx hashes and
 * explorer links.
 */
export const TxDetailsModal = ({tx, onClose}: TxDetailsModalProps) => {
    const transfers = tx.lastStatus?.transfers ?? [];
    const allHops = transfers.flatMap(t => t.transfer_sequence ?? []);
    const hasHops = allHops.length > 0;
    const isPending = isPendingState(tx.state);
    const [detailsOpen, setDetailsOpen] = useState(isPending);
    // A tx broadcast on BZE opens in the BZE Explorer; Skip's link is for other chains.
    const broadcastOnBze = !!tx.txHash && tx.broadcastChainId === getChainId();
    const release = tx.lastStatus?.transfer_asset_release;

    return (
        <VStack gap="14px" align="stretch">
            <DrawerViewHeader title="Transaction Details" onClose={onClose}/>

            {/* Summary */}
            <DrawerInset>
                <DrawerKV label="Status">
                    <StatusPill tone={txStateTone(tx.state)} live={isPending}>{txStateLabel(tx.state)}</StatusPill>
                </DrawerKV>
                <DrawerKV label="You sent"><DrawerMono>{tx.amountIn} {tx.assetTicker}</DrawerMono></DrawerKV>
                <DrawerKV label="Estimated output"><DrawerMono>~{tx.estimatedAmountOut} BZE</DrawerMono></DrawerKV>
                <DrawerKV label="Route">{tx.sourceChainName} → {tx.destChainName}</DrawerKV>
                <DrawerKV label="Submitted">{formatTime(tx.timestamp)}</DrawerKV>
            </DrawerInset>

            {/* Error */}
            {tx.error && <Notice status="danger">{tx.error}</Notice>}

            {/* Transfer details — collapsible, includes broadcast tx + hops */}
            <Collapsible.Root defaultOpen={isPending} onOpenChange={(details) => setDetailsOpen(details.open)}>
                <Collapsible.Trigger asChild>
                    <Button size="md" variant="ghost" w="full" px="8px" justifyContent="space-between" fontSize="13px" fontWeight="600" color="fg">
                        Transfer details
                        <Box transition="transform 0.2s" transform={detailsOpen ? 'rotate(90deg)' : 'rotate(0deg)'}>
                            <LuChevronRight size="14"/>
                        </Box>
                    </Button>
                </Collapsible.Trigger>
                <Collapsible.Content>
                    <VStack gap="8px" align="stretch" pt="4px">
                        {/* Broadcast tx hash */}
                        {tx.txHash && (
                            <HStack justify="space-between" px="12px" py="8px" borderWidth="1px" borderColor="hg.hairline" borderRadius="12px">
                                <Text fontSize="12px" color="hg.text.faint">Broadcast tx</Text>
                                <HStack gap="0">
                                    <CopyableHash hash={tx.txHash}/>
                                    {broadcastOnBze ? (
                                        <AppIconButton app="explorer" href={getExplorerTxURL(tx.txHash)} aria-label="View on Explorer" size="xs"/>
                                    ) : (
                                        <ExplorerLink link={tx.explorerLink}/>
                                    )}
                                </HStack>
                            </HStack>
                        )}

                        {/* Per-hop details */}
                        {allHops.map((hop, i) => (
                            <HopDetail key={i} event={hop}/>
                        ))}

                        {/* Pending indicator: before the relay details arrive, then while the hops run */}
                        {isPending && (
                            <HStack gap="8px" p="4px" justify="center" fontSize="12px" color="hg.text.faint">
                                <Spinner size="xs" color="hg.info"/>
                                <chakra.span>{hasHops ? 'Processing...' : 'Waiting for relay details...'}</chakra.span>
                            </HStack>
                        )}
                    </VStack>
                </Collapsible.Content>
            </Collapsible.Root>

            {/* Asset release info */}
            {release && (
                release.released
                    ? <Notice status="success">Funds have been released to your wallet.</Notice>
                    : <Notice status="warning">Funds are pending release...</Notice>
            )}

            <VStack gap="8px" w="full" align="stretch">
                {broadcastOnBze ? (
                    <HStack justify="center">
                        <AppLink app="explorer" href={getExplorerTxURL(tx.txHash!)}>Explorer</AppLink>
                    </HStack>
                ) : tx.explorerLink && (
                    // Broadcast on another chain: Skip's link goes to that chain's own explorer.
                    <Button size="md" variant={hgVariant('secondary')} w="full"
                            onClick={() => openExternalLink(tx.explorerLink!)}>
                        View on chain explorer
                        <LuExternalLink size="12"/>
                    </Button>
                )}
                <Button size="md" variant={hgVariant('secondary')} w="full" onClick={onClose}>
                    Close
                </Button>
            </VStack>
        </VStack>
    );
};
