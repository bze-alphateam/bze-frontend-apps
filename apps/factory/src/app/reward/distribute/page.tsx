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
    type TxSpec,
    getChainName,
    hgVariant,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useAssets,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { DistributeDone, type DistributeDoneInput } from '@/components/reward-wizard/distribute-done'
import { useNavigation, useNavigationWithParams } from '@/hooks/useNavigation'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import {
    BlockerNote,
    FormFrame,
    FormPage,
    GuidedForm,
    PayPanel,
    Question,
    ReviewStep,
    SubmitNote,
    TipNote,
    TxPanel,
    useGuidedSteps,
} from '@/components/guided'
import { daysLeftText, isFinished } from '@/lib/reward-extend'
import {
    checkDistributeAmount,
    distributeHref,
    distributeMsgValue,
    hasStakers,
    linkedRewardId,
    searchDistributableRewards,
} from '@/lib/reward-distribute'

const { distributeStakingRewards } = bze.rewards.MessageComposer.withTypeUrl

const TX_KIND: TxSpec = 'distribute-staking-rewards'
const STEP_KEYS = ['reward', 'amount', 'review'] as const

/** One reward of the picker list. */
function RewardOption({ reward, now, onPick }: { reward: StakingRewardSDKType; now: Date; onPick: () => void }) {
    const { asset: stakingAsset } = useAsset(reward.staking_denom)
    const { asset: prizeAsset } = useAsset(reward.prize_denom)
    const stakeTicker = stakingAsset?.ticker ?? reward.staking_denom
    const prizeTicker = prizeAsset?.ticker ?? reward.prize_denom

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
            data-testid="distribute-reward-option"
        >
            <TokenLogo src={stakingAsset?.logo ?? ''} symbol={stakeTicker} size="8" circular={true} />
            <VStack align="start" gap="2px" minW="0">
                <Text fontSize="14px" fontWeight="700">{`Stake ${stakeTicker} · paid in ${prizeTicker}`}</Text>
                <Text fontSize="12px" fontFamily="mono" color="fg.muted">{`#${reward.reward_id} · ${daysLeftText(reward, now)}`}</Text>
            </VStack>
        </chakra.button>
    )
}

/** The simple rewards someone stakes in, searched by token (and narrowed by `?staking=`). */
function RewardList({ rewards, stakingDenom, now, onPick }: {
    rewards: StakingRewardSDKType[];
    stakingDenom?: string | null;
    now: Date;
    onPick: (id: string) => void;
}) {
    const { denomTicker } = useAssets()
    const [query, setQuery] = useState('')
    const shown = useMemo(
        () => searchDistributableRewards(rewards, query, denomTicker, stakingDenom),
        [rewards, query, denomTicker, stakingDenom],
    )

    return (
        <VStack align="stretch" gap="12px">
            <Input
                placeholder="Search by token, e.g. HONEY"
                aria-label="Search rewards"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {shown.length === 0 ? (
                <Text fontSize="14px" color="fg.muted" data-testid="distribute-reward-empty">
                    {query.trim() ? 'No simple reward with stakers matches this search.' : 'No simple reward has stakers right now.'}
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
                    description="A finished reward with nothing staked can be deleted from the chain, so an old link may lead nowhere."
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

function DistributeContent() {
    const { getQueryParam } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { rewards, isLoading, hasError, refresh } = useStakingRewards()

    const linkedId = getQueryParam('id') ?? ''
    const linkedStaking = getQueryParam('staking') ?? getQueryParam('denom')
    const [pickedId, setPickedId] = useState<string | undefined>(undefined)
    const [amountInput, setAmountInput] = useState('')
    const [amountTouched, setAmountTouched] = useState(false)
    const [amountAnswered, setAmountAnswered] = useState(false)
    const [done, setDone] = useState<{ input: DistributeDoneInput; hash: string } | undefined>(undefined)
    // Today, for the days-left text.
    const [now] = useState(() => new Date())

    // A link preselects the reward until one is picked from the list.
    const preselected = linkedRewardId(rewards, { id: linkedId, staking: linkedStaking })
    const rewardId = pickedId ?? preselected
    const reward = rewards.find(r => r.reward_id === rewardId)
    const { asset: stakingAsset } = useAsset(reward?.staking_denom ?? '')
    const { asset: prizeAsset } = useAsset(reward?.prize_denom ?? '')
    // The balance shown and the Max button: the whole balance, less the gas when the prize is the gas token.
    const spendable = useMaxSpendable(reward?.prize_denom ?? '', reward ? TX_KIND : undefined)

    const connected = Boolean(address)
    const stakeTicker = stakingAsset?.ticker ?? reward?.staking_denom ?? ''
    const prizeTicker = prizeAsset?.ticker ?? reward?.prize_denom ?? ''
    const display = (amount: string | { toString(): string }, decimals?: number) => decimals !== undefined
        ? prettyAmount(uAmountToBigNumberAmount(amount.toString(), decimals))
        : amount.toString()

    const stakers = reward ? hasStakers(reward) : false
    const finished = reward ? isFinished(reward) : false
    // Without a wallet the wizard can still be walked to Review; the balance check needs one.
    const amount = prizeAsset
        ? checkDistributeAmount(amountInput, prizeAsset.decimals, connected ? spendable.amount : undefined)
        : { error: 'Required.', short: false, uAmount: undefined }
    const amountValid = stakers && amount.error === '' && !amount.short

    const steps = useGuidedSteps(STEP_KEYS, {
        reward: Boolean(rewardId) && Boolean(reward),
        amount: amountAnswered && amountValid,
        review: false,
    })

    const pick = (id: string) => {
        setPickedId(id)
        setAmountInput('')
        setAmountTouched(false)
        setAmountAnswered(false)
        steps.close()
    }

    const giftText = amount.uAmount ? `${display(amount.uAmount, prizeAsset?.decimals)} ${prizeTicker}` : ''
    const balanceText = `${display(spendable.balance, prizeAsset?.decimals)} ${prizeTicker}`
    const maxText = `${display(spendable.amount, prizeAsset?.decimals)} ${prizeTicker}`
    const stakedText = reward ? `${display(reward.staked_amount || '0', stakingAsset?.decimals)} ${stakeTicker}` : ''

    // Not wrapped in useCallback: the React Compiler memoizes it (the reward is looked up in the list each render).
    const buildMsgs = () => {
        if (!address || !reward || !amount.uAmount || !hasStakers(reward)) return undefined
        return [distributeStakingRewards(distributeMsgValue({ creator: address, rewardId: reward.reward_id, uAmount: amount.uAmount }))]
    }

    const onDone = useCallback(({ input, hash }: WizardTxDone<DistributeDoneInput>) => {
        refresh()
        if (input) setDone({ input, hash })
    }, [refresh])
    const { submit, panelProps } = useWizardTx<DistributeDoneInput>(buildMsgs, {
        title: rewardId ? `Distribute to reward #${rewardId}` : 'Distribute to a reward',
        onDone,
        href: rewardId ? distributeHref(rewardId) : undefined,
    })

    if (done) return <DistributeDone input={done.input} hash={done.hash} />

    if (linkedId && rewardId === linkedId && !isLoading && !hasError && !reward && !panelProps) {
        return <NotFound id={linkedId} />
    }

    const isComplete = steps.state.reward === 'done' && steps.state.amount === 'done'
    const canDistribute = isComplete && connected && amountValid

    const distribute = () => {
        if (!canDistribute || !reward) return
        submit({
            rewardId: reward.reward_id,
            stakingDenom: reward.staking_denom,
            stakingTicker: stakeTicker,
            prizeDenom: reward.prize_denom,
            prizeTicker,
            amount: display(amount.uAmount ?? '0', prizeAsset?.decimals),
        })
    }

    const leaves = amount.uAmount && reward ? [{ label: 'The gift', coin: { denom: reward.prize_denom, amount: amount.uAmount } }] : []

    const aside = (
        <PayPanel
            rows={leaves}
            txKind={TX_KIND}
            footer={amount.uAmount && connected && (
                <Text fontSize="14px" color={amount.short ? 'hg.danger.text' : 'fg.muted'} data-testid="distribute-holdings">
                    {`You hold ${balanceText} ${amount.short ? '✗' : '✓'}`}
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
        rewardBody = <RewardList rewards={rewards} stakingDenom={linkedStaking} now={now} onPick={pick} />
    }

    return (
        <GuidedForm
            parent={{ href: '/rewards', label: 'Rewards' }}
            crumb="Distribute"
            title={<>Distribute to <GradientText>stakers</GradientText></>}
            subtitle="Send a one-time amount to everyone staking in a simple reward."
            techTag="rewards · distribute staking rewards"
            aside={aside}
        >
            <Question
                title="Reward"
                question="Which reward?"
                {...steps.step('reward')}
                summary={reward && `Stake ${stakeTicker} · paid in ${prizeTicker}`}
            >
                {rewardBody}
            </Question>

            <Question
                title="Amount"
                question="How much?"
                {...steps.step('amount')}
                summary={giftText}
                onBack={steps.back}
                action={{ label: 'Review', onClick: () => { setAmountAnswered(true); steps.close() }, disabled: !amountValid }}
            >
                {reward && (
                    <VStack align="stretch" gap="16px">
                        <VStack as="section" aria-label="This reward" align="stretch" gap="8px" p="14px" borderRadius="hg.md" bg="hg.inset" borderWidth="1px" borderColor="hg.divider" data-testid="distribute-terms">
                            <TermRow label="People stake" value={stakeTicker} />
                            <TermRow label="Paid in" value={prizeTicker} />
                            <TermRow label="Staked now" value={stakedText} />
                        </VStack>

                        {!stakers ? (
                            <BlockerNote lead="Nobody stakes in this reward.">
                                There&apos;s no one to send to yet. Pick another reward, or come back once someone stakes.
                            </BlockerNote>
                        ) : (
                            <Field.Root invalid={amountTouched && amountInput.trim() !== '' && amount.error !== ''}>
                                <HStack justify="space-between" w="full" gap="8px" flexWrap="wrap">
                                    <Field.Label>{`Amount (${prizeTicker})`}</Field.Label>
                                    {connected && (
                                        <HStack gap="4px">
                                            <Text fontSize="12px" color="hg.text.faint" data-testid="distribute-balance">{`of ${balanceText}`}</Text>
                                            <Button
                                                size="2xs"
                                                variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }}
                                                onClick={() => { setAmountInput(spendable.inputValue); setAmountTouched(true) }}
                                                disabled={!spendable.amount.gt(0)}
                                            >
                                                Max
                                            </Button>
                                        </HStack>
                                    )}
                                </HStack>
                                <Input
                                    placeholder="e.g. 1000"
                                    inputMode="decimal"
                                    value={amountInput}
                                    onChange={(e) => setAmountInput(e.target.value)}
                                    onBlur={() => setAmountTouched(true)}
                                />
                                <Field.ErrorText>{amount.error}</Field.ErrorText>
                            </Field.Root>
                        )}

                        {stakers && giftText && (
                            <Box fontSize="14px" data-testid="distribute-sentence">
                                <Text>
                                    <chakra.strong>{giftText}</chakra.strong>
                                    {` is split between everyone staking ${stakeTicker} right now, by how much each stakes.`}
                                </Text>
                                {amount.short && (
                                    <Text mt="6px" color="hg.danger.text" fontWeight="600" role="alert">
                                        {`Not enough ${prizeTicker}: you can send up to ${maxText}.`}
                                    </Text>
                                )}
                            </Box>
                        )}

                        {stakers && finished && (
                            <TipNote lead="This reward has finished.">
                                Its stakers can still claim what you send.
                            </TipNote>
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
                    gets={[{ label: 'Distribution', value: `${stakeTicker} stakers can claim it right away` }]}
                    extra={giftText ? [{ label: 'Split between', value: `Everyone staking ${stakeTicker}, pro rata` }] : []}
                    permanent={["A distribution can't be undone"]}
                    submitLabel="Distribute now"
                    onSubmit={distribute}
                    disabled={!canDistribute}
                    onBack={steps.back}
                >
                    {!address && <SubmitNote>Connect your wallet to distribute.</SubmitNote>}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function RewardDistributePage() {
    return (
        <FormPage>
            <DistributeContent />
        </FormPage>
    )
}
