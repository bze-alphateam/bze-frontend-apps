"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, Button, chakra, Flex, Grid, HStack, IconButton, LinkBox, LinkOverlay, Text, VStack } from '@chakra-ui/react'
import { LuChevronRight, LuCopy, LuRefreshCw } from 'react-icons/lu'
import { Shimmer, StatusPill, TokenLogo, prettyAmount, uAmountToBigNumberAmount, useToast } from '@bze/bze-ui-kit'
import { workspaceHref } from '@/lib/workspace'
import { AdminBadge, TokenRow, shortFactoryDenom, stakeText } from '@/lib/tokens-directory'

function AdminPill({ badge, onRetry }: { badge: AdminBadge; onRetry: () => void }) {
    if (badge.kind === 'checking') {
        return <Text fontSize="12px" color="hg.text.faint" data-testid="admin-badge" data-kind={badge.kind}>{badge.label}</Text>
    }
    if (badge.kind === 'error') {
        return (
            <HStack gap="6px" data-testid="admin-badge" data-kind={badge.kind} position="relative" zIndex={1}>
                <Text fontSize="12px" color="hg.text.secondary">{badge.label}</Text>
                <Button size="2xs" variant="ghost" color="hg.link" fontWeight="600" onClick={onRetry}>
                    <LuRefreshCw /> Retry
                </Button>
            </HStack>
        )
    }
    if (badge.kind === 'you') {
        // The app's gold, like a selected tab's count.
        return (
            <chakra.span
                fontSize="12px"
                fontWeight="700"
                px="10px"
                py="4px"
                borderRadius="hg.pill"
                color="hg.link"
                bg="app.subtle"
                whiteSpace="nowrap"
                data-testid="admin-badge"
                data-kind={badge.kind}
            >
                {badge.label}
            </chakra.span>
        )
    }
    return (
        <Box data-testid="admin-badge" data-kind={badge.kind} title={badge.kind === 'renounced' ? 'Nobody can mint, burn or change the profile any more.' : undefined}>
            <StatusPill tone="neutral">{badge.label}</StatusPill>
        </Box>
    )
}

export interface TokenDirectoryRowProps {
    row: TokenRow;
    /** "Created by you" rows: the admin badge in place of the staking state. */
    admin?: { badge: AdminBadge; onRetry: () => void };
    /** Earlier pages stay on phones ("Show 20 more" adds to the list) but leave the desktop table. */
    phoneOnly?: boolean;
    /** True while the denom rewards load. */
    isStakeLoading?: boolean;
}

/** One token of the directory; the whole row opens the token page. */
export function TokenDirectoryRow({ row, admin, phoneOnly = false, isStakeLoading = false }: TokenDirectoryRowProps) {
    const { asset } = row
    const { toast } = useToast()
    const fixed = admin?.badge.kind === 'renounced'
    const supply = `${prettyAmount(uAmountToBigNumberAmount(asset.supply, asset.decimals))} ${asset.ticker}${fixed ? ' · fixed' : ''}`

    const copyDenom = async () => {
        await navigator.clipboard.writeText(asset.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    return (
        <LinkBox
            as="li"
            listStyleType="none"
            display={phoneOnly ? { base: 'block', md: 'none' } : 'block'}
            bg="hg.card"
            borderWidth="1px"
            borderColor="hg.hairline"
            borderRadius="hg.lg"
            px={{ base: '16px', md: '20px' }}
            py="14px"
            _hover={{ bg: 'hg.hoverFill' }}
            data-testid={admin ? 'my-token-row' : 'token-row'}
            data-denom={asset.denom}
            data-phone-only={phoneOnly || undefined}
        >
            <Grid
                templateColumns={{ base: '40px minmax(0, 1fr) 20px', md: '40px minmax(0, 1fr) 200px 220px 20px' }}
                columnGap="14px"
                rowGap="10px"
                alignItems="center"
            >
                <TokenLogo src={asset.logo} symbol={asset.ticker} size="10" circular={true} />
                <VStack align="start" gap="2px" minW={0}>
                    <HStack gap="8px" minW={0} maxW="full" flexWrap="wrap">
                        <LinkOverlay asChild>
                            <NextLink href={workspaceHref(asset.denom)}>
                                <Text as="span" fontSize="15px" fontWeight="700" wordBreak="break-word">
                                    {`${asset.name} · ${asset.ticker}`}
                                </Text>
                            </NextLink>
                        </LinkOverlay>
                        {asset.halted && <StatusPill tone="danger">Halted</StatusPill>}
                    </HStack>
                    <HStack gap="4px" minW={0} maxW="full">
                        <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" truncate title={asset.denom}>
                            {shortFactoryDenom(asset.denom)}
                        </Text>
                        <IconButton
                            aria-label={`Copy the denom of ${asset.ticker}`}
                            size="2xs"
                            variant="ghost"
                            color="hg.link"
                            position="relative"
                            zIndex={1}
                            onClick={copyDenom}
                        >
                            <LuCopy />
                        </IconButton>
                    </HStack>
                </VStack>
                {/* Supply and state: their own columns on desktop, a second line under the name on phones. */}
                <Flex
                    display={{ base: 'flex', md: 'contents' }}
                    direction="column"
                    align="start"
                    gap="6px"
                    gridColumn={{ base: '2 / 4', md: 'auto' }}
                    gridRow={{ base: '2', md: 'auto' }}
                    minW={0}
                >
                    <Text fontSize={{ base: '13px', md: '14px' }} color="fg.muted" data-testid="token-supply">{supply}</Text>
                    <Box minW={0}>
                        <RowState row={row} admin={admin} isStakeLoading={isStakeLoading} />
                    </Box>
                </Flex>
                <Box gridColumn={{ base: '3', md: '5' }} gridRow="1" color={admin?.badge.kind === 'you' ? 'hg.link' : 'hg.text.faint'} aria-hidden><LuChevronRight /></Box>
            </Grid>
        </LinkBox>
    )
}

function RowState({ row, admin, isStakeLoading }: Pick<TokenDirectoryRowProps, 'row' | 'admin' | 'isStakeLoading'>) {
    if (admin) return <AdminPill badge={admin.badge} onRetry={admin.onRetry} />
    if (isStakeLoading) return <Shimmer h="14px" w="140px" />
    return <Text fontSize="13px" color={row.dr ? 'fg' : 'hg.text.faint'} data-testid="token-stake">{stakeText(row)}</Text>
}
