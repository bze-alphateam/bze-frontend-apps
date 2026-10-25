"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Badge,
    Button,
    Field,
    HStack,
    Input,
    Text,
    Textarea,
    VStack,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuDownload, LuUpload } from 'react-icons/lu'
import { cosmos } from '@bze/bzejs'
import {
    TxKindSpec,
    hgVariant,
    getChainName,
    getSettings,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCanAffordTx,
} from '@bze/bze-ui-kit'
import type { TxFailureDetails } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import { AssetPicker } from '@/components/ui/asset-picker'
import { validateAmount } from '@/components/token-wizard/validation'
import {
    PayPanel,
    Question,
    ReviewStep,
    Segmented,
    SubmitNote,
    TxPanel,
    WarningNote,
    useGuidedSteps,
} from '@/components/guided'
import type { TxPanelError, TxPanelStatus } from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import {
    MAX_RECIPIENT_LINES,
    RecipientMode,
    clearMultiSendDraft,
    exampleCsv,
    loadMultiSendDraft,
    multiSendValue,
    parseRecipients,
    saveMultiSendDraft,
} from '@/lib/multisend'
import { youHoldText } from '@/lib/format'
import {
    MultiSendRun,
    RunBatch,
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
import { MultisendDone } from '@/components/multisend/multisend-done'
import { softButton } from '@/components/ui/soft-button'
import { AirdropForm, TargetQuestion } from '@/components/airdrop/airdrop-form'
import type { AirdropTarget } from '@/lib/airdrop'

const { multiSend } = cosmos.bank.v1beta1.MessageComposer.withTypeUrl

const FORM_STEPS = ['target', 'token', 'list'] as const
type FormStep = typeof FORM_STEPS[number]
const STEP_KEYS = [...FORM_STEPS, 'review'] as const

const MAX_FILE_BYTES = 1024 * 1024
const SHOWN_PROBLEMS = 50

const PLACEHOLDERS: Record<RecipientMode, string> = {
    same: 'bze1…\nbze1…\nbze1…',
    perWallet: 'bze1…, 100\nbze1…, 250\nbze1…, 50',
}

/** What the single-transaction send hands its Done screen (kept in the pending-tx store, so serialisable). */
interface SentInput {
    denom: string;
    ticker: string;
    count: number;
    totalLabel: string;
}

/** The current batch of a batched run, as the transaction panel shows it. */
interface BatchPanel {
    id: number;
    phase: 'confirm' | 'submitted' | 'declined' | 'failed' | 'slow';
    hash?: string;
    error?: TxPanelError;
}

/**
 * The panel state of the current batch, after what the run record says about it: a batch found
 * sent hides the panel (its row says so), except the last one, which ends on Confirmed.
 */
function batchPanelStatus(panel: BatchPanel, batch: RunBatch | undefined, runDone: boolean): TxPanelStatus | undefined {
    if (batch?.status === 'sent') return runDone ? 'confirmed' : undefined
    if (panel.phase !== 'slow') return panel.phase
    // Slow: only while the chain check hasn't settled it.
    return batch?.status === 'unknown' && !batch.notFound ? 'slow' : undefined
}

function Counter({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: React.ReactNode }) {
    return (
        <Badge variant={hgVariant(tone)} size="md" borderRadius="hg.pill" fontSize="12px" fontWeight="600" data-tone={tone}>
            {children}
        </Badge>
    )
}

interface ListAirdropProps {
    /** The token a link picked (`?denom=` or `?prize=`). */
    initialDenom?: string;
    onTarget: (target: AirdropTarget) => void;
}

/**
 * Airdrop coins to a list of wallets (bank multi-send): the same amount for everyone or one per
 * wallet, pasted or uploaded. Over 100 wallets it runs in batches that can be resumed.
 */
export function ListAirdrop({ initialDenom, onTarget }: ListAirdropProps) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()

    // The page renders on the client only (search params under a Suspense boundary),
    // so the browser draft can seed the first render. A link's token wins over it.
    const [draft] = useState(loadMultiSendDraft)
    const [denom, setDenom] = useState(() => initialDenom || draft?.denom || '')
    const [mode, setMode] = useState<RecipientMode>(draft?.mode ?? 'same')
    const [sameAmount, setSameAmount] = useState(draft?.sameAmount ?? '')
    const [text, setText] = useState(draft?.text ?? '')
    // A run stored by an earlier visit: a batch still `sending` was interrupted, so its outcome is unclear.
    const [run, setRun] = useState<MultiSendRun | undefined>(() => {
        const stored = loadMultiSendRun()
        return stored ? settleInterrupted(stored) : undefined
    })
    const runRef = useRef(run)
    const [answered, setAnswered] = useState<FormStep[]>(() => (denom ? (run ? ['target', 'token', 'list'] : ['target', 'token']) : ['target']))
    const [sameTouched, setSameTouched] = useState(false)
    const [fileError, setFileError] = useState('')
    const [sent, setSent] = useState<{ input: SentInput; hash: string } | undefined>(undefined)
    const [paused, setPaused] = useState(run !== undefined)
    const [confirmNewRun, setConfirmNewRun] = useState(false)
    const [sendingId, setSendingId] = useState<number | undefined>(undefined)
    const [batchPanel, setBatchPanel] = useState<BatchPanel | undefined>(undefined)
    const [checkingId, setCheckingId] = useState<number | undefined>(undefined)
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

    const steps = useGuidedSteps(STEP_KEYS, {
        target: true,
        token: answered.includes('token') && Boolean(asset),
        list: answered.includes('list') && listValid,
        review: false,
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

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const toDisplay = (uAmount: BigNumber | string) => prettyAmount(uAmountToBigNumberAmount(uAmount, decimals))
    const totalLabel = `${toDisplay(total)} ${ticker}`

    // Up to 100 wallets: one transaction through the wizard's transaction panel.
    const buildMsgs = useCallback(() => {
        if (!address || k !== 1) return undefined
        return [multiSend(multiSendValue(address, denom, parsed.ready))]
    }, [address, k, denom, parsed.ready])
    const onDone = useCallback(({ input, hash }: WizardTxDone<SentInput>) => {
        clearMultiSendDraft()
        if (input) setSent({ input, hash })
    }, [])
    const wizard = useWizardTx<SentInput>(buildMsgs, {
        title: ticker ? `Send ${ticker} to ${count} wallets` : 'Send to a list of wallets',
        onDone,
    })
    const panelStatus = wizard.panelProps?.status
    // Confirmed on chain: the list is spent, even if the Done screen is never opened.
    useEffect(() => {
        if (panelStatus === 'confirmed') clearMultiSendDraft()
    }, [panelStatus])

    const isComplete = FORM_STEPS.every(key => steps.state[key] === 'done')
    const canSend = isComplete && Boolean(address) && listValid && !afford.isLoading && afford.canAfford
        && resume === 'none' && (k === 1 || currentFingerprint !== undefined)

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

    /** Signs one batch. Its status is saved before the wallet opens, so a closed page can't hide it. */
    const sendBatch = async (id: number) => {
        const current = runRef.current
        const planned = batchesRef.current.find(b => b.id === id)
        const state = current?.batches.find(b => b.id === id)
        if (!address || !current || !planned || !state || !canSendBatch(state)) return

        setSendingId(id)
        setBatchPanel({ id, phase: 'confirm' })
        setCheckErrors(prev => prev.filter(e => e !== id))
        commit(markSending(current, id, address))
        // Filled by the callbacks (an object, so the checks below read what they wrote).
        const outcome: { broadcast?: string; failure?: { reason: string; details?: TxFailureDetails } } = {}
        try {
            await tx([multiSend(multiSendValue(address, current.denom, planned.outputs))], {
                toasts: false,
                onBroadcast: (hash) => {
                    outcome.broadcast = hash
                    setBatchPanel({ id, phase: 'submitted', hash })
                    if (runRef.current) commit(markBroadcast(runRef.current, id, hash))
                },
                onSuccess: (res) => {
                    if (runRef.current) commit(markSent(runRef.current, id, res.txhash))
                },
                onFailure: (reason, details) => {
                    outcome.failure = { reason, details }
                },
            })
        } finally {
            const after = runRef.current
            if (after?.batches.find(b => b.id === id)?.status === 'sending') {
                const { failure } = outcome
                const hash = outcome.broadcast ?? failure?.details?.txHash
                // Executed in a block with an error code: nobody was paid, the batch waits again.
                const refused = failure?.details?.code !== undefined
                if (!hash || refused) {
                    commit(markPending(after, id))
                    setBatchPanel(!failure || failure.details?.stage === 'sign'
                        ? { id, phase: 'declined' }
                        : { id, phase: 'failed', hash, error: { reason: failure.reason, details: failure.details?.rawLog, feeSpent: refused } })
                } else {
                    // Broadcast but not confirmed: unclear until the chain check.
                    commit(markUnknown(after, id))
                    setBatchPanel({ id, phase: 'slow', hash })
                }
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

    const submit = () => {
        if (!address || !canSend) return
        if (k > 1) {
            void startSending()
            return
        }
        wizard.submit({ denom, ticker, count, totalLabel })
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

    const checkNow = async (id: number) => {
        setCheckingId(id)
        try {
            await verify(id)
        } finally {
            setCheckingId(undefined)
        }
    }

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
        setBatchPanel(undefined)
        setCheckErrors([])
        setAnswered(denom ? ['target', 'token'] : ['target'])
        steps.close()
    }

    if (sent) {
        return (
            <MultisendDone
                denom={sent.input.denom}
                ticker={sent.input.ticker}
                count={sent.input.count}
                totalLabel={sent.input.totalLabel}
                hashes={[sent.hash]}
                onSendAnother={sendAnother}
            />
        )
    }

    const runDone = activeRun !== undefined && isRunDone(activeRun)
    const panelBatch = batchPanel && activeRun?.batches.find(b => b.id === batchPanel.id)
    const batchStatus = batchPanel ? batchPanelStatus(batchPanel, panelBatch, runDone) : undefined

    // A finished run ends on the Done screen once its last Confirmed panel is passed (or right away after a reload).
    if (activeRun && runDone && batchStatus !== 'confirmed') {
        return (
            <MultisendDone
                denom={denom}
                ticker={ticker}
                count={count}
                totalLabel={totalLabel}
                hashes={activeRun.batches.map(b => b.txHash ?? '')}
                reportHref={reportHref}
                onSendAnother={sendAnother}
            />
        )
    }

    // Derived from state only: the panel's callbacks read refs, so render never branches on them.
    const showBatchPanel = batchPanel !== undefined && batchStatus !== undefined

    // The network fee comes out of the same balance when it is paid in the sent token.
    const gasInDenom = afford.gasFee.denom === denom ? afford.gasFee.amount : new BigNumber(0)
    const left = new BigNumber(balance.amount).minus(total).minus(listValid ? gasInDenom : 0)

    const aside = (
        <PayPanel
            rows={listValid ? [{ label: 'Sent to wallets', coin: { denom, amount: parsed.total } }] : []}
            txKind={spec}
            footer={asset && address && !activeRun ? (
                <HStack justify="space-between" gap="12px">
                    <Text color="fg.muted">Left in your wallet</Text>
                    <Text fontWeight="600" color={left.lt(0) ? 'hg.danger.text' : undefined}>
                        {toDisplay(left)} {ticker}
                    </Text>
                </HStack>
            ) : undefined}
        />
    )

    const problemsShown = parsed.problems.slice(0, SHOWN_PROBLEMS)
    const hiddenProblems = parsed.problems.length - problemsShown.length

    const finalStep = activeRun ? (
        <VStack align="stretch" gap="12px">
            {showBatchPanel && batchPanel && batchStatus && (
                <TxPanel
                    status={batchStatus}
                    hash={batchPanel.hash ?? panelBatch?.txHash}
                    error={batchPanel.error}
                    checking={checkingId === batchPanel.id}
                    // Only the batch that failed is signed again.
                    onRetry={() => void sendBatch(batchPanel.id)}
                    onEdit={() => {
                        setBatchPanel(undefined)
                        setPaused(true)
                    }}
                    onContinue={() => setBatchPanel(undefined)}
                    onCheckStatus={() => void checkNow(batchPanel.id)}
                    onKeepWaiting={() => setBatchPanel(undefined)}
                />
            )}
            <RunProgress
                run={activeRun}
                decimals={decimals}
                ticker={ticker}
                paused={paused}
                checkErrors={checkErrors}
                sendingId={sendingId}
                blocker={!address ? 'Connect your wallet.' : !afford.isLoading && !afford.canAfford ? afford.message : ''}
                reportHref={reportHref}
                actions={!showBatchPanel}
                onSendNext={sendNext}
                onStop={() => setPaused(true)}
                onContinue={() => setPaused(false)}
                onCheckAgain={checkAgain}
                onSendAgain={sendBatch}
            />
        </VStack>
    ) : wizard.panelProps ? (
        <TxPanel {...wizard.panelProps} />
    ) : (
        <ReviewStep
            {...steps.step('review')}
            question="Everything right?"
            leaves={[
                ...(listValid ? [{ label: `Sent to ${count} wallets`, coin: { denom, amount: parsed.total } }] : []),
                ...(k > 1 ? [{ label: 'Transactions', text: `${k}, one network fee each` }] : []),
            ]}
            txKind={spec}
            gets={[{ label: 'Wallets', value: `${count} wallets receive ${ticker}` }]}
            permanent={["Sent tokens can't be taken back"]}
            submitLabel={`Airdrop to ${count} wallets`}
            onSubmit={submit}
            disabled={!canSend}
            onBack={steps.back}
        >
            {k > 1 && (
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted" data-testid="batch-note">
                    {`${k} transactions · one approval each`}
                </Text>
            )}
            {resume === 'changed' && (
                <WarningNote
                    lead="This list changed since your last run."
                    action={confirmNewRun ? (
                        <HStack gap="8px" wrap="wrap">
                            <Button variant={hgVariant('danger')} size="sm" onClick={startNewRun}>Yes, forget the old run</Button>
                            <Button size="sm" variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={() => setConfirmNewRun(false)}>Cancel</Button>
                        </HStack>
                    ) : (
                        <Button {...softButton} size="sm" onClick={() => setConfirmNewRun(true)}>
                            Start new run
                        </Button>
                    )}
                >
                    Start a new run? Wallets from the old run may be paid again.
                </WarningNote>
            )}
            {!address ? (
                <SubmitNote>Connect your wallet.</SubmitNote>
            ) : listValid && !afford.isLoading && !afford.canAfford && (
                <SubmitNote tone="error">{afford.message}</SubmitNote>
            )}
        </ReviewStep>
    )

    return (
        <AirdropForm
            techTag={VOCABULARY.multiSend.tech}
            status="List saved in this browser"
            aside={aside}
        >
            <TargetQuestion
                {...steps.step('target')}
                value="list"
                onPick={(target) => (target === 'list' ? steps.close() : onTarget(target))}
            />

            <Question
                title="Token"
                question="What are you sending?"
                {...steps.step('token')}
                onBack={steps.back}
                summary={asset ? (address ? `${ticker} · ${youHoldText(toDisplay(balance.amount), ticker)}` : ticker) : ''}
                action={{ label: 'Continue', onClick: () => answer('token'), disabled: !asset }}
            >
                <VStack align="stretch" gap="16px">
                    <AssetPicker
                        label="Token"
                        value={denom}
                        includeLP={true}
                        ownFirst={true}
                        heldOnly={true}
                        onSelect={(a) => setDenom(a.denom)}
                    />
                    {asset && address && (
                        <Text fontSize="14px" color="fg.muted">{youHoldText(toDisplay(balance.amount), ticker)}</Text>
                    )}
                </VStack>
            </Question>

            <Question
                title="List"
                question="Who gets it?"
                {...steps.step('list')}
                summary={listValid ? `${count} wallets · ${totalLabel} in total` : ''}
                onBack={steps.back}
                action={{ label: 'Review', onClick: () => answer('list'), disabled: !listValid }}
            >
                <VStack align="stretch" gap="16px">
                    <Segmented
                        label="How much each wallet gets"
                        value={mode}
                        onChange={setMode}
                        options={[{ value: 'same', label: 'Same amount for everyone' }, { value: 'perWallet', label: 'Amount per wallet' }]}
                    />

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
                            fontSize="12px"
                            rows={8}
                            placeholder={PLACEHOLDERS[mode]}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />
                        <Field.HelperText>{`Max ${MAX_RECIPIENT_LINES} wallets`}</Field.HelperText>
                    </Field.Root>

                    <HStack gap="8px" wrap="wrap">
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
                        <Button {...softButton} size="sm" onClick={() => fileInput.current?.click()}>
                            <LuUpload /> Upload CSV
                        </Button>
                        <Button asChild size="sm" variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }}>
                            <a
                                href={`data:text/csv;charset=utf-8,${encodeURIComponent(exampleCsv(mode))}`}
                                download={mode === 'same' ? 'wallets-example.csv' : 'wallets-amounts-example.csv'}
                            >
                                <LuDownload /> Download an example file
                            </a>
                        </Button>
                    </HStack>
                    {fileError && <Text fontSize="14px" color="hg.danger.text" role="alert">{fileError}</Text>}

                    {text.trim() !== '' && (
                        <VStack as="section" aria-label="List check" align="stretch" gap="8px">
                            <HStack gap="6px" wrap="wrap">
                                <Counter tone="success">{count} wallets ready</Counter>
                                {parsed.duplicates > 0 && (
                                    <Counter tone="warning">{parsed.duplicates} duplicates, merged into one</Counter>
                                )}
                                {parsed.problems.length > 0 && (
                                    <Counter tone="danger">{parsed.problems.length} lines to fix, left out</Counter>
                                )}
                                {listValid && <Counter tone="neutral">{`Total ${totalLabel}`}</Counter>}
                            </HStack>
                            {parsed.notes.length > 0 && (
                                <Text fontSize="12px" color="hg.text.faint">
                                    {`${parsed.notes.length} ${parsed.notes.length === 1 ? 'amount' : 'amounts'} ignored`}
                                </Text>
                            )}
                            {parsed.problems.length > 0 && (
                                <VStack as="ul" aria-label="Lines to fix" align="stretch" gap="4px" m="0" p="0" listStyleType="none">
                                    {problemsShown.map(p => (
                                        <Text as="li" key={`${p.line}-${p.text}`} fontSize="13px" color="hg.text.secondary" wordBreak="break-all">
                                            Line {p.line}: <Text as="span" fontFamily="mono" color="fg">{p.text}</Text> <Text as="span" color="hg.danger.text">{p.reason}</Text>
                                        </Text>
                                    ))}
                                    {hiddenProblems > 0 && (
                                        <Text as="li" fontSize="13px" color="hg.text.faint">and {hiddenProblems} more</Text>
                                    )}
                                </VStack>
                            )}
                        </VStack>
                    )}
                </VStack>
            </Question>

            {finalStep}
        </AirdropForm>
    )
}
