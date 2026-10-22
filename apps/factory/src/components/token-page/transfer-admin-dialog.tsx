"use client"

import React, { useEffect, useState } from 'react'
import { Box, Button, chakra, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import { LuPencil, LuTriangleAlert } from 'react-icons/lu'
import { Asset, getChainName, hgVariant, prettyAmount, truncateAddress, useGasFeeEstimate, useToast } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { FactoryDialog } from '@/components/ui/factory-dialog'
import { TxPanel } from '@/components/guided/tx-panel'
import { WarningNote } from '@/components/guided/notes'
import { useWizardTx } from '@/hooks/useWizardTx'
import { ADMIN_POWERS, adminTxHref, transferAdminError } from '@/lib/permissions'

const { changeAdmin } = bze.tokenfactory.MessageComposer.withTypeUrl

/** One review row: a label on the left, what it means on the right; amber when it needs care. */
function ReviewRow({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
    return (
        <HStack
            justify="space-between"
            align="start"
            gap="12px"
            flexWrap="wrap"
            px="14px"
            py="10px"
            borderRadius="12px"
            bg={warn ? 'hg.warning/8' : 'hg.inset'}
            borderWidth="1px"
            borderColor={warn ? 'hg.warning/40' : 'hg.divider'}
            data-testid="transfer-review-row"
        >
            <Text fontSize="13px" fontWeight="700" color={warn ? 'hg.warning.text' : 'fg.muted'}>{label}</Text>
            <Text fontSize="14px" textAlign="end" flex="1 1 200px" color={warn ? 'hg.warning.text' : 'fg'}>{value}</Text>
        </HStack>
    )
}

/** "Step N of 2 · Title", as the wizards number their steps. */
function StepLabel({ number, title }: { number: number; title: string }) {
    return (
        <chakra.span fontSize="11px" letterSpacing="0.1em" textTransform="uppercase" fontWeight="700" color="hg.text.faint">
            {`Step ${number} of 2 · ${title}`}
        </chakra.span>
    )
}

interface TransferAdminDialogProps {
    asset: Asset;
    open: boolean;
    onClose: () => void;
    /** After the chain confirmed it: reload the admin, so the section shows the new one. */
    onTransferred: () => void;
}

/** The dialog's body: mounted only while open, so the address starts empty every time. */
function TransferAdminContent({ asset, open, onClose, onTransferred }: TransferAdminDialogProps) {
    const ticker = asset.ticker
    const { address } = useChain(getChainName())
    const { toast } = useToast()
    const gasFee = useGasFeeEstimate('change-admin')

    const [recipient, setRecipient] = useState('')
    const [touched, setTouched] = useState(false)
    const [step, setStep] = useState<'address' | 'review'>('address')

    const newAdmin = recipient.trim()
    const error = transferAdminError(recipient, address)

    const buildMsgs = () => {
        if (!address || error) return undefined
        return [changeAdmin({ creator: address, denom: asset.denom, newAdmin })]
    }
    const onDone = () => {
        onTransferred()
        onClose()
        toast.success(`${ticker} admin transferred`)
    }
    const { submit, panelProps } = useWizardTx(buildMsgs, {
        title: `Transfer admin of ${ticker}`,
        onDone,
        onEdit: () => setStep('review'),
        href: adminTxHref(asset.denom, 'transfer'),
    })

    // Confirmed: nothing more to read here, the section shows the new admin.
    const confirmed = panelProps?.status === 'confirmed'
    const finish = panelProps?.onContinue
    useEffect(() => {
        if (confirmed) finish?.()
    }, [confirmed, finish])

    const toReview = () => {
        setTouched(true)
        if (!error) setStep('review')
    }

    let body: React.ReactNode
    if (panelProps) {
        body = <TxPanel {...panelProps} />
    } else if (step === 'address') {
        body = (
            <VStack as="form" align="stretch" gap="14px" aria-label="New admin address" onSubmit={(e: React.FormEvent) => { e.preventDefault(); toReview() }}>
                <StepLabel number={1} title="New admin address" />
                <Field.Root invalid={touched && error !== ''}>
                    <Field.Label fontSize="14px" fontWeight="600">New admin address</Field.Label>
                    <Input
                        placeholder="bze1…"
                        h="46px"
                        borderRadius="12px"
                        fontFamily="mono"
                        autoComplete="off"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />
                    <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>
                <Text fontSize="13px" color="fg.muted">A team multisig, a DAO or another wallet of yours.</Text>
                <Box>
                    <Button type="submit" variant={hgVariant('primary')} size="md" disabled={touched && error !== ''}>
                        Continue
                    </Button>
                </Box>
            </VStack>
        )
    } else {
        body = (
            <VStack align="stretch" gap="14px" as="section" aria-label="Review">
                <HStack justify="space-between" gap="10px" flexWrap="wrap" px="14px" py="10px" borderRadius="12px" borderWidth="1px" borderColor="hg.divider">
                    <Text fontSize="13px" minW={0} overflowWrap="anywhere">
                        <Text as="span" color="fg.muted">New admin </Text>
                        <Text as="span" fontFamily="mono" title={newAdmin} data-testid="transfer-new-admin">{truncateAddress(newAdmin)}</Text>
                    </Text>
                    <Button variant="ghost" size="xs" color="hg.link" onClick={() => setStep('address')}>
                        <LuPencil /> Edit
                    </Button>
                </HStack>
                <StepLabel number={2} title="Review" />
                <VStack align="stretch" gap="8px">
                    <ReviewRow label="You lose" value={ADMIN_POWERS} />
                    <ReviewRow label="They get" value="The same." />
                    <ReviewRow label="Permanent for you" value="Only the new admin can give it back." warn />
                </VStack>
                <WarningNote lead="Triple-check the address.">
                    {"Sent to the wrong one, it can't be fixed by anyone but that address's owner."}
                </WarningNote>
                {gasFee.amount.gt(0) && (
                    <Text fontSize="13px" color="fg.muted">{`Network fee ≈ ${prettyAmount(gasFee.displayAmount)} ${gasFee.ticker}`}</Text>
                )}
            </VStack>
        )
    }

    return (
        <FactoryDialog
            open={open}
            onClose={onClose}
            width="520px"
            sheetOnPhones
            title={`Transfer admin of ${ticker}`}
            description="Give admin rights to another address, e.g. a team multisig."
            footer={!panelProps && step === 'review' ? (
                <>
                    <Button variant={hgVariant('secondary')} size="lg" onClick={() => setStep('address')} flex={{ base: '1 1 100%', md: '0 0 auto' }}>
                        Back
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        fontWeight="700"
                        color="hg.warning.text"
                        borderColor="hg.warning/40"
                        bg="transparent"
                        _hover={{ bg: 'hg.warning/8' }}
                        onClick={() => submit()}
                        disabled={!address || error !== ''}
                        flex={{ base: '1 1 100%', md: '0 0 auto' }}
                    >
                        <LuTriangleAlert /> Transfer admin
                    </Button>
                </>
            ) : undefined}
        >
            {body}
        </FactoryDialog>
    )
}

/**
 * "Transfer admin": a two-step wizard in a dialog (new admin address → Review), then the TxPanel.
 * One MsgChangeAdmin to the new address; the wallet loses every admin power at once.
 */
export function TransferAdminDialog(props: TransferAdminDialogProps) {
    return props.open ? <TransferAdminContent {...props} /> : null
}
