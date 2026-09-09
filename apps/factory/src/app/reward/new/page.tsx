"use client"

import React, { Suspense, useMemo, useState } from 'react'
import {
    Box,
    Button,
    Card,
    Container,
    Field,
    HStack,
    Input,
    Separator,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import {
    LuArrowLeft,
    LuArrowUpRight,
    LuCircleCheck,
    LuCopy,
    LuGift,
    LuLock,
    LuPlus,
} from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    amountToUAmount,
    getChainExplorerURL,
    getChainName,
    getStakingApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCreationFees,
    useToast,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { AssetPicker } from '@/components/ui/asset-picker'
import { FeeDisclosure } from '@/components/ui/fee-disclosure'
import { InfoBox } from '@/components/ui/info-box'
import { validateAmount } from '@/components/token-wizard/validation'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'

const { createStakingReward } = bze.rewards.MessageComposer.withTypeUrl

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

// Chain limits verified in x/rewards: duration 1–36,500 days, lock 0–3,650 days.
const MIN_DURATION_DAYS = 1
const MAX_DURATION_DAYS = 36500
const MAX_LOCK_DAYS = 3650

// The keeper emits a typed StakingRewardCreateEvent carrying the assigned id.
// Typed-event attribute values are JSON-encoded, hence the quote stripping.
function extractRewardId(res: { [key: string]: unknown }): string | undefined {
    const events = res.events as
        | { type: string; attributes: { key: string; value: string }[] }[]
        | undefined
    const event = events?.find(e => e.type === 'bze.rewards.StakingRewardCreateEvent')
    const raw = event?.attributes.find(a => a.key === 'reward_id')?.value
    return raw ? raw.replace(/^"|"$/g, '') : undefined
}

function validateDays(value: string, min: number, max: number): string {
    const trimmed = value.trim()
    if (!trimmed) return 'Required.'
    if (!/^\d+$/.test(trimmed)) return 'Enter a whole number of days.'
    const days = Number(trimmed)
    if (days < min || days > max) {
        return `Must be between ${min.toLocaleString()} and ${max.toLocaleString()} days.`
    }
    return ''
}

// Min stake is optional: empty or 0 = no minimum.
function validateMinStake(value: string, decimals: number): string {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '0') return ''
    return validateAmount(trimmed, decimals)
}

function FieldWithError({
    label,
    helper,
    error,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    helper?: string;
    error: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    const [touched, setTouched] = useState(false)

    return (
        <Field.Root invalid={touched && error !== ''}>
            <Field.Label>{label}</Field.Label>
            <Input
                placeholder={placeholder}
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setTouched(true)}
            />
            {helper && <Field.HelperText>{helper}</Field.HelperText>}
            <Field.ErrorText>{error}</Field.ErrorText>
        </Field.Root>
    )
}

function RewardNewContent() {
    const { getQueryParam, navigate } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { fees, isLoading: isFeeLoading } = useCreationFees()
    const { tx } = useFactoryTx()
    const { toast } = useToast()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [created, setCreated] = useState<
        { txHash: string; rewardId?: string; escrowLabel: string } | undefined
    >(undefined)

    // The pool success screen chains here with its LP denom preselected.
    const [stakingDenom, setStakingDenom] = useState(() => getQueryParam('staking') ?? '')
    const [prizeDenom, setPrizeDenom] = useState('')
    const [prizePerDay, setPrizePerDay] = useState('')
    const [duration, setDuration] = useState('')
    const [lock, setLock] = useState('0')
    const [minStake, setMinStake] = useState('')

    const { asset: stakingAsset } = useAsset(stakingDenom)
    const { asset: prizeAsset } = useAsset(prizeDenom)
    const { balance: prizeBalance } = useBalance(prizeDenom)

    const fee = fees.createStakingRewardFee
    const { balance: feeBalance, isLoading: isFeeBalanceLoading } = useBalance(fee?.denom ?? '')
    const feePayment = useFeePayment(fee, 'create-staking-reward')

    const prizeError = prizeAsset ? validateAmount(prizePerDay, prizeAsset.decimals) : ''
    const durationError = validateDays(duration, MIN_DURATION_DAYS, MAX_DURATION_DAYS)
    const lockError = validateDays(lock, 0, MAX_LOCK_DAYS)
    const minStakeError = stakingAsset ? validateMinStake(minStake, stakingAsset.decimals) : ''

    // THE key disclosure: the chain escrows prize × duration upfront, not per day.
    const escrowUAmount = useMemo(() => {
        if (!prizeAsset || prizeError !== '' || durationError !== '') return undefined
        return new BigNumber(amountToUAmount(prizePerDay, prizeAsset.decimals))
            .multipliedBy(duration)
    }, [prizeAsset, prizePerDay, duration, prizeError, durationError])

    const escrowDisplay = useMemo(() => {
        if (!escrowUAmount || !prizeAsset) return undefined
        return uAmountToBigNumberAmount(escrowUAmount, prizeAsset.decimals)
    }, [escrowUAmount, prizeAsset])

    // The escrow and the creation fee both leave the wallet at creation — when the
    // prize IS the fee denom, the balance must cover them together. If the fee is
    // paid in the Settings fee token instead, it never touches the prize balance.
    const hasEnoughForEscrow = useMemo(() => {
        if (!escrowUAmount) return false
        let needed = escrowUAmount
        if (fee && prizeDenom === fee.denom && !feePayment.paysWithAlt) {
            needed = needed.plus(fee.amount)
        }
        return prizeBalance.amount.gte(needed)
    }, [escrowUAmount, fee, prizeDenom, prizeBalance, feePayment.paysWithAlt])

    const hasEnoughForFee = useMemo(() => {
        if (!fee) return false
        let needed = new BigNumber(fee.amount)
        if (escrowUAmount && prizeDenom === fee.denom) {
            needed = needed.plus(escrowUAmount)
        }
        // The gas fee is deducted first, from the same balance when it is paid in the fee denom.
        if (feePayment.gasFee.denom === fee.denom) {
            needed = needed.plus(feePayment.gasFee.amount)
        }
        return feeBalance.amount.gte(needed)
    }, [fee, feeBalance, escrowUAmount, prizeDenom, feePayment.gasFee.denom, feePayment.gasFee.amount])

    const canPayFee = hasEnoughForFee || feePayment.paysWithAlt

    const isComplete = Boolean(stakingDenom) && Boolean(prizeDenom) &&
        prizeError === '' && durationError === '' && lockError === '' && minStakeError === ''
    const canConfirm = isComplete && Boolean(address) && Boolean(fee) &&
        !isFeeBalanceLoading && canPayFee && hasEnoughForEscrow

    const submit = async () => {
        if (!address || !canConfirm || !stakingAsset || !prizeAsset || !escrowDisplay) return

        const trimmedMinStake = minStake.trim()
        const msg = createStakingReward({
            creator: address,
            prizeAmount: amountToUAmount(prizePerDay, prizeAsset.decimals),
            prizeDenom,
            stakingDenom,
            duration: duration.trim(),
            minStake: !trimmedMinStake || trimmedMinStake === '0'
                ? '0'
                : amountToUAmount(trimmedMinStake, stakingAsset.decimals),
            lock: lock.trim(),
        })

        const escrowLabel = `${prettyAmount(escrowDisplay)} ${prizeAsset.ticker}`

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: (res) => {
                    setCreated({ txHash: res.txhash, rewardId: extractRewardId(res), escrowLabel })
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const createAnother = () => {
        setCreated(undefined)
        setStakingDenom('')
        setPrizeDenom('')
        setPrizePerDay('')
        setDuration('')
        setLock('0')
        setMinStake('')
    }

    const copyRewardId = async () => {
        if (!created?.rewardId) return
        await navigator.clipboard.writeText(created.rewardId)
        toast.success('Copied', 'Reward id copied to clipboard.')
    }

    if (created) {
        const stakingUrl = getStakingApp().href
        const txUrl = `${getChainExplorerURL(getChainName())}/tx/${created.txHash}`

        return (
            <VStack align="stretch" gap={6} py={{ base: 4, md: 8 }}>
                <VStack gap={3} align="center">
                    <Box color="green.500">
                        <LuCircleCheck size={56} />
                    </Box>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        Your staking reward program is live!
                    </Text>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        {created.escrowLabel} was escrowed for the full program.
                        Anyone staking {stakingAsset?.ticker ?? 'the staking token'} now
                        shares the daily prize.
                    </Text>
                </VStack>

                {created.rewardId && (
                    <Box
                        p={4}
                        bgGradient="to-br"
                        gradientFrom="yellow.500/8"
                        gradientTo="yellow.600/8"
                        borderWidth="1px"
                        borderColor="yellow.500/20"
                        borderRadius="xl"
                    >
                        <VStack align="stretch" gap={2}>
                            <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                                Your reward id
                            </Text>
                            <HStack gap={2}>
                                <Text fontSize="sm" fontFamily="mono" p={2} borderRadius="md" bg="bg.muted" flex="1">
                                    {created.rewardId}
                                </Text>
                                <Button size="sm" variant="ghost" colorPalette="yellow" onClick={copyRewardId} aria-label="Copy reward id">
                                    <LuCopy />
                                </Button>
                            </HStack>
                        </VStack>
                    </Box>
                )}

                <HStack gap={3} justify="center" wrap="wrap">
                    <Button colorPalette="yellow" onClick={() => openExternal(stakingUrl)}>
                        View on Staking app <LuArrowUpRight />
                    </Button>
                    <Button variant="outline" colorPalette="yellow" onClick={() => openExternal(txUrl)}>
                        View transaction <LuArrowUpRight />
                    </Button>
                </HStack>

                <VStack align="stretch" gap={3}>
                    <Text fontSize="sm" color="fg.muted" fontWeight="medium" textAlign="center">
                        What&apos;s next?
                    </Text>
                    <HStack gap={3} justify="center" wrap="wrap">
                        <Button variant="outline" colorPalette="yellow" size="sm" onClick={createAnother}>
                            <LuPlus />
                            Create another reward
                        </Button>
                    </HStack>
                </VStack>

                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={() => navigate('/')}>
                    Back to hub
                </Button>
            </VStack>
        )
    }

    return (
        <VStack align="stretch" gap={6}>
            <Box>
                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={() => navigate('/')}>
                    <LuArrowLeft />
                    Creation hub
                </Button>
            </Box>

            <HStack gap={3}>
                <Box p={2.5} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                    <LuGift size={22} />
                </Box>
                <VStack align="start" gap={0}>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        Create Staking Reward
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        Fund a staking program — your community stakes a token and earns your prize.
                    </Text>
                </VStack>
            </HStack>

            <Card.Root variant="outline" p={{ base: 5, md: 6 }}>
                <VStack align="stretch" gap={5}>
                    <AssetPicker
                        label="Token participants stake"
                        value={stakingDenom}
                        includeLP={true}
                        onSelect={(asset) => setStakingDenom(asset.denom)}
                    />
                    <AssetPicker
                        label="Token they earn — the prize (paid from your wallet)"
                        value={prizeDenom}
                        onSelect={(asset) => setPrizeDenom(asset.denom)}
                    />

                    {stakingAsset && prizeAsset && (
                        <>
                            <Separator />

                            <VStack align="stretch" gap={4}>
                                <VStack align="start" gap={0}>
                                    <Text fontWeight="semibold">The prize</Text>
                                    <Text fontSize="sm" color="fg.muted">
                                        Every day, the daily prize is split among participants in
                                        proportion to their stake.
                                    </Text>
                                </VStack>

                                <FieldWithError
                                    label={`Prize per day (${prizeAsset.ticker})`}
                                    helper={`Balance: ${prettyAmount(uAmountToBigNumberAmount(prizeBalance.amount, prizeAsset.decimals))} ${prizeAsset.ticker}`}
                                    error={prizeError}
                                    value={prizePerDay}
                                    onChange={setPrizePerDay}
                                    placeholder="e.g. 1000"
                                />
                                <FieldWithError
                                    label="Program duration (days)"
                                    helper={`${MIN_DURATION_DAYS}–${MAX_DURATION_DAYS.toLocaleString()} days of daily payouts.`}
                                    error={durationError}
                                    value={duration}
                                    onChange={setDuration}
                                    placeholder="e.g. 30"
                                />
                            </VStack>

                            {/* The single most important disclosure in the app: the FULL
                                prize for the whole program is escrowed at creation. */}
                            <Box
                                p={5}
                                borderWidth="2px"
                                borderColor="orange.500/40"
                                borderRadius="xl"
                                bg="orange.500/10"
                            >
                                <HStack gap={3} align="start">
                                    <Box color="orange.500" mt={1}>
                                        <LuLock size={24} />
                                    </Box>
                                    <VStack align="start" gap={1}>
                                        <Text fontSize="sm" fontWeight="medium" color="fg.muted">
                                            Locked upfront when you create this program
                                        </Text>
                                        <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                                            {escrowDisplay
                                                ? `${prettyAmount(escrowDisplay)} ${prizeAsset.ticker}`
                                                : `— ${prizeAsset.ticker}`}
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted">
                                            The chain escrows the entire prize — daily prize × duration —
                                            from your wallet the moment the program is created. It is
                                            paid out to stakers day by day and cannot be withdrawn.
                                        </Text>
                                        {escrowDisplay && address && !hasEnoughForEscrow && (
                                            <Text fontSize="sm" color="red.500" fontWeight="medium">
                                                Not enough {prizeAsset.ticker} — you have{' '}
                                                {prettyAmount(uAmountToBigNumberAmount(prizeBalance.amount, prizeAsset.decimals))}.
                                            </Text>
                                        )}
                                    </VStack>
                                </HStack>
                            </Box>

                            <Separator />

                            <VStack align="stretch" gap={4}>
                                <VStack align="start" gap={0}>
                                    <Text fontWeight="semibold">Participation rules</Text>
                                    <Text fontSize="sm" color="fg.muted">
                                        Optional constraints for the people who stake.
                                    </Text>
                                </VStack>

                                <FieldWithError
                                    label="Lock period (days)"
                                    helper={`How long a participant's stake stays locked after they exit (0–${MAX_LOCK_DAYS.toLocaleString()}, 0 = no lock).`}
                                    error={lockError}
                                    value={lock}
                                    onChange={setLock}
                                />
                                <FieldWithError
                                    label={`Minimum stake (${stakingAsset.ticker}, optional)`}
                                    helper="The smallest amount someone can join with. Leave empty for no minimum."
                                    error={minStakeError}
                                    value={minStake}
                                    onChange={setMinStake}
                                    placeholder="0"
                                />
                            </VStack>

                            <InfoBox title="How staking rewards work">
                                Participants stake {stakingAsset.ticker} and share the daily prize
                                of {prizeAsset.ticker}, proportional to their stake. The program runs
                                for the full duration you fund — creating it is a one-time, permanent
                                commitment of the entire prize. Anyone can top up more days later.
                            </InfoBox>
                        </>
                    )}

                    <Separator />

                    <FeeDisclosure fee={fee} isLoading={isFeeLoading} label="Staking reward creation fee" txKind="create-staking-reward" />

                    <VStack align="stretch" gap={2}>
                        <Button
                            size="lg"
                            colorPalette="yellow"
                            onClick={submit}
                            disabled={!canConfirm}
                            loading={isSubmitting}
                            loadingText="Waiting for signature..."
                        >
                            Create staking reward
                        </Button>
                        {!address ? (
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Connect your wallet to create this reward.
                            </Text>
                        ) : isComplete && !isFeeBalanceLoading && !canPayFee && (
                            <Text fontSize="sm" color="fg.error" textAlign="center">
                                Not enough balance to cover the creation fee on top of the escrowed prize.
                            </Text>
                        )}
                    </VStack>
                </VStack>
            </Card.Root>
        </VStack>
    )
}

export default function RewardNewPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="2xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <RewardNewContent />
                </Suspense>
            </Container>
        </Box>
    )
}
