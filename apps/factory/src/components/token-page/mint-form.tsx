"use client"

import React, { useState } from 'react'
import { Box, Button, Field, Input, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { bze } from '@bze/bzejs'
import { Asset, getChainName, hgVariant, prettyAmount, useMaxSpendable } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { mintAmountError, newTotalSupply, supplyCoins } from '@/lib/supply'

const { mint } = bze.tokenfactory.MessageComposer.withTypeUrl

/**
 * "Mint tokens", opened under its item for the admin: amount, the live new total supply, one tx and
 * its network fee. No module fee; useFactoryTx runs the gas pre-flight. The new tokens go to the
 * admin's wallet.
 */
export function MintForm({ asset, currentSupply, onDone }: {
    asset: Asset;
    /** Current total supply in display units. */
    currentSupply: BigNumber;
    onDone: () => void;
}) {
    const ticker = asset.ticker
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    // Only for the gas fee of this one message.
    const { gasFee } = useMaxSpendable(asset.denom, 'mint')

    const [amount, setAmount] = useState('')
    const [touched, setTouched] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const error = mintAmountError(amount, asset.decimals)
    const isValid = error === ''
    const newSupply = isValid ? newTotalSupply(currentSupply, amount) : undefined

    const submit = async () => {
        if (!address || !isValid) return

        setIsSubmitting(true)
        try {
            await tx([mint({ creator: address, coins: supplyCoins(amount, asset.decimals, asset.denom) })], {
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
        <Box as="form" aria-label="Mint tokens" bg="hg.inset" borderRadius="14px" p="16px" data-testid="mint-form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); void submit() }}>
            <VStack align="stretch" gap="14px">
                <Field.Root invalid={touched && amount.trim() !== '' && !isValid}>
                    <Field.Label fontSize="14px" fontWeight="600">How many?</Field.Label>
                    <Input
                        placeholder="e.g. 1000"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onBlur={() => setTouched(true)}
                        h="46px"
                        borderRadius="12px"
                        fontSize="16px"
                        bg="bg.panel"
                    />
                    {newSupply && (
                        <Field.HelperText fontSize="13px" color="fg.muted" data-testid="mint-sentence">
                            {`New supply ${prettyAmount(newSupply)} ${ticker}`}
                        </Field.HelperText>
                    )}
                    <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>

                <VStack align="stretch" gap="6px">
                    <Button
                        type="submit"
                        variant={hgVariant('primary')}
                        size="lg"
                        disabled={!isValid}
                        loading={isSubmitting}
                        loadingText="Confirm in your wallet"
                        whiteSpace="normal"
                        h="auto"
                        minH="46px"
                        py="8px"
                    >
                        {isValid ? `Mint ${new BigNumber(amount.trim()).toFormat()} ${ticker}` : `Mint ${ticker}`}
                    </Button>
                    <Text fontSize="12px" fontFamily="mono" color="hg.text.faint" textAlign="center" data-testid="mint-fee">
                        {gasFee.amount.gt(0)
                            ? `Network fee ≈ ${prettyAmount(gasFee.displayAmount)} ${gasFee.ticker}`
                            : 'Network fee'}
                    </Text>
                </VStack>
            </VStack>
        </Box>
    )
}
