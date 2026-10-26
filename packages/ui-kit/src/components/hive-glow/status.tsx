'use client';

import { Box, chakra, Flex, Spinner } from '@chakra-ui/react';
import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { LuCircleAlert, LuCircleCheck, LuInbox, LuInfo, LuOctagonAlert, LuSearchX, LuTriangleAlert } from 'react-icons/lu';

import { HIVE_GLOW_NOTICE } from '../../theme/hive-glow-tokens';
import { Shimmer } from './cards';

export type NoticeStatus = 'info' | 'warning' | 'danger' | 'success';

const NOTICE_ICONS: Record<NoticeStatus, ReactNode> = {
    info: <LuInfo />,
    warning: <LuTriangleAlert />,
    danger: <LuOctagonAlert />,
    success: <LuCircleCheck />,
};

const pct = (a: number) => Math.round(a * 100);

export interface NoticeProps {
    status: NoticeStatus;
    title?: ReactNode;
    children?: ReactNode;
    /** Replaces the status icon. */
    icon?: ReactNode;
}

/**
 * An inline notice in the shared status colours: 8 % fill, 30 % edge, 12 px radius, a 16 px
 * icon, muted body. It never takes the app colour, so it reads the same in every app.
 */
export const Notice = ({ status, title, children, icon }: NoticeProps) => (
    <Flex
        role="note"
        gap="10px"
        align="flex-start"
        px="14px"
        py="12px"
        borderRadius={`${HIVE_GLOW_NOTICE.radius}px`}
        bg={`hg.${status}/${pct(HIVE_GLOW_NOTICE.fillAlpha)}`}
        borderWidth="1px"
        borderColor={`hg.${status}/${pct(HIVE_GLOW_NOTICE.edgeAlpha)}`}
        data-testid="notice"
        data-status={status}
    >
        <Box
            as="span"
            aria-hidden
            flex="none"
            mt="2px"
            color={`hg.${status}`}
            css={{ '& svg': { width: `${HIVE_GLOW_NOTICE.icon}px`, height: `${HIVE_GLOW_NOTICE.icon}px` } }}
        >
            {icon ?? NOTICE_ICONS[status]}
        </Box>
        <Flex direction="column" gap="2px" fontSize="14px" minW="0">
            {title && <chakra.strong color="fg">{title}</chakra.strong>}
            {children && <chakra.span color="fg.muted" lineHeight="1.5">{children}</chakra.span>}
        </Flex>
    </Flex>
);

export interface StatusPillProps {
    tone: NoticeStatus | 'neutral';
    /** An in-flight state (in progress, connecting…): adds the breathing dot. */
    live?: boolean;
    children: ReactNode;
}

/** A status pill in the notice colours; in-flight states carry a live dot. */
export const StatusPill = ({ tone, live, children }: StatusPillProps) => {
    const neutral = tone === 'neutral';

    return (
        <chakra.span
            display="inline-flex"
            alignItems="center"
            gap="6px"
            fontSize="12px"
            fontWeight="600"
            px="10px"
            py="3px"
            borderRadius="hg.pill"
            whiteSpace="nowrap"
            color={neutral ? 'hg.text.secondary' : `hg.${tone}.text`}
            bg={neutral ? 'hg.secondaryFill' : `hg.${tone}/12`}
            borderWidth="1px"
            borderColor={neutral ? 'hg.hairline' : `hg.${tone}/30`}
            data-testid="status-pill"
            data-tone={tone}
        >
            {live && (
                <chakra.span
                    aria-hidden
                    data-testid="live-dot"
                    boxSize="6px"
                    borderRadius="full"
                    flex="none"
                    bg={neutral ? 'hg.text.faint' : `hg.${tone}`}
                    boxShadow="0 0 0 3px var(--ring)"
                    css={{ '--ring': neutral ? 'colors.hg.hairline' : `color-mix(in srgb, var(--chakra-colors-hg-${tone}) 25%, transparent)` }}
                    animation="hgBreathe 2.4s ease-in-out infinite"
                    _motionReduce={{ animation: 'none' }}
                />
            )}
            {children}
        </chakra.span>
    );
};

export interface SegmentedOption<T extends string> {
    value: T;
    label: ReactNode;
}

export interface SegmentedTabsProps<T extends string> {
    options: SegmentedOption<T>[];
    value: T;
    onChange: (value: T) => void;
    'aria-label': string;
}

/**
 * Two or three mutually exclusive views: an inset track whose active segment is raised and
 * underlined with the app gradient. Arrow keys move between segments.
 */
export function SegmentedTabs<T extends string>({ options, value, onChange, 'aria-label': ariaLabel }: SegmentedTabsProps<T>) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (e: KeyboardEvent, index: number) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = (index + step + options.length) % options.length;
        onChange(options[next].value);
        refs.current[next]?.focus();
    };

    return (
        <Flex role="tablist" aria-label={ariaLabel} gap="4px" p="4px" borderRadius="hg.md" bg="hg.inset">
            {options.map((option, index) => {
                const selected = option.value === value;
                return (
                    <chakra.button
                        key={option.value}
                        ref={(el: HTMLButtonElement | null) => { refs.current[index] = el; }}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(e) => onKeyDown(e, index)}
                        flex="1"
                        h="36px"
                        border="0"
                        borderRadius="9px"
                        fontSize="14px"
                        fontWeight={selected ? '700' : '500'}
                        bg={selected ? 'hg.raised' : 'transparent'}
                        color={selected ? 'fg' : 'fg.muted'}
                        boxShadow={selected ? 'xs' : 'none'}
                        cursor="pointer"
                        display="inline-flex"
                        flexDirection="column"
                        alignItems="center"
                        justifyContent="center"
                        focusVisibleRing="outside"
                        _hover={selected ? undefined : { color: 'fg' }}
                    >
                        {option.label}
                        {selected && (
                            <chakra.span aria-hidden display="block" h="2px" w="28px" mt="3px" borderRadius="2px" bgImage="app" />
                        )}
                    </chakra.button>
                );
            })}
        </Flex>
    );
}

/** A block waiting on a remote answer inside a form: a spinner, one line of text and two shimmer bars. */
export const LoadingRow = ({ children }: { children: ReactNode }) => (
    <Flex direction="column" gap="10px" bg="hg.inset" borderRadius="14px" px="14px" py="12px" role="status" aria-live="polite">
        <Flex align="center" gap="8px" fontSize="13px" color="hg.text.faint">
            <Spinner size="xs" color="app.solid" css={{ '--spinner-track-color': 'colors.app.subtle' }} />
            {children}
        </Flex>
        <Shimmer h="10px" w="70%" />
        <Shimmer h="10px" w="50%" />
    </Flex>
);

export type PageStateKind = 'loading' | 'empty' | 'error' | 'not-found';

export interface PageStateProps {
    kind: PageStateKind;
    title?: ReactNode;
    description?: ReactNode;
    /** A button, when the page has one (retry, browse…). */
    action?: ReactNode;
    /** Replaces the state's icon. */
    icon?: ReactNode;
    /** Number of skeleton rows while loading. */
    rows?: number;
}

const STATE_ICONS: Record<Exclude<PageStateKind, 'loading'>, ReactNode> = {
    empty: <LuInbox />,
    error: <LuCircleAlert />,
    'not-found': <LuSearchX />,
};

/**
 * What a list or page shows instead of its data. Sits where the data would be, inside its card;
 * loading draws skeleton rows in the data's shape, never a spinner on a blank page.
 */
export const PageState = ({ kind, title, description, action, icon, rows = 3 }: PageStateProps) => {
    if (kind === 'loading') {
        return (
            <Flex direction="column" aria-busy="true" data-testid="page-state" data-kind={kind}>
                {Array.from({ length: rows }, (_, i) => (
                    <Flex
                        key={i}
                        justify="space-between"
                        align="center"
                        py="14px"
                        borderTopWidth={i ? '1px' : '0'}
                        borderColor="hg.divider"
                        data-testid="page-state-row"
                    >
                        <Flex gap="12px" align="center" flex="1">
                            <Shimmer boxSize="32px" borderRadius="full" flex="none" />
                            <Flex direction="column" gap="6px" flex="1">
                                <Shimmer h="12px" w="45%" />
                                <Shimmer h="10px" w="25%" />
                            </Flex>
                        </Flex>
                        <Shimmer h="32px" w="80px" borderRadius="hg.sm" />
                    </Flex>
                ))}
            </Flex>
        );
    }

    const error = kind === 'error';

    return (
        <Flex
            direction="column"
            align="center"
            textAlign="center"
            gap="10px"
            px="24px"
            py="32px"
            role={error ? 'alert' : undefined}
            data-testid="page-state"
            data-kind={kind}
        >
            <Flex
                as="span"
                aria-hidden
                boxSize="48px"
                align="center"
                justify="center"
                borderRadius="14px"
                borderWidth="1px"
                {...(error
                    ? { bg: 'hg.danger/10', borderColor: 'hg.danger/35', color: 'hg.danger' }
                    : { bg: 'hg.inset', borderColor: 'app.border', color: 'hg.accent' })}
                css={{ '& svg': { width: '22px', height: '22px' } }}
            >
                {icon ?? STATE_ICONS[kind]}
            </Flex>
            {title && <chakra.strong fontSize="17px" color="fg">{title}</chakra.strong>}
            {description && (
                <chakra.span fontSize="14px" lineHeight="1.5" color="fg.muted" maxW="320px">{description}</chakra.span>
            )}
            {action && <Box mt="6px">{action}</Box>}
        </Flex>
    );
};
