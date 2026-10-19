"use client"

import React from 'react'
import { Box, chakra, Flex, Grid, GridItem, VStack } from '@chakra-ui/react'
import { LuArrowLeft } from 'react-icons/lu'
import { HeroGlow, PageContainer } from '@bze/bze-ui-kit'
import { useNavigation } from '@/hooks/useNavigation'
import { useReturnTo } from './return-to'
import { TechTag } from './tech-tag'

interface GuidedFormProps {
    /** Where the back link goes. Default: the return path when there is one, else the home page. */
    backHref?: string;
    backLabel?: string;
    /** The goal, in plain words; one word of it may be a GradientText. */
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** The technical name of the tool, shown under the title (e.g. `tradebin · order-book market`). */
    techTag?: React.ReactNode;
    /** Optional top-right slot, e.g. "Draft saved in this browser". */
    status?: React.ReactNode;
    /** The questions. */
    children: React.ReactNode;
    /** The panels (What will happen, You will pay, the action). */
    aside?: React.ReactNode;
}

/** The content band under a form's hero (also the frame of its success and notice screens). */
export function FormFrame({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
    return (
        <PageContainer as="main" pt={{ base: '16px', md: '28px' }} pb={{ base: '32px', md: '48px' }}>
            {narrow ? <Box maxW="760px" mx="auto">{children}</Box> : children}
        </PageContainer>
    )
}

/**
 * Page layout of a guided form: the hero band (back link, title, tool name), then the questions
 * in the wide column and the 360 px panel column beside them from `lg` up; one column below
 * that, with the panels after the questions. Reads search params (return path), so render it
 * inside a <Suspense> boundary.
 */
export function GuidedForm({ backHref, backLabel, title, subtitle, techTag, status, children, aside }: GuidedFormProps) {
    const { navigate } = useNavigation()
    const returnTo = useReturnTo()

    const href = backHref ?? returnTo?.href ?? '/'
    const label = backLabel ?? (returnTo ? `Back to ${returnTo.label}` : 'What do you want to do?')

    return (
        <>
            <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
                <HeroGlow strength="inner" />
                <PageContainer position="relative" pt={{ base: '12px', md: '24px' }} pb={{ base: '22px', md: '32px' }}>
                    <Flex direction="column" gap="12px">
                        <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
                            <chakra.button
                                type="button"
                                display="inline-flex"
                                alignItems="center"
                                gap="6px"
                                h={{ base: '44px', md: '36px' }}
                                fontSize="14px"
                                fontWeight="600"
                                color="hg.link"
                                bg="transparent"
                                border="0"
                                p="0"
                                cursor="pointer"
                                _hover={{ color: 'hg.link.hover' }}
                                focusVisibleRing="outside"
                                onClick={() => navigate(href)}
                            >
                                <LuArrowLeft size={14} aria-hidden />
                                {label}
                            </chakra.button>
                            {status && <Flex align="center" gap="8px" fontSize="12px" color="hg.text.faint">{status}</Flex>}
                        </Flex>
                        <chakra.h1 m="0" textStyle="pageTitle" fontSize={{ base: '26px', md: '36px' }}>
                            {title}
                        </chakra.h1>
                        {techTag && <TechTag>{techTag}</TechTag>}
                        {subtitle && (
                            <chakra.p m="0" fontSize={{ base: '14px', md: '16px' }} lineHeight="1.6" color="fg.muted" maxW="860px">
                                {subtitle}
                            </chakra.p>
                        )}
                    </Flex>
                </PageContainer>
            </Box>

            <FormFrame>
                <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' }} gap="24px" alignItems="start">
                    <GridItem minW={0}>
                        <VStack align="stretch" gap="12px">{children}</VStack>
                    </GridItem>
                    {aside && (
                        <GridItem as="aside" minW={0} position={{ lg: 'sticky' }} top={{ lg: '96px' }}>
                            <VStack align="stretch" gap="14px">{aside}</VStack>
                        </GridItem>
                    )}
                </Grid>
            </FormFrame>
        </>
    )
}
