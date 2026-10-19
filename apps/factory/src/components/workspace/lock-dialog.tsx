"use client"

import React, { useState } from 'react'
import {
    Box,
    Button,
    Checkbox,
    Field,
    Grid,
    HStack,
    Input,
    Text,
    VStack,
} from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import type BigNumber from 'bignumber.js'
import { LuCheck, LuCircleAlert, LuLock, LuLockOpen } from 'react-icons/lu'
import { Asset, Shimmer, getChainName, hgVariant, prettyAmount, useToast } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { FactoryDialog } from '@/components/ui/factory-dialog'
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
            <Box color={row.ok ? 'hg.success' : 'hg.warning'} mt="2px" flexShrink={0}>
                {row.ok ? <LuCheck size={16} /> : <LuCircleAlert size={16} />}
            </Box>
            <Text fontSize="14px" overflowWrap="anywhere">
                {row.title}
                {row.note && <Text as="span" color="hg.text.faint">{` ${row.note}`}</Text>}
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
        <VStack align="stretch" gap="8px" p="16px" borderWidth="1px" borderRadius="14px" borderColor="hg.hairline" bg="hg.inset">
            <Text fontWeight="700" fontSize="14px">Before you lock, check your setup</Text>
            {setup.isLoading ? (
                <VStack align="stretch" gap="8px">
                    <Shimmer h="16px" />
                    <Shimmer h="16px" />
                    <Shimmer h="16px" />
                </VStack>
            ) : (
                <>
                    {rows.map(row => <ChecklistRow key={row.key} row={row} />)}
                    {warnsAboutFrozen && (
                        <Text fontSize="13px" color="hg.warning.text" data-testid="prelock-warning">
                            {`Brand kit and description can't be added after locking.`}
                        </Text>
                    )}
                </>
            )}
        </VStack>
    )
}

/** "Frozen forever" in the danger tint, "Keeps working" in the success tint. */
function ListColumn({ title, items, icon, tone }: { title: string; items: string[]; icon: React.ReactNode; tone: 'danger' | 'success' }) {
    return (
        <VStack align="stretch" gap="6px" p="14px" borderWidth="1px" borderRadius="14px" borderColor={`hg.${tone}/30`} bg={`hg.${tone}/8`}>
            <HStack gap="6px" color={`hg.${tone}.text`}>
                {icon}
                <Text fontWeight="700" fontSize="14px">{title}</Text>
            </HStack>
            {items.map(item => (
                <Text key={item} fontSize="13px">{item}</Text>
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

/** The dialog; its body mounts only while open, so the confirmation starts empty every time. */
function LockDialogContent({ open, onClose, onLocked, ...data }: LockDialogData & { open: boolean; onClose: () => void; onLocked: () => void }) {
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
        <FactoryDialog
            open={open}
            onClose={onClose}
            width="640px"
            titleSize="lg"
            closeLabel="Close dialog"
            kicker="Last step of your launch · optional"
            title={`Lock ${ticker} forever?`}
            description={`Buyers will see Fixed supply instead of Mintable. It's the strongest trust signal a token can have, and it can never be undone, by you, by BeeZee or by anyone.`}
            footer={(
                <>
                    <Button variant={hgVariant('secondary')} size="lg" onClick={onClose} flex={{ base: '1 1 100%', md: '0 0 auto' }}>
                        Not now, keep control
                    </Button>
                    <Button
                        variant={hgVariant('danger')}
                        size="lg"
                        bg="hg.danger.solid"
                        color="white"
                        borderColor="transparent"
                        onClick={submit}
                        disabled={!isArmed}
                        loading={isSubmitting}
                        loadingText="Waiting for signature..."
                        flex={{ base: '1 1 100%', md: '0 0 auto' }}
                        _disabled={{ bg: 'hg.danger.solid', color: 'white', opacity: 0.45 }}
                    >
                        {`Lock ${ticker} forever`}
                    </Button>
                </>
            )}
        >
            <VStack align="stretch" gap="18px">
                <PreLockChecklist {...data} />

                <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="12px">
                    <ListColumn title="Frozen forever" items={frozenForever(ticker)} icon={<LuLock size={15} />} tone="danger" />
                    <ListColumn title="Keeps working" items={keepsWorking(ticker)} icon={<LuLockOpen size={15} />} tone="success" />
                </Grid>

                <Checkbox.Root
                    checked={understood}
                    onCheckedChange={(e) => setUnderstood(e.checked === true)}
                    alignItems="start"
                >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control
                        mt="2px"
                        borderColor="hg.text.faint"
                        _checked={{ bg: 'hg.danger.solid', borderColor: 'hg.danger.solid', color: 'white' }}
                    />
                    <Checkbox.Label fontSize="14px" lineHeight="1.5" fontWeight="400">
                        {`I understand this can't be undone, and that nobody can unlock ${ticker} again.`}
                    </Checkbox.Label>
                </Checkbox.Root>

                <Field.Root>
                    <Field.Label fontSize="14px" fontWeight="600">{`Type ${ticker} to confirm`}</Field.Label>
                    <Input
                        placeholder={ticker}
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        autoComplete="off"
                        h="46px"
                        borderRadius="12px"
                    />
                </Field.Root>
            </VStack>
        </FactoryDialog>
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
    // A fresh mount on every open, so the checkbox and the typed ticker start empty.
    return <LockDialogContent key={open ? 'open' : 'closed'} {...data} open={open} onClose={onClose} onLocked={onLocked} />
}
