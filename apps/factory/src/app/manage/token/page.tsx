"use client"

import React, { Suspense } from 'react'
import { Box, Button, Card, Container, Skeleton, Tabs, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuSearchX } from 'react-icons/lu'
import { getChainName, uAmountToBigNumberAmount, useBalance } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useTokenSupply } from '@/hooks/useTokenSupply'
import { WorkspaceHeader } from '@/components/workspace/workspace-header'
import { OverviewTab } from '@/components/workspace/overview-tab'
import { SupplyTab } from '@/components/workspace/supply-tab'
import { ProfileTab } from '@/components/workspace/profile-tab'
import { TradingTab } from '@/components/workspace/trading-tab'
import { RewardsTab } from '@/components/workspace/rewards-tab'
import { ControlTab } from '@/components/workspace/control-tab'
import type { WorkspaceTabProps } from '@/components/workspace/types'
import {
    adminState as toAdminState,
    isWorkspaceHref,
    parseWorkspaceTab,
    workspaceHref,
    type WorkspaceTab,
} from '@/lib/workspace'

const TABS: { value: WorkspaceTab; label: string; Content: React.ComponentType<WorkspaceTabProps> }[] = [
    { value: 'overview', label: 'Overview', Content: OverviewTab },
    { value: 'supply', label: 'Supply', Content: SupplyTab },
    { value: 'profile', label: 'Profile', Content: ProfileTab },
    { value: 'trading', label: 'Trading', Content: TradingTab },
    { value: 'rewards', label: 'Rewards', Content: RewardsTab },
    { value: 'control', label: 'Control', Content: ControlTab },
]

function TokenWorkspaceContent() {
    const { denomParam, getQueryParam, navigate, replace } = useNavigationWithParams()
    const denom = denomParam ?? ''
    const tab = parseWorkspaceTab(getQueryParam('tab'))
    const { tokens, isLoading, refreshAdmins } = useMyTokens()
    const { address } = useChain(getChainName())
    const token = tokens.find(t => t.asset.denom === denom)
    // Only the wallet's own tokens are shown: never query the chain for any other denom in the URL.
    const { supply, isLoading: isSupplyLoading, refresh } = useTokenSupply(token ? denom : '')
    const { balance } = useBalance(denom)

    if (isLoading) {
        return (
            <VStack align="stretch" gap={4}>
                <Skeleton height="10" width="64" />
                <Skeleton height="24" />
                <Skeleton height="48" />
            </VStack>
        )
    }

    if (!token) {
        return (
            <Card.Root variant="outline" p="10">
                <VStack gap={4}>
                    <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                        <LuSearchX size={28} />
                    </Box>
                    <VStack gap={1}>
                        <Text fontWeight="semibold">Token not found</Text>
                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                            This token doesn&apos;t belong to your connected address — only the creator
                            can manage a token here. Check the wallet you&apos;re connected with.
                        </Text>
                    </VStack>
                    <Button colorPalette="yellow" variant="outline" onClick={() => navigate('/manage')}>
                        <LuArrowLeft />
                        Back to Your tokens
                    </Button>
                </VStack>
            </Card.Root>
        )
    }

    const asset = token.asset
    const state = toAdminState(token.admin, address)
    const goTo = (href: string) => (isWorkspaceHref(href) ? replace(href) : navigate(href))

    const tabProps: WorkspaceTabProps = {
        asset,
        admin: token.admin,
        adminState: state,
        // Live supply (refreshed after every mint/burn), asset snapshot as fallback.
        supplyDisplay: uAmountToBigNumberAmount(supply ?? asset.supply, asset.decimals),
        supply,
        isSupplyLoading,
        balanceDisplay: uAmountToBigNumberAmount(balance.amount, asset.decimals),
        refreshSupply: refresh,
        refreshAdmins,
        goTo,
    }

    return (
        <VStack align="stretch" gap={6}>
            <WorkspaceHeader asset={asset} admin={token.admin} adminState={state} onBack={() => navigate('/manage')} />

            {/* Each tab mounts when opened, so it reads the chain fresh every time. */}
            <Tabs.Root
                value={tab}
                onValueChange={(e) => replace(workspaceHref(denom, parseWorkspaceTab(e.value)))}
                lazyMount={true}
                unmountOnExit={true}
                colorPalette="yellow"
                variant="line"
            >
                <Tabs.List overflowX="auto" flexWrap="nowrap" maxW="full" css={{ scrollbarWidth: 'none' }}>
                    {TABS.map(t => (
                        <Tabs.Trigger key={t.value} value={t.value} flexShrink={0}>
                            {t.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>
                {TABS.map(({ value, Content }) => (
                    <Tabs.Content key={value} value={value} pt={6}>
                        <Content {...tabProps} />
                    </Tabs.Content>
                ))}
            </Tabs.Root>
        </VStack>
    )
}

export default function ManageTokenPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="4xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="64" />}>
                    <TokenWorkspaceContent />
                </Suspense>
            </Container>
        </Box>
    )
}
