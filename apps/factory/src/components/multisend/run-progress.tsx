"use client"

import React from 'react'
import { Box, Button, HStack, Link, Progress, Text, VStack } from '@chakra-ui/react'
import { LuArrowUpRight, LuDownload } from 'react-icons/lu'
import { getChainExplorerURL } from '@bze/bze-ui-kit'
import { WarningNote } from '@/components/guided'
import { MultiSendRun, RunBatch, batchLabel, nextBatch, sentCount } from '@/lib/multisend-run'

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
            <HStack gap={1} color="green.600" flexShrink={0}>
                <Text>Sent ✓</Text>
                {batch.txHash && (
                    <Link
                        href={`${getChainExplorerURL()}/tx/${batch.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        colorPalette="yellow"
                        color="colorPalette.fg"
                    >
                        tx <LuArrowUpRight />
                    </Link>
                )}
            </HStack>
        )
    }
    if (batch.status === 'sending') return <Text color="fg.muted" flexShrink={0}>Sending…</Text>
    if (batch.status === 'pending') return <Text color="fg.muted" flexShrink={0}>Waiting</Text>
    if (batch.notFound) return <Text color="fg.error" flexShrink={0}>Not found</Text>
    if (checkError) {
        return (
            <HStack gap={1} flexShrink={0}>
                <Text color="fg.error">Couldn&apos;t check</Text>
                <Button size="2xs" variant="ghost" colorPalette="yellow" onClick={onCheckAgain}>Check again</Button>
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
        <Box as="section" aria-label="Sending progress" p={4} borderRadius="xl" borderWidth="1px" borderColor="border" bg="bg.panel">
            <VStack align="stretch" gap={3}>
                <Text fontSize="sm" fontWeight="semibold">Transaction {Math.min(sent + 1, k)} of {k}</Text>
                <Progress.Root value={sent} max={k} size="sm" colorPalette="yellow" aria-label={`${sent} of ${k} transactions sent`}>
                    <Progress.Track><Progress.Range /></Progress.Track>
                </Progress.Root>

                {paused && (
                    <Text fontSize="sm">{sent} of {k} transactions sent. Continue where you left off.</Text>
                )}

                <VStack as="ol" align="stretch" gap={1} maxH="64" overflowY="auto" listStyleType="none" fontSize="xs">
                    {run.batches.map(b => (
                        <HStack as="li" key={b.id} justify="space-between" gap={2} wrap="wrap">
                            <Text>{batchLabel(b, decimals, ticker)}</Text>
                            <BatchStatus batch={b} checkError={checkErrors.includes(b.id)} onCheckAgain={() => onCheckAgain(b.id)} />
                        </HStack>
                    ))}
                </VStack>

                {notFound.map(b => (
                    <VStack key={b.id} align="stretch" gap={2}>
                        <WarningNote lead={`Transaction ${b.id}:`}>
                            We couldn&apos;t find this transaction on the chain. Send it again only if your wallet shows it failed.
                        </WarningNote>
                        <Button size="sm" variant="outline" colorPalette="yellow" alignSelf="start" disabled={busy || blocker !== ''} onClick={() => onSendAgain(b.id)}>
                            Send this one again
                        </Button>
                    </VStack>
                ))}

                {paused ? (
                    <Button colorPalette="yellow" onClick={onContinue}>Continue</Button>
                ) : next && (
                    <HStack gap={2} wrap="wrap">
                        <Button
                            colorPalette="yellow"
                            flex="1"
                            onClick={onSendNext}
                            disabled={busy || blocker !== ''}
                            loading={sendingId === next.id}
                            loadingText="Waiting for signature..."
                        >
                            Send the next transaction
                        </Button>
                        <Button variant="outline" colorPalette="yellow" onClick={onStop} disabled={busy}>Stop for now</Button>
                    </HStack>
                )}
                {!paused && blocker && <Text fontSize="sm" color="fg.error" textAlign="center">{blocker}</Text>}

                {reportHref && sent > 0 && (
                    <Button asChild size="sm" variant="ghost" colorPalette="yellow" alignSelf="start">
                        <a href={reportHref} download="multisend-report.csv"><LuDownload /> Download report (CSV)</a>
                    </Button>
                )}
            </VStack>
        </Box>
    )
}
