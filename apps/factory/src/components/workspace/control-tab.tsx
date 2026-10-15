"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Card, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import { LuCheck, LuKeyRound, LuLock, LuRefreshCw, LuShieldCheck, LuUserRound } from 'react-icons/lu'
import { Asset, getChainName, validateBZEBech32Address } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { InfoBox } from '@/components/ui/info-box'
import { workspaceHref } from '@/lib/workspace'
import { keepsWorking, LockDialog } from './lock-dialog'
import type { WorkspaceTabProps } from './types'

const { changeAdmin } = bze.tokenfactory.MessageComposer.withTypeUrl

function CardTitle({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
    return (
        <HStack gap={2}>
            <Box p={2} borderRadius="lg" bg={`${color}/15`} color={color}>
                {icon}
            </Box>
            <Text fontWeight="semibold">{children}</Text>
        </HStack>
    )
}

function LockCard({ ticker, onOpen }: { ticker: string; onOpen: () => void }) {
    return (
        <Card.Root as="section" aria-label="Lock the supply" variant="outline" p="5" borderColor="red.500/25">
            <VStack align="stretch" gap={4}>
                <CardTitle icon={<LuLock size={18} />} color="red.500">Lock the supply</CardTitle>
                <Text fontSize="sm" color="fg.muted">
                    The strongest trust signal a token can have. Do it last, when your setup is done.
                </Text>
                <Box>
                    <Button colorPalette="red" variant="outline" onClick={onOpen}>
                        {`Lock ${ticker} forever…`}
                    </Button>
                </Box>
            </VStack>
        </Card.Root>
    )
}

function HandOverCard({ asset, onChanged }: { asset: Asset; onChanged: () => void }) {
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
        if (trimmed === address) return 'That is your own address — it already controls the token.'
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
        <Card.Root as="section" aria-label="Hand over control" variant="outline" p="5">
            <VStack align="stretch" gap={4}>
                <CardTitle icon={<LuKeyRound size={18} />} color="orange.500">Hand over control</CardTitle>

                <Field.Root invalid={touched && error !== ''}>
                    <Field.Label>Hand control to (address)</Field.Label>
                    <Input
                        placeholder="bze1…"
                        fontFamily="mono"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />
                    <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>

                <Text fontSize="sm" color="fg.muted">
                    The new address gets every power above and you lose all of it. Use this to move
                    control to a team wallet or a DAO.
                </Text>

                <InfoBox title="You lose all control">
                    {`From the moment this is signed, only the new address can mint, edit what wallets show, set the brand kit or hand control on. Triple-check the address: sending it to the wrong one can't be fixed by anyone but that address's owner.`}
                </InfoBox>

                <Box>
                    <Button
                        colorPalette="orange"
                        variant="outline"
                        onClick={submit}
                        disabled={error !== ''}
                        loading={isSubmitting}
                        loadingText="Waiting for signature..."
                    >
                        Hand over control
                    </Button>
                </Box>
            </VStack>
        </Card.Root>
    )
}

function LockedCard({ ticker }: { ticker: string }) {
    return (
        <Card.Root variant="outline" p="5" borderColor="green.500/30" bg="green.500/5" data-testid="control-locked">
            <VStack align="stretch" gap={3}>
                <CardTitle icon={<LuShieldCheck size={18} />} color="green.500">Supply provably fixed</CardTitle>
                <Text fontSize="sm">{`Nobody can ever mint, edit or brand ${ticker} again.`}</Text>
                <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Still works</Text>
                <VStack align="stretch" gap={1.5}>
                    {keepsWorking(ticker).map(item => (
                        <HStack key={item} gap={2}>
                            <Box color="green.500" flexShrink={0}><LuCheck size={14} /></Box>
                            <Text fontSize="sm">{item}</Text>
                        </HStack>
                    ))}
                </VStack>
            </VStack>
        </Card.Root>
    )
}

/**
 * Who controls the token. The admin hands control over or locks the supply forever (the lock
 * dialog, also opened by `?tab=control&lock=1`); everyone else sees who holds control now.
 */
export function ControlTab({ asset, admin, adminState, supply, supplyDisplay, refreshAdmins, goTo }: WorkspaceTabProps) {
    const ticker = asset.ticker
    const { getQueryParam } = useNavigationWithParams()
    const linkedLock = getQueryParam('lock') === '1'
    const [isLockOpen, setIsLockOpen] = useState(linkedLock)

    const closeLock = () => {
        setIsLockOpen(false)
        // Drop ?lock=1 so a reload doesn't open the dialog again.
        if (linkedLock) goTo(workspaceHref(asset.denom, 'control'))
    }

    return (
        <VStack align="stretch" gap={6}>
            <VStack align="stretch" gap={1}>
                <Text fontWeight="semibold" fontSize="lg">{`Who controls ${ticker}`}</Text>
                <Text fontSize="sm" color="fg.muted">
                    The admin can mint more, edit what wallets show, and set the brand kit.
                </Text>
                <Text fontSize="sm" color="fg.muted">
                    {`Buyers see ${ticker} as `}<Text as="strong" color="fg">Mintable</Text>
                    {` while someone has control, and `}<Text as="strong" color="fg">Fixed supply</Text>
                    {` once it is locked.`}
                </Text>
            </VStack>

            {adminState === 'admin' && (
                <>
                    <LockCard ticker={ticker} onOpen={() => setIsLockOpen(true)} />
                    <HandOverCard asset={asset} onChanged={() => void refreshAdmins()} />
                    <LockDialog
                        open={isLockOpen}
                        onClose={closeLock}
                        onLocked={() => void refreshAdmins()}
                        asset={asset}
                        admin={admin}
                        supply={supply}
                        supplyDisplay={supplyDisplay}
                    />
                </>
            )}

            {adminState === 'renounced' && <LockedCard ticker={ticker} />}

            {adminState === 'not-admin' && (
                <Card.Root variant="outline" p="5" data-testid="control-not-admin">
                    <HStack gap={3} align="start">
                        <Box color="fg.muted" mt={0.5} flexShrink={0}><LuUserRound size={18} /></Box>
                        <Text fontSize="sm" overflowWrap="anywhere">
                            <Text as="span" fontFamily="mono">{admin}</Text>
                            {` controls ${ticker} now.`}
                        </Text>
                    </HStack>
                </Card.Root>
            )}

            {adminState === 'unknown' && (
                <Card.Root variant="outline" p="5" data-testid="control-unknown">
                    <VStack align="stretch" gap={3}>
                        <Text fontSize="sm">{`Couldn't load who controls ${ticker}.`}</Text>
                        <Box>
                            <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => void refreshAdmins()}>
                                <LuRefreshCw />
                                Retry
                            </Button>
                        </Box>
                    </VStack>
                </Card.Root>
            )}
        </VStack>
    )
}
