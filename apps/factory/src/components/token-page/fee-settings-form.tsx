"use client"

import React, { useState } from 'react'
import { Box, Button, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import { Asset, getChainName, hgVariant, prettyAmount, useMaxSpendable } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { softButton } from '@/components/ui/soft-button'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import {
    DEFAULT_FEE_SETTINGS,
    type FeeSettings,
    communityPoolError,
    denomConfigValue,
    gasSurchargeError,
    settingChanges,
    transferFeeError,
} from '@/lib/denom-config'

const { setDenomConfig } = bze.tokenfactory.MessageComposer.withTypeUrl

/**
 * "Fees and community pool", opened under its item for the admin: the three fields prefilled with the
 * live config, the old → new review of what changes, one MsgSetDenomConfig with all three fields.
 */
export function FeeSettingsForm({ asset, current, onDone }: {
    asset: Asset;
    /** The live config, which the changes are measured against. */
    current: FeeSettings;
    onDone: () => void;
}) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { gasFee } = useMaxSpendable(asset.denom, 'set-denom-config')

    const [values, setValues] = useState<FeeSettings>(current)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const poolError = communityPoolError(values.communityPool)
    const feeError = transferFeeError(values.transferFeePct)
    const surchargeError = gasSurchargeError(values.gasSurchargePct)
    const isValid = !poolError && !feeError && !surchargeError
    const changes = isValid ? settingChanges(current, values) : []
    const set = (key: keyof FeeSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [key]: e.target.value }))

    const submit = async () => {
        if (!address || !isValid || changes.length === 0) return

        setIsSubmitting(true)
        try {
            await tx([setDenomConfig(denomConfigValue(address, asset.denom, values))], { onSuccess: onDone })
        } finally {
            setIsSubmitting(false)
        }
    }

    const input = { h: '46px', borderRadius: '12px', fontSize: '16px', bg: 'bg.panel' }
    return (
        <Box as="form" aria-label="Fees and community pool" bg="hg.inset" borderRadius="14px" p="16px" data-testid="fee-settings-form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); void submit() }}>
            <VStack align="stretch" gap="14px">
                <Field.Root invalid={Boolean(poolError)}>
                    <Field.Label fontSize="14px" fontWeight="600">Community pool (optional)</Field.Label>
                    <HStack w="full" gap="8px">
                        <Input placeholder="bze1…" value={values.communityPool} onChange={set('communityPool')} {...input} />
                        <Button {...softButton} h="46px" type="button" disabled={values.communityPool === ''} onClick={() => setValues(v => ({ ...v, communityPool: '' }))}>
                            Clear
                        </Button>
                    </HStack>
                    <Field.ErrorText>{poolError}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={Boolean(feeError)}>
                    <Field.Label fontSize="14px" fontWeight="600">Transfer fee (%, 0 to 5)</Field.Label>
                    <Input inputMode="decimal" value={values.transferFeePct} onChange={set('transferFeePct')} {...input} />
                    <Field.ErrorText>{feeError}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={Boolean(surchargeError)}>
                    <Field.Label fontSize="14px" fontWeight="600">Gas surcharge (%, 0 to 200)</Field.Label>
                    <Input inputMode="decimal" value={values.gasSurchargePct} onChange={set('gasSurchargePct')} {...input} />
                    <Field.ErrorText>{surchargeError}</Field.ErrorText>
                </Field.Root>

                <Button {...softButton} type="button" alignSelf="start" onClick={() => setValues(DEFAULT_FEE_SETTINGS)}>
                    Reset to defaults
                </Button>

                {changes.length > 0 && (
                    <VStack as="ul" align="stretch" gap="6px" m="0" p="0" listStyleType="none" aria-label="Changes" data-testid="fee-settings-changes">
                        {changes.map(change => (
                            <Text as="li" key={change.key} fontSize="13px" wordBreak="break-word">
                                {`${change.label}: ${change.from} → ${change.to}`}
                            </Text>
                        ))}
                    </VStack>
                )}

                <VStack align="stretch" gap="6px">
                    <Button
                        type="submit"
                        variant={hgVariant('primary')}
                        size="lg"
                        disabled={!isValid || changes.length === 0}
                        loading={isSubmitting}
                        loadingText="Confirm in your wallet"
                        whiteSpace="normal"
                        h="auto"
                        minH="46px"
                        py="8px"
                    >
                        Save fee settings
                    </Button>
                    <Text fontSize="12px" fontFamily="mono" color="hg.text.faint" textAlign="center" data-testid="fee-settings-fee">
                        {gasFee.amount.gt(0)
                            ? `Network fee ≈ ${prettyAmount(gasFee.displayAmount)} ${gasFee.ticker}`
                            : 'Network fee'}
                    </Text>
                </VStack>
            </VStack>
        </Box>
    )
}
