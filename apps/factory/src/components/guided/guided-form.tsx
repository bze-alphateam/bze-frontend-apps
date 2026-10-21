"use client"

import React from 'react'
import { Box, chakra, Flex, Grid, GridItem, VStack } from '@chakra-ui/react'
import { PageContainer } from '@bze/bze-ui-kit'
import { useNavigation } from '@/hooks/useNavigation'
import { useReturnTo } from './return-to'
import { TechTag } from './tech-tag'

interface GuidedFormProps {
    /**
     * The first breadcrumb: the return path when there is one ("<TICKER>"), else "Create" (the
     * home page). Pages that live under something else pass their own.
     */
    parent?: { href: string; label: string };
    /** The thing the wizard makes, the last breadcrumb ("Token", "Liquidity pool"). */
    crumb?: string;
    /** The goal, in plain words; one word of it may be a GradientText. */
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** The technical name of the tool, shown under the title (e.g. `tradebin · order-book market`). */
    techTag?: React.ReactNode;
    /** Optional top-right slot, e.g. "Draft saved in this browser". */
    status?: React.ReactNode;
    /** The steps. */
    children: React.ReactNode;
    /** The panels (What will happen, You will pay, the action). */
    aside?: React.ReactNode;
}

/** The content band of a form (also the frame of its success and notice screens). */
export function FormFrame({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
    return (
        <PageContainer as="main" pt={{ base: '16px', md: '28px' }} pb={{ base: '32px', md: '48px' }}>
            {narrow ? <Box maxW="760px" mx="auto">{children}</Box> : children}
        </PageContainer>
    )
}

/**
 * Page layout of a wizard: the breadcrumb ("Create / <Thing>", or "<TICKER> / <Thing>" when
 * opened with a return path) and the h1, then the steps in the wide column and the 360 px panel
 * column beside them, sticky, from `lg` up; one column below that, with the panels after the
 * steps. Reads search params (return path), so render it inside a <Suspense> boundary.
 */
export function GuidedForm({ parent, crumb, title, subtitle, techTag, status, children, aside }: GuidedFormProps) {
    const { navigate } = useNavigation()
    const returnTo = useReturnTo()

    const first = parent ?? (returnTo ? { href: returnTo.href, label: returnTo.label } : { href: '/', label: 'Create' })

    return (
        <FormFrame>
            <Flex direction="column" gap="8px" mb={{ base: '18px', md: '26px' }}>
                <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
                    <chakra.nav aria-label="Breadcrumb">
                        <chakra.ol display="flex" alignItems="center" flexWrap="wrap" gap="6px" m="0" p="0" listStyleType="none" fontSize="14px">
                            <chakra.li display="inline-flex">
                                <chakra.button
                                    type="button"
                                    display="inline-flex"
                                    alignItems="center"
                                    minH={{ base: '44px', md: '28px' }}
                                    fontSize="14px"
                                    fontWeight="600"
                                    color="hg.link"
                                    bg="transparent"
                                    border="0"
                                    p="0"
                                    cursor="pointer"
                                    _hover={{ color: 'hg.link.hover' }}
                                    focusVisibleRing="outside"
                                    aria-label={`Back to ${first.label}`}
                                    onClick={() => navigate(first.href)}
                                >
                                    {first.label}
                                </chakra.button>
                            </chakra.li>
                            {crumb && (
                                <chakra.li display="inline-flex" alignItems="center" gap="6px" color="fg.muted">
                                    <chakra.span aria-hidden color="hg.text.faint">/</chakra.span>
                                    <chakra.span aria-current="page">{crumb}</chakra.span>
                                </chakra.li>
                            )}
                        </chakra.ol>
                    </chakra.nav>
                    {status && <Flex align="center" gap="8px" fontSize="12px" color="hg.text.faint">{status}</Flex>}
                </Flex>
                <chakra.h1 m="0" textStyle="pageTitle" fontSize={{ base: '26px', md: '34px' }}>
                    {title}
                </chakra.h1>
                {techTag && <TechTag>{techTag}</TechTag>}
                {subtitle && (
                    <chakra.p m="0" fontSize={{ base: '14px', md: '16px' }} lineHeight="1.6" color="fg.muted" maxW="860px">
                        {subtitle}
                    </chakra.p>
                )}
            </Flex>

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
    )
}
