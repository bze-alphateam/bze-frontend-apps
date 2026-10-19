"use client"

import React from 'react'
import { Box, chakra, Flex } from '@chakra-ui/react'
import { LuArrowLeft } from 'react-icons/lu'
import { Eyebrow, HeroGlow, PageContainer, PageHero } from '@bze/bze-ui-kit'

interface InnerHeroProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** The eyebrow text next to the Factory icon. */
    eyebrow?: React.ReactNode;
    /** A quiet link above the eyebrow, back to where the page was opened from. */
    back?: { label: React.ReactNode; onClick: () => void };
    /** A muted line under the subtitle (step count, time). */
    meta?: React.ReactNode;
    /** Buttons on the right; they wrap under the title on phones. */
    actions?: React.ReactNode;
    /** Content under the title inside the hero band (the workspace header's facts). */
    children?: React.ReactNode;
}

/** The top of an inner Factory page: the half-strength glow, the 24 px eyebrow, a 36 px title and a divider under it. */
export function InnerHero({ title, subtitle, eyebrow = 'BeeZee Factory', back, meta, actions, children }: InnerHeroProps) {
    return (
        <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
            <HeroGlow strength="inner" />
            <PageContainer position="relative" pt={{ base: '24px', md: '28px' }} pb={{ base: '28px', md: '36px' }}>
                <Flex direction="column" gap="14px">
                    {back && (
                        <chakra.button
                            type="button"
                            alignSelf="flex-start"
                            display="inline-flex"
                            alignItems="center"
                            gap="6px"
                            fontSize="14px"
                            color="fg.muted"
                            bg="transparent"
                            border="0"
                            p="0"
                            cursor="pointer"
                            _hover={{ color: 'fg' }}
                            focusVisibleRing="outside"
                            onClick={back.onClick}
                        >
                            <LuArrowLeft size={14} aria-hidden /> {back.label}
                        </chakra.button>
                    )}
                    <PageHero
                        eyebrow={<Eyebrow app="factory" iconSize={24}>{eyebrow}</Eyebrow>}
                        title={title}
                        subtitle={subtitle}
                        actions={actions}
                    />
                    {meta && (
                        <Flex gap="10px" wrap="wrap" fontSize="14px" color="fg.muted">{meta}</Flex>
                    )}
                    {children}
                </Flex>
            </PageContainer>
        </Box>
    )
}
