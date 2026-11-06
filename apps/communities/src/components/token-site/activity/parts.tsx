'use client';

import React, {useCallback, useState} from "react";
import {Box, type BoxProps, chakra, Flex, Grid} from "@chakra-ui/react";
import {LuActivity} from "react-icons/lu";

import {TsButton, TsCard, TsChip, TsInset, TsNotice, ts, tsLabel, tsMix} from "../kit";

/** A labelled number of an inner page's header, with a short note under it. */
export interface InnerStat {
    id: string;
    label: string;
    value: React.ReactNode;
    note?: React.ReactNode;
}

/** The inner pages' row of key numbers: five across on a desktop, two on a phone. */
export function StatGrid({stats, label = "Key numbers"}: { stats: InnerStat[]; label?: string }) {
    return (
        <Grid as="section" aria-label={label} templateColumns={{base: "repeat(2, minmax(0, 1fr))", md: `repeat(${stats.length}, minmax(0, 1fr))`}} gap="12px">
            {stats.map((stat) => (
                <TsCard key={stat.id} data-testid={`activity-stat-${stat.id}`} px="20px" py="18px" display="flex" flexDirection="column" gap="6px" minW="0">
                    <chakra.span {...tsLabel}>{stat.label}</chakra.span>
                    <chakra.span fontSize={{base: "18px", md: "22px"}} fontWeight={700} fontVariantNumeric="tabular-nums" overflowWrap="anywhere">
                        {stat.value}
                    </chakra.span>
                    {stat.note && <chakra.span fontSize="13px" color={ts.muted}>{stat.note}</chakra.span>}
                </TsCard>
            ))}
        </Grid>
    );
}

export interface PillTab<T extends string> {
    value: T;
    label: string;
    count?: React.ReactNode;
}

/** The Activity page's tabs: pills, the selected one in the kit's gradient. */
export function PillTabs<T extends string>({label, tabs, value, onChange}: { label: string; tabs: PillTab<T>[]; value: T; onChange: (value: T) => void }) {
    return (
        <Flex role="tablist" aria-label={label} gap="8px" wrap="wrap" pt="36px" pb="20px">
            {tabs.map((tab) => {
                const selected = tab.value === value;
                return (
                    <chakra.button
                        key={tab.value}
                        type="button"
                        role="tab"
                        id={`tab-${tab.value}`}
                        aria-selected={selected}
                        aria-controls={`panel-${tab.value}`}
                        onClick={() => onChange(tab.value)}
                        display="inline-flex"
                        alignItems="center"
                        gap="8px"
                        minH="44px"
                        px="18px"
                        borderRadius="999px"
                        borderWidth="1px"
                        borderStyle="solid"
                        borderColor={selected ? "transparent" : tsMix(ts.fg, 18)}
                        bg={selected ? ts.gradient : "transparent"}
                        color={selected ? ts.onPri : ts.fg}
                        font="inherit"
                        fontSize="15px"
                        fontWeight={600}
                        cursor="pointer"
                        _focusVisible={{outline: `2px solid ${ts.fg}`, outlineOffset: "2px"}}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <chakra.span fontSize="12px" fontWeight={700} px="7px" py="1px" borderRadius="999px" bg="color-mix(in oklab, currentColor 16%, transparent)">
                                {tab.count}
                            </chakra.span>
                        )}
                    </chakra.button>
                );
            })}
        </Flex>
    );
}

/** A tab's panel, labelled by its tab. */
export function TabPanel({value, ...props}: BoxProps & { value: string }) {
    return <Box role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`} display="flex" flexDirection="column" {...props}/>;
}

/** A list in a card: rows separated by hairlines. */
export function ListCard(props: BoxProps) {
    return <TsCard overflow="hidden" css={{"& > * + *": {borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: ts.border}}} {...props}/>;
}

/** A shimmering block of a skeleton. */
export function Shimmer(props: BoxProps) {
    return (
        <Box
            aria-hidden="true"
            borderRadius="8px"
            bg={`linear-gradient(90deg, ${ts.inset} 0%, ${tsMix(ts.fg, 11)} 50%, ${ts.inset} 100%)`}
            bgSize="200% 100%"
            animation="ts-shimmer 1.6s linear infinite"
            css={{
                "@keyframes ts-shimmer": {from: {backgroundPosition: "200% 0"}, to: {backgroundPosition: "-200% 0"}},
                "@media (prefers-reduced-motion: reduce)": {animation: "none"},
            }}
            {...props}
        />
    );
}

/** Loading rows in the list's own shape. */
export function RowsSkeleton({rows = 5, label = "Loading"}: { rows?: number; label?: string }) {
    return (
        <ListCard role="status" aria-label={label} data-testid="rows-skeleton">
            {Array.from({length: rows}, (_, i) => (
                <Flex key={i} align="center" gap="16px" px={{base: "16px", md: "24px"}} py="18px">
                    <Shimmer w="72px" h="24px" borderRadius="999px"/>
                    <Flex direction="column" gap="8px" flex="1">
                        <Shimmer w="55%" h="16px"/>
                        <Shimmer w="30%" h="12px"/>
                    </Flex>
                    <Shimmer w="96px" h="18px" display={{base: "none", md: "block"}}/>
                </Flex>
            ))}
        </ListCard>
    );
}

/** The skeleton of the key numbers while the token's numbers load. */
export function StatsSkeleton({count = 5}: { count?: number }) {
    return (
        <Grid role="status" aria-label="Loading key numbers" templateColumns={{base: "repeat(2, minmax(0, 1fr))", md: `repeat(${count}, minmax(0, 1fr))`}} gap="12px">
            {Array.from({length: count}, (_, i) => <Shimmer key={i} h="96px" borderRadius="16px"/>)}
        </Grid>
    );
}

/** Nothing to list yet, inside the card where the list goes. */
export function EmptyCard({title, children}: { title: string; children?: React.ReactNode }) {
    return (
        <TsCard px={{base: "20px", md: "32px"}} py={{base: "32px", md: "44px"}} display="flex" flexDirection="column" alignItems="center" gap="10px" textAlign="center">
            <Flex aria-hidden="true" w="48px" h="48px" borderRadius="50%" bg={ts.inset} color={ts.pri} align="center" justify="center">
                <LuActivity size={22}/>
            </Flex>
            <chakra.h3 m="0" fontSize="18px" fontWeight={700}>{title}</chakra.h3>
            {children && <chakra.p m="0" color={ts.muted} fontSize="15px" lineHeight="1.5" maxW="440px">{children}</chakra.p>}
        </TsCard>
    );
}

/** A read failed: the message and Retry, inside the card where the data goes. */
export function ErrorCard({children, onRetry}: { children: React.ReactNode; onRetry: () => void }) {
    return (
        <TsCard p={{base: "16px", md: "20px"}}>
            <RetryNote onRetry={onRetry}>{children}</RetryNote>
        </TsCard>
    );
}

/** The error note with its Retry button. */
export function RetryNote({children, onRetry}: { children: React.ReactNode; onRetry: () => void }) {
    return (
        <TsNotice tone="danger">
            <Flex align="center" justify="space-between" gap="12px" wrap="wrap">
                <chakra.span>{children}</chakra.span>
                <TsButton variant="ghost" onClick={onRetry} borderRadius="12px">Retry</TsButton>
            </Flex>
        </TsNotice>
    );
}

interface LoadMoreProps {
    hasMore: boolean;
    isLoading: boolean;
    /** The last "Load more" failed; the rows already shown stay. */
    hasError: boolean;
    onLoadMore: () => void;
}

/** "Load more" under a cursor-paged list, or its error with Retry. */
export function LoadMore({hasMore, isLoading, hasError, onLoadMore}: LoadMoreProps) {
    if (hasError) {
        return <RetryNote onRetry={onLoadMore}>Couldn&apos;t load more rows.</RetryNote>;
    }
    if (!hasMore) return null;

    return (
        <TsButton variant="ghost" alignSelf="center" minH="48px" px="28px" onClick={onLoadMore} disabled={isLoading} aria-busy={isLoading}>
            {isLoading ? "Loading…" : "Load more"}
        </TsButton>
    );
}

/** Copies `value`, saying "Copied" for a moment. */
export function CopyButton({value, label}: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);
    const onCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable: ignore */
        }
    }, [value]);

    return <TsChip onClick={onCopy} aria-label={label}>{copied ? "Copied" : "Copy"}</TsChip>;
}

/** A recessed one-line note ("Holders appear after the next hourly snapshot."). */
export function InsetNote(props: BoxProps) {
    return <TsInset px="16px" py="14px" color={ts.muted} fontSize="15px" lineHeight="1.5" {...props}/>;
}
