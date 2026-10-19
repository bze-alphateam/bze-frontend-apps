"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Field, Grid, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import { LuCheck, LuKeyRound, LuLock, LuRefreshCw, LuShieldCheck, LuUserRound } from 'react-icons/lu'
import { Asset, HgCard, IconTile, Notice, getChainName, hgVariant, validateBZEBech32Address } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { softButton } from '@/components/ui/soft-button'
import { workspaceHref } from '@/lib/workspace'
import { keepsWorking, LockDialog } from './lock-dialog'
import type { WorkspaceTabProps } from './types'

const { changeAdmin } = bze.tokenfactory.MessageComposer.withTypeUrl

function CardTitle({ icon, children, success = false }: { icon: React.ReactNode; children: React.ReactNode; success?: boolean }) {
    return (
        <HStack gap="10px">
            {success ? (
                <Box
                    as="span"
                    aria-hidden
                    boxSize="36px"
                    flexShrink={0}
                    borderRadius="hg.md"
                    bg="hg.success/16"
                    color="hg.success.text"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                >
                    {icon}
                </Box>
            ) : (
                <IconTile icon={icon} size={36} />
            )}
            <Text as="h3" fontSize="17px" fontWeight="700">{children}</Text>
        </HStack>
    )
}

function LockCard({ ticker, onOpen }: { ticker: string; onOpen: () => void }) {
    return (
        <HgCard as="section" aria-label="Lock the supply" p="22px">
            <VStack align="stretch" gap="16px">
                <CardTitle icon={<LuLock />}>Lock the supply</CardTitle>
                <Text fontSize="14px" lineHeight="1.55" color="fg.muted">
                    The strongest trust signal a token can have. Do it last, when your setup is done.
                </Text>
                <Box>
                    <Button variant={hgVariant('danger')} size="lg" h="42px" fontWeight="700" onClick={onOpen}>
                        {`Lock ${ticker} forever…`}
                    </Button>
                </Box>
            </VStack>
        </HgCard>
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
        <HgCard as="section" aria-label="Hand over control" p="22px">
            <VStack align="stretch" gap="16px">
                <CardTitle icon={<LuKeyRound />}>Hand over control</CardTitle>

                <Field.Root invalid={touched && error !== ''}>
                    <Field.Label fontSize="14px" fontWeight="600">Hand control to (address)</Field.Label>
                    <Input
                        placeholder="bze1…"
                        h="46px"
                        borderRadius="12px"
                        fontFamily="mono"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />
                    <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>

                <Text fontSize="14px" lineHeight="1.55" color="fg.muted">
                    The new address gets every power above and you lose all of it. Use this to move
                    control to a team wallet or a DAO.
                </Text>

                <Notice status="warning" title="You lose all control">
                    {`From the moment this is signed, only the new address can mint, edit what wallets show, set the brand kit or hand control on. Triple-check the address: sending it to the wrong one can't be fixed by anyone but that address's owner.`}
                </Notice>

                <Box>
                    <Button
                        variant="outline"
                        size="lg"
                        h="42px"
                        borderRadius="hg.md"
                        fontWeight="700"
                        color="hg.warning.text"
                        borderColor="hg.warning/40"
                        bg="transparent"
                        _hover={{ bg: 'hg.warning/8' }}
                        _disabled={{ opacity: 0.55 }}
                        onClick={submit}
                        disabled={error !== ''}
                        loading={isSubmitting}
                        loadingText="Waiting for signature..."
                    >
                        Hand over control
                    </Button>
                </Box>
            </VStack>
        </HgCard>
    )
}

function LockedCard({ ticker }: { ticker: string }) {
    return (
        <Box p="22px" borderRadius="hg.lg" borderWidth="1px" borderColor="hg.success/30" bg="hg.success/5" data-testid="control-locked">
            <VStack align="stretch" gap="12px">
                <CardTitle icon={<LuShieldCheck />} success>Supply provably fixed</CardTitle>
                <Text fontSize="14px">{`Nobody can ever mint, edit or brand ${ticker} again.`}</Text>
                <Text fontSize="13px" fontWeight="600" color="fg.muted">Still works</Text>
                <VStack align="stretch" gap="6px">
                    {keepsWorking(ticker).map(item => (
                        <HStack key={item} gap="8px">
                            <Box color="hg.success" flexShrink={0} aria-hidden><LuCheck size={14} strokeWidth={3} /></Box>
                            <Text fontSize="14px">{item}</Text>
                        </HStack>
                    ))}
                </VStack>
            </VStack>
        </Box>
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
        <VStack align="stretch" gap="24px">
            <VStack align="stretch" gap="6px">
                <Text as="h2" fontWeight="700" fontSize="20px">{`Who controls ${ticker}`}</Text>
                <Text fontSize="14px" color="fg.muted">
                    The admin can mint more, edit what wallets show, and set the brand kit.
                </Text>
                <Text fontSize="14px" color="fg.muted">
                    {`Buyers see ${ticker} as `}<Text as="strong" color="fg">Mintable</Text>
                    {` while someone has control, and `}<Text as="strong" color="fg">Fixed supply</Text>
                    {` once it is locked.`}
                </Text>
            </VStack>

            {adminState === 'admin' && (
                <>
                    <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px" alignItems="start">
                        <LockCard ticker={ticker} onOpen={() => setIsLockOpen(true)} />
                        <HandOverCard asset={asset} onChanged={() => void refreshAdmins()} />
                    </Grid>
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
                <HgCard p="22px" data-testid="control-not-admin">
                    <HStack gap="12px" align="start">
                        <Box color="fg.muted" mt="2px" flexShrink={0} aria-hidden><LuUserRound size={18} /></Box>
                        <Text fontSize="14px" lineHeight="1.55" overflowWrap="anywhere">
                            <Text as="span" fontFamily="mono" fontSize="13px">{admin}</Text>
                            {` controls ${ticker} now.`}
                        </Text>
                    </HStack>
                </HgCard>
            )}

            {adminState === 'unknown' && (
                <HgCard p="22px" data-testid="control-unknown">
                    <VStack align="stretch" gap="12px">
                        <Text fontSize="14px">{`Couldn't load who controls ${ticker}.`}</Text>
                        <Box>
                            <Button {...softButton} size="sm" onClick={() => void refreshAdmins()}>
                                <LuRefreshCw />
                                Retry
                            </Button>
                        </Box>
                    </VStack>
                </HgCard>
            )}
        </VStack>
    )
}
