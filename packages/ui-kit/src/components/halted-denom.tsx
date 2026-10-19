'use client'

import {Badge, Box} from '@chakra-ui/react';
import {LuBan} from 'react-icons/lu';
import type {ReactNode} from 'react';
import {Tooltip} from './tooltip';
import {Notice} from './hive-glow/status';
import {hgVariant} from '../theme/variants';

const HALTED_TOOLTIP = 'Support for this asset has ended: the chain no longer executes orders or swaps with it.';

/** "Trading halted" badge for a market, pool or asset with a governance-halted denom. */
export const HaltedBadge = () => {
    return (
        <Tooltip content={HALTED_TOOLTIP} showArrow>
            <Badge variant={hgVariant("danger")} borderRadius="full" gap="1" px="2">
                <LuBan size={12}/>
                Trading halted
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
 * Explains why trading actions are locked for a halted asset and which exits stay open. The
 * danger notice (SurfNotices): never the app colour, so a halted asset looks the same in every app.
 */
export const HaltedNotice = ({tickers, children}: HaltedNoticeProps) => {
    const names = tickers.length > 0 ? tickers.join(' and ') : 'This asset';
    const verb = tickers.length > 1 ? 'are' : 'is';

    return (
        <Notice status="danger" icon={<LuBan/>} title={`${names} ${verb} no longer tradeable on BZE`}>
            Support for {tickers.length > 1 ? 'these assets' : 'this asset'} has ended, so the chain no longer
            executes orders or swaps with {tickers.length > 1 ? 'them' : 'it'}. You can still cancel your open
            orders, remove your liquidity, and transfer or withdraw the asset.
            {children && (
                <Box as="span" display="block" mt="4px">
                    {children}
                </Box>
            )}
        </Notice>
    );
};
