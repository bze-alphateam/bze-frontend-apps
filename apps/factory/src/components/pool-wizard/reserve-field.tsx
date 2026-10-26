"use client"

import React, { useMemo, useState } from 'react'
import { Button, Field, HStack, Input } from '@chakra-ui/react'
import { amountToUAmount, prettyAmount, uAmountToBigNumberAmount, useAsset, useBalance, useMaxSpendable } from '@bze/bze-ui-kit'
import { validateAmount } from '@/components/token-wizard/validation'
import { softButton } from '@/components/ui/soft-button'
import { notEnoughText, youHoldText } from '@/lib/format'
import { maxReserveAmount } from '@/lib/pool-new'

export const CREATE_POOL_TX_KIND = 'create-pool'

/**
 * One starting amount of the pool: the input, the wallet balance and Max. Max is gas-aware and
 * leaves the creation fee when this side is in the fee denom. The balance is only checked with
 * a wallet connected (without one there is nothing to compare with).
 */
export function ReserveField({
    denom,
    amount,
    onChange,
    fee,
    connected,
}: {
    denom: string;
    amount: string;
    onChange: (value: string) => void;
    /** The creation fee: Max leaves it when this reserve is in the fee denom. */
    fee?: { denom: string; amount: string };
    connected: boolean;
}) {
    const { asset } = useAsset(denom)
    const { balance } = useBalance(denom)
    const max = useMaxSpendable(denom, CREATE_POOL_TX_KIND)
    const [touched, setTouched] = useState(false)

    const error = useMemo(() => {
        if (!asset) return ''
        const base = validateAmount(amount, asset.decimals)
        if (base) return base
        if (connected && balance.amount.lt(amountToUAmount(amount, asset.decimals))) {
            return notEnoughText(asset.ticker, prettyAmount(uAmountToBigNumberAmount(balance.amount, asset.decimals)))
        }
        return ''
    }, [amount, asset, balance, connected])

    if (!asset) return null

    const fillMax = () => {
        const micro = maxReserveAmount(max.amount, denom, fee)
        onChange(uAmountToBigNumberAmount(micro, asset.decimals).toFixed())
        setTouched(true)
    }

    return (
        <Field.Root invalid={touched && error !== ''}>
            <Field.Label>{asset.ticker}</Field.Label>
            <HStack gap="8px" w="full">
                <Input
                    placeholder="e.g. 1000"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setTouched(true)}
                />
                {connected && (
                    <Button
                        {...softButton}
                        size="sm"
                        flexShrink={0}
                        aria-label={`Max ${asset.ticker}`}
                        disabled={max.isLoading}
                        onClick={fillMax}
                    >
                        Max
                    </Button>
                )}
            </HStack>
            {connected && (
                <Field.HelperText>
                    {youHoldText(prettyAmount(uAmountToBigNumberAmount(balance.amount, asset.decimals)), asset.ticker)}
                </Field.HelperText>
            )}
            <Field.ErrorText>{error}</Field.ErrorText>
        </Field.Root>
    )
}
