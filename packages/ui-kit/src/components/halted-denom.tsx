'use client'

import {Badge, Box, HStack, Text, VStack} from '@chakra-ui/react';
import {LuBan} from 'react-icons/lu';
import type {ReactNode} from 'react';
import {Tooltip} from './tooltip';

const HALTED_TOOLTIP = 'Support for this asset has ended: the chain no longer executes orders or swaps with it.';

/** "Trading halted" badge for a market, pool or asset with a governance-halted denom. */
export const HaltedBadge = () => {
    return (
        <Tooltip content={HALTED_TOOLTIP} showArrow>
            <Badge colorPalette={'red'} variant="subtle">
                <HStack gap="1">
                    <LuBan size={12}/>
                    <Text>Trading halted</Text>
                </HStack>
            </Badge>
        </Tooltip>
    );
};

interface HaltedNoticeProps {
    /** Tickers of the halted side(s), e.g. ["USDC.n"]. */
    tickers: string[];
    /** Extra sentence for the page, e.g. what happens to resting orders. */
    children?: ReactNode;
}

/**
 * Explains why trading actions are locked for a halted asset and which exits stay open. Same
 * layout as `LegacyAssetNoticeBox`, in red so it reads as "this action is unavailable".
 */
export const HaltedNotice = ({tickers, children}: HaltedNoticeProps) => {
    const names = tickers.length > 0 ? tickers.join(' and ') : 'This asset';
    const verb = tickers.length > 1 ? 'are' : 'is';

    return (
        <Box
            p={3}
            borderRadius="lg"
            bg="red.500/10"
            borderWidth="1px"
            borderColor="red.500/25"
            role="note"
        >
            <HStack align="start" gap={2.5}>
                <Box color="red.500" mt={0.5} flexShrink={0}>
                    <LuBan size={16}/>
                </Box>
                <VStack align="start" gap={0.5}>
                    <Box fontSize="sm" fontWeight="semibold">
                        {names} {verb} no longer tradeable on BZE
                    </Box>
                    <Box fontSize="sm" color="fg.muted">
                        Support for {tickers.length > 1 ? 'these assets' : 'this asset'} has ended, so the chain no longer
                        executes orders or swaps with {tickers.length > 1 ? 'them' : 'it'}. You can still cancel your open
                        orders, remove your liquidity, and transfer or withdraw the asset.
                    </Box>
                    {children && (
                        <Box fontSize="sm" color="fg.muted">
                            {children}
                        </Box>
                    )}
                </VStack>
            </HStack>
        </Box>
    );
};
