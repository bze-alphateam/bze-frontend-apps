'use client';

import {Box, chakra, Flex} from '@chakra-ui/react';
import {Eyebrow, HeroGlow, PageContainer} from '@bze/bze-ui-kit';
import type {ReactNode} from 'react';

interface InnerHeroProps {
    title: ReactNode;
    subtitle?: ReactNode;
    /** Before the title, on the eyebrow's line below it (the back link of a proposal page). */
    above?: ReactNode;
    /** On the right, bottom-aligned with the title (the voting power card); under it on phones. */
    aside?: ReactNode;
}

/**
 * The band at the top of an inner Staking page: the half-strength glow, the eyebrow and the
 * 36 px title (the ui-kit `PageHero` type scale), with a card on the right.
 */
export const InnerHero = ({title, subtitle, above, aside}: InnerHeroProps) => (
    <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
        <HeroGlow strength="inner" />
        <PageContainer position="relative" zIndex="1" pt={{base: '32px', md: '44px'}} pb={{base: '28px', md: '36px'}}>
            <Flex justify="space-between" align={{base: 'stretch', md: 'flex-end'}} gap="24px" wrap="wrap" data-testid="page-hero">
                <Flex direction="column" gap="12px" flex="999 1 520px" minW="0">
                    <Eyebrow app="staking" iconSize={24}>BeeZee Staking</Eyebrow>
                    {above}
                    <chakra.h1 m="0" textStyle="pageTitle" fontSize={{base: '28px', md: '36px'}}>{title}</chakra.h1>
                    {subtitle && (
                        <chakra.p m="0" fontSize={{base: '15px', md: '16px'}} lineHeight="1.55" color="fg.muted" maxW="640px">{subtitle}</chakra.p>
                    )}
                </Flex>
                {aside && <Box flex="1 1 300px" maxW={{md: '360px'}} minW="0">{aside}</Box>}
            </Flex>
        </PageContainer>
    </Box>
);
