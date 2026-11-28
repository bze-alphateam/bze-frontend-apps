'use client';

import type {ReactNode} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {LuCircleCheck, LuInfo, LuTriangleAlert} from 'react-icons/lu';
import type {PageTone} from '@/lib/proposal-view';

// The proposal page's own building blocks, drawn to its boards (E2–E7): the card, the pill in the DAO accent
// or a status colour, the tinted note, label / value rows and the option swatch. Colours are theme tokens.

/** A titled card: 16 px radius, 22 × 24 padding (16 on a phone), 17 px heading. */
export const Card = ({id, title, aside, testId, gap = '16px', children}: {id: string; title: ReactNode; aside?: ReactNode; testId: string; gap?: string; children: ReactNode}) => (
    <chakra.section
        aria-labelledby={`${id}-title`}
        data-testid={testId}
        bg="hg.card"
        borderWidth="1px"
        borderColor="hg.hairline"
        borderRadius="16px"
        px={{base: '16px', md: '24px'}}
        py={{base: '16px', md: '22px'}}
        display="flex"
        flexDirection="column"
        gap={{base: gap === '16px' ? '14px' : gap, md: gap}}
        minW="0"
    >
        <Flex gap="16px" align="center" justify="space-between" wrap="wrap">
            <chakra.h2 id={`${id}-title`} m="0" fontSize="17px" fontWeight="700">{title}</chakra.h2>
            {aside}
        </Flex>
        {children}
    </chakra.section>
);

/** The small caption on the right of a card heading. */
export const Caption = ({children}: {children: ReactNode}) => <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint">{children}</chakra.span>;

const PILL: Record<PageTone, {color: string; bg: string; border: string}> = {
    accent: {color: 'hg.link.hover', bg: 'hg.accent/14', border: 'hg.accent/40'},
    success: {color: 'hg.success.text', bg: 'hg.success/12', border: 'hg.success/38'},
    warning: {color: 'hg.warning.text', bg: 'hg.warning/12', border: 'hg.warning/38'},
    danger: {color: 'hg.danger.text', bg: 'hg.danger/12', border: 'hg.danger/38'},
    neutral: {color: 'hg.text.secondary', bg: 'hg.inset', border: 'hg.hairline'},
};

/** A pill (B1 Shared): 12 px / 600, 3 × 9 padding, the live dot for a state still in flight. */
export const Pill = ({tone, live, testId, children}: {tone: PageTone; live?: boolean; testId?: string; children: ReactNode}) => {
    const c = PILL[tone];
    return (
        <chakra.span
            display="inline-flex"
            alignItems="center"
            gap="6px"
            fontSize="12px"
            fontWeight="600"
            px="9px"
            py="3px"
            borderRadius="999px"
            whiteSpace="nowrap"
            color={c.color}
            bg={c.bg}
            borderWidth="1px"
            borderColor={c.border}
            data-testid={testId}
            data-tone={tone}
        >
            {live && <chakra.span aria-hidden boxSize="6px" borderRadius="999px" flex="none" bg="currentColor" />}
            {children}
        </chakra.span>
    );
};

const NOTE: Record<PageTone, {bg: string; border: string; icon: string}> = {
    accent: {bg: 'hg.accent/8', border: 'hg.accent/30', icon: 'hg.link.hover'},
    success: {bg: 'hg.success/8', border: 'hg.success/30', icon: 'hg.success.text'},
    warning: {bg: 'hg.warning/8', border: 'hg.warning/30', icon: 'hg.warning.text'},
    danger: {bg: 'hg.danger/8', border: 'hg.danger/30', icon: 'hg.danger.text'},
    neutral: {bg: 'hg.inset', border: 'hg.hairline', icon: 'fg.muted'},
};

const NOTE_ICON: Record<PageTone, ReactNode> = {
    accent: <LuInfo size={16} />,
    success: <LuCircleCheck size={16} />,
    warning: <LuTriangleAlert size={16} />,
    danger: <LuTriangleAlert size={16} />,
    neutral: <LuInfo size={16} />,
};

/** A tinted note (role="note"): icon, an optional bold title, the text, and an optional action on the right. */
export const Note = ({tone, title, children, action, icon, testId}: {tone: PageTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: ReactNode; testId?: string}) => {
    const c = NOTE[tone];
    return (
        <Flex role="note" gap="12px" align="flex-start" px="14px" py="12px" borderRadius="12px" bg={c.bg} borderWidth="1px" borderColor={c.border} wrap={{base: 'wrap', md: 'nowrap'}} data-testid={testId} data-tone={tone}>
            <chakra.span aria-hidden flex="none" mt="2px" color={c.icon}>{icon ?? NOTE_ICON[tone]}</chakra.span>
            <Flex direction="column" gap="2px" fontSize="14px" lineHeight="1.5" color="hg.text.secondary" minW="0" flex="1">
                {title && <chakra.strong fontSize="14px" color="fg">{title}</chakra.strong>}
                {children && <span>{children}</span>}
            </Flex>
            {action && <chakra.span ms={{md: 'auto'}} flex="none">{action}</chakra.span>}
        </Flex>
    );
};

/** Label / value rows with a hairline between them (the Deposit and cost card, the dialogs). */
export const Rows = ({rows, labelWidth = '140px', size = '14px', py = '12px'}: {rows: {label: ReactNode; value: ReactNode; testId?: string}[]; labelWidth?: string; size?: string; py?: string}) => (
    <chakra.dl m="0" display="flex" flexDirection="column">
        {rows.map((r, i) => (
            <chakra.div key={i} display="grid" gridTemplateColumns={`${labelWidth} 1fr`} gap="16px" py={py} borderTopWidth={i === 0 ? '0' : '1px'} borderColor="hg.divider" data-testid={r.testId}>
                <chakra.dt fontSize={size} color="fg.muted">{r.label}</chakra.dt>
                <chakra.dd m="0" fontSize={size} lineHeight="1.5" color="fg" minW="0" overflowWrap="anywhere">{r.value}</chakra.dd>
            </chakra.div>
        ))}
    </chakra.dl>
);

export const OPTION_COLOR = {YES: 'hg.up', NO: 'hg.down', ABSTAIN: 'hg.flat'} as const;
export const OPTION_TONE = {YES: 'success', NO: 'danger', ABSTAIN: 'neutral'} as const;

/** The 10 px square of an option's colour. */
export const Swatch = ({option}: {option: keyof typeof OPTION_COLOR}) => <chakra.span aria-hidden boxSize="10px" borderRadius="3px" flex="none" bg={OPTION_COLOR[option]} />;

/** The faint 12 px line under a block. */
export const Small = ({children, testId, center}: {children: ReactNode; testId?: string; center?: boolean}) => (
    <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" textAlign={center ? 'center' : undefined} data-testid={testId}>{children}</chakra.span>
);
