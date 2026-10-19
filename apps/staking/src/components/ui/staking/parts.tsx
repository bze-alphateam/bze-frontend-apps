'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {ReactNode} from 'react';

/** The Staking soft button (Stake, Delegate, Claim): app tint, app edge, link text. */
export const softButton = {
    variant: 'outline' as const,
    color: 'hg.link',
    borderColor: 'app.border',
    bg: 'app.subtle',
    borderRadius: 'hg.sm',
    fontWeight: '600',
    _hover: {bg: 'app.muted'},
    _disabled: {opacity: 0.5},
};

/** The neutral outline (Undelegate, Redelegate): no app colour. */
export const neutralButton = {
    variant: 'outline' as const,
    color: 'fg',
    borderColor: 'hg.lineStrong',
    bg: 'hg.secondaryFill',
    borderRadius: 'hg.sm',
    fontWeight: '600',
    _hover: {bg: 'hg.hoverFill'},
    _disabled: {opacity: 0.5},
};

/** A quiet text button next to a section title (Refresh). */
export const quietButton = {
    variant: 'ghost' as const,
    color: 'hg.text.secondary',
    fontWeight: '600',
    _hover: {bg: 'hg.hoverFill', color: 'fg'},
};

interface SectionHeaderProps {
    title: ReactNode;
    /** A pill or count after the title. */
    tag?: ReactNode;
    /** Buttons on the right. */
    actions?: ReactNode;
}

/** A dashboard section's title row: 22 px title (20 px on phones), actions on the right. */
export const SectionHeader = ({title, tag, actions}: SectionHeaderProps) => (
    <Flex justify="space-between" align="center" gap="16px" wrap="wrap">
        <chakra.h2 m="0" fontSize={{base: '20px', md: '22px'}} fontWeight="700" display="flex" alignItems="center" gap="10px">
            {title}
            {tag}
        </chakra.h2>
        {actions && <Flex gap="10px" align="center" wrap="wrap">{actions}</Flex>}
    </Flex>
);

/** A label and value row inside a card. */
export const InfoRow = ({label, children}: {label: ReactNode; children: ReactNode}) => (
    <Flex justify="space-between" align="center" gap="12px" fontSize="13px">
        <chakra.span color="hg.text.faint">{label}</chakra.span>
        <chakra.span color="fg" textAlign="end" minW="0">{children}</chakra.span>
    </Flex>
);

/** The validator cards' grid: one column on phones, 320 px cards and up on wider screens. */
export const cardsGrid = {templateColumns: {base: 'minmax(0, 1fr)', md: 'repeat(auto-fill, minmax(320px, 1fr))'}, gap: {base: '12px', md: '16px'}};
