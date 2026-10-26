"use client"

import React, { useId, useState } from 'react'
import { Box, Button, chakra, Flex, Spinner, Text, VStack } from '@chakra-ui/react'
import { LuCircleAlert, LuCircleCheck, LuClock, LuUndo2, LuWallet } from 'react-icons/lu'
import { AppLink, getExplorerTxURL, hgVariant } from '@bze/bze-ui-kit'

/**
 * - `confirm`: waiting for the wallet (before broadcast);
 * - `submitted`: broadcast, waiting for a block;
 * - `confirmed`: included and executed;
 * - `declined`: the wallet didn't sign it, nothing was broadcast;
 * - `failed`: refused (by the chain, or by a check before the wallet opened);
 * - `slow`: 60 s after broadcast with no result yet.
 */
export type TxPanelStatus = 'confirm' | 'submitted' | 'confirmed' | 'declined' | 'failed' | 'slow'

export interface TxPanelError {
    /** The plain reason (prettyError). */
    reason: string;
    /** The raw log, behind "Details". */
    details?: string;
    /** It reached the chain, so the network fee was spent. */
    feeSpent?: boolean;
}

export interface TxPanelProps {
    status: TxPanelStatus;
    hash?: string;
    height?: number;
    error?: TxPanelError;
    /** A status check is running (the Check transaction status button). */
    checking?: boolean;
    /** Signs and sends the same answers again (Declined, Failed). */
    onRetry: () => void;
    /** Back to the Review step (Declined). */
    onEdit: () => void;
    /** To the Done screen (Confirmed). */
    onContinue: () => void;
    /** Looks the hash up on the chain (Taking longer). */
    onCheckStatus?: () => void;
    /** Back to waiting (Taking longer). */
    onKeepWaiting?: () => void;
}

export const shortHash = (hash: string) => (hash.length > 14 ? `${hash.slice(0, 6)}…${hash.slice(-6)}` : hash)

const TONES = {
    neutral: { edge: 'app.solid/60', icon: 'app.fg' },
    success: { edge: 'hg.success/45', icon: 'hg.success.text' },
    warning: { edge: 'hg.warning/45', icon: 'hg.warning.text' },
    danger: { edge: 'hg.danger.solid', icon: 'hg.danger.text' },
} as const

function HashLine({ hash }: { hash: string }) {
    return (
        <Flex align="center" gap="10px" wrap="wrap" fontSize="13px">
            <chakra.span color="fg.muted">Transaction</chakra.span>
            <chakra.code fontFamily="mono" title={hash}>{shortHash(hash)}</chakra.code>
            <AppLink app="explorer" href={getExplorerTxURL(hash)}>Explorer</AppLink>
        </Flex>
    )
}

function Shell({ tone, icon, title, children, actions }: {
    tone: keyof typeof TONES;
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <VStack
            as="section"
            aria-label="Transaction"
            data-testid="tx-panel"
            align="stretch"
            gap="14px"
            p={{ base: '16px', md: '22px' }}
            borderRadius="hg.lg"
            borderWidth="1px"
            borderColor={TONES[tone].edge}
            bg="hg.card"
            boxShadow="hg.featured"
        >
            <Flex align="center" gap="10px" role="status" aria-live="polite">
                <Box color={TONES[tone].icon} flexShrink={0} display="inline-flex">{icon}</Box>
                <chakra.h2 m="0" fontSize={{ base: '18px', md: '20px' }} fontWeight="700">{title}</chakra.h2>
            </Flex>
            <VStack align="stretch" gap="10px" fontSize="14px" lineHeight="1.55" color="fg.muted">{children}</VStack>
            {actions && <Flex gap="8px" wrap="wrap">{actions}</Flex>}
        </VStack>
    )
}

/**
 * The in-page transaction panel that replaces the Review card after the final button. It never
 * offers a Cancel while the wallet is open: the page can't cancel a wallet prompt, so the copy
 * points to the wallet instead.
 */
export function TxPanel({ status, hash, height, error, checking, onRetry, onEdit, onContinue, onCheckStatus, onKeepWaiting }: TxPanelProps) {
    const [showDetails, setShowDetails] = useState(false)
    const detailsId = useId()

    switch (status) {
        case 'confirm':
            return (
                <Shell tone="neutral" icon={<LuWallet size={20} />} title="Confirm in your wallet">
                    <Text>
                        Your wallet shows the same amounts you just reviewed. Nothing happens until you approve there.
                        To cancel, reject it in your wallet.
                    </Text>
                </Shell>
            )
        case 'submitted':
            return (
                <Shell tone="neutral" icon={<Spinner size="sm" />} title="Submitted, waiting for a block">
                    <Text>Usually a few seconds. You can leave this page; we keep watching.</Text>
                    {hash && <HashLine hash={hash} />}
                </Shell>
            )
        case 'confirmed':
            return (
                <Shell
                    tone="success"
                    icon={<LuCircleCheck size={20} />}
                    title="Confirmed"
                    actions={<Button variant={hgVariant('primary')} onClick={onContinue}>Continue</Button>}
                >
                    <Text>{height ? `Included in block ${height.toLocaleString('en-US')}.` : 'Included in a block.'}</Text>
                    {hash && <HashLine hash={hash} />}
                </Shell>
            )
        case 'declined':
            return (
                <Shell
                    tone="warning"
                    icon={<LuUndo2 size={20} />}
                    title="You declined in the wallet"
                    actions={
                        <>
                            <Button variant={hgVariant('primary')} onClick={onRetry}>Try again</Button>
                            <Button variant={hgVariant('secondary')} onClick={onEdit}>Edit answers</Button>
                        </>
                    }
                >
                    <Text>Nothing left your wallet. Your answers are still here.</Text>
                </Shell>
            )
        case 'failed':
            return (
                <Shell
                    tone="danger"
                    icon={<LuCircleAlert size={20} />}
                    title="The chain didn't accept it"
                    actions={
                        <>
                            <Button variant={hgVariant('primary')} onClick={onRetry}>Try again</Button>
                            {error?.details && (
                                <Button
                                    variant={hgVariant('secondary')}
                                    aria-expanded={showDetails}
                                    aria-controls={detailsId}
                                    onClick={() => setShowDetails(v => !v)}
                                >
                                    Details
                                </Button>
                            )}
                        </>
                    }
                >
                    <Text color="fg" fontWeight="600">{error?.reason ?? 'Something went wrong.'}</Text>
                    <Text>
                        {error?.feeSpent
                            ? 'Only the network fee was spent. Your answers are still here.'
                            : 'Nothing left your wallet. Your answers are still here.'}
                    </Text>
                    {hash && <HashLine hash={hash} />}
                    {error?.details && showDetails && (
                        <chakra.pre
                            id={detailsId}
                            m="0"
                            p="10px"
                            borderRadius="hg.md"
                            bg="hg.inset"
                            fontFamily="mono"
                            fontSize="12px"
                            whiteSpace="pre-wrap"
                            overflowWrap="anywhere"
                        >
                            {error.details}
                        </chakra.pre>
                    )}
                </Shell>
            )
        case 'slow':
            return (
                <Shell
                    tone="warning"
                    icon={<LuClock size={20} />}
                    title="Taking longer than usual"
                    actions={
                        <>
                            <Button variant={hgVariant('primary')} onClick={onCheckStatus} loading={checking} loadingText="Checking...">
                                Check transaction status
                            </Button>
                            <Button variant={hgVariant('secondary')} onClick={onKeepWaiting} disabled={checking}>Keep waiting</Button>
                        </>
                    }
                >
                    <Text>{"That doesn't mean it failed, so don't send it again yet."}</Text>
                    {hash && <HashLine hash={hash} />}
                </Shell>
            )
    }
}
