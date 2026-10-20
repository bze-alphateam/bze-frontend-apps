'use client';

import { Box, type BoxProps, chakra, Flex, SimpleGrid, type SimpleGridProps, VisuallyHidden } from '@chakra-ui/react';
import type { ReactNode } from 'react';

const cardPadding = { base: '20px', md: '24px' };

export interface HgCardProps extends BoxProps {
    /** The card is a link or button: its hairline turns the app colour on hover and focus. */
    interactive?: boolean;
}

/** The neutral card: card fill, hairline, 16 px radius. */
export const HgCard = ({ interactive, ...props }: HgCardProps) => (
    <Box
        bg="hg.card"
        borderWidth="1px"
        borderColor="hg.hairline"
        borderRadius="hg.lg"
        boxShadow="hg.card"
        p={cardPadding}
        transitionProperty="border-color"
        transitionDuration="moderate"
        data-interactive={interactive ? '' : undefined}
        {...(interactive ? { _hover: { borderColor: 'app.border' }, _focusVisible: { borderColor: 'app.border' } } : {})}
        {...props}
    />
);

/** The one featured card of a page: a 1 px app-gradient edge and a soft glow below. */
export const FeaturedCard = ({ children, ...props }: BoxProps) => (
    <Box p="1px" borderRadius="17px" bgImage="featuredEdge" boxShadow="hg.featured" data-testid="featured-card">
        <Box h="100%" bg="hg.card" borderRadius="hg.lg" p={cardPadding} {...props}>
            {children}
        </Box>
    </Box>
);

export interface ChangeProps {
    /** The signed change; positive is up, negative down, zero flat. */
    value: number;
    /** Formats the absolute value. Default: two decimals and a percent sign. */
    format?: (abs: number) => string;
}

/** A signed change in the data colours: green up, red down, grey flat. */
export const Change = ({ value, format = (abs) => `${abs.toFixed(2)}%` }: ChangeProps) => {
    const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    const mark = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–';

    return (
        <chakra.span
            fontSize="13px"
            fontWeight="600"
            color={`hg.${direction}`}
            whiteSpace="nowrap"
            data-testid="change"
            data-direction={direction}
        >
            <span aria-hidden="true">{mark} </span>
            {direction !== 'flat' && <VisuallyHidden>{direction} </VisuallyHidden>}
            {format(Math.abs(value))}
        </chakra.span>
    );
};

export interface StatCardProps {
    label: ReactNode;
    value: ReactNode;
    /** A signed change shown under the value. */
    change?: number;
    changeFormat?: ChangeProps['format'];
    /** An optional icon, drawn on an inset tile in the app colour. */
    icon?: ReactNode;
    /** Shows shimmer blocks instead of the value. */
    loading?: boolean;
}

/**
 * A label and a number in a plain card. Numbers stay neutral; only the change takes a colour.
 * Below md it shrinks (11 px label, 16 px value, 12 px padding) so three fit in a phone row.
 */
export const StatCard = ({ label, value, change, changeFormat, icon, loading }: StatCardProps) => (
    <Flex
        bg="hg.card"
        borderWidth="1px"
        borderColor="hg.hairline"
        borderRadius={{ base: '14px', md: 'hg.lg' }}
        boxShadow="hg.card"
        px={{ base: '12px', md: '18px' }}
        py={{ base: '12px', md: '16px' }}
        gap="14px"
        align="center"
        minW="0"
        data-testid="stat-card"
        aria-busy={loading || undefined}
    >
        {icon && <IconTile icon={icon} variant="outline" />}
        <Flex direction="column" gap="4px" minW="0">
            <chakra.span fontSize={{ base: '11px', md: '13px' }} color="hg.text.faint">{label}</chakra.span>
            {loading ? (
                <>
                    <Shimmer w="60%" h="22px" />
                    <Shimmer w="35%" h="12px" />
                </>
            ) : (
                <>
                    <chakra.span fontSize={{ base: '16px', md: '22px' }} fontWeight="700" color="fg" data-testid="stat-value">{value}</chakra.span>
                    {change !== undefined && <Change value={change} format={changeFormat} />}
                </>
            )}
        </Flex>
    </Flex>
);

/** Three or four stat cards in one row; a 2-column grid on phones. */
export const StatStrip = ({ children, ...props }: SimpleGridProps) => {
    const count = Array.isArray(children) ? children.filter(Boolean).length : 1;

    return (
        <SimpleGrid columns={{ base: 2, md: Math.min(Math.max(count, 1), 4) }} gap="12px" data-testid="stat-strip" {...props}>
            {children}
        </SimpleGrid>
    );
};

export interface IconTileProps {
    icon: ReactNode;
    /** `filled`: the app gradient; `outline`: an inset tile with an app-colour edge. */
    variant?: 'filled' | 'outline';
    /** Width and height in px. */
    size?: number;
}

/** An icon on a tile: the gradient tile, or the outlined inset tile. */
export const IconTile = ({ icon, variant = 'filled', size = 40 }: IconTileProps) => (
    <Flex
        as="span"
        aria-hidden
        boxSize={`${size}px`}
        flex="none"
        align="center"
        justify="center"
        borderRadius={size <= 24 ? '7px' : 'hg.md'}
        data-testid="icon-tile"
        data-variant={variant}
        {...(variant === 'filled'
            ? { bgImage: 'app', color: 'hg.buttonText' }
            : { bg: 'hg.inset', borderWidth: '1px', borderColor: 'app.border', color: 'hg.accent' })}
        css={{ '& svg': { width: `${Math.round(size * 0.45)}px`, height: `${Math.round(size * 0.45)}px` } }}
    >
        {icon}
    </Flex>
);

/** A skeleton block with the slow shimmer (still when the user prefers reduced motion). */
export const Shimmer = (props: BoxProps) => (
    <Box
        as="span"
        display="block"
        borderRadius="hg.xs"
        bgImage="shimmer"
        bgSize="200% 100%"
        animation="hgShimmer 1.6s linear infinite"
        _motionReduce={{ animation: 'none' }}
        data-testid="shimmer"
        {...props}
    />
);
