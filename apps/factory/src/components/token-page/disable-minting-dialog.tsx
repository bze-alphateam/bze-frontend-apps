"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, Field, Grid, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import type BigNumber from 'bignumber.js'
import { LuCheck, LuX } from 'react-icons/lu'
import { Asset, getChainName, hgVariant, prettyAmount, useGasFeeEstimate, useToast } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { FactoryDialog } from '@/components/ui/factory-dialog'
import { TxPanel } from '@/components/guided/tx-panel'
import { useWizardTx } from '@/hooks/useWizardTx'
import { adminTxHref, disableMintingArmed, mintingGoneForever, mintingStaysTheSame } from '@/lib/permissions'
import { ActionItem, ItemButton } from './action-group'

const { disableMinting } = bze.tokenfactory.MessageComposer.withTypeUrl

/** "Ends for good" (✕, danger tint) and "Stays the same" (✓, success tint). */
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

interface DisableMintingDialogProps {
    asset: Asset;
    /** Total supply in display units: what stays fixed from now on. */
    supplyDisplay: BigNumber;
    open: boolean;
    onClose: () => void;
    /** After the chain confirmed it: reload the admin state, so Mint disappears. */
    onDisabled: () => void;
}

/** The dialog's body: mounted only while open, so the typed ticker starts empty every time. */
function DisableMintingContent({ asset, supplyDisplay, open, onClose, onDisabled }: DisableMintingDialogProps) {
    const ticker = asset.ticker
    const { address } = useChain(getChainName())
    const { toast } = useToast()
    const gasFee = useGasFeeEstimate('change-admin')
    const keepRef = useRef<HTMLButtonElement>(null)
    const [typed, setTyped] = useState('')
    const armed = disableMintingArmed(typed, ticker)

    const buildMsgs = () => {
        if (!address || !armed) return undefined
        return [disableMinting({ creator: address, denom: asset.denom })]
    }
    const onDone = () => {
        onClose()
        onDisabled()
        toast.success(`Minting of ${ticker} turned off for good`)
    }
    const { submit, panelProps } = useWizardTx(buildMsgs, {
        title: `Turn off minting of ${ticker}`,
        onDone,
        href: adminTxHref(asset.denom, 'disable-minting'),
    })

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
            title={`Turn off minting of ${ticker} for good?`}
            description="Permanent."
            initialFocusEl={() => keepRef.current}
            footer={panelProps ? undefined : (
                <>
                    {gasFee.amount.gt(0) && (
                        <Text fontSize="13px" color="fg.muted" me="auto" data-testid="disable-minting-network-fee">
                            {`Network fee ≈ ${prettyAmount(gasFee.displayAmount)} ${gasFee.ticker}`}
                        </Text>
                    )}
                    <Button ref={keepRef} variant={hgVariant('secondary')} size="lg" onClick={onClose} flex={{ base: '1 1 100%', md: '0 0 auto' }}>
                        Keep minting on
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
                        Turn off minting
                    </Button>
                </>
            )}
        >
            {panelProps ? <TxPanel {...panelProps} /> : (
                <VStack align="stretch" gap="18px">
                    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="12px">
                        <ListColumn title="Ends for good" items={mintingGoneForever(ticker)} tone="danger" />
                        <ListColumn title="Stays the same" items={mintingStaysTheSame(ticker)} tone="success" />
                    </Grid>

                    <HStack justify="space-between" gap="12px" flexWrap="wrap" px="14px" py="10px" borderRadius="12px" bg="hg.inset" data-testid="disable-minting-supply">
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
 * "Turn off minting for good" (BFE-384): one MsgDisableMinting, armed by typing the exact ticker;
 * "Keep minting on" has the focus. Irreversible, even for governance.
 */
export function DisableMintingDialog(props: DisableMintingDialogProps) {
    return props.open ? <DisableMintingContent {...props} /> : null
}

/** The Supply group's item: shown by the group for the admin of a mintable token on a v8.3.0 node only. */
export function DisableMintingItem({ asset, supplyDisplay, onDisabled }: Omit<DisableMintingDialogProps, 'open' | 'onClose'>) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <ActionItem
                testId="disable-minting-item"
                title="Turn off minting for good"
                action={<ItemButton onClick={() => setOpen(true)}>Turn off…</ItemButton>}
            />
            <DisableMintingDialog asset={asset} supplyDisplay={supplyDisplay} open={open} onClose={() => setOpen(false)} onDisabled={onDisabled} />
        </>
    )
}
