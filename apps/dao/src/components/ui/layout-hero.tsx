'use client';

import {Box, chakra, Flex} from '@chakra-ui/react';
import {Eyebrow, HeroGlow, PageContainer} from '@bze/bze-ui-kit';
import type {ReactNode} from 'react';

/** The band at the top of a DAO page: the half-strength glow, the eyebrow, the title and a line under it. */
export const InnerHero = ({title, subtitle}: {title: ReactNode; subtitle?: ReactNode}) => (
    <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
        <HeroGlow strength="inner" />
        <PageContainer position="relative" zIndex="1" pt={{base: '32px', md: '44px'}} pb={{base: '28px', md: '36px'}}>
            <Flex direction="column" gap="12px" data-testid="page-hero">
                <Eyebrow app="dao" iconSize={24}>BeeZee DAO</Eyebrow>
                <chakra.h1 m="0" textStyle="pageTitle" fontSize={{base: '28px', md: '36px'}}>{title}</chakra.h1>
                {subtitle && (
                    <chakra.p m="0" fontSize={{base: '15px', md: '16px'}} lineHeight="1.55" color="fg.muted" maxW="640px">{subtitle}</chakra.p>
                )}
            </Flex>
        </PageContainer>
    </Box>
);
