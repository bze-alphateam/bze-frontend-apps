'use client';

import { Box, chakra, Flex, type FlexProps } from '@chakra-ui/react';
import { LuArrowRight } from 'react-icons/lu';
import type { ReactNode } from 'react';
import { HgCard, Shimmer, TokenLogo } from '@bze/bze-ui-kit';
import { inLayout, showOnlyIn } from './swap-layout';

/** One swap (one hop) of the wallet's history, ready to display. */
export interface RecentSwap {
    key: string;
    paidAmount: string;
    paidTicker: string;
    paidLogo?: string;
    gotAmount: string;
    gotTicker: string;
    gotLogo?: string;
    /** The pool's pair, "BZE / USDC". */
    pool: string;
}

/** The swaps of one transaction (a multi-hop swap shares one timestamp). */
export interface RecentSwapGroup {
    key: string;
    /** "Sep 9, 2026" */
    day: string;
    /** "Sep 9" */
    shortDay: string;
    /** "11:26 AM" */
    time: string;
    swaps: RecentSwap[];
}

export interface RecentSwapsCardProps {
    groups: RecentSwapGroup[];
    isLoading: boolean;
}

const EmptyBox = ({ title, hint, ...props }: { title: string; hint: string } & FlexProps) => (
    <Flex direction="column" align="center" justify="center" gap="4px" textAlign="center" bg="hg.inset" borderRadius="12px" p="22px" {...props}>
        <chakra.span fontSize="14px" fontWeight="600">{title}</chakra.span>
        <chakra.span fontSize="12px" color="hg.text.faint">{hint}</chakra.span>
    </Flex>
);

const Paid = ({ swap }: { swap: RecentSwap }) => (
    <>{swap.paidAmount} {swap.paidTicker}</>
);

const Got = ({ swap }: { swap: RecentSwap }) => (
    <chakra.span color="hg.link" fontWeight="600">{swap.gotAmount} {swap.gotTicker}</chakra.span>
);

const th = { textAlign: 'start', fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hg.text.faint', px: '12px', pb: '10px' } as const;
const td = { px: '12px', py: '14px', borderTopWidth: '1px', borderColor: 'hg.divider' } as const;

/** A: one table row per swap, the date in the When cell. */
const SwapsTable = ({ groups }: { groups: RecentSwapGroup[] }) => (
    <Box maxH="400px" overflowY="auto" mx="-12px" css={showOnlyIn(['aligned'])}>
        <chakra.table w="100%" borderCollapse="collapse" fontSize="14px">
            <thead>
                <tr>
                    <chakra.th {...th}>When</chakra.th>
                    <chakra.th {...th}>You paid</chakra.th>
                    <chakra.th {...th}>You got</chakra.th>
                    <chakra.th {...th}>Pool</chakra.th>
                </tr>
            </thead>
            <tbody>
                {groups.flatMap((group) => group.swaps.map((swap) => (
                    <tr key={swap.key}>
                        <chakra.td {...td} fontFamily="mono" fontSize="12px" color="hg.text.muted" whiteSpace="nowrap">
                            {group.shortDay} · {group.time}
                        </chakra.td>
                        <chakra.td {...td}><Paid swap={swap} /></chakra.td>
                        <chakra.td {...td}><Got swap={swap} /></chakra.td>
                        <chakra.td {...td} fontSize="13px" color="hg.text.muted">{swap.pool}</chakra.td>
                    </tr>
                )))}
            </tbody>
        </chakra.table>
    </Box>
);

/** B: one line per swap, the time on the left and "paid → got" on the right. */
const SwapsLines = ({ groups }: { groups: RecentSwapGroup[] }) => (
    <Flex direction="column" maxH="400px" overflowY="auto" css={showOnlyIn(['centered'])}>
        {groups.flatMap((group) => group.swaps.map((swap) => (
            <Flex key={swap.key} justify="space-between" align="center" gap="4px 12px" wrap="wrap" px="4px" py="12px" borderTopWidth="1px" borderColor="hg.divider" fontSize="14px">
                <chakra.span fontFamily="mono" fontSize="12px" color="hg.text.muted">{group.shortDay} · {group.time}</chakra.span>
                <chakra.span textAlign="end"><Paid swap={swap} /> → <Got swap={swap} /></chakra.span>
            </Flex>
        )))}
    </Flex>
);

/** C-3: rows grouped by day, each transaction's swaps on one inset tile; scrolls inside the card. */
const SwapsByDay = ({ groups }: { groups: RecentSwapGroup[] }) => (
    <Flex direction="column" gap="8px" flex="1" minH="0" overflowY="auto" css={showOnlyIn(['split'], 'flex')}>
        {groups.map((group, idx) => (
            <Flex key={group.key} direction="column" gap="8px">
                {(idx === 0 || groups[idx - 1].day !== group.day) && (
                    <chakra.span fontSize="12px" fontWeight="600" color="hg.text.faint">{group.day}</chakra.span>
                )}
                <Flex direction="column" gap="8px" bg="hg.inset" borderRadius="12px" px="14px" py="12px">
                    <chakra.span fontFamily="mono" fontSize="11px" color="hg.text.faint">{group.time}</chakra.span>
                    {group.swaps.map((swap) => (
                        <Flex key={swap.key} align="center" gap="10px" wrap="wrap" fontSize="14px">
                            <TokenLogo src={swap.paidLogo} symbol={swap.paidTicker} size="6" circular={true} />
                            <chakra.strong>{swap.paidAmount}</chakra.strong>
                            <chakra.span color="hg.text.muted">{swap.paidTicker}</chakra.span>
                            <Box as="span" color="hg.text.faint"><LuArrowRight size={14} aria-hidden="true" /></Box>
                            <chakra.strong color="hg.link">{swap.gotAmount} {swap.gotTicker}</chakra.strong>
                            <TokenLogo src={swap.gotLogo} symbol={swap.gotTicker} size="6" circular={true} />
                        </Flex>
                    ))}
                </Flex>
            </Flex>
        ))}
    </Flex>
);

/**
 * Your Recent Swaps: one card with its loading and empty states, and the list drawn the way the
 * layout wants it (A table, B lines, C-3 day groups; the other two are hidden by CSS).
 */
export const RecentSwapsCard = ({ groups, isLoading }: RecentSwapsCardProps) => (
    <HgCard
        as="section"
        aria-label="Your Recent Swaps"
        w="100%"
        p="20px"
        display="flex"
        flexDirection="column"
        gap="12px"
        css={{
            [inLayout('aligned')]: { mt: { lg: '22px' } },
            [inLayout('split')]: { flex: { lg: '1' }, minH: { lg: '0' } },
        }}
    >
        <Flex justify="space-between" align="baseline" gap="12px">
            <chakra.h2 m="0" fontSize="17px" fontWeight="700">Your Recent Swaps</chakra.h2>
            <chakra.span fontSize="12px" color="hg.text.faint">this wallet · newest first</chakra.span>
        </Flex>
        {groups.length === 0 ? (
            isLoading ? (
                <chakra.span fontSize="14px" color="hg.text.muted">Loading swap history...</chakra.span>
            ) : (
                <EmptyBox title="No swap history yet" hint="Your swaps will appear here" />
            )
        ) : (
            <>
                <SwapsTable groups={groups} />
                <SwapsLines groups={groups} />
                <SwapsByDay groups={groups} />
            </>
        )}
    </HgCard>
);

/** C-3 without a wallet: the empty state that fills the activity column under the stats. */
export const ConnectForSwaps = () => (
    <EmptyBox
        title="Connect a wallet to see your swaps"
        hint="Your swaps will appear here"
        flex="1"
        css={showOnlyIn(['split'], 'flex')}
    />
);

export interface StatFigure {
    label: ReactNode;
    value: ReactNode;
    loading?: boolean;
}

/** B: the stats as one slim box of figures split by dividers (A and C-3 use the stat cards). */
export const StatFigures = ({ figures }: { figures: StatFigure[] }) => (
    <Flex
        w={{ base: '100%', md: 'fit-content' }}
        mx="auto"
        borderWidth="1px"
        borderColor="hg.hairline"
        borderRadius="14px"
        bg="hg.hoverFill/33"
        data-testid="stat-figures"
        css={showOnlyIn(['centered'])}
    >
        {figures.map((figure, idx) => (
            <Flex
                key={idx}
                direction="column"
                align="center"
                gap="2px"
                flex={{ base: '1', md: 'none' }}
                minW="0"
                px={{ base: '8px', md: '28px' }}
                py="12px"
                borderLeftWidth={idx > 0 ? '1px' : undefined}
                borderColor="hg.divider"
                aria-busy={figure.loading || undefined}
            >
                <chakra.span fontSize="12px" color="hg.text.muted">{figure.label}</chakra.span>
                {figure.loading ? (
                    <Shimmer w="64px" h="20px" />
                ) : (
                    <chakra.span fontSize="17px" fontWeight="700" color="fg" truncate data-testid="figure-value">{figure.value}</chakra.span>
                )}
            </Flex>
        ))}
    </Flex>
);
