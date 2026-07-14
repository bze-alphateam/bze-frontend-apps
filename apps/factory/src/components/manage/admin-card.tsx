"use client"

import React, { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Card,
    Field,
    Grid,
    HStack,
    Input,
    Text,
    VStack,
} from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import { LuKeyRound, LuLock } from 'react-icons/lu'
import { Asset, getChainName, validateBZEBech32Address } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { InfoBox } from '@/components/ui/info-box'

const { changeAdmin } = bze.tokenfactory.MessageComposer.withTypeUrl

function TransferAdminCard({ asset, onChanged }: { asset: Asset; onChanged: () => void }) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()

    const [recipient, setRecipient] = useState('')
    const [touched, setTouched] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const error = useMemo(() => {
        const trimmed = recipient.trim()
        if (!trimmed) return 'Recipient address is required.'
        const result = validateBZEBech32Address(trimmed)
        if (!result.isValid) return result.message
        if (trimmed === address) return 'That is your own address — it is already the admin.'
        return ''
    }, [recipient, address])

    const submit = async () => {
        if (!address || error) return

        const msg = changeAdmin({ creator: address, denom: asset.denom, newAdmin: recipient.trim() })

        setIsSubmitting(true)
        try {
            await tx([msg], { onSuccess: onChanged })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card.Root
            variant="outline"
            p="5"
            bgGradient="to-br"
            gradientFrom="orange.500/8"
            gradientTo="orange.600/8"
            borderColor="orange.500/20"
        >
            <VStack align="stretch" gap={4}>
                <HStack gap={2}>
                    <Box p={2} borderRadius="lg" bg="orange.500/15" color="orange.600">
                        <LuKeyRound size={18} />
                    </Box>
                    <Text fontWeight="semibold">Transfer admin</Text>
                </HStack>

                <Field.Root invalid={touched && error !== ''}>
                    <Field.Label>New admin address</Field.Label>
                    <Input
                        placeholder="bze1..."
                        fontFamily="mono"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />
                    <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>

                <InfoBox title="You lose all control">
                    From the moment this is signed, only the new admin can mint, burn, edit
                    metadata, or transfer the admin again. Triple-check the address — sending
                    it to the wrong one cannot be fixed by anyone but that address&apos;s owner.
                </InfoBox>

                <Button
                    colorPalette="orange"
                    variant="outline"
                    onClick={submit}
                    disabled={error !== ''}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    Transfer admin
                </Button>
            </VStack>
        </Card.Root>
    )
}

function RenounceAdminCard({ asset, onChanged }: { asset: Asset; onChanged: () => void }) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()

    const [confirmation, setConfirmation] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const isArmed = confirmation === asset.ticker

    const submit = async () => {
        if (!address || !isArmed) return

        const msg = changeAdmin({ creator: address, denom: asset.denom, newAdmin: '' })

        setIsSubmitting(true)
        try {
            await tx([msg], { onSuccess: onChanged })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card.Root
            variant="outline"
            p="5"
            bgGradient="to-br"
            gradientFrom="red.500/8"
            gradientTo="red.600/8"
            borderColor="red.500/20"
        >
            <VStack align="stretch" gap={4}>
                <HStack gap={2}>
                    <Box p={2} borderRadius="lg" bg="red.500/15" color="red.600">
                        <LuLock size={18} />
                    </Box>
                    <Text fontWeight="semibold">Renounce admin</Text>
                </HStack>

                {/* Same supply-guarantee framing as the wizard: no on-chain supply cap,
                    so the renounce IS the fixed-supply guarantee holders rely on. */}
                <InfoBox title="Irreversible — supply becomes provably fixed">
                    BeeZee has no supply cap: renouncing the admin is what fixes the supply
                    forever. Nobody — including you — will ever mint again, and the metadata
                    is frozen as it is now. This cannot be undone by anyone.
                </InfoBox>

                <Field.Root>
                    <Field.Label>Type {asset.ticker} to confirm</Field.Label>
                    <Input
                        placeholder={asset.ticker}
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                    />
                    <Field.HelperText>
                        Exactly as shown — this arms the button below.
                    </Field.HelperText>
                </Field.Root>

                <Button
                    colorPalette="red"
                    onClick={submit}
                    disabled={!isArmed}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    Renounce admin forever
                </Button>
            </VStack>
        </Card.Root>
    )
}

/**
 * The admin lifecycle actions (BZE-20) — both are one MsgChangeAdmin, but they
 * get very different guardrails: transfer needs a valid bze recipient and a
 * loud warning, renounce needs the user to type the token symbol to arm the
 * button. onChanged re-fetches the admin so the badge and panel flip right away.
 */
export function AdminActions({ asset, onChanged }: { asset: Asset; onChanged: () => void }) {
    return (
        <VStack align="stretch" gap={3}>
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                Danger zone
            </Text>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                <TransferAdminCard asset={asset} onChanged={onChanged} />
                <RenounceAdminCard asset={asset} onChanged={onChanged} />
            </Grid>
        </VStack>
    )
}
