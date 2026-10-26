"use client"

import React from 'react'
import { Box, Button, chakra, Flex, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuRefreshCw } from 'react-icons/lu'
import { HgCard, PageState, Shimmer, getChainName, useAsset } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { BrandKitEditor } from '@/components/brand-kit/brand-kit-editor'
import { FormFrame, FormPage, useReturnTo } from '@/components/guided'
import { completedReturnHref } from '@/components/guided/return-to'
import { InfoBox } from '@/components/ui/info-box'
import { softButton } from '@/components/ui/soft-button'
import { useDenomAdmin } from '@/hooks/useDenomAdmin'
import { useDenomBranding } from '@/hooks/useDenomBranding'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { adminState, workspaceHref } from '@/lib/workspace'

function Loading() {
    return (
        <FormFrame>
            <VStack align="stretch" gap="16px" aria-busy="true">
                <Shimmer h="40px" w="256px" />
                <Shimmer h="72px" borderRadius="16px" />
                <Shimmer h="384px" borderRadius="16px" />
            </VStack>
        </FormFrame>
    )
}

/**
 * The brand kit editor (BFE-293): its own page because the token page's brand kit item is a small
 * box in a half-width column. Opened from the token page with `?return=`; without one, "back"
 * goes to the token page. Anyone can open it and try templates, only the admin can save.
 */
function BrandKitContent() {
    const { denomParam, navigate } = useNavigationWithParams()
    const denom = denomParam ?? ''
    const returnTo = useReturnTo()
    const { address } = useChain(getChainName())
    const { asset, isLoading: isAssetLoading } = useAsset(denom)
    const { admin, isLoading: isAdminLoading, refresh: refreshAdmin } = useDenomAdmin(denom)
    const { branding, isLoading: isBrandingLoading, hasError, refresh } = useDenomBranding(denom)

    const ticker = asset?.ticker ?? 'your token'
    const back = returnTo ?? { href: workspaceHref(denom), label: ticker }
    const goBack = () => navigate(back.href)

    if (!denom.startsWith('factory/') || (!isAssetLoading && !asset)) {
        return (
            <FormFrame>
                <HgCard p="16px">
                    <PageState
                        kind="not-found"
                        title="Open the brand kit from your token's page"
                        description="It works for tokens made in the Factory: the link needs the token ID."
                        action={<Button {...softButton} size="lg" onClick={() => navigate('/tokens')}>Your tokens</Button>}
                    />
                </HgCard>
            </FormFrame>
        )
    }

    if (isAssetLoading || isAdminLoading || isBrandingLoading || !asset) return <Loading />

    const state = adminState(admin, address)

    return (
        <FormFrame>
            <Flex direction="column" gap="8px" mb={{ base: '18px', md: '24px' }}>
                <chakra.button
                    type="button"
                    alignSelf="start"
                    display="inline-flex"
                    alignItems="center"
                    gap="6px"
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
                    onClick={goBack}
                >
                    <LuArrowLeft /> {`Back to ${back.label}`}
                </chakra.button>
                <chakra.h1 m="0" textStyle="pageTitle" fontSize={{ base: '26px', md: '34px' }}>
                    {`Brand kit for ${asset.ticker}`}
                </chakra.h1>
                <chakra.p m="0" fontSize={{ base: '14px', md: '16px' }} lineHeight="1.6" color="fg.muted" maxW="860px">
                    {`Colours and a font for ${asset.ticker}'s page on Communities, in light and dark mode.`}
                </chakra.p>
            </Flex>

            {hasError || state === 'unknown' ? (
                <VStack align="stretch" gap={3} data-testid="brand-kit-page-error">
                    <InfoBox title="Couldn't load the brand kit">
                        The chain query failed. The node may be down, so we can&apos;t tell what is stored or who may change it.
                    </InfoBox>
                    <Box>
                        <Button {...softButton} size="sm" onClick={() => { void refresh(); void refreshAdmin() }}>
                            <LuRefreshCw />
                            Retry
                        </Button>
                    </Box>
                </VStack>
            ) : state === 'renounced' ? (
                <HgCard p="16px" data-testid="brand-kit-page-frozen">
                    <PageState
                        kind="empty"
                        title="The brand kit is frozen"
                        description={`${asset.ticker}'s admin was given up, so nobody can change its brand kit any more.`}
                        action={<Button {...softButton} size="lg" onClick={goBack}>{`Back to ${back.label}`}</Button>}
                    />
                </HgCard>
            ) : (
                <BrandKitEditor
                    asset={asset}
                    initial={branding}
                    saveBlocker={!address
                        ? 'Connect your wallet.'
                        : state === 'not-admin' ? `Only ${asset.ticker}'s admin can save its brand kit.` : undefined}
                    onCancel={goBack}
                    onSaved={() => navigate(completedReturnHref(back.href))}
                />
            )}
        </FormFrame>
    )
}

export default function BrandKitPage() {
    return (
        <FormPage>
            <BrandKitContent />
        </FormPage>
    )
}
