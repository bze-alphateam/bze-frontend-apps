"use client"

import React, { Suspense, useEffect } from 'react'
import NextLink from 'next/link'
import { Box, Button, Grid, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuSearchX } from 'react-icons/lu'
import {
    AppLink,
    Asset,
    HgCard,
    PageContainer,
    PageState,
    Shimmer,
    getChainName,
    getDexApp,
    hgVariant,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    useBalance,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomAdmin } from '@/hooks/useDenomAdmin'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { useTokenSupply } from '@/hooks/useTokenSupply'
import type { AdminAccess } from '@/components/token-page/action-group'
import { DetailsGroup } from '@/components/token-page/details-group'
import { AdminUnknownNotice, PermissionsSection } from '@/components/token-page/permissions-section'
import { RewardsGroup } from '@/components/token-page/rewards-group'
import { SupplyGroup } from '@/components/token-page/supply-group'
import { StatShimmer, TokenHeader } from '@/components/token-page/token-header'
import { TradingGroup } from '@/components/token-page/trading-group'
import { TOKENS_PATH } from '@/lib/tokens-directory'
import { TOKEN_SECTIONS, adminState, ownerBadge, tokenPageAccess, tokenPageReturn } from '@/lib/workspace'

/** A link from elsewhere to `#rewards` etc.: the sections render after the data, so scroll once they exist. */
function useScrollToSection() {
    useEffect(() => {
        const id = window.location.hash.slice(1)
        if (!(TOKEN_SECTIONS as readonly string[]).includes(id)) return
        document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }, [])
}

/** The page of one Factory token, for any wallet; admin actions only once the chain says so. */
function TokenPageBody({ asset }: { asset: Asset }) {
    const { address } = useChain(getChainName())
    const { admin, isLoading: isAdminLoading, refresh: refreshAdmin } = useDenomAdmin(asset.denom)
    const { supply, isLoading: isSupplyLoading, refresh: refreshSupply } = useTokenSupply(asset.denom)
    const { balance } = useBalance(asset.denom)
    const setup = useTokenSetup(asset.denom, { admin, supply })
    useScrollToSection()

    const ticker = asset.ticker
    const state = adminState(admin, address)
    const access: AdminAccess = isAdminLoading ? 'checking' : state
    const back = tokenPageReturn(asset)
    // Live supply (refreshed after every mint), asset snapshot as fallback.
    const supplyDisplay = uAmountToBigNumberAmount(supply ?? asset.supply, asset.decimals)
    const groupProps = { asset, access, back }

    return (
        <>
            <TokenHeader
                asset={asset}
                admin={admin}
                isAdminLoading={isAdminLoading}
                badge={isAdminLoading ? undefined : ownerBadge(asset.denom, admin, address)}
                stats={{
                    supply: isSupplyLoading ? <StatShimmer /> : `${prettyAmount(supplyDisplay)} ${ticker}`,
                    held: address ? `${prettyAmount(uAmountToBigNumberAmount(balance.amount, asset.decimals))} ${ticker}` : undefined,
                    staked: setup.isLoading
                        ? <StatShimmer />
                        : setup.denomReward
                            ? `${prettyAmount(uAmountToBigNumberAmount(setup.denomReward.staked_amount, asset.decimals))} ${ticker}`
                            : 'Not stakable yet',
                }}
            />

            <PageContainer as="main" pt="24px" pb="64px">
                <VStack align="stretch" gap="20px">
                    {access === 'unknown' && <AdminUnknownNotice onRetry={() => void refreshAdmin()} />}

                    <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }} gap="16px" alignItems="start">
                        <SupplyGroup {...groupProps} supplyDisplay={supplyDisplay} onMinted={refreshSupply} />
                        <DetailsGroup {...groupProps} />
                        <TradingGroup {...groupProps} />
                        <RewardsGroup {...groupProps} />
                    </Grid>

                    <PermissionsSection
                        isChecking={isAdminLoading}
                        asset={asset}
                        admin={admin}
                        adminState={state}
                        supplyDisplay={supplyDisplay}
                        supply={supply}
                        refreshAdmins={refreshAdmin}
                    />
                </VStack>
            </PageContainer>
        </>
    )
}

function TokenPageContent() {
    const { denomParam } = useNavigationWithParams()
    const denom = denomParam ?? ''
    const { getAsset, isLoading } = useAssets()
    const asset = denom ? getAsset(denom) : undefined

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

    const access = tokenPageAccess(denom, asset)
    if (access === 'token' && asset) return <TokenPageBody asset={asset} />

    return (
        <PageContainer pt="32px" pb="64px">
            <HgCard p="16px" data-testid="token-page-state">
                {access === 'not-factory' && asset ? (
                    <PageState
                        kind="empty"
                        icon={<LuSearchX />}
                        title="Only tokens made with Factory have a page here."
                        description={`${asset.ticker} wasn't created with Factory. Its page is on the DEX.`}
                        action={<AppLink app="dex" href={`${getDexApp().href}/assets/details?denom=${encodeURIComponent(asset.denom)}`}>DEX</AppLink>}
                    />
                ) : (
                    <PageState
                        kind="not-found"
                        icon={<LuSearchX />}
                        title="We couldn't find this token."
                        description="Check the link, or find the token in the list of every Factory token."
                        action={(
                            <Button asChild variant={hgVariant('secondary')} size="lg">
                                <NextLink href={TOKENS_PATH}>
                                    <LuArrowLeft />
                                    All tokens
                                </NextLink>
                            </Button>
                        )}
                    />
                )}
            </HgCard>
        </PageContainer>
    )
}

export default function TokenPage() {
    return (
        <Box minH="100vh">
            <Suspense fallback={<PageContainer pt="28px"><Shimmer h="256px" borderRadius="16px" /></PageContainer>}>
                <TokenPageContent />
            </Suspense>
        </Box>
    )
}
