"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Card, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuFlame, LuPlus } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    Asset,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { TipNote, WarningNote } from '@/components/guided/notes'
import { newTotalSupply, supplyAmountError, supplyCoins, type SupplyAction } from '@/lib/supply'

const { mint, burn } = bze.tokenfactory.MessageComposer.withTypeUrl

/**
 * "Mint more <TICKER>" and "Burn <TICKER>": amount input, a live new-total-supply sentence,
 * one tx and its network fee. Neither has a module fee; useFactoryTx runs the gas pre-flight.
 * Burn is capped by the admin's own balance — the tokenfactory only burns coins the admin holds.
 */
export function SupplyActionCard({
    asset,
    currentSupply,
    mode,
    onDone,
}: {
    asset: Asset;
    /** Current total supply in display units. */
    currentSupply: BigNumber;
    mode: SupplyAction;
    onDone: () => void;
}) {
    const isMint = mode === 'mint'
    const ticker = asset.ticker
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    // The burn's Max and balance cap; for both, the gas fee of this one message.
    const spendable = useMaxSpendable(asset.denom, isMint ? 'mint' : 'burn-tokens')
    const gasFee = spendable.gasFee

    const [amount, setAmount] = useState('')
    const [touched, setTouched] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const balanceDisplay = uAmountToBigNumberAmount(spendable.balance, asset.decimals)
    const error = useMemo(
        () => supplyAmountError(amount, asset.decimals, mode, spendable.balance),
        [amount, asset.decimals, mode, spendable.balance],
    )
    const isValid = error === ''
    const newSupply = isValid ? newTotalSupply(currentSupply, amount, mode) : undefined

    const submit = async () => {
        if (!address || !isValid) return

        const coins = supplyCoins(amount, asset.decimals, asset.denom)
        const msg = isMint ? mint({ creator: address, coins }) : burn({ creator: address, coins })

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: () => {
                    setAmount('')
                    setTouched(false)
                    onDone()
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const helper = newSupply
        ? isMint
            ? `New total supply ${prettyAmount(newSupply)} ${ticker}. The new ${ticker} goes to your wallet.`
            : `New total supply ${prettyAmount(newSupply)} ${ticker}. Burned from your wallet.`
        : isMint
            ? `Minted to your wallet and added to the total supply.`
            : `Burned from your balance (${prettyAmount(balanceDisplay)} ${ticker}).`

    const label = isValid ? `${isMint ? 'Mint' : 'Burn'} ${new BigNumber(amount.trim()).toFormat()} ${ticker}` : `${isMint ? 'Mint' : 'Burn'} ${ticker}`

    return (
        <Card.Root variant="outline" p="5" minW="0" data-testid={`supply-${mode}-card`}>
            <VStack align="stretch" gap={4}>
                <HStack gap={2}>
                    <Box p={2} borderRadius="lg" bg={isMint ? 'yellow.500/15' : 'red.500/15'} color={isMint ? 'yellow.600' : 'red.500'}>
                        {isMint ? <LuPlus size={18} /> : <LuFlame size={18} />}
                    </Box>
                    <Text fontWeight="semibold">{isMint ? `Mint more ${ticker}` : `Burn ${ticker}`}</Text>
                </HStack>

                <Field.Root invalid={touched && amount.trim() !== '' && !isValid}>
                    <HStack justify="space-between" w="full" gap={2} flexWrap="wrap">
                        <Field.Label>{isMint ? 'How many?' : 'How many to burn?'}</Field.Label>
                        {!isMint && (
                            <HStack gap={1}>
                                <Text fontSize="xs" color="fg.muted">{`of ${prettyAmount(balanceDisplay)} ${ticker}`}</Text>
                                <Button
                                    size="2xs"
                                    variant="ghost"
                                    colorPalette="red"
                                    onClick={() => { setAmount(spendable.inputValue); setTouched(true) }}
                                    disabled={!spendable.amount.gt(0)}
                                >
                                    Max
                                </Button>
                            </HStack>
                        )}
                    </HStack>
                    <Input
                        placeholder="e.g. 1000"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />
                    <Field.HelperText data-testid={`supply-${mode}-sentence`}>{helper}</Field.HelperText>
                    <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>

                {isMint
                    ? <WarningNote lead="Heads up:">Minting more lowers the share every holder owns.</WarningNote>
                    : <TipNote lead="Good to know:">You can only burn what you hold.</TipNote>}

                <VStack align="stretch" gap={1}>
                    <Button
                        colorPalette={isMint ? 'yellow' : 'red'}
                        variant={isMint ? 'solid' : 'outline'}
                        onClick={submit}
                        disabled={!isValid}
                        loading={isSubmitting}
                        loadingText="Waiting for signature..."
                        whiteSpace="normal"
                        h="auto"
                        minH="10"
                        py={2}
                    >
                        {label}
                    </Button>
                    <Text fontSize="xs" color="fg.muted" textAlign="center" data-testid={`supply-${mode}-fee`}>
                        {gasFee.amount.gt(0)
                            ? `Network fee ≈ ${prettyAmount(gasFee.displayAmount)} ${gasFee.ticker}`
                            : 'Network fee only, no module fee'}
                    </Text>
                </VStack>
            </VStack>
        </Card.Root>
    )
}
