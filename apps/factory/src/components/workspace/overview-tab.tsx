"use client"

import React from 'react'
import { Badge, Box, Button, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import { LuCheck, LuCircle, LuCircleDashed, LuCircleHelp, LuFlame, LuLock, LuPlus, LuRefreshCw, LuSend, LuSprout, LuTriangleAlert } from 'react-icons/lu'
import { FeaturedCard, Shimmer, hgVariant, prettyAmount, uAmountToBigNumberAmount } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
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
    done: <LuCheck size={12} strokeWidth={3} />,
    todo: <LuCircle size={12} strokeWidth={0} />,
    partial: <LuCircleDashed size={12} strokeWidth={3} />,
    unknown: <LuCircleHelp size={12} strokeWidth={2.5} />,
    impossible: <LuLock size={12} strokeWidth={2.5} />,
}

/** The state disc: green check when done, an amber dashed ring when partly done, a quiet ring otherwise. */
const STATE_DISCS: Record<SetupItem['state'], Record<string, string>> = {
    done: { color: 'hg.success.text', bg: 'hg.success/14', borderColor: 'hg.success/45', borderStyle: 'solid' },
    todo: { color: 'fg.muted', bg: 'transparent', borderColor: 'hg.lineStrong', borderStyle: 'solid' },
    partial: { color: 'hg.warning', bg: 'hg.warning/10', borderColor: 'hg.warning/55', borderStyle: 'dashed' },
    unknown: { color: 'fg.muted', bg: 'transparent', borderColor: 'hg.lineStrong', borderStyle: 'dashed' },
    impossible: { color: 'hg.text.faint', bg: 'hg.inset', borderColor: 'hg.divider', borderStyle: 'solid' },
}

function SetupRow({ item, onGo, onRetry }: { item: SetupItem; onGo: (href: string) => void; onRetry: () => void }) {
    const isOpen = item.state === 'todo' || item.state === 'partial'

    return (
        <HStack
            justify="space-between"
            gap="16px"
            py="14px"
            borderTopWidth="1px"
            borderColor="hg.divider"
            data-testid={`setup-item-${item.key}`}
            data-state={item.state}
        >
            <HStack gap="12px" align="start" minW={0}>
                <Box
                    as="span"
                    aria-hidden
                    boxSize="22px"
                    mt="1px"
                    flexShrink={0}
                    borderRadius="full"
                    borderWidth="1px"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    {...STATE_DISCS[item.state]}
                >
                    {STATE_ICONS[item.state]}
                </Box>
                <VStack align="start" gap="3px" minW={0}>
                    <HStack gap="8px" flexWrap="wrap">
                        <Text as="strong" fontSize="15px" fontWeight="700" color={item.state === 'impossible' ? 'fg.muted' : 'fg'}>
                            {item.title}
                        </Text>
                        {item.optional && (
                            <Badge size="xs" variant="outline" color="fg.muted" borderColor="hg.lineStrong" borderRadius="hg.pill" boxShadow="none" fontWeight="500">
                                optional
                            </Badge>
                        )}
                    </HStack>
                    <Text fontSize="13px" lineHeight="1.45" color="fg.muted" lineClamp={2} wordBreak="break-word">
                        {item.detail}
                    </Text>
                </VStack>
            </HStack>
            <Box flexShrink={0}>
                {item.state === 'unknown' ? (
                    <Button size="sm" variant="ghost" color="hg.link" fontWeight="600" fontSize="13px" onClick={onRetry}>
                        <LuRefreshCw /> Retry
                    </Button>
                ) : item.action ? (
                    <Button
                        size="sm"
                        fontSize="13px"
                        {...(isOpen
                            ? { variant: hgVariant('primary'), borderRadius: '10px' }
                            : { variant: 'ghost' as const, color: 'hg.link', fontWeight: '600' })}
                        onClick={() => onGo(item.action!.href)}
                    >
                        {item.action.label}
                    </Button>
                ) : null}
            </Box>
        </HStack>
    )
}

/** A quick action: the soft app button with its icon in the link colour. */
const quick = { ...softButton, size: 'lg' as const, h: '40px', px: '14px', borderRadius: '12px', fontSize: '14px' }

/** The token at a glance: stats, the chain-derived setup checklist, quick actions, the lock callout. */
export function OverviewTab({ asset, admin, adminState, supply, supplyDisplay, isSupplyLoading, balanceDisplay, goTo }: WorkspaceTabProps) {
    const setup = useTokenSetup(asset.denom, { admin, supply })
    const ticker = asset.ticker
    const back = (tab: 'rewards') => ({ href: workspaceHref(asset.denom, tab), label: ticker })

    return (
        <VStack align="stretch" gap="28px">
            <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap={{ base: '12px', md: '16px' }}>
                <StatBox
                    minW="0"
                    label="Total supply"
                    value={isSupplyLoading ? <Shimmer h="18px" w="96px" /> : `${prettyAmount(supplyDisplay)} ${ticker}`}
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
                        setup.isLoading ? <Shimmer h="18px" w="80px" />
                            : setup.denomReward
                                ? `${prettyAmount(uAmountToBigNumberAmount(setup.denomReward.staked_amount, asset.decimals))} ${ticker}`
                                : 'Not stakable yet'
                    }
                />
                <StatBox
                    minW="0"
                    label="Where it trades"
                    value={
                        setup.isLoading ? <Shimmer h="18px" w="80px" />
                            : `${setup.pools.length} pool${setup.pools.length === 1 ? '' : 's'} · order-book market ${setup.hasMarket ? 'yes' : 'no'}`
                    }
                />
            </Grid>

            <Box as="section" aria-label="Set up">
                <FeaturedCard px={{ base: '18px', md: '24px' }} py="22px">
                    <Text as="h2" fontSize="18px" fontWeight="700">Set up {ticker}</Text>
                    {setup.isLoading ? (
                        <VStack align="stretch" gap="8px" pt="12px">
                            <Shimmer h="16px" w="192px" />
                            <Shimmer h="40px" />
                            <Shimmer h="40px" />
                        </VStack>
                    ) : (
                        <>
                            <Text fontSize="14px" color="fg.muted" mt="4px" mb="12px" data-testid="setup-progress">
                                <Text as="strong" color="fg">{setup.doneCount} of {setup.totalCount} done.</Text> Read from the chain, so it stays current.
                            </Text>
                            {setup.items.map(item => (
                                <SetupRow key={item.key} item={item} onGo={goTo} onRetry={() => void setup.refresh()} />
                            ))}
                        </>
                    )}
                </FeaturedCard>
            </Box>

            <VStack as="section" aria-label="Quick actions" align="stretch" gap="12px">
                <Text as="h2" fontSize="18px" fontWeight="700">Quick actions</Text>
                <HStack gap="10px" flexWrap="wrap" css={{ '& button svg': { color: 'var(--chakra-colors-hg-link)' } }}>
                    {adminState === 'admin' && (
                        <Button {...quick} onClick={() => goTo(workspaceHref(asset.denom, 'supply'))}>
                            <LuPlus /> Mint more {ticker}
                        </Button>
                    )}
                    <Button {...quick} onClick={() => goTo(workspaceHref(asset.denom, 'supply'))}>
                        <LuFlame /> Burn {ticker}
                    </Button>
                    {setup.hasStakers && (
                        <Button {...quick} onClick={() => goTo(withReturn(airdropFormHref(asset.denom), back('rewards')))}>
                            <LuSend /> {VOCABULARY.airdropToStakers.name}
                        </Button>
                    )}
                    <Button
                        {...quick}
                        onClick={() => goTo(withReturn(`/reward/new?staking=${encodeURIComponent(asset.denom)}`, back('rewards')))}
                    >
                        <LuSprout /> Start a {VOCABULARY.stakingProgram.name.toLowerCase()}
                    </Button>
                </HStack>
            </VStack>

            {adminState === 'admin' && (
                <HStack
                    as="section"
                    gap="14px"
                    align="start"
                    justify="space-between"
                    flexWrap="wrap"
                    px="18px"
                    py="16px"
                    borderRadius="14px"
                    bg="hg.warning/6"
                    borderWidth="1px"
                    borderColor="hg.warning/30"
                    data-testid="control-callout"
                >
                    <HStack gap="12px" align="start" flex="1 1 360px" minW={0}>
                        <Box color="hg.warning" mt="2px" flexShrink={0} aria-hidden><LuTriangleAlert size={18} /></Box>
                        <Text fontSize="14px" lineHeight="1.55" color="fg">
                            Buyers see {ticker} as Mintable. You can still mint more. When the setup is done,
                            locking the supply under Control shows Fixed supply everywhere. It can&apos;t be undone.
                        </Text>
                    </HStack>
                    <Button size="md" variant="ghost" color="hg.warning.text" fontWeight="600" onClick={() => goTo(workspaceHref(asset.denom, 'control'))}>
                        Open Control →
                    </Button>
                </HStack>
            )}
            {adminState === 'renounced' && (
                <HStack
                    gap="10px"
                    px="18px"
                    py="14px"
                    borderRadius="14px"
                    bg="hg.success/6"
                    borderWidth="1px"
                    borderColor="hg.success/30"
                    data-testid="control-callout"
                >
                    <Box color="hg.success" aria-hidden><LuLock size={16} /></Box>
                    <Text fontSize="14px" fontWeight="700">Supply provably fixed</Text>
                </HStack>
            )}
        </VStack>
    )
}
