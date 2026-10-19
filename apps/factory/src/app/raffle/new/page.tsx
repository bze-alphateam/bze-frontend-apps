"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Checkbox, HStack, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuRefreshCw } from 'react-icons/lu'
import {
    AppLink,
    GradientText,
    Shimmer,
    formatTimeRemainingFromEpochs,
    getBurnerApp,
    getExplorerTxURL,
    getChainName,
    isLpDenom,
    useAsset,
    useCanAffordTx,
    useEpochs,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useTokenRaffle } from '@/hooks/useTokenRaffle'
import { AssetPicker } from '@/components/ui/asset-picker'
import { TextField } from '@/components/manage/denom-reward-form-parts'
import {
    AnswerChip,
    AnswerChips,
    BlockerNote,
    ContinueRow,
    FormPage,
    GuidedForm,
    Hint,
    OutcomePanel,
    PayPanel,
    Question,
    SubmitBlock,
    SubmitNote,
    SuccessPanel,
    WarningNote,
    useGuidedSteps,
} from '@/components/guided'
import type { PayRow } from '@/components/guided'
import {
    POT_TREND_TEXT,
    buildStartRaffleMsg,
    burnerCoinHref,
    chancesFromOneIn,
    displayAmount,
    expectedPotTrend,
    formatRaffleEnd,
    isRaffleRunningError,
    percentFromChances,
    raffleEndDate,
    raffleRunningText,
    toBaseUnits,
    validateOneIn,
    validatePot,
    validatePrizePercent,
    validateRaffleDays,
    validateTicketPrice,
} from '@/lib/raffle-new'
import { softButton } from '@/components/ui/soft-button'

const STEPS = ['token', 'pot', 'days', 'ticket', 'chance', 'prize'] as const
type Step = typeof STEPS[number]

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
    const { tx } = useFactoryTx()
    const { hourEpochInfo } = useEpochs()

    const [denom, setDenom] = useState(() => getQueryParam('denom') ?? '')
    const [potInput, setPotInput] = useState('')
    const [daysInput, setDaysInput] = useState('')
    const [ticketInput, setTicketInput] = useState('')
    const [oneInInput, setOneInInput] = useState('')
    const [percentInput, setPercentInput] = useState('')
    const [answered, setAnswered] = useState<Step[]>(() => (getQueryParam('denom') ? ['token'] : []))
    const [understood, setUnderstood] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    // The chain refused the start because a raffle is running for this denom (the lookup missed it).
    const [chainRunningFor, setChainRunningFor] = useState<string | undefined>(undefined)
    const [done, setDone] = useState<{ txHash: string; denom: string; ticker: string; endsAt: string } | undefined>(undefined)

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
    const isRunning = Boolean(runningRaffle) || (chainRunningFor !== undefined && chainRunningFor === denom)
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
    const chances = oneInError === '' ? chancesFromOneIn(Number(oneInInput.trim())) : undefined
    const percent = percentError === '' ? Number(percentInput.trim()) : undefined

    const tokenReady = Boolean(asset) && tokenBlock === '' && raffle.status === 'none' && !isRunning
    const steps = useGuidedSteps(STEPS, {
        token: answered.includes('token') && tokenReady,
        pot: answered.includes('pot') && potBase !== undefined,
        days: answered.includes('days') && days !== undefined,
        ticket: answered.includes('ticket') && ticketBase !== undefined,
        chance: answered.includes('chance') && chances !== undefined,
        prize: answered.includes('prize') && percent !== undefined,
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const allAnswered = STEPS.every(k => steps.state[k] === 'done')
    const afford = useCanAffordTx({
        spec: address && potBase ? 'start-raffle' : undefined,
        spend: potBase ? { denom, amount: potBase } : undefined,
    })
    const canConfirm = allAnswered && Boolean(address) && understood && !afford.isLoading && afford.canAfford

    const endsAt = useMemo(
        () => (days !== undefined ? raffleEndDate(days, hourEpochInfo?.current_epoch_start_time) : undefined),
        [days, hourEpochInfo?.current_epoch_start_time],
    )
    const endText = endsAt ? formatRaffleEnd(endsAt) : ''

    const potText = potBase ? `${displayAmount(potBase, decimals)} ${ticker}` : ''
    const ticketText = ticketBase ? `${displayAmount(ticketBase, decimals)} ${ticker}` : ''
    const prizeNowText = potBase && percent !== undefined
        ? `${displayAmount(potBase.multipliedBy(percent).div(100).integerValue(BigNumber.ROUND_DOWN), decimals)} ${ticker}`
        : ''
    const trend = potBase && ticketBase && chances !== undefined && percent !== undefined
        ? expectedPotTrend({ ticketPrice: ticketBase, chances, ratio: new BigNumber(percent).div(100).toFixed(2), pot: potBase })
        : undefined

    const burnerHref = (d: string) => burnerCoinHref(getBurnerApp().href, d)

    const pickToken = (d: string) => {
        setDenom(d)
        setChainRunningFor(undefined)
    }

    const submit = async () => {
        if (!address || !canConfirm || !potBase || !ticketBase || days === undefined || chances === undefined || percent === undefined) return
        const msg = buildStartRaffleMsg({ creator: address, denom, pot: potBase, days, chances, prizePercent: percent, ticketPrice: ticketBase })
        const result = { denom, ticker, endsAt: endText }

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: (res) => {
                    setDone({ txHash: res.txhash, ...result })
                    refresh()
                },
                onFailure: (err) => {
                    if (isRaffleRunningError(err)) {
                        setChainRunningFor(result.denom)
                        refresh()
                    }
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const startAnother = () => {
        setDone(undefined)
        setDenom('')
        setPotInput('')
        setDaysInput('')
        setTicketInput('')
        setOneInInput('')
        setPercentInput('')
        setAnswered([])
        setUnderstood(false)
        setChainRunningFor(undefined)
    }

    if (done) {
        return (
            <SuccessPanel
                title={`The ${done.ticker} raffle is live`}
                text={done.endsAt ? `It ends around ${done.endsAt}. Whatever is left in the pot then is burned.` : undefined}
                links={[
                    { label: 'Burner', href: burnerHref(done.denom), app: 'burner' },
                    { label: 'Explorer', href: getExplorerTxURL(done.txHash), app: 'explorer' },
                ]}
                again={{ label: 'Start another', onClick: startAnother }}
            />
        )
    }

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
                    {potText && days !== undefined && ticketText && chances !== undefined && percent !== undefined ? (
                        <Text data-testid="raffle-outcome">
                            You put <Text as="span" fontWeight="600">{potText}</Text> in the pot now.
                            {` For ${fmt(days)} ${days === 1 ? 'day' : 'days'}, anyone can buy a ticket for ${ticketText}.`}
                            {` About 1 ticket in ${fmt(Number(oneInInput.trim()))} wins ${percent} % of the pot at that moment.`}
                            {' Losing tickets add their price to the pot.'}
                            {` On ${endText}, whatever is left is burned.`}
                        </Text>
                    ) : (
                        <Text color="fg.muted">
                            Answer the questions to see how your raffle will run.
                        </Text>
                    )}
                    {trend && <Text fontWeight="600">{POT_TREND_TEXT[trend]}</Text>}
                </VStack>
            </OutcomePanel>

            <VStack align="stretch" gap="8px" aria-label="Before you start">
                {WARNINGS.map(w => <WarningNote key={w} lead="Heads up:">{w}</WarningNote>)}
            </VStack>

            <PayPanel rows={payRows} txKind="start-raffle" />

            <VStack align="stretch" gap="12px">
                <Checkbox.Root
                    checked={understood}
                    onCheckedChange={(e) => setUnderstood(e.checked === true)}
                    alignItems="start"
                    gap="10px"
                >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control mt="1px" borderRadius="6px" />
                    <Checkbox.Label fontSize="14px" lineHeight="1.5" fontWeight="400" color="hg.text.secondary">
                        {"I understand the pot can't be taken back and what's left at the end is burned."}
                    </Checkbox.Label>
                </Checkbox.Root>
                <SubmitBlock label="Start the raffle" onClick={submit} disabled={!canConfirm} loading={isSubmitting}>
                    {!address ? (
                        <SubmitNote>Connect your wallet to start the raffle.</SubmitNote>
                    ) : allAnswered && !afford.isLoading && !afford.canAfford && afford.message && (
                        <Text fontSize="14px" lineHeight="1.5" color="hg.danger.text" textAlign="center" role="alert">{afford.message}</Text>
                    )}
                </SubmitBlock>
            </VStack>
        </>
    )

    return (
        <GuidedForm
            title={<>Run a burning <GradientText>raffle</GradientText></>}
            subtitle="Fund a prize pot. People buy tickets for a chance to win part of it. Losing tickets make the pot bigger, and whatever is left at the end is burned."
            techTag="Burning raffle"
            aside={aside}
        >
            <Question
                number={1}
                title="Which token?"
                state={steps.state.token}
                summary={ticker ? <>Raffle {ticker}</> : ''}
                onChange={() => steps.open('token')}
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
                        <Box data-testid="raffle-running">
                            <BlockerNote
                                action={<Box ms="-6px" fontSize="14px"><AppLink app="burner" href={burnerHref(denom)}>Burner</AppLink></Box>}
                            >
                                {runningText}
                            </BlockerNote>
                        </Box>
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
                    <ContinueRow disabled={!tokenReady} onContinue={() => answer('token')} />
                </VStack>
            </Question>

            <Question
                number={2}
                title="How big is the prize pot?"
                state={steps.state.pot}
                summary={potText}
                onChange={() => steps.open('pot')}
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
                    <ContinueRow disabled={potBase === undefined} onContinue={() => answer('pot')} />
                </VStack>
            </Question>

            <Question
                number={3}
                title="How long should it run?"
                state={steps.state.days}
                summary={days !== undefined ? `${fmt(days)} ${days === 1 ? 'day' : 'days'}, ends around ${endText}` : ''}
                onChange={() => steps.open('days')}
            >
                <VStack align="stretch" gap="12px">
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
                    <ContinueRow disabled={days === undefined} onContinue={() => answer('days')} />
                </VStack>
            </Question>

            <Question
                number={4}
                title="What does a ticket cost?"
                state={steps.state.ticket}
                summary={ticketText}
                onChange={() => steps.open('ticket')}
            >
                <VStack align="stretch" gap="12px">
                    <TextField
                        label={`Ticket price (${ticker})`}
                        helper="Paid by each person joining, per ticket. A losing ticket's price goes into the pot."
                        error={ticketError}
                        value={ticketInput}
                        onChange={setTicketInput}
                        placeholder="e.g. 10"
                    />
                    <ContinueRow disabled={ticketBase === undefined} onContinue={() => answer('ticket')} />
                </VStack>
            </Question>

            <Question
                number={5}
                title="How often does a ticket win?"
                state={steps.state.chance}
                summary={chances !== undefined ? `1 in ${fmt(Number(oneInInput.trim()))} tickets` : ''}
                onChange={() => steps.open('chance')}
            >
                <VStack align="stretch" gap="12px">
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
                    <ContinueRow disabled={chances === undefined} onContinue={() => answer('chance')} />
                </VStack>
            </Question>

            <Question
                number={6}
                title="How much does a winner get?"
                state={steps.state.prize}
                summary={percent !== undefined ? `${percent} % of the pot` : ''}
                onChange={() => steps.open('prize')}
            >
                <VStack align="stretch" gap="12px">
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
                    <ContinueRow disabled={percent === undefined} onContinue={() => answer('prize')} />
                </VStack>
            </Question>
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
