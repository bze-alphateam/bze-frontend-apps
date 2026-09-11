"use client"

import React from 'react'
import { Box, Button, HStack, IconButton, Separator, Text, VStack } from '@chakra-ui/react'
import { LuCopy } from 'react-icons/lu'
import {
    getChainName,
    prettyAmount,
    toBigNumber,
    useCreationFees,
    useToast,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { FeeDisclosure } from '@/components/ui/fee-disclosure'
import { InfoBox } from '@/components/ui/info-box'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { useCreateTokenTx } from '@/components/token-wizard/useCreateTokenTx'
import { TOKEN_DECIMALS } from '@/components/token-wizard/validation'
import { useFeePayment } from '@/hooks/useFeePayment'

function ReviewRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <HStack justify="space-between" align="start" gap={4}>
            <Text fontSize="sm" color="fg.muted" flexShrink={0}>
                {label}
            </Text>
            <Box fontSize="sm" fontWeight="medium" textAlign="right" fontFamily={mono ? 'mono' : undefined} wordBreak="break-all">
                {value}
            </Box>
        </HStack>
    )
}

export function ReviewStep() {
    const { form } = useTokenWizard()
    const { resultingDenom } = useTokenWizardValidation()
    const { address } = useChain(getChainName())
    const { fees, isLoading: isFeeLoading } = useCreationFees()
    const { toast } = useToast()

    const fee = fees.createDenomFee
    // The wizard sends one multi-message tx: create + mint + metadata (+ admin renounce).
    const txKind = form.fixedSupply
        ? ['create-denom', 'mint', 'set-denom-metadata', 'change-admin'] as const
        : ['create-denom', 'mint', 'set-denom-metadata'] as const
    const { canPayFee, isLoading: isBalanceLoading } = useFeePayment(fee, [...txKind])

    const denomPreview = resultingDenom ?? `factory/${address ?? '<your address>'}/${form.subdenom}`

    const copyDenom = async () => {
        await navigator.clipboard.writeText(denomPreview)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    const { submit, isSubmitting } = useCreateTokenTx()
    const canConfirm = Boolean(address) && Boolean(fee) && !isBalanceLoading && canPayFee

    return (
        <VStack align="stretch" gap={5}>
            <VStack align="stretch" gap={3}>
                <ReviewRow label="Token" value={`${form.name.trim()} (${form.symbol})`} />
                <ReviewRow
                    label="Denom"
                    value={
                        <HStack gap={1} justify="end">
                            <Text as="span" fontFamily="mono" fontSize="xs">
                                {denomPreview}
                            </Text>
                            <IconButton aria-label="Copy denom" size="2xs" variant="ghost" colorPalette="yellow" onClick={copyDenom}>
                                <LuCopy />
                            </IconButton>
                        </HStack>
                    }
                />
                <ReviewRow label="Decimals" value={TOKEN_DECIMALS} />
                <ReviewRow
                    label="Initial supply"
                    value={`${prettyAmount(toBigNumber(form.initialSupply || '0'))} ${form.symbol}`}
                />
                <ReviewRow
                    label="Supply"
                    value={
                        form.fixedSupply
                            ? 'Fixed — admin renounced at creation'
                            : 'Flexible — you keep the admin and can mint more'
                    }
                />
                {form.description.trim() !== '' && (
                    <ReviewRow label="Description" value={form.description.trim()} />
                )}
            </VStack>

            {/* Trust messaging: the chain has no supply cap, so say loudly what the
                admin choice actually guarantees. */}
            <InfoBox title={form.fixedSupply ? 'Supply provably fixed' : 'Supply can grow'}>
                {form.fixedSupply
                    ? 'The admin renounce is part of this transaction — nobody, including you, will ever be able to mint more. This cannot be undone.'
                    : 'BeeZee has no supply cap: as long as you hold the admin, you can mint more at any time. Holders only get a fixed-supply guarantee once the admin is renounced — you can do that later from the Manage page.'}
            </InfoBox>

            <Separator />

            <FeeDisclosure fee={fee} isLoading={isFeeLoading} label="Token creation fee" txKind={[...txKind]} />

            <VStack align="stretch" gap={2}>
                <Button size="lg" colorPalette="yellow" onClick={submit} disabled={!canConfirm} loading={isSubmitting} loadingText="Waiting for signature...">
                    Create token
                </Button>
                {!address && (
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Connect your wallet to create this token.
                    </Text>
                )}
            </VStack>
        </VStack>
    )
}
