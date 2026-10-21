"use client"

import React, { Suspense } from 'react'
import { Box, Button, Tabs, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuSearchX } from 'react-icons/lu'
import { HgCard, PageContainer, PageState, Shimmer, getChainName, hgVariant, uAmountToBigNumberAmount, useBalance } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useTokenSupply } from '@/hooks/useTokenSupply'
import { BandTab, BandTabList } from '@/components/ui/band-tabs'
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
    { value: 'control', label: 'Permissions', Content: ControlTab },
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
            <PageContainer pt="28px">
                <VStack align="stretch" gap="16px" aria-busy="true">
                    <Shimmer h="40px" w="256px" />
                    <Shimmer h="96px" borderRadius="16px" />
                    <Shimmer h="192px" borderRadius="16px" />
                </VStack>
            </PageContainer>
        )
    }

    if (!token) {
        return (
            <PageContainer pt="32px" pb="64px">
                <HgCard p="16px">
                    <PageState
                        kind="not-found"
                        icon={<LuSearchX />}
                        title="Token not found"
                        description={(
                            <>
                                This token doesn&apos;t belong to your connected address — only the creator
                                can manage a token here. Check the wallet you&apos;re connected with.
                            </>
                        )}
                        action={(
                            <Button variant={hgVariant('secondary')} size="lg" onClick={() => navigate('/tokens')}>
                                <LuArrowLeft />
                                Back to Your tokens
                            </Button>
                        )}
                    />
                </HgCard>
            </PageContainer>
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
        // Each tab mounts when opened, so it reads the chain fresh every time.
        <Tabs.Root
            value={tab}
            onValueChange={(e) => replace(workspaceHref(denom, parseWorkspaceTab(e.value)))}
            lazyMount={true}
            unmountOnExit={true}
            variant="plain"
        >
            <WorkspaceHeader
                asset={asset}
                admin={token.admin}
                adminState={state}
                onBack={() => navigate('/tokens')}
                tabs={(
                    <BandTabList label="Workspace">
                        {TABS.map(t => <BandTab key={t.value} value={t.value}>{t.label}</BandTab>)}
                    </BandTabList>
                )}
            />

            <PageContainer as="main" pt="28px" pb="64px">
                {TABS.map(({ value, Content }) => (
                    <Tabs.Content key={value} value={value} p="0">
                        <Content {...tabProps} />
                    </Tabs.Content>
                ))}
            </PageContainer>
        </Tabs.Root>
    )
}

export default function ManageTokenPage() {
    return (
        <Box minH="100vh">
            <Suspense fallback={<PageContainer pt="28px"><Shimmer h="256px" borderRadius="16px" /></PageContainer>}>
                <TokenWorkspaceContent />
            </Suspense>
        </Box>
    )
}
