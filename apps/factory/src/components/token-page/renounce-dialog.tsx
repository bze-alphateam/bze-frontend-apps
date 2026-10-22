"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, Field, Grid, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import type BigNumber from 'bignumber.js'
import { LuCheck, LuCircleAlert, LuX } from 'react-icons/lu'
import { Asset, Shimmer, getChainName, hgVariant, prettyAmount, useGasFeeEstimate, useToast } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { FactoryDialog } from '@/components/ui/factory-dialog'
import { TxPanel } from '@/components/guided/tx-panel'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { useWizardTx } from '@/hooks/useWizardTx'
import { adminTxHref, goneForever, renounceArmed, renounceHints, staysTheSame } from '@/lib/permissions'

const { changeAdmin } = bze.tokenfactory.MessageComposer.withTypeUrl

/** "Gone forever" (✕, danger tint) and "Stays the same" (✓, success tint). */
function ListColumn({ title, items, tone }: { title: string; items: string[]; tone: 'danger' | 'success' }) {
    return (
        <VStack
            as="section"
            aria-label={title}
            align="stretch"
            gap="8px"
            p="14px"
            borderWidth="1px"
            borderRadius="14px"
            borderColor={`hg.${tone}/30`}
            bg={`hg.${tone}/8`}
        >
            <Text fontWeight="700" fontSize="14px" color={`hg.${tone}.text`}>{title}</Text>
            <VStack as="ul" align="stretch" gap="6px" m="0" p="0" listStyleType="none">
                {items.map(item => (
                    <HStack as="li" key={item} gap="8px" align="start">
                        <Box color={`hg.${tone}.text`} mt="3px" flexShrink={0} aria-hidden>
                            {tone === 'danger' ? <LuX size={14} strokeWidth={3} /> : <LuCheck size={14} strokeWidth={3} />}
                        </Box>
                        <Text fontSize="13px">{item}</Text>
                    </HStack>
                ))}
            </VStack>
        </VStack>
    )
}

/** The pre-renounce facts, read from the chain each time the dialog opens. */
function Hints({ asset, admin, supply }: Pick<RenounceDialogProps, 'asset' | 'admin' | 'supply'>) {
    const setup = useTokenSetup(asset.denom, { admin, supply })
    if (setup.isLoading) {
        return (
            <VStack align="stretch" gap="8px" aria-busy="true">
                <Shimmer h="16px" />
                <Shimmer h="16px" />
            </VStack>
        )
    }
    const hints = renounceHints(setup.items)
    if (hints.length === 0) return null

    return (
        <VStack align="stretch" gap="8px" data-testid="renounce-hints">
            {hints.map(hint => (
                <HStack key={hint.key} gap="8px" align="start" data-testid={`renounce-hint-${hint.key}`} data-ok={hint.ok}>
                    <Box color={hint.ok ? 'hg.success' : 'hg.warning'} mt="2px" flexShrink={0} aria-hidden>
                        {hint.ok ? <LuCheck size={16} /> : <LuCircleAlert size={16} />}
                    </Box>
                    <Text fontSize="14px" overflowWrap="anywhere">{hint.text}</Text>
                </HStack>
            ))}
        </VStack>
    )
}

interface RenounceDialogProps {
    asset: Asset;
    /** The live admin (the connected wallet) and supply, for the setup facts. */
    admin: string | undefined;
    supply?: string;
    /** Total supply in display units: what stays fixed from now on. */
    supplyDisplay: BigNumber;
    open: boolean;
    onClose: () => void;
    /** After the chain confirmed it: reload the admin, so the page shows "Admin given up" everywhere. */
    onRenounced: () => void;
}

/** The dialog's body: mounted only while open, so the typed ticker starts empty every time. */
function RenounceContent({ asset, admin, supply, supplyDisplay, open, onClose, onRenounced }: RenounceDialogProps) {
    const ticker = asset.ticker
    const { address } = useChain(getChainName())
    const { toast } = useToast()
    const gasFee = useGasFeeEstimate('change-admin')
    const keepRef = useRef<HTMLButtonElement>(null)
    const [typed, setTyped] = useState('')
    const armed = renounceArmed(typed, ticker)

    const buildMsgs = () => {
        if (!address || !armed) return undefined
        return [changeAdmin({ creator: address, denom: asset.denom, newAdmin: '' })]
    }
    const onDone = () => {
        onClose()
        onRenounced()
        toast.success(`${ticker} admin renounced`)
    }
    const { submit, panelProps } = useWizardTx(buildMsgs, {
        title: `Renounce admin of ${ticker}`,
        onDone,
        href: adminTxHref(asset.denom, 'renounce'),
    })

    // Confirmed: close, and the page re-renders as "Admin given up".
    const confirmed = panelProps?.status === 'confirmed'
    const finish = panelProps?.onContinue
    useEffect(() => {
        if (confirmed) finish?.()
    }, [confirmed, finish])

    return (
        <FactoryDialog
            open={open}
            onClose={onClose}
            width="640px"
            titleSize="lg"
            sheetOnPhones
            closeLabel="Close dialog"
            title={`Renounce admin of ${ticker}?`}
            description="This is permanent. There is no undo, not by you, not by BeeZee."
            initialFocusEl={() => keepRef.current}
            footer={panelProps ? undefined : (
                <>
                    {gasFee.amount.gt(0) && (
                        <Text fontSize="13px" color="fg.muted" me="auto" data-testid="renounce-network-fee">
                            {`Network fee ≈ ${prettyAmount(gasFee.displayAmount)} ${gasFee.ticker}`}
                        </Text>
                    )}
                    <Button ref={keepRef} variant={hgVariant('secondary')} size="lg" onClick={onClose} flex={{ base: '1 1 100%', md: '0 0 auto' }}>
                        Keep admin
                    </Button>
                    <Button
                        variant={hgVariant('danger')}
                        size="lg"
                        bg="hg.danger.solid"
                        color="white"
                        borderColor="transparent"
                        onClick={() => submit()}
                        disabled={!armed || !address}
                        flex={{ base: '1 1 100%', md: '0 0 auto' }}
                        _disabled={{ bg: 'hg.danger.solid', color: 'white', opacity: 0.45 }}
                    >
                        Renounce admin
                    </Button>
                </>
            )}
        >
            {panelProps ? <TxPanel {...panelProps} /> : (
                <VStack align="stretch" gap="18px">
                    <Hints asset={asset} admin={admin} supply={supply} />

                    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="12px">
                        <ListColumn title="Gone forever" items={goneForever(ticker)} tone="danger" />
                        <ListColumn title="Stays the same" items={staysTheSame(ticker)} tone="success" />
                    </Grid>

                    <HStack justify="space-between" gap="12px" flexWrap="wrap" px="14px" py="10px" borderRadius="12px" bg="hg.inset" data-testid="renounce-supply">
                        <Text fontSize="13px" color="fg.muted">Supply, fixed from now on</Text>
                        <Text fontSize="14px" fontWeight="700">{`${prettyAmount(supplyDisplay)} ${ticker}`}</Text>
                    </HStack>

                    <Field.Root>
                        <Field.Label fontSize="14px" fontWeight="600">{`Type ${ticker} to confirm`}</Field.Label>
                        <Input
                            placeholder={ticker}
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            h="46px"
                            borderRadius="12px"
                        />
                    </Field.Root>
                </VStack>
            )}
        </FactoryDialog>
    )
}

/**
 * "Renounce admin of <T>?": its own review dialog, opened only by the Permissions section's
 * Renounce… button (never a next step). One MsgChangeAdmin to '', armed by typing the exact
 * ticker; "Keep admin" has the focus.
 */
export function RenounceDialog(props: RenounceDialogProps) {
    return props.open ? <RenounceContent {...props} /> : null
}
