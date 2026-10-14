"use client"

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
    getChainExplorerURL,
    getChainName,
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
    const [answered, setAnswered] = useState<Step[]>(() => (denom ? ['token'] : []))
    const [sameTouched, setSameTouched] = useState(false)
    const [fileError, setFileError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [sent, setSent] = useState<{ txHash: string; count: number; totalLabel: string } | undefined>(undefined)
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
    const tooMany = count > MULTISEND_BATCH_SIZE
    const total = new BigNumber(parsed.total)
    const listValid = Boolean(asset) && count > 0 && !tooMany && sameError === '' && total.gt(0)

    const steps = useGuidedSteps(STEPS, {
        token: answered.includes('token') && Boolean(asset),
        list: answered.includes('list') && listValid,
    })

    const spec: TxKindSpec | undefined = count > 0 ? { kind: 'multi-send', count } : undefined
    const afford = useCanAffordTx({
        spec: listValid ? spec : undefined,
        spend: listValid ? { denom, amount: parsed.total } : undefined,
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const isComplete = STEPS.every(k => steps.state[k] === 'done')
    const canSend = isComplete && Boolean(address) && listValid && !afford.isLoading && afford.canAfford

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

    const sendAnother = () => {
        setSent(undefined)
        setText('')
        setSameAmount('')
        setSameTouched(false)
        setAnswered(denom ? ['token'] : [])
        steps.close()
    }

    if (sent) {
        return (
            <SuccessPanel
                title={`Sent to ${sent.count} wallets`}
                text={`${sent.totalLabel} is now in their wallets.`}
                links={[{ label: 'View transaction', href: `${getChainExplorerURL()}/tx/${sent.txHash}` }]}
                again={{ label: 'Send another list', onClick: sendAnother }}
            />
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
                footer={asset && address ? (
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

            <VStack align="stretch" gap={2}>
                <Button
                    size="lg"
                    colorPalette="yellow"
                    onClick={submit}
                    disabled={!canSend}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    Send to {count} wallets
                </Button>
                {!address ? (
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Connect your wallet to send.
                    </Text>
                ) : listValid && !afford.isLoading && !afford.canAfford && (
                    <Text fontSize="sm" color="fg.error" textAlign="center">{afford.message}</Text>
                )}
            </VStack>

            <TipNote lead="Want to reach people who are already active?">
                Gifting the stakers of a token goes only to wallets that hold and stake it.{' '}
                <Link asChild colorPalette="yellow" color="colorPalette.fg">
                    <NextLink href="/denom-reward">Gift the stakers</NextLink>
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
                            {tooMany && (
                                <Text fontSize="sm" color="fg.error" role="alert">
                                    Lists over {MULTISEND_BATCH_SIZE} wallets are coming soon. Split your list for now.
                                </Text>
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
