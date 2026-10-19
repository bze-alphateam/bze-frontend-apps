'use client';

import { Box, type BoxProps, chakra, type HTMLChakraProps } from '@chakra-ui/react';

/** The page width: 1200 px with 24 px gutters (16 px on phones). */
export const PageContainer = (props: BoxProps) => (
    <Box w="100%" maxW="hg.container" mx="auto" px={{ base: '16px', md: '24px' }} {...props} />
);

export interface HeroGlowProps extends BoxProps {
    /** `home` for home pages, `inner` (half strength) for every other page. */
    strength?: 'home' | 'inner';
}

/**
 * The app-coloured radial glow behind the top of a page. Place it as the first child of a
 * `position: relative` wrapper; it never takes clicks.
 */
export const HeroGlow = ({ strength = 'home', ...props }: HeroGlowProps) => (
    <Box
        aria-hidden
        data-testid="hero-glow"
        data-strength={strength}
        position="absolute"
        top="0"
        insetX="0"
        h="720px"
        bgImage={strength === 'home' ? 'heroGlow' : 'heroGlowInner'}
        bgRepeat="no-repeat"
        pointerEvents="none"
        zIndex="0"
        {...props}
    />
);

/** One word of a hero title in the app gradient. */
export const GradientText = (props: HTMLChakraProps<'span'>) => (
    <chakra.span bgImage="appWord" bgClip="text" color="transparent" css={{ WebkitTextFillColor: 'transparent' }} {...props} />
);
