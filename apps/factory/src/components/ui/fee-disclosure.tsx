"use client"

import React, { useMemo } from 'react'
import { Box, Button, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuCircleAlert, LuCircleCheck, LuSettings, LuTriangleAlert } from 'react-icons/lu'
import {
    FeeCoin,
    Sidebar,
    SettingsSidebarContent,
    TokenLogo,
    useAsset,
    useAssetPrice,
    useBalance,
    uAmountToBigNumberAmount,
    toBigNumber,
    prettyAmount,
    getChainName,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFeePayment } from '@/hooks/useFeePayment'

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
 *
 * The balance indicator follows the chain's actual charging order (see
 * useFeePayment): selected fee token first, silent fallback to the native denom.
 */
export function FeeDisclosure({ fee, isLoading, label = 'Creation fee' }: FeeDisclosureProps) {
    const { address } = useChain(getChainName())
    const { asset: feeAsset } = useAsset(fee?.denom ?? '')
    const feeTokenPrice = useAssetPrice(fee?.denom ?? '')
    const { balance, isLoading: isBalanceLoading } = useBalance(fee?.denom ?? '')
    const payment = useFeePayment(fee)

    const nativeTicker = feeAsset?.ticker ?? fee?.denom ?? ''
    const altTicker = payment.altAsset?.ticker ?? ''

    const displayAmount = useMemo(() => {
        if (!fee || !feeAsset) return undefined
        return uAmountToBigNumberAmount(fee.amount, feeAsset.decimals)
    }, [fee, feeAsset])

    const usdValue = useMemo(() => {
        if (!fee || !feeAsset || !feeTokenPrice.hasPrice) return undefined
        return feeTokenPrice.uAmountUsdValue(toBigNumber(fee.amount), feeAsset.decimals)
    }, [fee, feeAsset, feeTokenPrice])

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
                                Fee token: {payment.altAsset?.ticker ?? '...'}
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
                            <TokenLogo src={feeAsset?.logo} symbol={nativeTicker} size="5" />
                            <Text fontWeight="bold" fontSize="lg">
                                {displayAmount ? prettyAmount(displayAmount) : fee.amount} {nativeTicker}
                            </Text>
                            {(usdValue || payment.altAmount) && (
                                <Text fontSize="sm" color="fg.muted">
                                    {usdValue ? `≈ $${prettyAmount(usdValue)}` : ''}
                                    {payment.altAmount && altTicker
                                        ? ` (≈ ${prettyAmount(payment.altAmount)} ${altTicker})`
                                        : ''}
                                </Text>
                            )}
                        </HStack>

                        {!address ? (
                            <Text fontSize="sm" color="fg.muted">
                                Connect your wallet to check your balance.
                            </Text>
                        ) : isBalanceLoading || payment.isLoading ? (
                            <Skeleton height="4" width="40" />
                        ) : payment.method === 'alt' ? (
                            <HStack gap={1.5} color="green.500">
                                <LuCircleCheck size={14} />
                                <Text fontSize="sm">
                                    You have enough {altTicker} to pay this fee.
                                </Text>
                            </HStack>
                        ) : payment.method === 'fallback' ? (
                            <HStack gap={1.5} color="orange.500" align="start">
                                <Box mt="0.5">
                                    <LuTriangleAlert size={14} />
                                </Box>
                                <Text fontSize="sm">
                                    Not enough {altTicker} (you have{' '}
                                    {prettyAmount(payment.altBalanceDisplay)}) — the fee will be
                                    charged in {nativeTicker} instead. You have enough {nativeTicker}.
                                </Text>
                            </HStack>
                        ) : payment.method === 'native' ? (
                            <HStack gap={1.5} color="green.500">
                                <LuCircleCheck size={14} />
                                <Text fontSize="sm">
                                    You have enough {nativeTicker} to pay this fee.
                                </Text>
                            </HStack>
                        ) : (
                            <HStack gap={1.5} color="red.500">
                                <LuCircleAlert size={14} />
                                <Text fontSize="sm">
                                    {payment.isAltSelected
                                        ? `Not enough ${altTicker} or ${nativeTicker} to pay this fee — you have ${prettyAmount(payment.altBalanceDisplay)} ${altTicker} and ${prettyAmount(uAmountToBigNumberAmount(balance.amount, feeAsset?.decimals ?? 6))} ${nativeTicker}.`
                                        : `Not enough ${nativeTicker} — you have ${prettyAmount(uAmountToBigNumberAmount(balance.amount, feeAsset?.decimals ?? 6))}.`}
                                </Text>
                            </HStack>
                        )}
                    </>
                )}
            </VStack>
        </Box>
    )
}
