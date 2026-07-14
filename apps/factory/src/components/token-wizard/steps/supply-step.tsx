"use client"

import React, { useState } from 'react'
import { Box, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { LuKeyRound, LuLock } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { prettyAmount, toBigNumber } from '@bze/bze-ui-kit'
import { InfoBox } from '@/components/ui/info-box'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'

// The admin strategy is an explicit, first-class choice.
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
    const { form, updateForm } = useTokenWizard()
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
                <VStack align="stretch" gap={2}>
                    <Text fontSize="sm" fontWeight="medium">
                        Admin strategy
                    </Text>
                    <HStack gap={3} align="stretch" flexDir={{ base: 'column', sm: 'row' }}>
                        <AdminStrategyCard
                            icon={LuKeyRound}
                            title="Keep admin"
                            description="You keep full control: mint more, burn from your account, update metadata. You can still renounce at any time later, from the Manage page."
                            selected={!form.fixedSupply}
                            onSelect={() => updateForm({ fixedSupply: false })}
                        />
                        <AdminStrategyCard
                            icon={LuLock}
                            title="Renounce at creation"
                            description="Gives up every admin right in the creation transaction itself — no more minting, no metadata changes, nothing. This cannot be undone."
                            selected={form.fixedSupply}
                            onSelect={() => updateForm({ fixedSupply: true })}
                        />
                    </HStack>
                </VStack>

                <InfoBox title="Why renounce?">
                    Renouncing means permanently giving up every right the admin has over the
                    token: minting more, updating the metadata, or handing the admin to someone
                    else. It cannot be undone — not even by you.
                    What you get in return is trust: anyone can verify on-chain that the token
                    has no admin, so holders know nobody can inflate the supply or change the
                    token under them. A provably fixed supply is just one example of that
                    guarantee. You don&apos;t have to decide now — keep the admin today and
                    renounce whenever you&apos;re ready, from the Manage page.
                </InfoBox>
            </VStack>
        </VStack>
    )
}
