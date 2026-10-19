"use client"

import React from 'react'
import { Box, Button, chakra, HStack, Text, VStack } from '@chakra-ui/react'
import { LuDownload } from 'react-icons/lu'
import { AppIconButton, getExplorerTxURL, hgVariant } from '@bze/bze-ui-kit'
import { WarningNote } from '@/components/guided'
import { MultiSendRun, RunBatch, batchLabel, nextBatch, sentCount } from '@/lib/multisend-run'
import { softButton } from '@/components/ui/soft-button'

interface RunProgressProps {
    run: MultiSendRun;
    decimals: number;
    ticker: string;
    /** Stopped, or reopened from the browser: shows the resume line and "Continue". */
    paused: boolean;
    /** Batches whose chain check couldn't reach the node. */
    checkErrors: ReadonlyArray<number>;
    /** The batch waiting for its signature. */
    sendingId?: number;
    /** Why the next batch can't be sent (wallet, balance), or ''. */
    blocker: string;
    reportHref?: string;
    onSendNext: () => void;
    onStop: () => void;
    onContinue: () => void;
    onCheckAgain: (id: number) => void;
    onSendAgain: (id: number) => void;
}

function BatchStatus({ batch, checkError, onCheckAgain }: { batch: RunBatch; checkError: boolean; onCheckAgain: () => void }) {
    if (batch.status === 'sent') {
        return (
            <HStack gap="4px" color="hg.success.text" flexShrink={0}>
                <Text fontWeight="600">Sent ✓</Text>
                {batch.txHash && (
                    <AppIconButton app="explorer" href={getExplorerTxURL(batch.txHash)} aria-label="View transaction" size="xs" />
                )}
            </HStack>
        )
    }
    if (batch.status === 'sending') return <Text color="fg.muted" flexShrink={0}>Sending…</Text>
    if (batch.status === 'pending') return <Text color="fg.muted" flexShrink={0}>Waiting</Text>
    if (batch.notFound) return <Text color="hg.danger.text" fontWeight="600" flexShrink={0}>Not found</Text>
    if (checkError) {
        return (
            <HStack gap="4px" flexShrink={0}>
                <Text color="hg.danger.text" fontWeight="600">Couldn&apos;t check</Text>
                <Button size="2xs" variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={onCheckAgain}>Check again</Button>
            </HStack>
        )
    }
    return <Text color="fg.muted" flexShrink={0}>Checking…</Text>
}

/** "Transaction i of k": one row per batch, one signature per click, stop and resume. */
export function RunProgress({
    run, decimals, ticker, paused, checkErrors, sendingId, blocker, reportHref,
    onSendNext, onStop, onContinue, onCheckAgain, onSendAgain,
}: RunProgressProps) {
    const k = run.batches.length
    const sent = sentCount(run)
    const next = nextBatch(run)
    const notFound = run.batches.filter(b => b.status === 'unknown' && b.notFound)
    const busy = sendingId !== undefined

    return (
        <Box as="section" aria-label="Sending progress" p="18px" borderRadius="hg.lg" borderWidth="1px" borderColor="hg.hairline" bg="hg.card">
            <VStack align="stretch" gap="12px">
                <chakra.h3 m="0" fontSize="14px" fontWeight="700">{`Transaction ${Math.min(sent + 1, k)} of ${k}`}</chakra.h3>
                <Box
                    role="progressbar"
                    aria-label={`${sent} of ${k} transactions sent`}
                    aria-valuemin={0}
                    aria-valuemax={k}
                    aria-valuenow={sent}
                    h="8px"
                    borderRadius="hg.pill"
                    bg="hg.inset"
                    overflow="hidden"
                >
                    <Box h="full" borderRadius="hg.pill" bgImage="app" w={`${k > 0 ? (sent / k) * 100 : 0}%`} transition="width 0.3s" />
                </Box>

                {paused && (
                    <Text fontSize="14px" color="fg.muted">{`${sent} of ${k} transactions sent. Continue where you left off.`}</Text>
                )}

                <VStack as="ol" align="stretch" gap="0" maxH="256px" overflowY="auto" listStyleType="none" m="0" p="0" fontSize="13px">
                    {run.batches.map(b => (
                        <HStack as="li" key={b.id} justify="space-between" gap="10px" wrap="wrap" py="8px" borderBottomWidth="1px" borderColor="hg.divider">
                            <Text>{batchLabel(b, decimals, ticker)}</Text>
                            <BatchStatus batch={b} checkError={checkErrors.includes(b.id)} onCheckAgain={() => onCheckAgain(b.id)} />
                        </HStack>
                    ))}
                </VStack>

                {notFound.map(b => (
                    <WarningNote
                        key={b.id}
                        lead={`Transaction ${b.id}:`}
                        action={(
                            <Button {...softButton} size="sm" disabled={busy || blocker !== ''} onClick={() => onSendAgain(b.id)}>
                                Send this one again
                            </Button>
                        )}
                    >
                        We couldn&apos;t find this transaction on the chain. Send it again only if your wallet shows it failed.
                    </WarningNote>
                ))}

                {paused ? (
                    <Button variant={hgVariant('primary')} size="xl" onClick={onContinue}>Continue</Button>
                ) : next && (
                    <HStack gap="8px" wrap="wrap">
                        <Button
                            variant={hgVariant('primary')}
                            size="lg"
                            flex="1"
                            onClick={onSendNext}
                            disabled={busy || blocker !== ''}
                            loading={sendingId === next.id}
                            loadingText="Waiting for signature..."
                        >
                            Send the next transaction
                        </Button>
                        <Button {...softButton} size="lg" onClick={onStop} disabled={busy}>Stop for now</Button>
                    </HStack>
                )}
                {!paused && blocker && <Text fontSize="14px" lineHeight="1.5" color="hg.danger.text" textAlign="center">{blocker}</Text>}

                {reportHref && sent > 0 && (
                    <Button asChild size="sm" variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }} alignSelf="center">
                        <a href={reportHref} download="multisend-report.csv"><LuDownload /> Download report (CSV)</a>
                    </Button>
                )}
            </VStack>
        </Box>
    )
}
