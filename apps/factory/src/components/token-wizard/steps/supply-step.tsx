"use client"

import React, { useState } from 'react'
import { Box, Field, HStack, Input, Switch, Text, VStack } from '@chakra-ui/react'
import { LuKeyRound, LuLock } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { prettyAmount, toBigNumber } from '@bze/bze-ui-kit'
import { InfoBox } from '@/components/ui/info-box'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'

// Pro lane: the admin strategy is an explicit, first-class choice.
function AdminStrategyCard({
    icon: Icon,
    title,
    description,
    selected,
    onSelect,
}: {
    icon: IconType;
    title: string;
    description: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <Box
            flex="1"
            p={4}
            borderWidth="2px"
            borderRadius="lg"
            cursor="pointer"
            transition="all 0.2s"
            borderColor={selected ? 'yellow.500' : 'border'}
            bg={selected ? 'yellow.500/10' : 'transparent'}
            onClick={onSelect}
            _hover={{ borderColor: 'yellow.500/60' }}
        >
            <VStack align="start" gap={2}>
                <Box color={selected ? 'yellow.600' : 'fg.muted'}>
                    <Icon size={20} />
                </Box>
                <Text fontWeight="semibold" fontSize="sm">
                    {title}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                    {description}
                </Text>
            </VStack>
        </Box>
    )
}

export function SupplyStep() {
    const { form, updateForm, lane } = useTokenWizard()
    const { supplyErrors } = useTokenWizardValidation()

    const [touched, setTouched] = useState(false)
    const supplyError = touched ? supplyErrors.initialSupply : ''

    const supplyPreview =
        supplyErrors.initialSupply === '' && form.symbol
            ? `${prettyAmount(toBigNumber(form.initialSupply))} ${form.symbol} minted to your address at creation.`
            : ''

    return (
        <VStack align="stretch" gap={5}>
            <Field.Root invalid={supplyError !== ''}>
                <Field.Label>Initial supply</Field.Label>
                <Input
                    placeholder="e.g. 1000000"
                    inputMode="decimal"
                    value={form.initialSupply}
                    onChange={(e) => updateForm({ initialSupply: e.target.value })}
                    onBlur={() => setTouched(true)}
                />
                <Field.HelperText>
                    {supplyPreview || 'The amount minted to your address when the token is created.'}
                </Field.HelperText>
                <Field.ErrorText>{supplyError}</Field.ErrorText>
            </Field.Root>

            <VStack align="stretch" gap={3}>
                {lane === 'pro' ? (
                    <VStack align="stretch" gap={2}>
                        <Text fontSize="sm" fontWeight="medium">
                            Admin strategy
                        </Text>
                        <HStack gap={3} align="stretch" flexDir={{ base: 'column', sm: 'row' }}>
                            <AdminStrategyCard
                                icon={LuKeyRound}
                                title="Keep admin"
                                description="You can mint more, burn from your account, update metadata — or renounce later from Manage."
                                selected={!form.fixedSupply}
                                onSelect={() => updateForm({ fixedSupply: false })}
                            />
                            <AdminStrategyCard
                                icon={LuLock}
                                title="Renounce at creation"
                                description="Provably fixed supply from block one — the renounce is part of the creation transaction. Irreversible."
                                selected={form.fixedSupply}
                                onSelect={() => updateForm({ fixedSupply: true })}
                            />
                        </HStack>
                    </VStack>
                ) : (
                    <Switch.Root
                        colorPalette="yellow"
                        checked={form.fixedSupply}
                        onCheckedChange={(e) => updateForm({ fixedSupply: e.checked })}
                    >
                        <Switch.HiddenInput />
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Label>
                            <HStack gap={2}>
                                <Text fontWeight="medium">Make supply fixed</Text>
                                <Text fontSize="sm" color="fg.muted">
                                    (renounce admin at creation)
                                </Text>
                            </HStack>
                        </Switch.Label>
                    </Switch.Root>
                )}

                <InfoBox title="Why renounce?">
                    BeeZee has no on-chain supply cap — a &quot;fixed supply&quot; only truly exists once
                    the token admin is renounced. Turning this on adds the renounce to the creation
                    transaction itself, so the supply is provably fixed from block one. It cannot be
                    undone: you will never be able to mint more, burn from other accounts, or change
                    the token&apos;s metadata. Leave it off to keep the admin — you can still renounce
                    later from the Manage page.
                </InfoBox>
            </VStack>
        </VStack>
    )
}
