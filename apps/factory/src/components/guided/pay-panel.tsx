"use client"

import React, { useMemo } from 'react'
import { Box, Button, HStack, Separator, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuCircleAlert, LuCircleCheck, LuSettings, LuTriangleAlert } from 'react-icons/lu'
import {
    FeeCoin,
    Sidebar,
    SettingsSidebarContent,
    TokenLogo,
    TxSpec,
    getChainName,
    prettyAmount,
    toBigNumber,
    uAmountToBigNumberAmount,
    useAsset,
    useAssetPrice,
    useBalance,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFeePayment } from '@/hooks/useFeePayment'

export interface PayRow {
    label: string;
    /** An amount of a token: logo, amount, ticker and ≈ USD. */
    coin?: FeeCoin;
    /** Or a plain text value ("None", "No Factory fee"). */
    text?: string;
    /** A short explanation under the row. */
    info?: React.ReactNode;
}

interface PayPanelProps {
    /** One row per cost; several fee denoms = one row per denom total. */
    rows: PayRow[];
    /**
     * The module (Factory) fee, the one the chain may take in the fee token picked in
     * Settings. Drives the "≈ ALT" estimate on its row and the balance line.
     */
    moduleFee?: FeeCoin;
    /** The message(s) the form will send; adds the network fee row and reserves it in the balance check. */
    txKind?: TxSpec;
    /** Fees still loading (useCreationFees). */
    isLoading?: boolean;
    /** The fee params query failed: show only the "could not load" message. */
    feeUnknown?: boolean;
    /** E.g. a "Left in your wallet" line. */
    footer?: React.ReactNode;
}

function PanelShell({ children }: { children: React.ReactNode }) {
    return (
        <Box
            as="section"
            aria-label="You will pay"
            p={4}
            borderRadius="xl"
            borderWidth="1px"
            borderColor="border"
            bg="bg.panel"
        >
            <VStack align="stretch" gap={3}>
                <Text fontSize="sm" fontWeight="semibold">You will pay</Text>
                {children}
            </VStack>
        </Box>
    )
}

function CoinRow({ row, altText }: { row: PayRow & { coin: FeeCoin }; altText?: string }) {
    const { asset } = useAsset(row.coin.denom)
    const price = useAssetPrice(row.coin.denom)
    const ticker = asset?.ticker ?? row.coin.denom

    const display = asset ? prettyAmount(uAmountToBigNumberAmount(row.coin.amount, asset.decimals)) : row.coin.amount
    const usd = useMemo(() => {
        if (!asset || !price.hasPrice) return undefined
        return price.uAmountUsdValue(toBigNumber(row.coin.amount), asset.decimals)
    }, [asset, price, row.coin.amount])

    const extra = [usd ? `≈ $${prettyAmount(usd)}` : '', altText ? `(≈ ${altText})` : ''].filter(Boolean).join(' ')

    return (
        <VStack align="stretch" gap={0.5}>
            <HStack justify="space-between" align="start" gap={3}>
                <Text fontSize="sm" color="fg.muted">{row.label}</Text>
                <HStack gap={1.5} flexShrink={0}>
                    <TokenLogo src={asset?.logo} symbol={ticker} size="4" />
                    <Text fontSize="sm" fontWeight="semibold">{display} {ticker}</Text>
                </HStack>
            </HStack>
            {extra && <Text fontSize="xs" color="fg.muted" textAlign="right">{extra}</Text>}
            {row.info && <Box fontSize="xs" color="fg.muted">{row.info}</Box>}
        </VStack>
    )
}

function TextRow({ label, value, info }: { label: string; value: React.ReactNode; info?: React.ReactNode }) {
    return (
        <VStack align="stretch" gap={0.5}>
            <HStack justify="space-between" align="start" gap={3}>
                <Text fontSize="sm" color="fg.muted">{label}</Text>
                <Text fontSize="sm" fontWeight="semibold" textAlign="right">{value}</Text>
            </HStack>
            {info && <Box fontSize="xs" color="fg.muted">{info}</Box>}
        </VStack>
    )
}

/**
 * "You will pay": every cost of the form before signing. Replaces FeeDisclosure in the
 * guided forms and keeps all its behaviour: the fee in the token picked in Settings
 * (estimated from the pool, the way the chain converts it), the network fee, a Fee token
 * button that opens Settings without losing form state, and the balance check, which
 * follows the chain's charging order (see useFeePayment): network fee first, then the
 * selected fee token, silent fallback to the native denom.
 */
export function PayPanel({ rows, moduleFee, txKind, isLoading, feeUnknown, footer }: PayPanelProps) {
    const { address } = useChain(getChainName())
    const { asset: feeAsset } = useAsset(moduleFee?.denom ?? '')
    const { balance, isLoading: isBalanceLoading } = useBalance(moduleFee?.denom ?? '')
    const payment = useFeePayment(moduleFee, txKind)

    if (isLoading) {
        return (
            <PanelShell>
                <Skeleton height="4" width="48" />
                <Skeleton height="4" width="40" />
            </PanelShell>
        )
    }

    if (feeUnknown) {
        return (
            <PanelShell>
                <HStack gap={2} color="fg.muted" align="start">
                    <Box mt={0.5}><LuCircleAlert size={16} /></Box>
                    <Text fontSize="sm">
                        Could not load the current fee from the chain. Please refresh and try again.
                    </Text>
                </HStack>
            </PanelShell>
        )
    }

    const nativeTicker = feeAsset?.ticker ?? moduleFee?.denom ?? ''
    const altTicker = payment.altAsset?.ticker ?? ''
    const hasGas = Boolean(txKind) && payment.gasFee.amount.gt(0)
    const gasText = hasGas ? `≈ ${prettyAmount(payment.gasFee.displayAmount)} ${payment.gasFee.ticker}` : ''
    const altText = payment.altAmount && altTicker ? `${prettyAmount(payment.altAmount)} ${altTicker}` : undefined

    // The ≈ ALT estimate belongs to the module fee row only (the first row carrying it).
    const moduleRowIndex = moduleFee
        ? rows.findIndex(r => r.coin?.denom === moduleFee.denom && r.coin?.amount === moduleFee.amount)
        : -1
    const nativeBalance = prettyAmount(uAmountToBigNumberAmount(balance.amount, feeAsset?.decimals ?? 6))
    const plusGas = gasText ? ' and the network fee' : ''

    return (
        <PanelShell>
            <VStack align="stretch" gap={2.5}>
                {rows.map((row, i) => row.coin
                    ? <CoinRow key={`${row.label}-${i}`} row={row as PayRow & { coin: FeeCoin }} altText={i === moduleRowIndex ? altText : undefined} />
                    : <TextRow key={`${row.label}-${i}`} label={row.label} value={row.text ?? ''} info={row.info} />
                )}
                {gasText && (
                    <TextRow label="Network fee" value={gasText} info="Taken first, from the same balance." />
                )}
            </VStack>

            <Sidebar
                ariaLabel="Settings"
                trigger={
                    <Button variant="ghost" size="xs" colorPalette="yellow" alignSelf="start" ml={-2}>
                        <LuSettings />
                        Fee token: {payment.altAsset?.ticker ?? '...'}
                    </Button>
                }
            >
                <SettingsSidebarContent />
            </Sidebar>

            {moduleFee && (
                <>
                    <Separator />
                    {!address ? (
                        <Text fontSize="sm" color="fg.muted">
                            Connect your wallet to check your balance.
                        </Text>
                    ) : isBalanceLoading || payment.isLoading ? (
                        <Skeleton height="4" width="40" data-testid="balance-loading" />
                    ) : payment.method === 'alt' ? (
                        <HStack gap={1.5} color="green.500" align="start">
                            <Box mt={0.5}><LuCircleCheck size={14} /></Box>
                            <Text fontSize="sm">
                                You have enough {altTicker} to pay this fee{plusGas}.
                            </Text>
                        </HStack>
                    ) : payment.method === 'fallback' ? (
                        <HStack gap={1.5} color="orange.500" align="start">
                            <Box mt={0.5}><LuTriangleAlert size={14} /></Box>
                            <Text fontSize="sm">
                                Not enough {altTicker} (you have{' '}
                                {prettyAmount(payment.altBalanceDisplay)}{gasText ? ', the network fee goes first' : ''}) — the fee will be
                                charged in {nativeTicker} instead. You have enough {nativeTicker}.
                            </Text>
                        </HStack>
                    ) : payment.method === 'native' ? (
                        <HStack gap={1.5} color="green.500" align="start">
                            <Box mt={0.5}><LuCircleCheck size={14} /></Box>
                            <Text fontSize="sm">
                                You have enough {nativeTicker} to pay this fee{plusGas}.
                            </Text>
                        </HStack>
                    ) : (
                        <HStack gap={1.5} color="red.500" align="start">
                            <Box mt={0.5}><LuCircleAlert size={14} /></Box>
                            <Text fontSize="sm">
                                {payment.isAltSelected
                                    ? `Not enough ${altTicker} or ${nativeTicker} to pay this fee${gasText ? ' plus the network fee' : ''} — you have ${prettyAmount(payment.altBalanceDisplay)} ${altTicker} and ${nativeBalance} ${nativeTicker}.`
                                    : `Not enough ${nativeTicker} to pay this fee${gasText ? ' plus the network fee' : ''} — you have ${nativeBalance}.`}
                            </Text>
                        </HStack>
                    )}
                </>
            )}

            {footer && <Box fontSize="sm">{footer}</Box>}
        </PanelShell>
    )
}
