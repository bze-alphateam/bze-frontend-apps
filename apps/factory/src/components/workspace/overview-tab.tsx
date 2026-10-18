"use client"

import React from 'react'
import { Badge, Box, Button, Card, Grid, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuCheck, LuCircle, LuCircleDashed, LuCircleHelp, LuFlame, LuLock, LuPlus, LuRefreshCw, LuSend, LuSprout, LuTriangleAlert } from 'react-icons/lu'
import { prettyAmount, uAmountToBigNumberAmount } from '@bze/bze-ui-kit'
import { withReturn } from '@/components/guided/return-to'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { airdropFormHref } from '@/lib/denom-reward'
import type { SetupItem } from '@/lib/token-setup'
import { VOCABULARY } from '@/lib/vocabulary'
import { workspaceHref } from '@/lib/workspace'
import { shareOfSupply } from '@/lib/supply'
import { StatBox } from './stat-box'
import type { WorkspaceTabProps } from './types'

const STATE_ICONS: Record<SetupItem['state'], React.ReactNode> = {
    done: <LuCheck size={16} />,
    todo: <LuCircle size={16} />,
    partial: <LuCircleDashed size={16} />,
    unknown: <LuCircleHelp size={16} />,
    impossible: <LuLock size={16} />,
}

const STATE_COLORS: Record<SetupItem['state'], string> = {
    done: 'green.500',
    todo: 'fg.muted',
    partial: 'orange.500',
    unknown: 'fg.muted',
    impossible: 'fg.subtle',
}

function SetupRow({ item, onGo, onRetry }: { item: SetupItem; onGo: (href: string) => void; onRetry: () => void }) {
    const isOpen = item.state === 'todo' || item.state === 'partial'

    return (
        <HStack
            justify="space-between"
            gap={3}
            py={3}
            borderTopWidth="1px"
            borderColor="border.muted"
            data-testid={`setup-item-${item.key}`}
            data-state={item.state}
        >
            <HStack gap={3} align="start" minW={0}>
                <Box color={STATE_COLORS[item.state]} mt={0.5} flexShrink={0}>
                    {STATE_ICONS[item.state]}
                </Box>
                <VStack align="start" gap={0.5} minW={0}>
                    <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="sm" fontWeight="semibold" color={item.state === 'impossible' ? 'fg.muted' : undefined}>
                            {item.title}
                        </Text>
                        {item.optional && <Badge size="xs" variant="outline" colorPalette="gray">optional</Badge>}
                    </HStack>
                    <Text fontSize="xs" color="fg.muted" lineClamp={2} wordBreak="break-word">
                        {item.detail}
                    </Text>
                </VStack>
            </HStack>
            <Box flexShrink={0}>
                {item.state === 'unknown' ? (
                    <Button size="xs" variant="ghost" colorPalette="yellow" onClick={onRetry}>
                        <LuRefreshCw /> Retry
                    </Button>
                ) : item.action ? (
                    <Button
                        size="xs"
                        colorPalette="yellow"
                        variant={isOpen ? 'solid' : 'ghost'}
                        onClick={() => onGo(item.action!.href)}
                    >
                        {item.action.label}
                    </Button>
                ) : null}
            </Box>
        </HStack>
    )
}

/** The token at a glance: stats, the chain-derived setup checklist, quick actions, the lock callout. */
export function OverviewTab({ asset, admin, adminState, supply, supplyDisplay, isSupplyLoading, balanceDisplay, goTo }: WorkspaceTabProps) {
    const setup = useTokenSetup(asset.denom, { admin, supply })
    const ticker = asset.ticker
    const back = (tab: 'rewards') => ({ href: workspaceHref(asset.denom, tab), label: ticker })

    return (
        <VStack align="stretch" gap={6}>
            <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap={3}>
                <StatBox
                    minW="0"
                    label="Total supply"
                    value={isSupplyLoading ? <Skeleton height="4" width="24" /> : `${prettyAmount(supplyDisplay)} ${ticker}`}
                />
                <StatBox
                    minW="0"
                    label="In your wallet"
                    value={`${prettyAmount(balanceDisplay)} ${ticker}`}
                    hint={shareOfSupply(balanceDisplay, supplyDisplay)}
                />
                <StatBox
                    minW="0"
                    label="Staked by holders"
                    value={
                        setup.isLoading ? <Skeleton height="4" width="20" />
                            : setup.denomReward
                                ? `${prettyAmount(uAmountToBigNumberAmount(setup.denomReward.staked_amount, asset.decimals))} ${ticker}`
                                : 'Not stakable yet'
                    }
                />
                <StatBox
                    minW="0"
                    label="Where it trades"
                    value={
                        setup.isLoading ? <Skeleton height="4" width="20" />
                            : `${setup.pools.length} pool${setup.pools.length === 1 ? '' : 's'} · order-book market ${setup.hasMarket ? 'yes' : 'no'}`
                    }
                />
            </Grid>

            <Card.Root variant="outline" p="5">
                <VStack align="stretch" gap={1}>
                    <Text fontWeight="semibold">Set up {ticker}</Text>
                    {setup.isLoading ? (
                        <VStack align="stretch" gap={2} pt={2}>
                            <Skeleton height="4" width="48" />
                            <Skeleton height="10" />
                            <Skeleton height="10" />
                        </VStack>
                    ) : (
                        <>
                            <Text fontSize="sm" color="fg.muted" pb={2} data-testid="setup-progress">
                                {setup.doneCount} of {setup.totalCount} done. Read from the chain, so it stays current.
                            </Text>
                            {setup.items.map(item => (
                                <SetupRow key={item.key} item={item} onGo={goTo} onRetry={() => void setup.refresh()} />
                            ))}
                        </>
                    )}
                </VStack>
            </Card.Root>

            <VStack align="stretch" gap={3}>
                <Text fontWeight="semibold">Quick actions</Text>
                <HStack gap={2} flexWrap="wrap">
                    {adminState === 'admin' && (
                        <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => goTo(workspaceHref(asset.denom, 'supply'))}>
                            <LuPlus /> Mint more {ticker}
                        </Button>
                    )}
                    <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => goTo(workspaceHref(asset.denom, 'supply'))}>
                        <LuFlame /> Burn {ticker}
                    </Button>
                    {setup.hasStakers && (
                        <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => goTo(withReturn(airdropFormHref(asset.denom), back('rewards')))}>
                            <LuSend /> {VOCABULARY.airdropToStakers.name}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        colorPalette="yellow"
                        onClick={() => goTo(withReturn(`/reward/new?staking=${encodeURIComponent(asset.denom)}`, back('rewards')))}
                    >
                        <LuSprout /> Start a {VOCABULARY.stakingProgram.name.toLowerCase()}
                    </Button>
                </HStack>
            </VStack>

            {adminState === 'admin' && (
                <Card.Root variant="outline" p="4" borderColor="orange.500/30" bg="orange.500/5" data-testid="control-callout">
                    <HStack gap={3} align="start" justify="space-between" flexWrap="wrap">
                        <HStack gap={3} align="start" flex="1" minW="60">
                            <Box color="orange.500" mt={0.5} flexShrink={0}><LuTriangleAlert size={16} /></Box>
                            <Text fontSize="sm">
                                Buyers see {ticker} as Mintable. You can still mint more. When the setup is done,
                                locking the supply under Control shows Fixed supply everywhere. It can&apos;t be undone.
                            </Text>
                        </HStack>
                        <Button size="sm" variant="ghost" colorPalette="orange" onClick={() => goTo(workspaceHref(asset.denom, 'control'))}>
                            Open Control →
                        </Button>
                    </HStack>
                </Card.Root>
            )}
            {adminState === 'renounced' && (
                <Card.Root variant="outline" p="4" borderColor="green.500/30" bg="green.500/5" data-testid="control-callout">
                    <HStack gap={3}>
                        <Box color="green.500"><LuLock size={16} /></Box>
                        <Text fontSize="sm" fontWeight="semibold">Supply provably fixed</Text>
                    </HStack>
                </Card.Root>
            )}
        </VStack>
    )
}
