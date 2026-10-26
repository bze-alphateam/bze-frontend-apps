"use client"

import React, { useState } from 'react'
import NextLink from 'next/link'
import BigNumber from 'bignumber.js'
import { Box, Button, chakra, Field, HStack, Input, Link, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    type Asset,
    type DenomReward,
    type TxSpec,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { AirdropForm, TargetQuestion } from '@/components/airdrop/airdrop-form'
import {
    BlockerNote,
    PayPanel,
    type PayRow,
    Question,
    ReviewStep,
    SubmitNote,
    TxPanel,
    useGuidedSteps,
} from '@/components/guided'
import { StakedTokenPicker, type TokenState } from '@/components/pickers/staked-token-picker'
import { DistributeDone, type DistributeDoneInput } from '@/components/reward-wizard/distribute-done'
import { PrizeDone } from '@/components/reward-wizard/prize-done'
import { PrizeSlotNote } from '@/components/reward-wizard/prize-slot-note'
import { AssetPicker } from '@/components/ui/asset-picker'
import { AIRDROP_TX_KIND, airdropPayRows, useAirdropGift } from '@/hooks/useAirdropGift'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import {
    type AirdropTarget,
    type StakersReward,
    defaultReward,
    hasStaked,
    rewardsOfToken,
    simpleStakedDenoms,
} from '@/lib/airdrop'
import { compoundedNewHref, nothingStakedText } from '@/lib/denom-reward'
import type { PrizeDoneInput } from '@/lib/prize-wizard'
import { notEnoughText, youHoldText } from '@/lib/format'
import { checkDistributeAmount, distributeMsgValue } from '@/lib/reward-distribute'
import { chooseRewardsHref } from '@/lib/create-routes'

const { distributeStakingRewards } = bze.rewards.MessageComposer.withTypeUrl

const SIMPLE_TX_KIND: TxSpec = 'distribute-staking-rewards'

const FORM_STEPS = ['target', 'token', 'reward', 'amount'] as const
type FormStep = typeof FORM_STEPS[number]
const STEP_KEYS = [...FORM_STEPS, 'review'] as const

/** What the Done screen gets: the compounded reward's or the simple reward's (kept in the pending-tx store). */
type AirdropDoneInput =
    | { via: 'compounded'; prize: PrizeDoneInput }
    | { via: 'simple'; distribute: DistributeDoneInput }

/** The last read right before signing: nothing staked any more, or the read failed. */
type Recheck = { denom: string; result: 'empty' | 'error' }

/** A token's state in the picker: whether anyone stakes it in its compounded reward. */
function pickerState(asset: Asset, dr?: DenomReward): TokenState | undefined {
    if (!dr) return undefined
    const staked = uAmountToBigNumberAmount(dr.staked_amount, asset.decimals)
    return staked.gt(0) ? { text: `${prettyAmount(staked)} staked`, tone: 'good' } : undefined
}

/** One reward of the picked token, with what is staked in it. */
function RewardOption({ reward, stakedTicker, stakedDecimals, selected, onPick }: {
    reward: StakersReward;
    stakedTicker: string;
    stakedDecimals?: number;
    selected: boolean;
    onPick: () => void;
}) {
    const { asset: prizeAsset } = useAsset(reward.kind === 'simple' ? reward.prizeDenom : '')
    const staked = stakedDecimals !== undefined ? prettyAmount(uAmountToBigNumberAmount(reward.staked, stakedDecimals)) : reward.staked
    const empty = !hasStaked(reward)
    const title = reward.kind === 'compounded'
        ? 'Compounded reward · any token'
        : `Simple reward #${reward.rewardId} · paid in ${prizeAsset?.ticker ?? reward.prizeDenom}`
    const line = reward.kind === 'simple' && reward.daysLeft === 0 ? 'Finished · stakers can still claim' : ''

    return (
        <chakra.button
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={empty}
            display="flex"
            alignItems="center"
            gap="12px"
            w="full"
            px="14px"
            py="12px"
            textAlign="start"
            borderRadius="12px"
            borderWidth="1px"
            borderColor={selected ? 'app.border' : 'hg.divider'}
            bg={selected ? 'app.subtle' : 'hg.inset'}
            cursor="pointer"
            overflowWrap="anywhere"
            _hover={{ borderColor: 'app.border' }}
            _disabled={{ cursor: 'not-allowed', opacity: 0.6, _hover: { borderColor: 'hg.divider' } }}
            focusVisibleRing="outside"
            onClick={onPick}
            data-testid="airdrop-reward"
        >
            <VStack align="start" gap="2px" minW={0} flex="1">
                <Text fontSize="14px" fontWeight="700">{title}</Text>
                {line && <Text fontSize="12px" color="fg.muted">{line}</Text>}
            </VStack>
            <Text fontSize="13px" fontWeight="600" color={empty ? 'hg.text.faint' : 'hg.success.text'} textAlign="end" flexShrink={0}>
                {empty ? 'Nothing staked' : `${staked} ${stakedTicker} staked`}
            </Text>
        </chakra.button>
    )
}

interface StakersAirdropProps {
    target: Extract<AirdropTarget, 'stakers' | 'lp'>;
    /** What a link picked: the staked token, a simple reward, the coin to send. */
    initialDenom?: string;
    initialRewardId?: string;
    initialPrize?: string;
    onTarget: (target: AirdropTarget) => void;
}

/**
 * Airdrop coins to the stakers of a token, or to liquidity providers (stakers of a pool share):
 * pick the token, then the reward to go through when it has more than one, then the amount. A
 * compounded reward takes any coin; a simple reward only its own prize coin.
 */
export function StakersAirdrop({ target, initialDenom = '', initialRewardId, initialPrize = '', onTarget }: StakersAirdropProps) {
    const { address } = useChain(getChainName())
    const connected = Boolean(address)
    const simple = useStakingRewards()

    const [pickedDenom, setDenom] = useState(initialDenom)
    const [pickedReward, setPickedReward] = useState<string | undefined>(undefined)
    const [prizeDenom, setPrizeDenom] = useState(initialPrize)
    const [amountInput, setAmountInput] = useState('')
    const [amountTouched, setAmountTouched] = useState(false)
    const [answered, setAnswered] = useState<FormStep[]>(() => (initialDenom || initialRewardId ? ['target', 'token'] : ['target']))
    const [checking, setChecking] = useState(false)
    const [recheck, setRecheck] = useState<Recheck | undefined>(undefined)
    const [done, setDone] = useState<{ input: AirdropDoneInput; hash: string } | undefined>(undefined)

    // A link to one simple reward (`?id=`) names its staked token through the reward.
    const linkedDenom = initialRewardId ? simple.rewards.find(r => r.reward_id === initialRewardId)?.staking_denom : undefined
    const denom = pickedDenom || linkedDenom || ''
    const { asset: stakedAsset } = useAsset(denom)
    const dr = useDenomReward(denom)
    const rewards = rewardsOfToken(denom, dr.denomReward, simple.rewards)
    const rewardKey = pickedReward ?? defaultReward(rewards, initialRewardId)
    const reward = rewards.find(r => r.key === rewardKey)
    const viaCompounded = reward?.kind === 'compounded'
    const coinDenom = reward?.kind === 'simple' ? reward.prizeDenom : prizeDenom
    const { asset: coinAsset } = useAsset(coinDenom)

    const txKind = viaCompounded ? AIRDROP_TX_KIND : SIMPLE_TX_KIND
    // The balance shown and the Max button: the whole balance, less the gas when the coin is the gas token.
    const spendable = useMaxSpendable(coinDenom, reward ? txKind : undefined)
    const amount = coinAsset
        ? checkDistributeAmount(amountInput, coinAsset.decimals, connected ? spendable.amount : undefined)
        : { error: 'Required.', short: false, uAmount: undefined }

    const gift = useAirdropGift({
        denom,
        stakedAmount: dr.denomReward?.staked_amount,
        prizes: dr.prizes,
        prizeDenom: viaCompounded ? prizeDenom : '',
        uAmount: viaCompounded ? amount.uAmount : undefined,
        stakedTicker: stakedAsset?.ticker,
    })

    const loading = dr.isLoading || simple.isLoading
    const loadError = dr.hasError || simple.hasError
    const anyStaked = rewards.some(hasStaked)
    const tokenOk = Boolean(denom) && !loading && !loadError && anyStaked
    const amountOk = Boolean(coinAsset) && amount.error === '' && !amount.short
        && (!viaCompounded || (!gift.slot.capReached && gift.costs.escrow !== undefined))

    const lastCheck = recheck?.denom === denom ? recheck.result : undefined
    const steps = useGuidedSteps(STEP_KEYS, {
        target: true,
        // Only when the check right before signing finds the stake gone does the token stay answered, so Review shows why.
        token: answered.includes('token') && (tokenOk || lastCheck === 'empty'),
        reward: Boolean(reward) && (hasStaked(reward!) || lastCheck === 'empty'),
        amount: answered.includes('amount') && amountOk,
        review: false,
    })

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }
    const pickToken = (asset: Asset) => {
        setDenom(asset.denom)
        setPickedReward(undefined)
        setAmountInput('')
        setAmountTouched(false)
    }
    const pickReward = (key: string) => {
        setPickedReward(key)
        setAmountInput('')
        setAmountTouched(false)
        steps.close()
    }

    // Until the asset list loads, plain words stand in for the tickers: a raw factory denom is one
    // long unbreakable word that would push the page wider than a phone.
    const ticker = stakedAsset?.ticker ?? ''
    const stakedName = ticker || (target === 'lp' ? 'the LP shares' : 'the token')
    const people = target === 'lp' ? `${stakedName} liquidity providers` : `${stakedName} stakers`
    const coinTicker = coinAsset?.ticker ?? ''
    const giftText = amount.uAmount && coinAsset ? `${prettyAmount(uAmountToBigNumberAmount(amount.uAmount, coinAsset.decimals))} ${coinTicker}` : ''
    const balanceText = coinAsset ? prettyAmount(uAmountToBigNumberAmount(spendable.balance, coinAsset.decimals)) : ''
    const stakedText = reward && stakedAsset ? `${prettyAmount(uAmountToBigNumberAmount(reward.staked, stakedAsset.decimals))} ${ticker}` : ''
    const rewardSummary = !reward ? '' : reward.kind === 'compounded'
        ? `Compounded reward · ${stakedText} staked`
        : `Simple reward #${reward.rewardId} · ${stakedText} staked`

    const buildMsgs = () => {
        if (!address || !reward || !amount.uAmount) return undefined
        if (reward.kind === 'compounded') {
            const msg = gift.message(address)
            return msg ? [msg] : undefined
        }
        return [distributeStakingRewards(distributeMsgValue({ creator: address, rewardId: reward.rewardId, uAmount: amount.uAmount }))]
    }
    const onDone = ({ input, hash }: WizardTxDone<AirdropDoneInput>) => {
        void dr.refresh()
        simple.refresh()
        if (input) setDone({ input, hash })
    }
    const { submit, panelProps } = useWizardTx<AirdropDoneInput>(buildMsgs, {
        title: `Airdrop to ${people}`,
        onDone,
    })

    if (done) {
        return done.input.via === 'compounded'
            ? <PrizeDone input={done.input.prize} hash={done.hash} />
            : <DistributeDone input={done.input.distribute} hash={done.hash} />
    }

    const isComplete = FORM_STEPS.every(k => steps.state[k] === 'done')
    const stakedNow = reward ? hasStaked(reward) : false
    const nobodyStakes = isComplete && (lastCheck === 'empty' || (reward !== undefined && !stakedNow))
    const canSign = isComplete && connected && amountOk && stakedNow && !checking
        && (!viaCompounded || gift.canSign)

    // The stake can drop to 0 while the wizard is open, and the chain then refuses the airdrop:
    // a compounded reward is read again right before you sign.
    const sign = async () => {
        if (!canSign || !reward || !coinAsset) return
        const shown = prettyAmount(uAmountToBigNumberAmount(amount.uAmount ?? '0', coinAsset.decimals))
        // A simple reward has no single-reward read: its staked amount on screen is the last one known.
        if (reward.kind === 'compounded') {
            setChecking(true)
            const fresh = await dr.refresh()
            setChecking(false)
            if (!fresh || fresh.hasError) {
                setRecheck({ denom, result: 'error' })
                return
            }
            if (!fresh.denomReward || !new BigNumber(fresh.denomReward.staked_amount || 0).gt(0)) {
                setRecheck({ denom, result: 'empty' })
                return
            }
        }
        setRecheck(undefined)
        submit(reward.kind === 'compounded'
            ? { via: 'compounded', prize: { kind: 'airdrop', stakedDenom: denom, stakedTicker: ticker, prizeDenom, prizeTicker: coinTicker, amount: shown } }
            : { via: 'simple', distribute: { rewardId: reward.rewardId, stakingDenom: denom, stakingTicker: ticker, prizeDenom: reward.prizeDenom, prizeTicker: coinTicker, amount: shown } })
    }

    const payRows: PayRow[] = viaCompounded
        ? airdropPayRows(gift, prizeDenom)
        : amount.uAmount && reward ? [{ label: 'Airdrop', coin: { denom: coinDenom, amount: amount.uAmount } }] : []
    const feeLoading = viaCompounded && gift.isNewPrize && gift.isFeeLoading
    const feeUnknown = viaCompounded && gift.isNewPrize && !gift.slot.capReached && !gift.isFeeLoading && !gift.costs.feesKnown

    const aside = (
        <PayPanel rows={payRows} moduleFee={viaCompounded ? gift.mainFee : undefined} txKind={txKind} isLoading={feeLoading} feeUnknown={feeUnknown} />
    )

    let tokenNote: React.ReactNode = null
    if (denom && loadError) {
        tokenNote = (
            <BlockerNote
                action={(
                    <Button size="xs" variant="ghost" color="hg.link" fontWeight="600" onClick={() => { void dr.refresh(); simple.refresh() }}>
                        <LuRefreshCw /> Retry
                    </Button>
                )}
            >
                {`Couldn't load ${ticker ? `${ticker}'s` : 'the'} rewards. The node may be down.`}
            </BlockerNote>
        )
    } else if (denom && !loading && rewards.length === 0) {
        tokenNote = (
            <BlockerNote action={<Link asChild color="hg.link" fontSize="14px" fontWeight="600"><NextLink href={chooseRewardsHref({ denom })}>Create a staking reward</NextLink></Link>}>
                {`${stakedName} has no staking reward yet, so nobody can stake it.`}
            </BlockerNote>
        )
    } else if (denom && !loading && !anyStaked) {
        tokenNote = <Box data-testid="airdrop-blocker"><BlockerNote>{nothingStakedText(stakedName)}</BlockerNote></Box>
    }

    return (
        <AirdropForm aside={aside}>
            <TargetQuestion
                {...steps.step('target')}
                value={target}
                onPick={(next) => (next === target ? steps.close() : onTarget(next))}
            />

            <Question
                title="Stake"
                question={target === 'lp' ? 'Which LP shares?' : 'Which token?'}
                {...steps.step('token')}
                summary={ticker && people}
                onBack={steps.back}
                action={{ label: 'Continue', onClick: () => answer('token'), disabled: !tokenOk }}
            >
                <VStack align="stretch" gap="14px">
                    <StakedTokenPicker
                        mode="hasRewards"
                        stakable={simpleStakedDenoms(simple.rewards)}
                        only={target === 'lp' ? 'lp' : 'tokens'}
                        value={denom}
                        onChange={pickToken}
                        stateOf={pickerState}
                    />
                    <Text fontSize="14px" color="fg.muted">
                        {'Not in the list? '}
                        <Link asChild color="hg.link" fontWeight="600"><NextLink href={target === 'lp' ? chooseRewardsHref() : compoundedNewHref()}>{target === 'lp' ? 'Make it stakable first' : 'Make a token stakable'}</NextLink></Link>
                    </Text>
                    {tokenNote}
                </VStack>
            </Question>

            <Question
                title="Reward"
                question={`Which reward's ${target === 'lp' ? 'providers' : 'stakers'}?`}
                {...steps.step('reward')}
                summary={rewardSummary}
                onBack={steps.back}
            >
                <VStack align="stretch" gap="8px" role="radiogroup" aria-label="Reward">
                    {rewards.map(r => (
                        <RewardOption
                            key={r.key}
                            reward={r}
                            stakedTicker={ticker}
                            stakedDecimals={stakedAsset?.decimals}
                            selected={r.key === rewardKey}
                            onPick={() => pickReward(r.key)}
                        />
                    ))}
                </VStack>
            </Question>

            <Question
                title="Amount"
                question="How much?"
                {...steps.step('amount')}
                summary={giftText}
                onBack={steps.back}
                action={{ label: 'Review', onClick: () => answer('amount'), disabled: !amountOk }}
            >
                <VStack align="stretch" gap="16px">
                    {viaCompounded && (
                        <AssetPicker label="Token" value={prizeDenom} onSelect={(asset) => setPrizeDenom(asset.denom)} />
                    )}
                    {viaCompounded && coinAsset && (
                        <PrizeSlotNote slot={gift.slot} max={gift.maxPrizes} />
                    )}
                    {reward?.kind === 'simple' && (
                        <Text fontSize="14px" color="fg.muted">{`Paid in ${coinTicker || 'its reward token'}`}</Text>
                    )}
                    {coinAsset && (
                        <Field.Root invalid={amountTouched && amountInput.trim() !== '' && amount.error !== ''}>
                            <HStack justify="space-between" w="full" gap="8px" flexWrap="wrap">
                                <Field.Label>{`Amount (${coinTicker})`}</Field.Label>
                                {connected && (
                                    <HStack gap="4px">
                                        <Text fontSize="12px" color="hg.text.faint" data-testid="airdrop-balance">{youHoldText(balanceText, coinTicker)}</Text>
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
                    {giftText && amount.short && (
                        <Text fontSize="14px" color="hg.danger.text" fontWeight="600" role="alert">
                            {notEnoughText(coinTicker, balanceText)}
                        </Text>
                    )}
                </VStack>
            </Question>

            {panelProps ? (
                <TxPanel {...panelProps} />
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={payRows}
                    moduleFee={viaCompounded ? gift.mainFee : undefined}
                    txKind={txKind}
                    isLoading={feeLoading}
                    feeUnknown={feeUnknown}
                    gets={[{ label: 'Airdrop', value: giftText ? `${giftText} to ${people}` : people }]}
                    permanent={["This action can't be undone"]}
                    submitLabel="Airdrop"
                    onSubmit={() => void sign()}
                    disabled={!canSign}
                    onBack={steps.back}
                    blocker={nobodyStakes ? (
                        <Box data-testid="presign-blocker">
                            <BlockerNote>{nothingStakedText(stakedName)}</BlockerNote>
                        </Box>
                    ) : undefined}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet.</SubmitNote>
                    ) : lastCheck === 'error' ? (
                        <SubmitNote tone="error">{`Couldn't check the stakers right before signing. Please try again.`}</SubmitNote>
                    ) : viaCompounded && isComplete && gift.blocker ? (
                        <SubmitNote tone="error">{gift.blocker}</SubmitNote>
                    ) : viaCompounded && isComplete && gift.costs.escrow && !gift.afford.isLoading && !gift.afford.canAfford && gift.afford.message && (
                        <SubmitNote tone="error">{gift.afford.message}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </AirdropForm>
    )
}
