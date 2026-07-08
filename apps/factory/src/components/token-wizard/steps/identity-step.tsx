"use client"

import React, { useState } from 'react'
import { Field, Input, Text, VStack } from '@chakra-ui/react'
import { getChainName } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { MAX_DECIMALS, suggestSubdenom } from '@/components/token-wizard/validation'

type TouchedFields = Partial<Record<'name' | 'symbol' | 'subdenom' | 'decimals', boolean>>

export function IdentityStep() {
    const { form, updateForm } = useTokenWizard()
    const { identityErrors } = useTokenWizardValidation()
    const { address } = useChain(getChainName())

    // Errors appear per field only after the user interacted with it; the Next
    // button is gated on validity regardless.
    const [touched, setTouched] = useState<TouchedFields>({})
    const touch = (field: keyof TouchedFields) => setTouched(prev => ({ ...prev, [field]: true }))
    const errorFor = (field: keyof TouchedFields) => (touched[field] ? identityErrors[field] : '')

    const onSymbolChange = (raw: string) => {
        const symbol = raw.toUpperCase()
        // Keep suggesting the subdenom from the symbol until the user edits it by hand.
        updateForm(form.subdenomTouched ? { symbol } : { symbol, subdenom: suggestSubdenom(symbol) })
    }

    const denomPreview = `factory/${address ?? '<your address>'}/${form.subdenom || '<subdenom>'}`

    return (
        <VStack align="stretch" gap={5}>
            <Field.Root invalid={errorFor('name') !== ''}>
                <Field.Label>Token name</Field.Label>
                <Input
                    placeholder="e.g. Honey Coin"
                    value={form.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    onBlur={() => touch('name')}
                />
                <Field.HelperText>The full name shown in wallets and explorers.</Field.HelperText>
                <Field.ErrorText>{errorFor('name')}</Field.ErrorText>
            </Field.Root>

            <Field.Root invalid={errorFor('symbol') !== ''}>
                <Field.Label>Symbol</Field.Label>
                <Input
                    placeholder="e.g. HONEY"
                    value={form.symbol}
                    onChange={(e) => onSymbolChange(e.target.value)}
                    onBlur={() => touch('symbol')}
                />
                <Field.HelperText>The ticker — short and uppercase, like BZE.</Field.HelperText>
                <Field.ErrorText>{errorFor('symbol')}</Field.ErrorText>
            </Field.Root>

            <Field.Root invalid={errorFor('subdenom') !== ''}>
                <Field.Label>Subdenom</Field.Label>
                <Input
                    placeholder="e.g. uhoney"
                    value={form.subdenom}
                    onChange={(e) => updateForm({ subdenom: e.target.value, subdenomTouched: true })}
                    onBlur={() => touch('subdenom')}
                />
                <Field.HelperText>
                    <Text as="span" display="block">
                        The on-chain base unit id — suggested from your symbol, editable.
                    </Text>
                    <Text as="span" display="block" fontFamily="mono" fontSize="xs" mt={1} wordBreak="break-all">
                        {denomPreview}
                    </Text>
                </Field.HelperText>
                <Field.ErrorText>{errorFor('subdenom')}</Field.ErrorText>
            </Field.Root>

            <Field.Root invalid={errorFor('decimals') !== ''}>
                <Field.Label>Decimals</Field.Label>
                <Input
                    type="number"
                    min={0}
                    max={MAX_DECIMALS}
                    step={1}
                    maxW="32"
                    value={Number.isNaN(form.decimals) ? '' : form.decimals}
                    onChange={(e) => updateForm({ decimals: e.target.value === '' ? NaN : Number(e.target.value) })}
                    onBlur={() => touch('decimals')}
                />
                <Field.HelperText>
                    How divisible the token is. 6 is the ecosystem standard (1 token = 1,000,000 base units).
                </Field.HelperText>
                <Field.ErrorText>{errorFor('decimals')}</Field.ErrorText>
            </Field.Root>
        </VStack>
    )
}
