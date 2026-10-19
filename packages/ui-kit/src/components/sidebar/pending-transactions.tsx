'use client'

import {Box, chakra, Flex, IconButton} from '@chakra-ui/react';
import {LuInfo, LuX} from 'react-icons/lu';
import type {CrossChainTxRecord} from '../../types/cross_chain';
import {txStateLabel, isPendingState} from '../../utils/tx_state';
import {Tooltip} from '../tooltip';
import {StatusPill} from '../hive-glow/status';
import {DrawerMono, DrawerSectionTitle, txStateTone} from './drawer-kit';

interface PendingTransactionsProps {
    transactions: CrossChainTxRecord[];
    onDismiss: (id: string) => void;
    onSelect: (tx: CrossChainTxRecord) => void;
}

/**
 * "Latest Buy": the last Buy BZE (Skip) transaction, rendered above the balances in the wallet
 * sidebar. One row, never a history: the full history lives in the Explorer. In progress it
 * carries the soft app tint and a live dot; clicking it opens Transaction Details. Shows nothing
 * when there is no transaction to show.
 */
export const PendingTransactions = ({transactions, onDismiss, onSelect}: PendingTransactionsProps) => {
    if (transactions.length === 0) return null;

    return (
        <Flex direction="column" gap="8px" data-testid="latest-buy">
            <Flex align="center" gap="6px">
                <DrawerSectionTitle>Latest Buy</DrawerSectionTitle>
                <Tooltip
                    showArrow
                    openDelay={100}
                    content="Your latest Buy BZE transaction stays here for 1 minute after it finishes, or until you dismiss it. Every transaction is in the Explorer."
                    contentProps={{maxW: '220px', fontSize: 'xs'}}
                >
                    <Box as="span" cursor="help" color="hg.text.faint" display="inline-flex" alignItems="center">
                        <LuInfo size="12"/>
                    </Box>
                </Tooltip>
            </Flex>
            {transactions.map(tx => {
                const pending = isPendingState(tx.state);
                return (
                    <Flex
                        key={tx.id}
                        align="center"
                        gap="8px"
                        pl="12px"
                        pr="6px"
                        py="10px"
                        borderRadius="12px"
                        bg={pending ? 'app.subtle' : 'hg.inset'}
                        borderWidth="1px"
                        borderColor="hg.hairline"
                        _hover={{borderColor: 'app.border'}}
                        data-pending={pending ? '' : undefined}
                    >
                        <chakra.button
                            type="button"
                            flex="1"
                            minW="0"
                            border="0"
                            bg="transparent"
                            p="0"
                            textAlign="left"
                            display="flex"
                            flexDirection="column"
                            gap="6px"
                            color="fg"
                            cursor="pointer"
                            focusVisibleRing="outside"
                            onClick={() => onSelect(tx)}
                        >
                            <chakra.span fontWeight="600" truncate maxW="100%">
                                <DrawerMono>{tx.amountIn} {tx.assetTicker} → ~{tx.estimatedAmountOut} BZE</DrawerMono>
                            </chakra.span>
                            <Flex as="span" align="center" gap="8px" minW="0">
                                <StatusPill tone={txStateTone(tx.state)} live={pending}>{txStateLabel(tx.state)}</StatusPill>
                                <chakra.span fontSize="12px" color="hg.text.faint" truncate>
                                    {tx.sourceChainName} → {tx.destChainName}
                                </chakra.span>
                            </Flex>
                        </chakra.button>
                        <IconButton
                            aria-label="Dismiss"
                            variant="ghost"
                            size="xs"
                            color="hg.text.muted"
                            onClick={() => onDismiss(tx.id)}
                        >
                            <LuX/>
                        </IconButton>
                    </Flex>
                );
            })}
        </Flex>
    );
};
