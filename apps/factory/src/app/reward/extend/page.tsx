"use client"

import React, { useCallback, useMemo, useState } from 'react'
import { Box, Button, chakra, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuRefreshCw } from 'react-icons/lu'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { bze } from '@bze/bzejs'
import {
    GradientText,
    HgCard,
    PageState,
    Shimmer,
    TokenLogo,
    getChainName,
    hgVariant,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useAssets,
    useBalance,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { ExtendDone, type ExtendDoneInput } from '@/components/reward-wizard/extend-done'
import { useNavigation, useNavigationWithParams } from '@/hooks/useNavigation'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import {
    FormFrame,
    FormPage,
    GuidedForm,
    PayPanel,
    Question,
    ReviewStep,
    SubmitNote,
    TxPanel,
    useGuidedSteps,
} from '@/components/guided'
import {
    daysLeftText,
    endDate,
    extendCost,
    extendHref,
    extendMsgValue,
    extendRoom,
    isFinished,
    newEndDate,
    searchRunningRewards,
    validateExtraDays,
} from '@/lib/reward-extend'
import { formatDate, minMaxHint, notEnoughText, youHoldText } from '@/lib/format'

const { updateStakingReward } = bze.rewards.MessageComposer.withTypeUrl

const TX_KIND = 'update-staking-reward'
const STEP_KEYS = ['reward', 'days', 'review'] as const

/** One running reward of the picker list. */
function RewardOption({ reward, now, onPick }: { reward: StakingRewardSDKType; now: Date; onPick: () => void }) {
    const { asset: stakingAsset } = useAsset(reward.staking_denom)
    const { asset: prizeAsset } = useAsset(reward.prize_denom)
    const stakeTicker = stakingAsset?.ticker ?? reward.staking_denom
    const prizeTicker = prizeAsset?.ticker ?? reward.prize_denom
    const perDay = prizeAsset ? prettyAmount(uAmountToBigNumberAmount(reward.prize_amount, prizeAsset.decimals)) : reward.prize_amount

    return (
        <chakra.button
            type="button"
            onClick={onPick}
            display="flex"
            alignItems="center"
            gap="12px"
            w="100%"
            textAlign="left"
            px="14px"
            py="12px"
            borderRadius="hg.md"
            borderWidth="1px"
            borderColor="hg.divider"
            bg="hg.inset"
            cursor="pointer"
            overflowWrap="anywhere"
            _hover={{ borderColor: 'app.border' }}
            data-testid="extend-reward-option"
        >
            <TokenLogo src={stakingAsset?.logo ?? ''} symbol={stakeTicker} size="8" circular={true} />
            <VStack align="start" gap="2px" minW="0">
                <Text fontSize="14px" fontWeight="700">{`Stake ${stakeTicker} · earn ${perDay} ${prizeTicker} a day`}</Text>
                <Text fontSize="12px" fontFamily="mono" color="fg.muted">{`#${reward.reward_id} · ${daysLeftText(reward, now)}`}</Text>
            </VStack>
        </chakra.button>
    )
}

/** Without `?id=`: the running simple rewards, searched by staked token. */
function RewardList({ rewards, now, onPick }: { rewards: StakingRewardSDKType[]; now: Date; onPick: (id: string) => void }) {
    const { denomTicker } = useAssets()
    const [query, setQuery] = useState('')
    const shown = useMemo(() => searchRunningRewards(rewards, query, denomTicker), [rewards, query, denomTicker])

    return (
        <VStack align="stretch" gap="12px">
            <Input
                placeholder="Search by staked token, e.g. HONEY"
                aria-label="Search rewards"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {shown.length === 0 ? (
                <Text fontSize="14px" color="fg.muted" data-testid="extend-reward-empty">
                    {query.trim() ? 'No running simple reward matches this search.' : 'No simple reward is running right now.'}
                </Text>
            ) : shown.map(reward => (
                <RewardOption key={reward.reward_id} reward={reward} now={now} onPick={() => onPick(reward.reward_id)} />
            ))}
        </VStack>
    )
}

function TermRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <HStack justify="space-between" align="start" gap="12px">
            <Text fontSize="14px" color="fg.muted">{label}</Text>
            <Text fontSize="14px" fontWeight="600" textAlign="right">{value}</Text>
        </HStack>
    )
}

function NotFound({ id }: { id: string }) {
    const { navigate } = useNavigation()
    return (
        <FormFrame narrow>
            <HgCard p="16px">
                <PageState
                    kind="not-found"
                    title={`We couldn't find reward #${id}.`}
                    description="It may have finished and been removed."
                    action={(
                        <Button variant={hgVariant('secondary')} size="lg" onClick={() => navigate('/rewards')}>
                            <LuArrowLeft />
                            See all rewards
                        </Button>
                    )}
                />
            </HgCard>
        </FormFrame>
    )
}

function ExtendContent() {
    const { getQueryParam } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { rewards, isLoading, hasError, refresh } = useStakingRewards()

    const linkedId = getQueryParam('id') ?? ''
    const [rewardId, setRewardId] = useState(linkedId)
    const [rewardAnswered, setRewardAnswered] = useState(Boolean(linkedId))
    const [extraDays, setExtraDays] = useState('')
    const [daysAnswered, setDaysAnswered] = useState(false)
    const [done, setDone] = useState<{ input: ExtendDoneInput; hash: string } | undefined>(undefined)
    // Today, for the days-left and end dates.
    const [now] = useState(() => new Date())

    const reward = rewards.find(r => r.reward_id === rewardId)
    const { asset: stakingAsset } = useAsset(reward?.staking_denom ?? '')
    const { asset: prizeAsset } = useAsset(reward?.prize_denom ?? '')
    const { balance: prizeBalance } = useBalance(reward?.prize_denom ?? '')

    const connected = Boolean(address)
    const stakeTicker = stakingAsset?.ticker ?? reward?.staking_denom ?? ''
    const prizeTicker = prizeAsset?.ticker ?? reward?.prize_denom ?? ''
    const display = (amount: string | number | { toString(): string }) => prizeAsset
        ? prettyAmount(uAmountToBigNumberAmount(amount.toString(), prizeAsset.decimals))
        : amount.toString()

    const daysError = reward ? validateExtraDays(extraDays, reward) : 'Required.'
    const cost = reward && daysError === '' ? extendCost(reward, extraDays.trim()) : undefined
    const hasEnough = Boolean(cost) && prizeBalance.amount.gte(cost ?? 0)
    // Without a wallet the wizard can still be walked to Review; the balance check needs one.
    const daysValid = daysError === '' && (!connected || hasEnough)

    const steps = useGuidedSteps(STEP_KEYS, {
        reward: rewardAnswered && Boolean(reward),
        days: daysAnswered && daysValid,
        review: false,
    })

    const pick = (id: string) => {
        setRewardId(id)
        setRewardAnswered(true)
        setExtraDays('')
        setDaysAnswered(false)
        steps.close()
    }

    const perDay = reward ? display(reward.prize_amount) : ''
    const finished = reward ? isFinished(reward) : false
    const oldEnd = reward && !finished ? formatDate(endDate(reward, now), now) : ''
    const newEnd = reward && cost ? formatDate(newEndDate(reward, Number(extraDays.trim()), now), now) : ''
    const daysCount = Number(extraDays.trim())
    const daysText = `${daysCount.toLocaleString('en-US')} day${daysCount === 1 ? '' : 's'}`

    // Not wrapped in useCallback: the React Compiler memoizes it (the reward is looked up in the list each render).
    const buildMsgs = () => {
        if (!address || !reward || validateExtraDays(extraDays, reward) !== '') return undefined
        return [updateStakingReward(extendMsgValue({ creator: address, rewardId: reward.reward_id, days: extraDays }))]
    }

    const onDone = useCallback(({ input, hash }: WizardTxDone<ExtendDoneInput>) => {
        refresh()
        if (input) setDone({ input, hash })
    }, [refresh])
    const { submit, panelProps } = useWizardTx<ExtendDoneInput>(buildMsgs, {
        title: rewardId ? `Extend reward #${rewardId}` : 'Extend reward',
        onDone,
        href: rewardId ? extendHref(rewardId) : undefined,
    })

    if (done) return <ExtendDone input={done.input} hash={done.hash} />

    if (linkedId && rewardId === linkedId && !isLoading && !hasError && !reward && !panelProps) {
        return <NotFound id={linkedId} />
    }

    const isComplete = steps.state.reward === 'done' && steps.state.days === 'done'
    const canExtend = isComplete && connected && hasEnough

    const extend = () => {
        if (!canExtend || !reward) return
        submit({
            rewardId: reward.reward_id,
            stakingDenom: reward.staking_denom,
            stakingTicker: stakeTicker,
            prizeDenom: reward.prize_denom,
            prizeTicker,
            perDay,
            days: extraDays.trim(),
            newEnd,
        })
    }

    const leaves = cost && reward ? [{ label: 'Extra rewards', coin: { denom: reward.prize_denom, amount: cost.toFixed() } }] : []

    const aside = (
        <PayPanel
            rows={leaves}
            txKind={TX_KIND}
            footer={cost && connected && (
                <Text fontSize="14px" color={hasEnough ? 'fg.muted' : 'hg.danger.text'} data-testid="extend-holdings">
                    {`${youHoldText(display(prizeBalance.amount), prizeTicker)} ${hasEnough ? '✓' : '✗'}`}
                </Text>
            )}
        />
    )

    let rewardBody: React.ReactNode
    if (isLoading) {
        rewardBody = <Shimmer h="64px" borderRadius="hg.md" />
    } else if (hasError) {
        rewardBody = (
            <VStack align="stretch" gap="10px">
                <Text fontSize="14px" color="hg.danger.text" role="alert">
                    Couldn&apos;t load the simple rewards. The node may be down; try again in a moment.
                </Text>
                <Box>
                    <Button variant={hgVariant('secondary')} size="sm" onClick={refresh}><LuRefreshCw /> Retry</Button>
                </Box>
            </VStack>
        )
    } else {
        rewardBody = <RewardList rewards={rewards} now={now} onPick={pick} />
    }

    return (
        <GuidedForm
            parent={{ href: '/rewards', label: 'Rewards' }}
            crumb="Extend"
            title={<>Extend a <GradientText>reward</GradientText></>}
            subtitle="Pay for more days of a simple reward."
            aside={aside}
        >
            <Question
                title="Reward"
                question="Which reward?"
                {...steps.step('reward')}
                summary={reward && `Stake ${stakeTicker} · earn ${perDay} ${prizeTicker} a day`}
            >
                {rewardBody}
            </Question>

            <Question
                title="Extra days"
                question="How many more days?"
                {...steps.step('days')}
                summary={cost && `${daysText} · new end ${newEnd}`}
                onBack={steps.back}
                action={{ label: 'Review extension', onClick: () => { setDaysAnswered(true); steps.close() }, disabled: !daysValid }}
            >
                {reward && (
                    <VStack align="stretch" gap="16px">
                        <VStack as="section" aria-label="This reward" align="stretch" gap="8px" p="14px" borderRadius="hg.md" bg="hg.inset" borderWidth="1px" borderColor="hg.divider" data-testid="extend-terms">
                            <TermRow label="Stake" value={stakeTicker} />
                            <TermRow label="Daily reward" value={`${perDay} ${prizeTicker}`} />
                            <TermRow label="End date" value={finished ? 'Ended' : oldEnd} />
                        </VStack>

                        <Field.Root invalid={extraDays !== '' && daysError !== ''}>
                            <Field.Label>Extra days</Field.Label>
                            <Input
                                placeholder="e.g. 30"
                                inputMode="numeric"
                                value={extraDays}
                                onChange={(e) => setExtraDays(e.target.value)}
                                maxW="200px"
                            />
                            <Field.HelperText>{minMaxHint(1, extendRoom(reward), 'days')}</Field.HelperText>
                            <Field.ErrorText>{daysError}</Field.ErrorText>
                        </Field.Root>

                        {cost && (
                            <VStack align="stretch" gap="8px" p="14px" borderRadius="hg.md" bg="hg.inset" borderWidth="1px" borderColor="hg.divider" data-testid="extend-cost">
                                <Box data-testid="extend-new-end"><TermRow label="New end date" value={newEnd} /></Box>
                            </VStack>
                        )}

                        {cost && connected && !hasEnough && (
                            <Text fontSize="14px" color="hg.danger.text" fontWeight="600" role="alert">
                                {notEnoughText(prizeTicker, display(prizeBalance.amount))}
                            </Text>
                        )}
                    </VStack>
                )}
            </Question>

            {panelProps ? (
                <TxPanel {...panelProps} />
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={leaves}
                    txKind={TX_KIND}
                    gets={[{ label: 'Extension', value: `${daysCount.toLocaleString('en-US')} more day${daysCount === 1 ? '' : 's'}` }]}
                    extra={newEnd ? [{ label: 'New end date', value: newEnd }] : []}
                    permanent={["This action can't be undone"]}
                    submitLabel="Extend"
                    onSubmit={extend}
                    disabled={!canExtend}
                    onBack={steps.back}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet.</SubmitNote>
                    ) : isComplete && !hasEnough && (
                        <SubmitNote tone="error">{notEnoughText(prizeTicker, display(prizeBalance.amount))}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function RewardExtendPage() {
    return (
        <FormPage>
            <ExtendContent />
        </FormPage>
    )
}
