"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuRefreshCw } from 'react-icons/lu'
import {
    AppLink,
    GradientText,
    Shimmer,
    formatTimeRemainingFromEpochs,
    getBurnerApp,
    getChainName,
    getRafflesOrThrow,
    isLpDenom,
    useAsset,
    useCanAffordTx,
    useEpochs,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useTokenRaffle } from '@/hooks/useTokenRaffle'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import { AssetPicker } from '@/components/ui/asset-picker'
import { TextField } from '@/components/manage/denom-reward-form-parts'
import { RaffleDone } from '@/components/raffle-wizard/raffle-done'
import {
    AnswerChip,
    AnswerChips,
    BlockerNote,
    FormPage,
    GuidedForm,
    Hint,
    OutcomePanel,
    PayPanel,
    Question,
    ReviewStep,
    SubmitNote,
    TxPanel,
    WarningNote,
    useGuidedSteps,
} from '@/components/guided'
import type { PayRow } from '@/components/guided'
import {
    POT_TREND_TEXT,
    type RaffleDoneInput,
    type RafflePlay,
    buildStartRaffleMsg,
    burnerCoinHref,
    chancesFromOneIn,
    displayAmount,
    expectedPotTrend,
    formatRaffleEnd,
    isRaffleRunningError,
    percentFromChances,
    potSummary,
    raffleEndDate,
    raffleRunningText,
    rafflePlaySummary,
    raffleSentence,
    toBaseUnits,
    validateOneIn,
    validatePot,
    validatePrizePercent,
    validateRaffleDays,
    validateTicketPrice,
} from '@/lib/raffle-new'
import { softButton } from '@/components/ui/soft-button'

const STEPS = ['token', 'pot', 'play', 'review'] as const
type FormStep = Exclude<typeof STEPS[number], 'review'>

const DAY_PRESETS = [7, 14, 30]
const ONE_IN_PRESETS = [10, 100, 1000]
const PERCENT_PRESETS = [10, 25, 50]

const WARNINGS = [
    "The pot leaves your wallet now and can't be taken back.",
    "Once started, a raffle can't be stopped or changed.",
    'Whatever is left in the pot when it ends is burned. Nothing comes back to you.',
]

const fmt = (n: number) => n.toLocaleString('en-US')

function Presets({ values, current, label, onPick }: { values: number[]; current: string; label: (n: number) => string; onPick: (n: number) => void }) {
    return (
        <AnswerChips>
            {values.map(v => (
                <AnswerChip key={v} selected={current.trim() === String(v)} onClick={() => onPick(v)}>
                    {label(v)}
                </AnswerChip>
            ))}
        </AnswerChips>
    )
}

function RaffleFormContent() {
    const { getQueryParam } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { hourEpochInfo } = useEpochs()

    const [denom, setDenom] = useState(() => getQueryParam('denom') ?? '')
    const [potInput, setPotInput] = useState('')
    const [daysInput, setDaysInput] = useState('')
    const [ticketInput, setTicketInput] = useState('')
    const [oneInInput, setOneInInput] = useState('')
    const [percentInput, setPercentInput] = useState('')
    const [answered, setAnswered] = useState<FormStep[]>(() => (getQueryParam('denom') ? ['token'] : []))
    const [checking, setChecking] = useState(false)
    const [checkFailed, setCheckFailed] = useState(false)
    // The last check before signing (or the chain) found a raffle running for this denom.
    const [runningFor, setRunningFor] = useState<string | undefined>(undefined)
    const [done, setDone] = useState<{ input: RaffleDoneInput; hash: string } | undefined>(undefined)

    const { asset } = useAsset(denom)
    const { raffle, refresh } = useTokenRaffle(denom || undefined)
    const ticker = asset?.ticker ?? ''
    const decimals = asset?.decimals ?? 0
    const max = useMaxSpendable(denom, address && denom ? 'start-raffle' : undefined)

    // Deep links can name a token the picker hides.
    const tokenBlock = !asset ? '' : asset.halted
        ? "Halted tokens can't be raffled."
        : isLpDenom(asset.denom) ? "LP tokens can't be raffled." : ''

    const currentEpoch = hourEpochInfo?.current_epoch
    const runningRaffle = raffle.status === 'running' ? raffle.raffle : undefined
    const isRunning = Boolean(runningRaffle) || (runningFor !== undefined && runningFor === denom)
    const runningText = runningRaffle && currentEpoch !== undefined
        ? raffleRunningText(ticker, formatTimeRemainingFromEpochs(runningRaffle.end_at, currentEpoch))
        : `A raffle for ${ticker} is already running.`

    const potError = asset ? validatePot(potInput, decimals, ticker, address ? max.amount : undefined) : ''
    const daysError = validateRaffleDays(daysInput)
    const ticketError = asset ? validateTicketPrice(ticketInput, decimals, ticker) : ''
    const oneInError = validateOneIn(oneInInput)
    const percentError = validatePrizePercent(percentInput)

    const potBase = asset && potError === '' ? toBaseUnits(potInput, decimals) : undefined
    const ticketBase = asset && ticketError === '' ? toBaseUnits(ticketInput, decimals) : undefined
    const days = daysError === '' ? Number(daysInput.trim()) : undefined
    const oneIn = oneInError === '' ? Number(oneInInput.trim()) : undefined
    const chances = oneIn !== undefined ? chancesFromOneIn(oneIn) : undefined
    const percent = percentError === '' ? Number(percentInput.trim()) : undefined

    const potText = potBase ? `${displayAmount(potBase, decimals)} ${ticker}` : ''
    const ticketText = ticketBase ? `${displayAmount(ticketBase, decimals)} ${ticker}` : ''
    const play: RafflePlay | undefined = days !== undefined && ticketText && oneIn !== undefined && percent !== undefined
        ? { days, ticket: ticketText, oneIn, percent }
        : undefined

    const tokenReady = Boolean(asset) && tokenBlock === '' && raffle.status === 'none' && !isRunning
    const steps = useGuidedSteps(STEPS, {
        token: answered.includes('token') && tokenReady,
        pot: answered.includes('pot') && potBase !== undefined,
        play: answered.includes('play') && play !== undefined && chances !== undefined,
        review: false,
    })

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const isComplete = steps.state.token === 'done' && steps.state.pot === 'done' && steps.state.play === 'done'
    const afford = useCanAffordTx({
        spec: address && potBase ? 'start-raffle' : undefined,
        spend: potBase ? { denom, amount: potBase } : undefined,
    })
    const canSign = isComplete && Boolean(address) && !afford.isLoading && afford.canAfford && !checking

    const endsAt = useMemo(
        () => (days !== undefined ? raffleEndDate(days, hourEpochInfo?.current_epoch_start_time) : undefined),
        [days, hourEpochInfo?.current_epoch_start_time],
    )
    const endText = endsAt ? formatRaffleEnd(endsAt) : ''

    const prizeNowText = potBase && percent !== undefined
        ? `${displayAmount(potBase.multipliedBy(percent).div(100).integerValue(BigNumber.ROUND_DOWN), decimals)} ${ticker}`
        : ''
    const trend = potBase && ticketBase && chances !== undefined && percent !== undefined
        ? expectedPotTrend({ ticketPrice: ticketBase, chances, ratio: new BigNumber(percent).div(100).toFixed(2), pot: potBase })
        : undefined

    const burnerHref = (d: string) => burnerCoinHref(getBurnerApp().href, d)

    const pickToken = (d: string) => {
        setDenom(d)
        setRunningFor(undefined)
        setCheckFailed(false)
    }

    const buildMsgs = () => {
        if (!address || !potBase || !ticketBase || days === undefined || chances === undefined || percent === undefined) return undefined
        return [buildStartRaffleMsg({ creator: address, denom, pot: potBase, days, chances, prizePercent: percent, ticketPrice: ticketBase })]
    }
    const onDone = ({ input, hash }: WizardTxDone<RaffleDoneInput>) => {
        refresh()
        if (input) setDone({ input, hash })
    }
    const { submit, panelProps } = useWizardTx<RaffleDoneInput>(buildMsgs, {
        title: `Start the ${ticker || 'token'} raffle`,
        onDone,
    })

    if (done) return <RaffleDone input={done.input} hash={done.hash} />

    // One raffle per denom: it is checked again right before signing, so a raffle started
    // meanwhile sends you back to the token instead of failing in the wallet.
    const sign = async () => {
        if (!canSign) return
        const input: RaffleDoneInput = { denom, ticker, endsAt: endText }
        setChecking(true)
        setCheckFailed(false)
        let running: boolean
        try {
            const raffles = await getRafflesOrThrow()
            running = raffles.some(r => r.denom === denom)
        } catch {
            setChecking(false)
            setCheckFailed(true)
            return
        }
        setChecking(false)
        if (running) {
            setRunningFor(denom)
            refresh()
            return
        }
        submit(input)
    }

    // The chain refused the start because a raffle runs (the checks missed it).
    const chainSaysRunning = panelProps?.status === 'failed' &&
        isRaffleRunningError(`${panelProps.error?.reason ?? ''} ${panelProps.error?.details ?? ''}`)

    const runningNote = (
        <Box data-testid="raffle-running">
            <BlockerNote
                action={<Box ms="-6px" fontSize="14px"><AppLink app="burner" href={burnerHref(denom)}>Burner</AppLink></Box>}
            >
                {runningText}
            </BlockerNote>
        </Box>
    )

    const payRows: PayRow[] = [
        potBase
            ? { label: 'Prize pot', coin: { denom, amount: potBase.toFixed() }, info: 'Leaves your wallet now.' }
            : { label: 'Prize pot', text: '—' },
        { label: 'Factory fee', text: 'None' },
    ]

    const aside = (
        <>
            <OutcomePanel>
                <VStack align="stretch" gap="8px">
                    {potText && play ? (
                        <Text data-testid="raffle-outcome">
                            You put <Text as="span" fontWeight="600">{potText}</Text> in the pot now.
                            {` ${raffleSentence(play)}`}
                            {' Losing tickets add their price to the pot.'}
                            {endText && ` On ${endText}, whatever is left is burned.`}
                        </Text>
                    ) : (
                        <Text color="fg.muted">
                            Answer the questions to see how your raffle will run.
                        </Text>
                    )}
                    {trend && <Text fontWeight="600">{POT_TREND_TEXT[trend]}</Text>}
                </VStack>
            </OutcomePanel>
            <PayPanel rows={payRows} txKind="start-raffle" />
        </>
    )

    return (
        <GuidedForm
            crumb="Burning raffle"
            title={<>Run a burning <GradientText>raffle</GradientText></>}
            subtitle="Fund a prize pot. People buy tickets for a chance to win part of it. Losing tickets make the pot bigger, and whatever is left at the end is burned."
            techTag="Burning raffle"
            aside={aside}
        >
            <Question
                title="Token"
                question="Which token is the raffle in?"
                {...steps.step('token')}
                summary={ticker}
                action={{ label: 'Continue', onClick: () => answer('token'), disabled: !tokenReady }}
            >
                <VStack align="stretch" gap="16px">
                    <AssetPicker
                        label="Token to raffle"
                        value={denom}
                        ownFirst={true}
                        excludeHalted={true}
                        onSelect={(a) => pickToken(a.denom)}
                    />
                    <Hint>{"Any token can be raffled. Halted tokens can't be raffled."}</Hint>
                    {asset && address && (
                        <Text fontSize="14px" color="fg.muted">You have {displayAmount(max.balance, decimals)} {ticker}.</Text>
                    )}
                    {tokenBlock ? (
                        <Text fontSize="14px" color="hg.danger.text" role="alert">{tokenBlock}</Text>
                    ) : asset && isRunning ? (
                        runningNote
                    ) : asset && raffle.status === 'loading' ? (
                        <Shimmer h="16px" w="224px" data-testid="raffle-checking" />
                    ) : asset && raffle.status === 'error' ? (
                        <HStack gap="12px" wrap="wrap">
                            <Text fontSize="14px" color="hg.danger.text" role="alert">
                                {`Couldn't check whether ${ticker} already has a raffle running.`}
                            </Text>
                            <Button {...softButton} size="xs" onClick={refresh}>
                                <LuRefreshCw />
                                Retry
                            </Button>
                        </HStack>
                    ) : null}
                </VStack>
            </Question>

            <Question
                title="Prize pot"
                question="How big is the prize pot?"
                {...steps.step('pot')}
                summary={potText && potSummary(potText)}
                onBack={steps.back}
                action={{ label: 'Continue', onClick: () => answer('pot'), disabled: potBase === undefined }}
            >
                <VStack align="stretch" gap="12px">
                    <TextField
                        label={`Prize pot (${ticker})`}
                        helper={`At least ${displayAmount('100000', decimals)} ${ticker}.${address ? ` You can put in up to ${displayAmount(max.amount, decimals)} ${ticker}.` : ''}`}
                        error={potError}
                        value={potInput}
                        onChange={setPotInput}
                        placeholder="e.g. 1000"
                    />
                    {address && (
                        <Button alignSelf="start" {...softButton} size="xs" onClick={() => setPotInput(max.inputValue)}>
                            MAX
                        </Button>
                    )}
                </VStack>
            </Question>

            <Question
                title="How it plays"
                question="How long, what a ticket costs, and what a winner gets"
                {...steps.step('play')}
                summary={play ? rafflePlaySummary(play) : ''}
                onBack={steps.back}
                action={{ label: 'Continue', onClick: () => answer('play'), disabled: play === undefined }}
            >
                <VStack align="stretch" gap="20px">
                    <VStack align="stretch" gap="8px">
                        <Presets values={DAY_PRESETS} current={daysInput} label={n => `${n} days`} onPick={n => setDaysInput(String(n))} />
                        <TextField
                            label="Days"
                            helper={endText ? `Ends around ${endText}.` : '1 to 180 whole days.'}
                            error={daysError}
                            value={daysInput}
                            onChange={setDaysInput}
                            placeholder="e.g. 14"
                            inputMode="numeric"
                        />
                    </VStack>
                    <TextField
                        label={`Ticket price (${ticker})`}
                        helper="Paid by each person joining, per ticket. A losing ticket's price goes into the pot."
                        error={ticketError}
                        value={ticketInput}
                        onChange={setTicketInput}
                        placeholder="e.g. 10"
                    />
                    <VStack align="stretch" gap="8px">
                        <Presets values={ONE_IN_PRESETS} current={oneInInput} label={n => `1 in ${fmt(n)}`} onPick={n => setOneInInput(String(n))} />
                        <TextField
                            label="1 ticket in how many wins?"
                            helper={chances !== undefined
                                ? `Each ticket wins with a chance of ${percentFromChances(chances)} %.`
                                : `A whole number from 1 to ${fmt(1_000_000)}.`}
                            error={oneInError}
                            value={oneInInput}
                            onChange={setOneInInput}
                            placeholder="e.g. 100"
                            inputMode="numeric"
                        />
                    </VStack>
                    <VStack align="stretch" gap="8px">
                        <Presets values={PERCENT_PRESETS} current={percentInput} label={n => `${n} %`} onPick={n => setPercentInput(String(n))} />
                        <TextField
                            label="Share of the pot (%)"
                            helper={percent !== undefined && prizeNowText
                                ? `${percent} % of the pot, ${prizeNowText} right now.`
                                : 'A whole percent from 1 to 100, of the pot at the moment of the win.'}
                            error={percentError}
                            value={percentInput}
                            onChange={setPercentInput}
                            placeholder="e.g. 25"
                            inputMode="numeric"
                        />
                    </VStack>
                    {play && (
                        <Text fontSize="14px" fontWeight="600" data-testid="raffle-sentence">{raffleSentence(play)}</Text>
                    )}
                </VStack>
            </Question>

            {panelProps ? (
                <>
                    <TxPanel {...panelProps} />
                    {chainSaysRunning && runningNote}
                </>
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={payRows}
                    txKind="start-raffle"
                    gets={[{ label: 'Burning raffle', value: 'A raffle on Burner' }]}
                    permanent={["What's left in the pot at the end is burned", "Raffle settings can't change once started"]}
                    submitLabel="Start raffle"
                    onSubmit={() => void sign()}
                    disabled={!canSign}
                    onBack={steps.back}
                >
                    <VStack align="stretch" gap="8px" aria-label="Before you start">
                        {WARNINGS.map(w => <WarningNote key={w} lead="Heads up:">{w}</WarningNote>)}
                    </VStack>
                    {!address ? (
                        <SubmitNote>Connect your wallet to start the raffle.</SubmitNote>
                    ) : checkFailed ? (
                        <SubmitNote tone="error">{`Couldn't check whether ${ticker} already has a raffle running. Please try again.`}</SubmitNote>
                    ) : isComplete && !afford.isLoading && !afford.canAfford && afford.message && (
                        <SubmitNote tone="error">{afford.message}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function RaffleNewPage() {
    return (
        <FormPage>
            <RaffleFormContent />
        </FormPage>
    )
}
