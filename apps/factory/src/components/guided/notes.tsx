"use client"

import React from 'react'
import { Box, chakra, Flex } from '@chakra-ui/react'
import { LuCircleCheck, LuInfo, LuTriangleAlert } from 'react-icons/lu'

type Tone = 'warning' | 'tip' | 'blocker' | 'good'

const TONES: Record<Tone, { bg: string; edge: string; icon: string; glyph: React.ReactNode; role?: 'alert' }> = {
    warning: { bg: 'hg.warning/8', edge: 'hg.warning/30', icon: 'hg.warning', glyph: <LuTriangleAlert size={16} /> },
    tip: { bg: 'hg.inset', edge: 'hg.lineStrong', icon: 'hg.link', glyph: <LuInfo size={16} /> },
    blocker: { bg: 'hg.danger/8', edge: 'hg.danger/30', icon: 'hg.danger', glyph: <LuTriangleAlert size={16} />, role: 'alert' },
    good: { bg: 'hg.success/8', edge: 'hg.success/30', icon: 'hg.success', glyph: <LuCircleCheck size={16} /> },
}

interface NoteProps {
    /** Bold lead word(s), e.g. "Heads up:". */
    lead?: string;
    children: React.ReactNode;
    /** A link or button under the text ("Add liquidity to it", the DEX link). */
    action?: React.ReactNode;
}

function Note({ lead, children, action, tone }: NoteProps & { tone: Tone }) {
    const t = TONES[tone]
    return (
        <Flex
            role={t.role}
            align="flex-start"
            gap="10px"
            px="14px"
            py="12px"
            borderRadius="hg.md"
            bg={t.bg}
            borderWidth="1px"
            borderColor={t.edge}
            fontSize="14px"
            lineHeight="1.55"
            data-testid={`note-${tone}`}
            data-tone={tone}
        >
            <Box as="span" color={t.icon} mt="3px" flexShrink={0} aria-hidden>{t.glyph}</Box>
            <Flex direction="column" align="flex-start" gap="10px" minW={0}>
                <Box>
                    {lead && <><chakra.strong fontWeight="700">{lead}</chakra.strong>{' '}</>}
                    <chakra.span color={lead ? 'fg.muted' : 'fg'}>{children}</chakra.span>
                </Box>
                {action}
            </Flex>
        </Flex>
    )
}

/** Amber note: what can go wrong or can't be undone. */
export function WarningNote(props: NoteProps) {
    return <Note {...props} tone="warning" />
}

/** Neutral note with the Factory info icon: a helpful hint. */
export function TipNote(props: NoteProps) {
    return <Note {...props} tone="tip" />
}

/** Red note: something stops the form (the pool exists, nobody stakes, a raffle runs). Announced as an alert. */
export function BlockerNote(props: NoteProps) {
    return <Note {...props} tone="blocker" />
}

/** Green note: a check that passed. */
export function GoodNote(props: NoteProps) {
    return <Note {...props} tone="good" />
}
