"use client"

import React from 'react'
import { Box, Button, Grid, GridItem, HStack, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft } from 'react-icons/lu'
import { useNavigation } from '@/hooks/useNavigation'
import { useReturnTo } from './return-to'
import { TechTag } from './tech-tag'

interface GuidedFormProps {
    /** Where the back link goes. Default: the return path when there is one, else the home page. */
    backHref?: string;
    backLabel?: string;
    /** The goal, in plain words. */
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** The technical name of the tool, shown next to the title (e.g. `tradebin · order-book market`). */
    techTag?: React.ReactNode;
    /** Optional top-right slot, e.g. "Draft saved in this browser". */
    status?: React.ReactNode;
    /** The questions. */
    children: React.ReactNode;
    /** The panels (What will happen, You will pay, the action). */
    aside?: React.ReactNode;
}

/**
 * Page layout of a guided form: questions in the wide column and the panels beside them
 * from `lg` up; one column below that, with the panels after the questions.
 * Reads search params (return path), so render it inside a <Suspense> boundary.
 */
export function GuidedForm({ backHref, backLabel, title, subtitle, techTag, status, children, aside }: GuidedFormProps) {
    const { navigate } = useNavigation()
    const returnTo = useReturnTo()

    const href = backHref ?? returnTo?.href ?? '/'
    const label = backLabel ?? (returnTo ? `Back to ${returnTo.label}` : 'What do you want to do?')

    return (
        <VStack align="stretch" gap={6}>
            <HStack justify="space-between" gap={3} wrap="wrap">
                <Button variant="ghost" colorPalette="yellow" size="sm" ml={-2} onClick={() => navigate(href)}>
                    <LuArrowLeft />
                    {label}
                </Button>
                {status && <Box fontSize="xs" color="fg.muted">{status}</Box>}
            </HStack>

            <VStack align="start" gap={1}>
                <Text as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" letterSpacing="tight">
                    {title}
                </Text>
                {techTag && <TechTag>{techTag}</TechTag>}
                {subtitle && (
                    <Text fontSize={{ base: 'sm', md: 'md' }} color="fg.muted">
                        {subtitle}
                    </Text>
                )}
            </VStack>

            <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }} gap={6} alignItems="start">
                <GridItem minW={0}>
                    <VStack align="stretch" gap={3}>{children}</VStack>
                </GridItem>
                {aside && (
                    <GridItem minW={0} position={{ lg: 'sticky' }} top={{ lg: 6 }}>
                        <VStack align="stretch" gap={4}>{aside}</VStack>
                    </GridItem>
                )}
            </Grid>
        </VStack>
    )
}
