'use client';

import {Box, chakra, Flex, Table} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {HgCard} from '@bze/bze-ui-kit';

interface SectionHeaderProps {
    title: ReactNode;
    /** A pill after the title ("3 coins", "Last 30 victims"). */
    tag?: ReactNode;
    /** On the right: a link or buttons. */
    actions?: ReactNode;
    id?: string;
}

/** A section's title row: 22 px title (20 px on phones), a pill, actions on the right. */
export const SectionHeader = ({title, tag, actions, id}: SectionHeaderProps) => (
    <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
        <Flex align="center" gap="12px" wrap="wrap">
            <chakra.h2 id={id} m="0" fontSize={{base: '20px', md: '22px'}} fontWeight="700">{title}</chakra.h2>
            {tag}
        </Flex>
        {actions && <Flex gap="10px" align="center" wrap="wrap">{actions}</Flex>}
    </Flex>
);

/** The app-tinted pill: counts, "All time", "Never coming back". */
export const AppPill = ({children}: {children: ReactNode}) => (
    <chakra.span
        display="inline-flex"
        alignItems="center"
        fontSize="12px"
        fontWeight="600"
        px="10px"
        py="3px"
        borderRadius="hg.pill"
        whiteSpace="nowrap"
        color="hg.link"
        bg="app.subtle"
        borderWidth="1px"
        borderColor="app.border"
        data-testid="app-pill"
    >
        {children}
    </chakra.span>
);

/** The soft app button (Join on a card, secondary app actions): app tint, app edge, link text. */
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

/** An amount in the app's warm text colour (burned, locked, ready to burn). */
export const emberAmount = {color: 'hg.link', fontWeight: '700'};

/** A card holding a table: no padding, clipped corners, the table scrolls on its own. */
export const TableCard = ({children}: {children: ReactNode}) => (
    <Box bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="hg.lg" boxShadow="hg.card" overflow="hidden">
        {children}
    </Box>
);

/** The table's header cell: 11 px capitals on the header fill. */
export const HeaderCell = ({children, end}: {children: ReactNode; end?: boolean}) => (
    <Table.ColumnHeader
        px="20px"
        py="12px"
        bg="hg.cardHeader"
        textAlign={end ? 'end' : 'start'}
        fontSize="11px"
        letterSpacing="0.08em"
        textTransform="uppercase"
        fontWeight="700"
        color="hg.text.faint"
        borderColor="hg.divider"
    >
        {children}
    </Table.ColumnHeader>
);

/** A table cell with the shared padding and divider. */
export const BodyCell = ({children, end}: {children?: ReactNode; end?: boolean}) => (
    <Table.Cell px="20px" py="14px" textAlign={end ? 'end' : 'start'} borderColor="hg.divider">
        {children}
    </Table.Cell>
);

/** A clickable table row (it opens the coin page). */
export const rowLink = {
    cursor: 'pointer',
    bg: 'transparent',
    _hover: {bg: 'hg.hoverFill'},
    transition: 'background 0.15s',
};

/** A stacked phone row, below 768 px. */
export const stackedRow = {
    px: '16px',
    py: '14px',
    cursor: 'pointer',
    borderColor: 'hg.divider',
    _hover: {bg: 'hg.hoverFill'},
};

interface BurnStatProps {
    label: ReactNode;
    value: ReactNode;
    /** Under the value, on the left: the USD value or a count. */
    foot?: ReactNode;
    /** Under the value, on the right: a pill. */
    tag?: ReactNode;
}

/** A stat tile: label, a 28 px number, then a muted line with a pill (burned, locked, next burning). */
export const BurnStat = ({label, value, foot, tag}: BurnStatProps) => (
    <HgCard px="20px" py="18px" display="flex" flexDirection="column" gap="6px" minW="0" data-testid="burn-stat">
        <chakra.span fontSize="14px" color="hg.text.secondary">{label}</chakra.span>
        <chakra.span fontSize={{base: '24px', md: '28px'}} fontWeight="800" letterSpacing="-0.01em" color="fg" overflowWrap="anywhere">
            {value}
        </chakra.span>
        {(foot || tag) && (
            <Flex justify="space-between" align="center" gap="8px" fontSize="13px" color="hg.text.faint" minH="24px">
                <span>{foot}</span>
                {tag}
            </Flex>
        )}
    </HgCard>
);
