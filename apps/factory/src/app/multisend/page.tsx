"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Box,
    Button,
    Container,
    Field,
    Group,
    HStack,
    Input,
    Link,
    Skeleton,
    Text,
    Textarea,
    VStack,
} from '@chakra-ui/react'
import NextLink from 'next/link'
import BigNumber from 'bignumber.js'
import { LuDownload, LuUpload } from 'react-icons/lu'
import { cosmos } from '@bze/bzejs'
import {
    TxKindSpec,
    getExplorerTxURL,
    getChainName,
    getSettings,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCanAffordTx,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { AssetPicker } from '@/components/ui/asset-picker'
import { validateAmount } from '@/components/token-wizard/validation'
import {
    GuidedForm,
    OutcomePanel,
    PayPanel,
    Question,
    SuccessPanel,
    TipNote,
    WarningNote,
    useGuidedSteps,
} from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import {
    MULTISEND_BATCH_SIZE,
    RecipientMode,
    clearMultiSendDraft,
    exampleCsv,
    loadMultiSendDraft,
    multiSendValue,
    parseRecipients,
    saveMultiSendDraft,
} from '@/lib/multisend'
import {
    MultiSendRun,
    canSendBatch,
    clearMultiSendRun,
    isRunDone,
    listFingerprint,
    loadMultiSendRun,
    markBroadcast,
    markPending,
    markSending,
    markSent,
    markUnknown,
    nextBatch,
    planBatches,
    reportCsv,
    resumeState,
    saveMultiSendRun,
    settleInterrupted,
    startRun,
} from '@/lib/multisend-run'
import { checkBatchOnChain, restTxLookup } from '@/lib/multisend-lookup'
import { RunProgress } from '@/components/multisend/run-progress'

const { multiSend } = cosmos.bank.v1beta1.MessageComposer.withTypeUrl

const STEPS = ['token', 'list'] as const
type Step = typeof STEPS[number]

const MAX_FILE_BYTES = 1024 * 1024
const SHOWN_PROBLEMS = 50

const PLACEHOLDERS: Record<RecipientMode, string> = {
    same: 'bze1…\nbze1…\nbze1…',
    perWallet: 'bze1…, 100\nbze1…, 250\nbze1…, 50',
}

function Counter({ color, children }: { color: string; children: React.ReactNode }) {
    return (
        <Text fontSize="sm" fontWeight="medium" color={color} px={2} py={0.5} borderRadius="md" bg={`${color.split('.')[0]}.500/10`}>
            {children}
        </Text>
    )
}

function MultiSendContent() {
    const { getQueryParam } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()

    // The page renders on the client only (search params under a Suspense boundary),
    // so the browser draft can seed the first render. A `?denom=` link wins over it.
    const [draft] = useState(loadMultiSendDraft)
    const [denom, setDenom] = useState(() => getQueryParam('denom') ?? draft?.denom ?? '')
    const [mode, setMode] = useState<RecipientMode>(draft?.mode ?? 'same')
    const [sameAmount, setSameAmount] = useState(draft?.sameAmount ?? '')
    const [text, setText] = useState(draft?.text ?? '')
    // A run stored by an earlier visit: a batch still `sending` was interrupted, so its outcome is unclear.
    const [run, setRun] = useState<MultiSendRun | undefined>(() => {
        const stored = loadMultiSendRun()
        return stored ? settleInterrupted(stored) : undefined
    })
    const runRef = useRef(run)
    const [answered, setAnswered] = useState<Step[]>(() => (denom ? (run ? ['token', 'list'] : ['token']) : []))
    const [sameTouched, setSameTouched] = useState(false)
    const [fileError, setFileError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [sent, setSent] = useState<{ txHash: string; count: number; totalLabel: string } | undefined>(undefined)
    const [paused, setPaused] = useState(run !== undefined)
    const [confirmNewRun, setConfirmNewRun] = useState(false)
    const [sendingId, setSendingId] = useState<number | undefined>(undefined)
    const [checkErrors, setCheckErrors] = useState<number[]>([])
    const [fingerprint, setFingerprint] = useState<{ key: string; value: string } | undefined>(undefined)
    const inFlight = useRef(new Set<number>())
    const lookup = useMemo(() => restTxLookup(getSettings().endpoints.restEndpoint), [])
    const fileInput = useRef<HTMLInputElement>(null)

    const { asset } = useAsset(denom)
    const { balance } = useBalance(denom)
    const decimals = asset?.decimals ?? 0
    const ticker = asset?.ticker ?? ''

    useEffect(() => {
        saveMultiSendDraft({ denom, mode, sameAmount, text })
    }, [denom, mode, sameAmount, text])

    const sameError = mode === 'same' && asset ? validateAmount(sameAmount, decimals) : ''
    const parsed = useMemo(
        () => parseRecipients(text, mode, decimals, sameAmount),
        [text, mode, decimals, sameAmount],
    )
    const count = parsed.ready.length
    const total = new BigNumber(parsed.total)
    const listValid = Boolean(asset) && count > 0 && sameError === '' && total.gt(0)
    const batches = useMemo(() => planBatches(parsed.ready), [parsed.ready])
    const k = batches.length
    const batchesRef = useRef(batches)
    useEffect(() => {
        batchesRef.current = batches
    }, [batches])

    // The run belongs to one exact list: its fingerprint is computed (async) for the list on screen.
    const listKey = useMemo(() => JSON.stringify([denom, parsed.ready]), [denom, parsed.ready])
    useEffect(() => {
        let live = true
        listFingerprint(denom, parsed.ready).then(value => {
            if (live) setFingerprint({ key: listKey, value })
        })
        return () => {
            live = false
        }
    }, [listKey, denom, parsed.ready])
    const currentFingerprint = fingerprint?.key === listKey ? fingerprint.value : undefined
    const resume = listValid ? resumeState(run, currentFingerprint) : run ? 'checking' : 'none'
    const activeRun = resume === 'same' ? run : undefined
    const next = activeRun ? nextBatch(activeRun) : undefined

    const commit = useCallback((nextRun: MultiSendRun | undefined) => {
        runRef.current = nextRun
        setRun(nextRun)
        if (nextRun) saveMultiSendRun(nextRun)
        else clearMultiSendRun()
    }, [])

    const steps = useGuidedSteps(STEPS, {
        token: answered.includes('token') && Boolean(asset),
        list: answered.includes('list') && listValid,
    })

    // The network fee of the whole list: one estimate per transaction.
    const spec: TxKindSpec | TxKindSpec[] | undefined = k === 0
        ? undefined
        : k === 1 ? { kind: 'multi-send', count } : batches.map(b => ({ kind: 'multi-send' as const, count: b.outputs.length }))
    // Before a run: the whole list. During a run: the balance is checked again before every transaction.
    const afford = useCanAffordTx({
        spec: !listValid ? undefined : next ? { kind: 'multi-send', count: next.count } : spec,
        spend: !listValid ? undefined : { denom, amount: next ? next.total : parsed.total },
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const isComplete = STEPS.every(k => steps.state[k] === 'done')
    const canSend = isComplete && Boolean(address) && listValid && !afford.isLoading && afford.canAfford
        && resume === 'none' && (k === 1 || currentFingerprint !== undefined)

    const toDisplay = (uAmount: BigNumber | string) => prettyAmount(uAmountToBigNumberAmount(uAmount, decimals))
    const totalLabel = `${toDisplay(total)} ${ticker}`

    const readFile = (file: File | undefined) => {
        if (!file) return
        setFileError('')
        if (!/\.(csv|txt)$/i.test(file.name)) {
            setFileError('Upload a .csv or .txt file.')
            return
        }
        if (file.size > MAX_FILE_BYTES) {
            setFileError('Files are limited to 1 MB.')
            return
        }
        // Read in the browser only: the list never leaves this device until it is signed.
        const reader = new FileReader()
        reader.onload = () => setText(typeof reader.result === 'string' ? reader.result : '')
        reader.onerror = () => setFileError('Could not read this file.')
        reader.readAsText(file)
    }

    const submit = async () => {
        if (!address || !canSend) return
        if (k > 1) {
            await startSending()
            return
        }
        const msg = multiSend(multiSendValue(address, denom, parsed.ready))
        const result = { count, totalLabel }

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: (res) => {
                    clearMultiSendDraft()
                    setSent({ txHash: res.txhash, ...result })
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    /** Signs one batch. Its status is saved before the wallet opens, so a closed page can't hide it. */
    const sendBatch = async (id: number) => {
        const current = runRef.current
        const planned = batchesRef.current.find(b => b.id === id)
        const state = current?.batches.find(b => b.id === id)
        if (!address || !current || !planned || !state || !canSendBatch(state)) return

        setSendingId(id)
        setCheckErrors(prev => prev.filter(e => e !== id))
        commit(markSending(current, id, address))
        let broadcast = false
        try {
            await tx([multiSend(multiSendValue(address, current.denom, planned.outputs))], {
                onBroadcast: (hash) => {
                    broadcast = true
                    if (runRef.current) commit(markBroadcast(runRef.current, id, hash))
                },
                onSuccess: (res) => {
                    if (runRef.current) commit(markSent(runRef.current, id, res.txhash))
                },
            })
        } finally {
            const after = runRef.current
            if (after?.batches.find(b => b.id === id)?.status === 'sending') {
                // Never broadcast (rejected in the wallet): nobody was paid. Broadcast but not
                // confirmed: unclear until the chain check (which also catches a failed result).
                commit(broadcast ? markUnknown(after, id) : markPending(after, id))
            }
            setSendingId(undefined)
        }
    }

    const startSending = async () => {
        if (!currentFingerprint) return
        setPaused(false)
        commit(startRun(currentFingerprint, denom, batches))
        await sendBatch(1)
    }

    const sendNext = async () => {
        const target = runRef.current ? nextBatch(runRef.current) : undefined
        if (target) await sendBatch(target.id)
    }

    // Unclear batches are looked up on the chain (by hash, else among the sender's recent
    // multi-sends) before anything else may happen to them.
    const verify = useCallback(async (id: number) => {
        const current = runRef.current
        const state = current?.batches.find(b => b.id === id)
        const planned = batchesRef.current.find(b => b.id === id)
        if (!current || !state || !planned) return
        const check = await checkBatchOnChain(lookup, {
            txHash: state.txHash,
            sender: state.sender ?? address,
            denom: current.denom,
            outputs: planned.outputs,
        })
        const latest = runRef.current
        if (!latest || latest.fingerprint !== current.fingerprint) return
        if (check.result === 'sent') commit(markSent(latest, id, check.txHash))
        else if (check.result === 'failed') commit(markPending(latest, id))
        else if (check.result === 'not-found') commit(markUnknown(latest, id, true))
        else setCheckErrors(prev => (prev.includes(id) ? prev : [...prev, id]))
    }, [lookup, address, commit])

    const toCheck = activeRun
        ? activeRun.batches.filter(b => b.status === 'unknown' && !b.notFound && !checkErrors.includes(b.id)).map(b => b.id).join(',')
        : ''
    useEffect(() => {
        for (const id of toCheck.split(',').filter(Boolean).map(Number)) {
            if (inFlight.current.has(id)) continue
            inFlight.current.add(id)
            void verify(id).finally(() => inFlight.current.delete(id))
        }
    }, [toCheck, verify])

    const checkAgain = (id: number) => setCheckErrors(prev => prev.filter(e => e !== id))

    const startNewRun = () => {
        commit(undefined)
        setConfirmNewRun(false)
        setCheckErrors([])
        setPaused(false)
    }

    const reportHref = useMemo(() => {
        if (!activeRun || !activeRun.batches.some(b => b.status === 'sent')) return undefined
        return `data:text/csv;charset=utf-8,${encodeURIComponent(reportCsv(activeRun, batches, decimals, ticker))}`
    }, [activeRun, batches, decimals, ticker])

    const sendAnother = () => {
        setSent(undefined)
        commit(undefined)
        clearMultiSendDraft()
        setText('')
        setSameAmount('')
        setSameTouched(false)
        setPaused(false)
        setCheckErrors([])
        setAnswered(denom ? ['token'] : [])
        steps.close()
    }

    if (sent) {
        return (
            <SuccessPanel
                title={`Sent to ${sent.count} wallets`}
                text={`${sent.totalLabel} is now in their wallets.`}
                links={[{ label: 'Explorer', href: getExplorerTxURL(sent.txHash), app: 'explorer' }]}
                again={{ label: 'Send another list', onClick: sendAnother }}
            />
        )
    }

    if (activeRun && isRunDone(activeRun)) {
        return (
            <VStack align="stretch" gap={4}>
                <SuccessPanel
                    title={`Sent to ${count} wallets in ${activeRun.batches.length} transactions`}
                    text={`${totalLabel} is now in their wallets.`}
                    again={{ label: 'Send another list', onClick: sendAnother }}
                />
                {reportHref && (
                    <Button asChild variant="outline" colorPalette="yellow" alignSelf="center">
                        <a href={reportHref} download="multisend-report.csv"><LuDownload /> Download report (CSV)</a>
                    </Button>
                )}
            </VStack>
        )
    }

    const balanceText = asset ? `${toDisplay(balance.amount)} ${ticker}` : ''
    // The network fee comes out of the same balance when it is paid in the sent token.
    const gasInDenom = afford.gasFee.denom === denom ? afford.gasFee.amount : new BigNumber(0)
    const left = new BigNumber(balance.amount).minus(total).minus(listValid ? gasInDenom : 0)

    const aside = (
        <>
            <OutcomePanel techTag={VOCABULARY.multiSend.tech}>
                {listValid ? (
                    <Text>
                        <Text as="span" fontWeight="semibold">{totalLabel}</Text> goes to {count} wallets, each
                        getting {mode === 'same' ? `${prettyAmount(new BigNumber(sameAmount.trim()))} ${ticker}` : 'the amount on its line'}.
                    </Text>
                ) : (
                    <Text color="fg.muted">Pick a token and add the wallets to see what gets sent.</Text>
                )}
            </OutcomePanel>

            <PayPanel
                rows={[
                    ...(listValid ? [{ label: 'Sent to wallets', coin: { denom, amount: parsed.total } }] : []),
                    { label: 'Factory fee', text: 'None' },
                ]}
                txKind={spec}
                footer={asset && address && !activeRun ? (
                    <HStack justify="space-between" gap={3}>
                        <Text color="fg.muted">Left in your wallet</Text>
                        <Text fontWeight="semibold" color={left.lt(0) ? 'fg.error' : undefined}>
                            {toDisplay(left)} {ticker}
                        </Text>
                    </HStack>
                ) : undefined}
            />

            <WarningNote lead="Check the list twice.">
                Tokens sent to a wrong address can&apos;t be recovered.
            </WarningNote>

            {listValid && k > 1 && (
                <Text fontSize="sm" color="fg.muted">
                    {`It's sent in ${k} transactions of up to ${MULTISEND_BATCH_SIZE} wallets each, so you'll approve ${k} times in your wallet. If you stop halfway, the wallets already paid are marked and won't be paid twice.`}
                </Text>
            )}

            {resume === 'changed' && (
                <VStack align="stretch" gap={2}>
                    <WarningNote lead="This list changed since your last run.">
                        Start a new run? Wallets from the old run may be paid again.
                    </WarningNote>
                    {confirmNewRun ? (
                        <HStack gap={2} wrap="wrap">
                            <Button size="sm" colorPalette="red" onClick={startNewRun}>Yes, forget the old run</Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmNewRun(false)}>Cancel</Button>
                        </HStack>
                    ) : (
                        <Button size="sm" variant="outline" colorPalette="yellow" alignSelf="start" onClick={() => setConfirmNewRun(true)}>
                            Start new run
                        </Button>
                    )}
                </VStack>
            )}

            {activeRun ? (
                <RunProgress
                    run={activeRun}
                    decimals={decimals}
                    ticker={ticker}
                    paused={paused}
                    checkErrors={checkErrors}
                    sendingId={sendingId}
                    blocker={!address ? 'Connect your wallet to send.' : !afford.isLoading && !afford.canAfford ? afford.message : ''}
                    reportHref={reportHref}
                    onSendNext={sendNext}
                    onStop={() => setPaused(true)}
                    onContinue={() => setPaused(false)}
                    onCheckAgain={checkAgain}
                    onSendAgain={sendBatch}
                />
            ) : (
                <VStack align="stretch" gap={2}>
                    <Button
                        size="lg"
                        colorPalette="yellow"
                        onClick={submit}
                        disabled={!canSend}
                        loading={isSubmitting || sendingId !== undefined}
                        loadingText="Waiting for signature..."
                    >
                        {k > 1 ? `Start sending (${k} transactions)` : `Send to ${count} wallets`}
                    </Button>
                    {!address ? (
                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                            Connect your wallet to send.
                        </Text>
                    ) : listValid && !afford.isLoading && !afford.canAfford && (
                        <Text fontSize="sm" color="fg.error" textAlign="center">{afford.message}</Text>
                    )}
                </VStack>
            )}

            <TipNote lead="Want to reach people who are already active?">
                Gifting the stakers of a token goes only to wallets that hold and stake it.{' '}
                <Link asChild colorPalette="yellow" color="colorPalette.fg">
                    <NextLink href="/rewards">Gift the stakers</NextLink>
                </Link>
            </TipNote>
        </>
    )

    const problemsShown = parsed.problems.slice(0, SHOWN_PROBLEMS)
    const hiddenProblems = parsed.problems.length - problemsShown.length

    return (
        <GuidedForm
            title={VOCABULARY.multiSend.name}
            subtitle="Paste addresses, or upload a file from a contest, a snapshot or a spreadsheet. Everyone on the list gets the token straight in their wallet."
            techTag={VOCABULARY.multiSend.tech}
            status="List saved in this browser"
            aside={aside}
        >
            <Question
                number={1}
                title="What do you send?"
                state={steps.state.token}
                summary={asset ? `${ticker} · you have ${toDisplay(balance.amount)}` : ''}
                onChange={() => steps.open('token')}
            >
                <VStack align="stretch" gap={4}>
                    <AssetPicker
                        label="Token to send"
                        value={denom}
                        includeLP={true}
                        ownFirst={true}
                        onSelect={(a) => setDenom(a.denom)}
                    />
                    {asset && address && (
                        <Text fontSize="sm" color="fg.muted">You have {balanceText}.</Text>
                    )}
                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!asset} onClick={() => answer('token')}>
                        Continue
                    </Button>
                </VStack>
            </Question>

            <Question
                number={2}
                title="Who gets it, and how much?"
                state={steps.state.list}
                summary={listValid ? `${count} wallets · ${totalLabel}` : ''}
                onChange={() => steps.open('list')}
            >
                <VStack align="stretch" gap={4}>
                    <Group attached alignSelf="start">
                        {([['same', 'Same for everyone'], ['perWallet', 'Amount per wallet']] as const).map(([m, label]) => (
                            <Button
                                key={m}
                                size="sm"
                                colorPalette="yellow"
                                variant={mode === m ? 'solid' : 'outline'}
                                aria-pressed={mode === m}
                                onClick={() => setMode(m)}
                            >
                                {label}
                            </Button>
                        ))}
                    </Group>

                    {mode === 'same' && (
                        <Field.Root invalid={sameTouched && sameError !== ''}>
                            <Field.Label>Amount each{ticker ? ` (${ticker})` : ''}</Field.Label>
                            <Input
                                inputMode="decimal"
                                placeholder="e.g. 100"
                                value={sameAmount}
                                onChange={(e) => setSameAmount(e.target.value)}
                                onBlur={() => setSameTouched(true)}
                            />
                            <Field.ErrorText>{sameError}</Field.ErrorText>
                        </Field.Root>
                    )}

                    <Field.Root>
                        <Field.Label>{mode === 'same' ? 'Wallets, one per line' : 'Wallets and amounts, one per line'}</Field.Label>
                        <Textarea
                            fontFamily="mono"
                            fontSize="xs"
                            rows={8}
                            placeholder={PLACEHOLDERS[mode]}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />
                        <Field.HelperText>
                            Commas, semicolons, tabs or spaces between fields. Lines starting with # are skipped.
                        </Field.HelperText>
                    </Field.Root>

                    <HStack gap={2} wrap="wrap">
                        <input
                            ref={fileInput}
                            type="file"
                            accept=".csv,.txt,text/csv,text/plain"
                            hidden
                            data-testid="list-file"
                            onChange={(e) => {
                                readFile(e.target.files?.[0])
                                e.target.value = ''
                            }}
                        />
                        <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => fileInput.current?.click()}>
                            <LuUpload /> Upload CSV or TXT
                        </Button>
                        <Button asChild size="sm" variant="ghost" colorPalette="yellow">
                            <a
                                href={`data:text/csv;charset=utf-8,${encodeURIComponent(exampleCsv(mode))}`}
                                download={mode === 'same' ? 'wallets-example.csv' : 'wallets-amounts-example.csv'}
                            >
                                <LuDownload /> Download an example file
                            </a>
                        </Button>
                    </HStack>
                    {fileError && <Text fontSize="sm" color="fg.error" role="alert">{fileError}</Text>}

                    {text.trim() !== '' && (
                        <VStack align="stretch" gap={2}>
                            <HStack gap={2} wrap="wrap">
                                <Counter color="green.600">{count} wallets ready</Counter>
                                {parsed.duplicates > 0 && (
                                    <Counter color="orange.600">{parsed.duplicates} duplicates, merged into one</Counter>
                                )}
                                {parsed.problems.length > 0 && (
                                    <Counter color="red.600">{parsed.problems.length} lines to fix, left out</Counter>
                                )}
                            </HStack>
                            {parsed.notes.length > 0 && (
                                <Text fontSize="xs" color="fg.muted">
                                    {parsed.notes.length} {parsed.notes.length === 1 ? 'line has' : 'lines have'} an amount that is ignored: everyone gets the same.
                                </Text>
                            )}
                            {parsed.problems.length > 0 && (
                                <Box as="details" fontSize="sm">
                                    <Box as="summary" cursor="pointer" color="fg.muted">Show the lines to fix</Box>
                                    <VStack as="ul" align="stretch" gap={1} mt={2} listStyleType="none">
                                        {problemsShown.map(p => (
                                            <Text as="li" key={`${p.line}-${p.text}`} fontSize="xs" wordBreak="break-all">
                                                Line {p.line}: <Text as="span" fontFamily="mono">{p.text}</Text> {p.reason}
                                            </Text>
                                        ))}
                                        {hiddenProblems > 0 && (
                                            <Text as="li" fontSize="xs" color="fg.muted">and {hiddenProblems} more</Text>
                                        )}
                                    </VStack>
                                </Box>
                            )}
                        </VStack>
                    )}

                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!listValid} onClick={() => answer('list')}>
                        Continue
                    </Button>
                </VStack>
            </Question>
        </GuidedForm>
    )
}

export default function MultiSendPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="5xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <MultiSendContent />
                </Suspense>
            </Container>
        </Box>
    )
}
