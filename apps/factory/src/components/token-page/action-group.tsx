"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { type Asset, HgCard, Shimmer, hgVariant } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
import type { ReturnTo } from '@/components/guided/return-to'
import type { AdminState, TokenSection } from '@/lib/workspace'

/** The admin as the page knows it: 'checking' while the live query runs. */
export type AdminAccess = AdminState | 'checking'

/** What every action group of the token page gets. */
export interface GroupProps {
    asset: Asset;
    access: AdminAccess;
    /** The way back to this page, for every wizard a group opens. */
    back: ReturnTo;
}

/** One group card (canvas D2): a title, a one-line description, then its items. */
export function ActionGroup({ id, title, description, children }: {
    id: TokenSection;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <Box as="section" id={id} aria-label={title} scrollMarginTop="96px" minW={0}>
            <HgCard px={{ base: '18px', md: '22px' }} pt="20px" pb="8px" h="full">
                <Text as="h2" fontSize="18px" fontWeight="700">{title}</Text>
                <Text fontSize="14px" color="fg.muted" mt="4px" mb="8px">{description}</Text>
                <VStack align="stretch" gap="0">{children}</VStack>
            </HgCard>
        </Box>
    )
}

/** One item of a group: what it is, one line about it, and its button. `children` open below it. */
export function ActionItem({ title, line, action, testId, children }: {
    title: React.ReactNode;
    line?: React.ReactNode;
    action?: React.ReactNode;
    testId?: string;
    children?: React.ReactNode;
}) {
    return (
        <Box py="14px" borderTopWidth="1px" borderColor="hg.divider" data-testid={testId}>
            <HStack justify="space-between" align="center" gap="14px" flexWrap="wrap">
                <VStack align="start" gap="3px" minW={0} flex="1 1 200px">
                    <Text as="strong" fontSize="15px" fontWeight="700">{title}</Text>
                    {line && <Box fontSize="13px" lineHeight="1.45" color="fg.muted" wordBreak="break-word">{line}</Box>}
                </VStack>
                {action && <Box flexShrink={0}>{action}</Box>}
            </HStack>
            {children && <Box mt="14px">{children}</Box>}
        </Box>
    )
}

const itemButton = { size: 'sm' as const, h: '36px', px: '14px', fontSize: '13px' }

/** An item's button to another Factory page: gold when it is the group's primary item. */
export function ItemLink({ href, primary = false, children }: { href: string; primary?: boolean; children: React.ReactNode }) {
    return (
        <Button asChild {...(primary ? { variant: hgVariant('primary'), borderRadius: '10px' } : softButton)} {...itemButton}>
            <NextLink href={href}>{children}</NextLink>
        </Button>
    )
}

/** An item's button that acts on the page (opens a form below it). */
export function ItemButton({ onClick, primary = false, disabled, children, ...rest }: {
    onClick: () => void;
    primary?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    'aria-expanded'?: boolean;
}) {
    return (
        <Button
            {...(primary ? { variant: hgVariant('primary'), borderRadius: '10px' } : softButton)}
            {...itemButton}
            onClick={onClick}
            disabled={disabled}
            {...rest}
        >
            {children}
        </Button>
    )
}

/** Where an admin-only item goes while the admin query runs. */
export function AdminItemShimmer({ testId }: { testId?: string }) {
    return (
        <Box py="14px" borderTopWidth="1px" borderColor="hg.divider" aria-busy="true" data-testid={testId ?? 'admin-item-loading'}>
            <Shimmer h="16px" w="128px" />
            <Shimmer h="12px" w="224px" mt="8px" />
        </Box>
    )
}
