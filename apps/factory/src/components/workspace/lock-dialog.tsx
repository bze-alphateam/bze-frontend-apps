"use client"

import React, { useState } from 'react'
import {
    Box,
    Button,
    Checkbox,
    CloseButton,
    Dialog,
    Field,
    Grid,
    HStack,
    Input,
    Portal,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import type BigNumber from 'bignumber.js'
import { LuCheck, LuCircleAlert, LuLock, LuLockOpen } from 'react-icons/lu'
import { Asset, getChainName, prettyAmount, useToast } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import type { SetupItem } from '@/lib/token-setup'

const { changeAdmin } = bze.tokenfactory.MessageComposer.withTypeUrl

/** What the lock freezes for good. */
export const frozenForever = (ticker: string) => [
    `Minting more ${ticker}`,
    'Name and description',
    'Brand kit colours and font',
    'Handing control to someone else',
]

/** What a locked token can still do. */
export const keepsWorking = (ticker: string) => [
    'Trading, pools and markets',
    'Holder rewards, airdrops, staking programs',
    `Anyone burning their own ${ticker}`,
    'Getting listed in the registry',
]

// Setup items the lock freezes, with the dialog's wording.
const LOCK_AFFECTED: { key: string; title: string }[] = [
    { key: 'description', title: 'Name and description are final' },
    { key: 'brandKit', title: 'Brand kit is set' },
]

// Setup items worth a last look that the lock doesn't touch (the registry item comes with BFE-164).
const LOCK_UNAFFECTED_KEYS = ['registry']

interface CheckRow {
    key: string;
    title: string;
    ok: boolean;
    note?: string;
}

function ChecklistRow({ row }: { row: CheckRow }) {
    return (
        <HStack gap={2} align="start" data-testid={`prelock-${row.key}`} data-ok={row.ok}>
            <Box color={row.ok ? 'green.500' : 'orange.500'} mt={0.5} flexShrink={0}>
                {row.ok ? <LuCheck size={16} /> : <LuCircleAlert size={16} />}
            </Box>
            <Text fontSize="sm" overflowWrap="anywhere">
                {row.title}
                {row.note && <Text as="span" color="fg.muted">{` ${row.note}`}</Text>}
            </Text>
        </HStack>
    )
}

/** "Before you lock, check your setup": read from the chain each time the dialog opens. */
function PreLockChecklist({ asset, admin, supply, supplyDisplay }: LockDialogData) {
    const setup = useTokenSetup(asset.denom, { admin, supply })
    const byKey = new Map<string, SetupItem>(setup.items.map(item => [item.key, item]))

    const rows: CheckRow[] = [
        ...LOCK_AFFECTED.flatMap(({ key, title }) => {
            const item = byKey.get(key)
            return item ? [{ key, title, ok: item.state === 'done' }] : []
        }),
        { key: 'supply', title: `Supply is what you want: ${prettyAmount(supplyDisplay)} ${asset.ticker}`, ok: true },
        ...LOCK_UNAFFECTED_KEYS.flatMap(key => {
            const item = byKey.get(key)
            return item ? [{ key, title: item.title, ok: item.state === 'done', note: '(not affected by the lock)' }] : []
        }),
    ]
    const warnsAboutFrozen = rows.some(row => !row.ok && LOCK_AFFECTED.some(a => a.key === row.key))

    return (
        <VStack align="stretch" gap={2} p={4} borderWidth="1px" borderRadius="xl" borderColor="border.muted">
            <Text fontWeight="semibold" fontSize="sm">Before you lock, check your setup</Text>
            {setup.isLoading ? (
                <VStack align="stretch" gap={2}>
                    <Skeleton height="4" />
                    <Skeleton height="4" />
                    <Skeleton height="4" />
                </VStack>
            ) : (
                <>
                    {rows.map(row => <ChecklistRow key={row.key} row={row} />)}
                    {warnsAboutFrozen && (
                        <Text fontSize="sm" color="orange.600" data-testid="prelock-warning">
                            {`Brand kit and description can't be added after locking.`}
                        </Text>
                    )}
                </>
            )}
        </VStack>
    )
}

function ListColumn({ title, items, icon, color }: { title: string; items: string[]; icon: React.ReactNode; color: string }) {
    return (
        <VStack align="stretch" gap={2} p={4} borderWidth="1px" borderRadius="xl" borderColor={`${color}/30`} bg={`${color}/5`}>
            <HStack gap={2} color={color}>
                {icon}
                <Text fontWeight="semibold" fontSize="sm">{title}</Text>
            </HStack>
            {items.map(item => (
                <Text key={item} fontSize="sm">{item}</Text>
            ))}
        </VStack>
    )
}

interface LockDialogData {
    asset: Asset;
    admin: string | undefined;
    /** Live total supply in base units. */
    supply?: string;
    supplyDisplay: BigNumber;
}

/** The dialog's contents; mounted only while open, so the confirmation starts empty every time. */
function LockDialogContent({ onClose, onLocked, ...data }: LockDialogData & { onClose: () => void; onLocked: () => void }) {
    const { asset } = data
    const ticker = asset.ticker
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { toast } = useToast()

    const [understood, setUnderstood] = useState(false)
    const [confirmation, setConfirmation] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const isArmed = understood && confirmation === ticker

    const submit = async () => {
        if (!address || !isArmed) return

        const msg = changeAdmin({ creator: address, denom: asset.denom, newAdmin: '' })

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: () => {
                    onClose()
                    onLocked()
                    toast.success(`${ticker} is locked forever`)
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <Dialog.Header flexDirection="column" alignItems="start" gap={1}>
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                    Last step of your launch · optional
                </Text>
                <Dialog.Title fontSize="xl" fontWeight="bold">{`Lock ${ticker} forever?`}</Dialog.Title>
                <Dialog.Description color="fg.muted" fontSize="sm">
                    {`Buyers will see Fixed supply instead of Mintable. It's the strongest trust signal a token can have, and it can never be undone, by you, by BeeZee or by anyone.`}
                </Dialog.Description>
                <Dialog.CloseTrigger asChild>
                    <CloseButton size="sm" aria-label="Close dialog" />
                </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
                <VStack align="stretch" gap={4}>
                    <PreLockChecklist {...data} />

                    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap={3}>
                        <ListColumn title="Frozen forever" items={frozenForever(ticker)} icon={<LuLock size={16} />} color="red.500" />
                        <ListColumn title="Keeps working" items={keepsWorking(ticker)} icon={<LuLockOpen size={16} />} color="green.500" />
                    </Grid>

                    <Checkbox.Root
                        checked={understood}
                        onCheckedChange={(e) => setUnderstood(e.checked === true)}
                        colorPalette="red"
                        alignItems="start"
                    >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control mt={0.5} />
                        <Checkbox.Label fontSize="sm">
                            {`I understand this can't be undone, and that nobody can unlock ${ticker} again.`}
                        </Checkbox.Label>
                    </Checkbox.Root>

                    <Field.Root>
                        <Field.Label>{`Type ${ticker} to confirm`}</Field.Label>
                        <Input
                            placeholder={ticker}
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            autoComplete="off"
                        />
                    </Field.Root>
                </VStack>
            </Dialog.Body>

            <Dialog.Footer flexWrap="wrap" gap={2}>
                <Button variant="outline" onClick={onClose} flex={{ base: '1 1 100%', md: '0 0 auto' }}>
                    Not now, keep control
                </Button>
                <Button
                    colorPalette="red"
                    onClick={submit}
                    disabled={!isArmed}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                    flex={{ base: '1 1 100%', md: '0 0 auto' }}
                >
                    {`Lock ${ticker} forever`}
                </Button>
            </Dialog.Footer>
        </>
    )
}

/**
 * "Lock <TICKER> forever?": the last, optional launch step. Renounces the admin with one
 * MsgChangeAdmin (newAdmin ''), armed only by the checkbox and the exact ticker.
 */
export function LockDialog({
    open,
    onClose,
    onLocked,
    ...data
}: LockDialogData & { open: boolean; onClose: () => void; onLocked: () => void }) {
    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => !e.open && onClose()}
            size="lg"
            scrollBehavior="inside"
            lazyMount={true}
            unmountOnExit={true}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: 'calc(100vw - 32px)', md: '640px' }} borderRadius="2xl">
                        <LockDialogContent {...data} onClose={onClose} onLocked={onLocked} />
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
