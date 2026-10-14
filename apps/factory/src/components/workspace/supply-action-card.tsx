"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Card, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuFlame, LuPlus } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    Asset,
    amountToUAmount,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useBalance,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { InfoBox } from '@/components/ui/info-box'
import { validateAmount } from '@/components/token-wizard/validation'

const { mint, burn } = bze.tokenfactory.MessageComposer.withTypeUrl

/**
 * Mint and burn share the same card shape: amount input, live new-total-supply
 * preview, one tx. Burn is additionally capped by the admin's own balance —
 * the tokenfactory can only burn coins the admin holds.
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
    mode: 'mint' | 'burn';
    onDone: () => void;
}) {
    const isMint = mode === 'mint'
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { balance } = useBalance(asset.denom)

    const [amount, setAmount] = useState('')
    const [touched, setTouched] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const balanceDisplay = uAmountToBigNumberAmount(balance.amount, asset.decimals)

    const error = useMemo(() => {
        const base = validateAmount(amount, asset.decimals)
        if (base) return base
        if (!isMint && balance.amount.lt(amountToUAmount(amount, asset.decimals))) {
            return 'You can only burn tokens you hold — the amount exceeds your balance.'
        }
        return ''
    }, [amount, asset.decimals, isMint, balance])

    const newSupply = useMemo(() => {
        if (error || !amount.trim()) return undefined
        return isMint ? currentSupply.plus(amount) : currentSupply.minus(amount)
    }, [error, amount, isMint, currentSupply])

    const submit = async () => {
        if (!address || error) return

        const coins = `${amountToUAmount(amount, asset.decimals)}${asset.denom}`
        const msg = isMint
            ? mint({ creator: address, coins })
            : burn({ creator: address, coins })

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

    return (
        <Card.Root
            variant="outline"
            p="5"
            bgGradient="to-br"
            gradientFrom="yellow.500/8"
            gradientTo="yellow.600/8"
            borderColor="yellow.500/20"
        >
            <VStack align="stretch" gap={4}>
                <HStack gap={2}>
                    <Box p={2} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                        {isMint ? <LuPlus size={18} /> : <LuFlame size={18} />}
                    </Box>
                    <Text fontWeight="semibold">{isMint ? 'Mint more' : 'Burn tokens'}</Text>
                </HStack>

                <Field.Root invalid={touched && error !== ''}>
                    <Field.Label>Amount</Field.Label>
                    <Input
                        placeholder="e.g. 1000"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />
                    <Field.HelperText>
                        {newSupply
                            ? `New total supply: ${prettyAmount(newSupply)} ${asset.ticker}`
                            : isMint
                                ? 'Minted to your address and added to the total supply.'
                                : `Burned from your balance (${prettyAmount(balanceDisplay)} ${asset.ticker}).`}
                    </Field.HelperText>
                    <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>

                <Button
                    colorPalette={isMint ? 'yellow' : 'red'}
                    variant={isMint ? 'solid' : 'outline'}
                    onClick={submit}
                    disabled={error !== '' || !amount.trim()}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    {isMint ? 'Mint' : 'Burn'}
                </Button>

                <InfoBox>
                    {isMint
                        ? 'Minting increases the total supply — holders are diluted. The new tokens land in your wallet.'
                        : 'Burning permanently destroys tokens from YOUR balance and lowers the total supply. It cannot touch anyone else’s tokens.'}
                </InfoBox>
            </VStack>
        </Card.Root>
    )
}
