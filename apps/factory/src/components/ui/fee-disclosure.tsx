"use client"

import React, { useMemo } from 'react'
import { Box, Button, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuCircleAlert, LuCircleCheck, LuSettings } from 'react-icons/lu'
import {
    FeeCoin,
    Sidebar,
    SettingsSidebarContent,
    TokenLogo,
    useAsset,
    useAssetPrice,
    useBalance,
    useSettings,
    uAmountToBigNumberAmount,
    toBigNumber,
    prettyAmount,
    getChainName,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'

interface FeeDisclosureProps {
    /** The creation fee to disclose. Undefined = still loading or params query failed. */
    fee?: FeeCoin;
    /** Loading state from useCreationFees. */
    isLoading?: boolean;
    /** e.g. "Token creation fee". Shown as the box label in forms and at review. */
    label?: string;
}

/**
 * Spec's Fee UX principles: the fee is shown loud and clear in every creation form
 * and again at review, with an approximate value in the fee token picked in Settings,
 * a quick way to open Settings without losing form state, and a balance indicator.
 */
export function FeeDisclosure({ fee, isLoading, label = 'Creation fee' }: FeeDisclosureProps) {
    const { address } = useChain(getChainName())
    const { feeDenom } = useSettings()
    const { asset: feeAsset } = useAsset(fee?.denom ?? '')
    const { asset: settingsFeeAsset } = useAsset(feeDenom)
    const feeTokenPrice = useAssetPrice(fee?.denom ?? '')
    const settingsTokenPrice = useAssetPrice(feeDenom)
    const { balance, isLoading: isBalanceLoading } = useBalance(fee?.denom ?? '')

    const displayAmount = useMemo(() => {
        if (!fee || !feeAsset) return undefined
        return uAmountToBigNumberAmount(fee.amount, feeAsset.decimals)
    }, [fee, feeAsset])

    const usdValue = useMemo(() => {
        if (!fee || !feeAsset || !feeTokenPrice.hasPrice) return undefined
        return feeTokenPrice.uAmountUsdValue(toBigNumber(fee.amount), feeAsset.decimals)
    }, [fee, feeAsset, feeTokenPrice])

    // Approximate fee value in the fee token the user picked in Settings — only shown
    // when that token differs from the fee's denom and both have price data.
    const settingsTokenValue = useMemo(() => {
        if (!usdValue || !settingsFeeAsset || settingsFeeAsset.denom === fee?.denom) return undefined
        if (!settingsTokenPrice.hasPrice) return undefined
        return usdValue.dividedBy(settingsTokenPrice.price)
    }, [usdValue, settingsFeeAsset, fee, settingsTokenPrice])

    const hasEnough = useMemo(() => {
        if (!fee) return false
        return balance.amount.gte(fee.amount)
    }, [fee, balance])

    if (isLoading) {
        return (
            <Box p={4} borderWidth="1px" borderColor="yellow.500/25" borderRadius="lg" bg="yellow.500/5">
                <VStack align="stretch" gap={2}>
                    <Skeleton height="4" width="32" />
                    <Skeleton height="6" width="48" />
                </VStack>
            </Box>
        )
    }

    return (
        <Box p={4} borderWidth="1px" borderColor="yellow.500/25" borderRadius="lg" bg="yellow.500/5">
            <VStack align="stretch" gap={2}>
                <HStack justify="space-between">
                    <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                        {label}
                    </Text>
                    <Sidebar
                        ariaLabel="Settings"
                        trigger={
                            <Button variant="ghost" size="xs" colorPalette="yellow">
                                <LuSettings />
                                Fee token: {settingsFeeAsset?.ticker ?? '...'}
                            </Button>
                        }
                    >
                        <SettingsSidebarContent accentColor="yellow" />
                    </Sidebar>
                </HStack>

                {!fee ? (
                    <HStack gap={2} color="fg.muted">
                        <LuCircleAlert size={16} />
                        <Text fontSize="sm">
                            Could not load the current fee from the chain. Please refresh and try again.
                        </Text>
                    </HStack>
                ) : (
                    <>
                        <HStack gap={2}>
                            <TokenLogo src={feeAsset?.logo} symbol={feeAsset?.ticker ?? fee.denom} size="5" />
                            <Text fontWeight="bold" fontSize="lg">
                                {displayAmount ? prettyAmount(displayAmount) : fee.amount} {feeAsset?.ticker ?? fee.denom}
                            </Text>
                            {(usdValue || settingsTokenValue) && (
                                <Text fontSize="sm" color="fg.muted">
                                    {usdValue ? `≈ $${prettyAmount(usdValue)}` : ''}
                                    {settingsTokenValue && settingsFeeAsset
                                        ? ` (≈ ${prettyAmount(settingsTokenValue)} ${settingsFeeAsset.ticker})`
                                        : ''}
                                </Text>
                            )}
                        </HStack>

                        {!address ? (
                            <Text fontSize="sm" color="fg.muted">
                                Connect your wallet to check your balance.
                            </Text>
                        ) : isBalanceLoading ? (
                            <Skeleton height="4" width="40" />
                        ) : hasEnough ? (
                            <HStack gap={1.5} color="green.500">
                                <LuCircleCheck size={14} />
                                <Text fontSize="sm">
                                    You have enough {feeAsset?.ticker ?? fee.denom} to pay this fee.
                                </Text>
                            </HStack>
                        ) : (
                            <HStack gap={1.5} color="red.500">
                                <LuCircleAlert size={14} />
                                <Text fontSize="sm">
                                    Not enough {feeAsset?.ticker ?? fee.denom} — you have{' '}
                                    {prettyAmount(uAmountToBigNumberAmount(balance.amount, feeAsset?.decimals ?? 6))}.
                                </Text>
                            </HStack>
                        )}
                    </>
                )}
            </VStack>
        </Box>
    )
}
