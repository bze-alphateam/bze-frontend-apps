'use client';

import {Box} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {Eyebrow, HeroGlow, PageContainer, PageHero} from '@bze/bze-ui-kit';

interface InnerHeroProps {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
}

/** The top of an inner page: the half-strength glow, the 24 px eyebrow, a 36 px title, a divider under it. */
export const InnerHero = ({title, subtitle, actions}: InnerHeroProps) => (
    <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
        <HeroGlow strength="inner"/>
        <PageContainer position="relative" pt={{base: '32px', md: '44px'}} pb={{base: '28px', md: '36px'}}>
            <PageHero
                eyebrow={<Eyebrow app="burner" iconSize={24}>BeeZee Burner</Eyebrow>}
                title={title}
                subtitle={subtitle}
                actions={actions}
            />
        </PageContainer>
    </Box>
);
