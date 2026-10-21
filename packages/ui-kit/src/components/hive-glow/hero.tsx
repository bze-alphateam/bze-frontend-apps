'use client';

import { Box, chakra, Flex } from '@chakra-ui/react';
import type { ReactNode } from 'react';

import type { AppKey } from '../../constants/app-identity';
import { AppIcon } from '../app-identity/app-icon';

export interface EyebrowProps {
    app: AppKey;
    /** The app's name: "BeeZee DEX". */
    children: ReactNode;
    /** Icon size in px: 32 on home pages, 24 on inner pages. */
    iconSize?: number;
}

/** The app icon and its name, in capitals in the eyebrow colour. */
export const Eyebrow = ({ app, children, iconSize = 32 }: EyebrowProps) => (
    <Flex align="center" gap={iconSize > 24 ? '10px' : '8px'} data-testid="eyebrow">
        <AppIcon app={app} size={iconSize} />
        <chakra.span textStyle="eyebrow" color="hg.eyebrow" textAlign="start">{children}</chakra.span>
    </Flex>
);

export interface HomeHeroProps {
    eyebrow?: ReactNode;
    /** The title; wrap its one gradient word in `GradientText`. */
    title: ReactNode;
    subtitle?: ReactNode;
    primaryAction?: ReactNode;
    secondaryAction?: ReactNode;
    /** Content under the actions, e.g. a `StatStrip`. */
    children?: ReactNode;
    align?: 'left' | 'center';
}

/** The home page hero: eyebrow, 52 px title, 18 px subtitle, primary and secondary actions. */
export const HomeHero = ({ eyebrow, title, subtitle, primaryAction, secondaryAction, children, align = 'left' }: HomeHeroProps) => {
    const centered = align === 'center';
    const hasActions = primaryAction || secondaryAction;

    return (
        <Flex
            direction="column"
            gap="22px"
            align={centered ? 'center' : 'flex-start'}
            textAlign={centered ? 'center' : 'start'}
            data-testid="home-hero"
            data-align={align}
        >
            {eyebrow}
            <chakra.h1 m="0" textStyle="hero" fontSize={{ base: '38px', md: '52px' }}>{title}</chakra.h1>
            {subtitle && (
                <chakra.p m="0" textStyle="subtitle" color="fg.muted" maxW="560px">{subtitle}</chakra.p>
            )}
            {hasActions && (
                <Flex gap="12px" wrap="wrap" justify={centered ? 'center' : 'flex-start'} data-testid="home-hero-actions">
                    {primaryAction}
                    {secondaryAction}
                </Flex>
            )}
            {children && <Box w="100%" mt="6px">{children}</Box>}
        </Flex>
    );
};

export interface PageHeroProps {
    eyebrow?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    /** Buttons on the right; they wrap under the title on phones. */
    actions?: ReactNode;
}

/** The compact hero of every inner page: a 36 px title and no gradient word. */
export const PageHero = ({ eyebrow, title, subtitle, actions }: PageHeroProps) => (
    <Flex justify="space-between" align="flex-end" gap="24px" wrap="wrap" data-testid="page-hero">
        <Flex direction="column" gap="12px" minW="0">
            {eyebrow}
            <chakra.h1 m="0" textStyle="pageTitle" fontSize={{ base: '28px', md: '36px' }}>{title}</chakra.h1>
            {subtitle && (
                <chakra.p m="0" textStyle="body" color="fg.muted" maxW="560px">{subtitle}</chakra.p>
            )}
        </Flex>
        {actions && <Flex gap="10px" wrap="wrap" data-testid="page-hero-actions">{actions}</Flex>}
    </Flex>
);
