'use client'

import {Text} from '@chakra-ui/react';
import BigNumber from 'bignumber.js';
import {uAmountToBigNumberAmount} from '../../utils/amount';
import type {UseRouteLimitResult} from '../../hooks/useRouteLimit';
import type {RouteLimitDirection} from '../../hooks/useRouteLimit';

// Same wording as BFE-380's stopped route.
export const SEND_STOPPED_TEXT = 'Transfers out on this route are stopped for now.';
export const RECEIVE_STOPPED_TEXT = 'Deposits on this route are stopped for now.';

/** Room as a display string, truncated (never rounded up) so the shown maximum always passes. */
export const formatRoom = (room: bigint, decimals: number): string =>
    uAmountToBigNumberAmount(room.toString(), decimals).decimalPlaces(Math.min(decimals, 6), BigNumber.ROUND_DOWN).toFormat();

const pad = (n: number) => String(n).padStart(2, '0');

const untilText = (limit: UseRouteLimitResult): string =>
    limit.nextReset
        ? `until ${pad(limit.nextReset.getUTCHours())}:00 UTC`
        : `(resets every ${limit.durationHours} hours)`;

const resetSentence = (limit: UseRouteLimitResult): string =>
    limit.nextReset
        ? `It resets at ${pad(limit.nextReset.getUTCHours())}:00 UTC.`
        : `It resets every ${limit.durationHours} hours.`;

/** Whether the route's daily limit has a message to show at all. */
export const hasRouteLimit = (limit: UseRouteLimitResult): boolean => limit.room !== undefined;

/** The amount error when `amount` (raw micro-units) goes over the room, '' when it passes. */
export const routeLimitError = (limit: UseRouteLimitResult, amountU: bigint, decimals: number, ticker: string, dir: RouteLimitDirection): string => {
    if (limit.room === undefined || amountU <= BigInt(0)) return '';
    if (limit.stopped) return dir === 'send' ? SEND_STOPPED_TEXT : RECEIVE_STOPPED_TEXT;
    if (amountU <= limit.room) return '';
    if (limit.room === BigInt(0)) return `Today's limit for this route is used up. ${resetSentence(limit)}`;
    return `Over today's limit for this route: at most ${formatRoom(limit.room, decimals)} ${ticker} ${untilText(limit)}.`;
}

interface RouteLimitLineProps {
    limit: UseRouteLimitResult;
    decimals: number;
    ticker: string;
    direction: RouteLimitDirection;
}

/** "Daily limit on this route: up to X more until 00:00 UTC". Renders nothing when the route has no limit. */
export const RouteLimitLine = ({limit, decimals, ticker, direction}: RouteLimitLineProps) => {
    if (limit.room === undefined) return null;
    const prefix = direction === 'send' ? 'Daily limit on this route' : 'Daily limit for deposits on this route';
    let text: string;
    if (limit.stopped) text = direction === 'send' ? SEND_STOPPED_TEXT : RECEIVE_STOPPED_TEXT;
    else if (limit.room === BigInt(0)) text = `Today's limit for this route is used up. ${resetSentence(limit)}`;
    else text = `${prefix}: up to ${formatRoom(limit.room, decimals)} ${ticker} more ${untilText(limit)}`;

    const local = limit.nextReset ? `Resets at ${limit.nextReset.toLocaleString()} (your local time)` : undefined;
    return (
        <Text fontSize="xs" color="fg.muted" data-testid="route-limit" title={local}>
            {text}
        </Text>
    );
}
