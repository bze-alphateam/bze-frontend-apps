"use client"

import React, { useState } from 'react'
import { Field, Input, Text, VStack } from '@chakra-ui/react'
import { getChainName } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { InfoBox } from '@/components/ui/info-box'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { suggestSubdenom, TOKEN_DECIMALS } from '@/components/token-wizard/validation'

type TouchedFields = Partial<Record<'name' | 'symbol', boolean>>

export function IdentityStep() {
    const { form, updateForm, lane } = useTokenWizard()
    const { identityErrors } = useTokenWizardValidation()
    const { address } = useChain(getChainName())

    // Errors appear per field only after the user interacted with it; the Next
    // button is gated on validity regardless.
    const [touched, setTouched] = useState<TouchedFields>({})
    const touch = (field: keyof TouchedFields) => setTouched(prev => ({ ...prev, [field]: true }))
    const errorFor = (field: keyof TouchedFields) => (touched[field] ? identityErrors[field] : '')

    const onSymbolChange = (raw: string) => {
        const symbol = raw.toUpperCase()
        updateForm({ symbol, subdenom: suggestSubdenom(symbol) })
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

            {/* The subdenom is never editable — shown for transparency in Pro only. */}
            {lane === 'pro' && (
                <Field.Root>
                    <Field.Label>Subdenom</Field.Label>
                    <Input value={form.subdenom} placeholder="uhoney" disabled />
                    <Field.HelperText>
                        <Text as="span" display="block">
                            The on-chain base unit id — derived from your symbol (&quot;u&quot; + lowercase).
                        </Text>
                        <Text as="span" display="block" fontFamily="mono" fontSize="xs" mt={1} wordBreak="break-all">
                            {denomPreview}
                        </Text>
                    </Field.HelperText>
                </Field.Root>
            )}

            <InfoBox title={`${TOKEN_DECIMALS} decimals`}>
                Your token will use {TOKEN_DECIMALS} decimals — the BeeZee ecosystem standard
                (1 {form.symbol || 'token'} = 1,000,000 base units).
            </InfoBox>
        </VStack>
    )
}
