"use client"

import React, { useMemo } from 'react'
import type BigNumber from 'bignumber.js'
import { Box, Button, chakra, HStack, Separator, Text, VStack } from '@chakra-ui/react'
import { LuCircleAlert, LuCircleCheck, LuInfo, LuSettings, LuTriangleAlert } from 'react-icons/lu'
import {
    FeeCoin,
    Sidebar,
    SettingsSidebarContent,
    Shimmer,
    TokenLogo,
    Tooltip,
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
    /** What the cost is, in a tooltip next to the label. Defaults to the one for the label (rowTip). */
    tip?: string;
}

const TIPS: Record<string, string> = {
    'Creation fee': 'A one-time payment to create it.',
    'Compounded reward fee': 'A one-time payment that makes the token stakable.',
    'Daily prize fee': 'Paid once, so the blockchain pays out your daily prize to stakers until it ends.',
    'New prize fee': 'A one-time payment, the first time a token becomes a prize of this reward.',
    'Rewards': 'Locked now and paid to stakers day by day.',
    'Extra rewards': 'Locked now and paid to stakers during the extra days.',
    'Airdrop': 'Shared among the stakers right away.',
    'Sent to wallets': 'Sent to the wallets on your list right away.',
    'Starting pot': "The pot the raffle starts with. Winners are paid from it, and what's left at the end is burned.",
    'Network fee': 'The amount shown is an estimate.',
}

/** The tooltip of a pay row: its own, or the one for its label. */
export function rowTip(label: string, tip?: string): string | undefined {
    if (tip) return tip
    if (label.startsWith('Starting ')) return 'Your first deposit. It sets the starting price and stays in the pool.'
    return TIPS[label]
}

/** A row label with an ⓘ that explains the cost. */
function RowLabel({ label, tip }: { label: string; tip?: string }) {
    const text = rowTip(label, tip)
    return (
        <HStack gap="4px" align="center" minW={0}>
            <Text fontSize="14px" color="fg.muted">{label}</Text>
            {text && (
                <Tooltip content={text} showArrow openDelay={100} positioning={{ placement: 'top' }}>
                    <chakra.button type="button" aria-label={`About ${label}`} display="inline-flex" color="hg.text.faint" bg="transparent" border="0" p="0" cursor="help" _hover={{ color: 'fg' }} focusVisibleRing="outside">
                        <LuInfo size={13} aria-hidden />
                    </chakra.button>
                </Tooltip>
            )}
        </HStack>
    )
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
        <VStack
            as="section"
            aria-label="You will pay"
            align="stretch"
            gap="12px"
            p="18px"
            borderRadius="hg.lg"
            borderWidth="1px"
            borderColor="hg.hairline"
            bg="hg.card"
        >
            <chakra.h3 m="0" fontSize="14px" fontWeight="700">You will pay</chakra.h3>
            {children}
        </VStack>
    )
}

export function CoinRow({ row, altText }: { row: PayRow & { coin: FeeCoin }; altText?: string }) {
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
        <VStack align="stretch" gap="3px">
            <HStack justify="space-between" align="start" gap="12px">
                <RowLabel label={row.label} tip={row.tip} />
                <HStack gap="6px" flexShrink={0}>
                    <TokenLogo src={asset?.logo} symbol={ticker} size="4" />
                    <Text fontSize="14px" fontWeight="600">{display} {ticker}</Text>
                </HStack>
            </HStack>
            {extra && <Text fontSize="12px" color="hg.text.faint" textAlign="right">{extra}</Text>}
            {row.info && <Box fontSize="12px" lineHeight="1.45" color="hg.text.faint">{row.info}</Box>}
        </VStack>
    )
}

export function TextRow({ label, value, info, tip }: { label: string; value: React.ReactNode; info?: React.ReactNode; tip?: string }) {
    return (
        <VStack align="stretch" gap="3px">
            <HStack justify="space-between" align="start" gap="12px">
                <RowLabel label={label} tip={tip} />
                <Text fontSize="14px" fontWeight="600" textAlign="right">{value}</Text>
            </HStack>
            {info && <Box fontSize="12px" lineHeight="1.45" color="hg.text.faint">{info}</Box>}
        </VStack>
    )
}

/** One line of the total: an amount of one token. */
function TotalCoin({ coin, approx }: { coin: FeeCoin; approx: boolean }) {
    const { asset } = useAsset(coin.denom)
    const ticker = asset?.ticker ?? coin.denom
    const display = asset ? prettyAmount(uAmountToBigNumberAmount(coin.amount, asset.decimals)) : coin.amount
    return <Text fontSize="15px" fontWeight="700" textAlign="right">{`${approx ? '≈ ' : ''}${display} ${ticker}`}</Text>
}

/** Every coin row plus the network fee, summed per token, in the order they first appear. */
export function payTotals(rows: PayRow[], gas?: FeeCoin): FeeCoin[] {
    const sums = new Map<string, BigNumber>()
    for (const coin of [...rows.map(r => r.coin), gas]) {
        if (!coin || !toBigNumber(coin.amount).gt(0)) continue
        sums.set(coin.denom, (sums.get(coin.denom) ?? toBigNumber(0)).plus(toBigNumber(coin.amount)))
    }
    return [...sums].map(([denom, amount]) => ({ denom, amount: amount.toFixed(0) }))
}

/** The index of the row that is the module fee itself (the first one carrying it), or -1. */
export function moduleFeeRowIndex(rows: PayRow[], moduleFee?: FeeCoin): number {
    return moduleFee
        ? rows.findIndex(r => r.coin?.denom === moduleFee.denom && r.coin?.amount === moduleFee.amount)
        : -1
}

/** Every coin the rows take from the wallet besides the module fee: the balance check reserves them. */
export function spentBesidesFee(rows: PayRow[], moduleFee?: FeeCoin): FeeCoin[] {
    const feeIndex = moduleFeeRowIndex(rows, moduleFee)
    return rows.flatMap((row, i) => (row.coin && i !== feeIndex ? [row.coin] : []))
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
    const payment = useFeePayment(moduleFee, txKind, spentBesidesFee(rows, moduleFee))

    if (isLoading) {
        return (
            <PanelShell>
                <Shimmer h="14px" w="190px" />
                <Shimmer h="14px" w="150px" />
            </PanelShell>
        )
    }

    if (feeUnknown) {
        return (
            <PanelShell>
                <HStack gap="8px" color="fg.muted" align="start">
                    <Box mt="3px" flexShrink={0}><LuCircleAlert size={16} /></Box>
                    <Text fontSize="14px" lineHeight="1.5">
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
    const moduleRowIndex = moduleFeeRowIndex(rows, moduleFee)
    const totals = payTotals(rows, hasGas ? { denom: payment.gasFee.denom, amount: payment.gasFee.amount.toFixed(0) } : undefined)
    const nativeBalance = prettyAmount(uAmountToBigNumberAmount(balance.amount, feeAsset?.decimals ?? 6))

    return (
        <PanelShell>
            <VStack align="stretch" gap="10px">
                {rows.map((row, i) => row.coin
                    ? <CoinRow key={`${row.label}-${i}`} row={row as PayRow & { coin: FeeCoin }} altText={i === moduleRowIndex ? altText : undefined} />
                    : <TextRow key={`${row.label}-${i}`} label={row.label} value={row.text ?? ''} info={row.info} tip={row.tip} />
                )}
                {gasText && (
                    <TextRow label="Network fee" value={gasText} />
                )}
            </VStack>

            {totals.length > 0 && (
                <HStack
                    justify="space-between"
                    align="start"
                    gap="12px"
                    px="12px"
                    py="10px"
                    borderRadius="hg.md"
                    bg="app.subtle"
                    borderWidth="1px"
                    borderColor="app.border"
                    data-testid="pay-total"
                >
                    <Text fontSize="15px" fontWeight="700">Total</Text>
                    <VStack align="end" gap="2px">
                        {totals.map(coin => <TotalCoin key={coin.denom} coin={coin} approx={hasGas && coin.denom === payment.gasFee.denom} />)}
                    </VStack>
                </HStack>
            )}

            {payment.isAltSelected && (
            <Sidebar
                ariaLabel="Settings"
                trigger={
                    <Button variant="ghost" size="xs" color="hg.link" alignSelf="start" ml="-8px" _hover={{ bg: 'app.subtle' }}>
                        <LuSettings />
                        Fee token: {payment.altAsset?.ticker ?? '...'}
                    </Button>
                }
            >
                <SettingsSidebarContent />
            </Sidebar>
            )}

            {moduleFee && (
                <>
                    <Separator borderColor="hg.divider" />
                    {!address ? (
                        <Text fontSize="14px" color="fg.muted">
                            Connect your wallet to check your balance.
                        </Text>
                    ) : isBalanceLoading || payment.isLoading ? (
                        <Shimmer h="14px" w="160px" data-testid="balance-loading" />
                    ) : payment.method === 'alt' ? (
                        <HStack gap="8px" color="hg.success.text" align="start">
                            <Box mt="3px" flexShrink={0}><LuCircleCheck size={16} /></Box>
                            <Text fontSize="14px" lineHeight="1.5">
                                {`You hold enough ${altTicker}`}
                            </Text>
                        </HStack>
                    ) : payment.method === 'fallback' ? (
                        <HStack gap="8px" color="hg.warning.text" align="start">
                            <Box mt="3px" flexShrink={0}><LuTriangleAlert size={16} /></Box>
                            <Text fontSize="14px" lineHeight="1.5">
                                {`Not enough ${altTicker} · paid in ${nativeTicker}`}
                            </Text>
                        </HStack>
                    ) : payment.method === 'native' ? (
                        <HStack gap="8px" color="hg.success.text" align="start">
                            <Box mt="3px" flexShrink={0}><LuCircleCheck size={16} /></Box>
                            <Text fontSize="14px" lineHeight="1.5">
                                {`You hold enough ${nativeTicker}`}
                            </Text>
                        </HStack>
                    ) : (
                        <HStack gap="8px" color="hg.danger.text" align="start">
                            <Box mt="3px" flexShrink={0}><LuCircleAlert size={16} /></Box>
                            <Text fontSize="14px" lineHeight="1.5">
                                {payment.isAltSelected
                                    ? `Not enough ${altTicker} or ${nativeTicker}: you hold ${prettyAmount(payment.altBalanceDisplay)} ${altTicker} and ${nativeBalance} ${nativeTicker}.`
                                    : `Not enough ${nativeTicker}: you hold ${nativeBalance} ${nativeTicker}.`}
                            </Text>
                        </HStack>
                    )}
                </>
            )}

            {footer && <Box fontSize="14px">{footer}</Box>}
        </PanelShell>
    )
}
