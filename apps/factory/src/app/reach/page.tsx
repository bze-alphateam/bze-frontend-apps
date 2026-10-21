"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw, LuSprout } from 'react-icons/lu'
import {
    GradientText,
    Shimmer,
    amountToUAmount,
    getExplorerTxURL,
    getChainName,
    getCommunitiesApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useAssets,
    useAssetsContext,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useAllDenomRewards } from '@/hooks/useAllDenomRewards'
import { AIRDROP_TX_KIND, airdropPayRows, useAirdropGift } from '@/hooks/useAirdropGift'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { schedulePayRows, useScheduleGift } from '@/hooks/useScheduleGift'
import { CommunityPicker } from '@/components/rewards/community-picker'
import { PrizeTokenQuestion } from '@/components/rewards/prize-token-question'
import { InfoBox } from '@/components/ui/info-box'
import { validateAmount } from '@/components/token-wizard/validation'
import {
    BlockerNote,
    ContinueRow,
    FormPage,
    GuidedForm,
    OutcomePanel,
    PayPanel,
    Question,
    SubmitBlock,
    SubmitNote,
    SuccessPanel,
    TipNote,
    useGuidedSteps,
} from '@/components/guided'
import { MAX_SCHEDULE_DAYS, MIN_SCHEDULE_DAYS, denomRewardHref, prizeBlocker, validateScheduleDays } from '@/lib/denom-reward'
import { communityOptions } from '@/lib/reach'
import { softButton } from '@/components/ui/soft-button'

const STEPS = ['community', 'gift', 'mode'] as const
type Step = typeof STEPS[number]
type Mode = 'once' | 'daily'

const DEFAULT_DAYS = '30'

function ModeCard({ selected, title, text, onClick, children }: {
    selected: boolean;
    title: string;
    text: string;
    onClick: () => void;
    children?: React.ReactNode;
}) {
    return (
        <Box
            px="14px"
            py="12px"
            borderRadius="hg.md"
            borderWidth="1px"
            borderColor={selected ? 'app.border' : 'hg.hairline'}
            bg={selected ? 'app.subtle' : 'hg.inset'}
            transition="border-color 0.15s"
            _hover={selected ? undefined : { borderColor: 'app.border' }}
        >
            <VStack align="stretch" gap="12px">
                <Box as="button" role="radio" aria-checked={selected} onClick={onClick} textAlign="start" cursor="pointer" focusVisibleRing="outside" borderRadius="hg.sm">
                    <Text fontWeight="600" color={selected ? 'hg.link' : 'fg'}>{title}</Text>
                    <Text fontSize="14px" lineHeight="1.5" color="fg.muted">{text}</Text>
                </Box>
                {children}
            </VStack>
        </Box>
    )
}

function ReachContent() {
    const { getQueryParam, navigate } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { getAsset } = useAssets()
    const { usdPricesMap } = useAssetsContext()
    const all = useAllDenomRewards()

    const initialCommunity = getQueryParam('community') ?? ''
    const [community, setCommunity] = useState(initialCommunity)
    const [giftDenom, setGiftDenom] = useState(getQueryParam('gift') ?? '')
    const [amountInput, setAmountInput] = useState('')
    const [amountTouched, setAmountTouched] = useState(false)
    const [mode, setMode] = useState<Mode>('once')
    const [daysInput, setDaysInput] = useState(DEFAULT_DAYS)
    const [answered, setAnswered] = useState<Step[]>(initialCommunity ? ['community'] : [])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [doneTx, setDoneTx] = useState<{ txHash: string; ticker: string; denom: string } | undefined>(undefined)

    const options = useMemo(
        () => communityOptions(all.list ?? [], getAsset, usdPricesMap, address),
        [all.list, getAsset, usdPricesMap, address],
    )
    const picked = options.find(o => o.denom === community)

    const { denomReward, prizes } = useDenomReward(community)
    const { asset: giftAsset } = useAsset(giftDenom)
    const spendable = useMaxSpendable(giftDenom, mode === 'once' ? AIRDROP_TX_KIND : 'create-denom-reward-schedule')

    const amountError = giftAsset ? validateAmount(amountInput, giftAsset.decimals) : ''
    const uAmount = useMemo(() => {
        if (!giftAsset || amountError !== '') return undefined
        return amountToUAmount(amountInput, giftAsset.decimals)
    }, [giftAsset, amountError, amountInput])
    const daysError = validateScheduleDays(daysInput)
    const days = daysError === '' ? Number(daysInput.trim()) : undefined

    // Both hooks run; only the chosen mode gets an amount, so the other one stays idle.
    const airdrop = useAirdropGift({
        denom: community,
        stakedAmount: denomReward?.staked_amount,
        prizes,
        prizeDenom: giftDenom,
        uAmount: mode === 'once' ? uAmount : undefined,
    })
    const daily = useScheduleGift({
        denom: community,
        prizes,
        prizeDenom: giftDenom,
        dailyUAmount: mode === 'daily' ? uAmount : undefined,
        days: mode === 'daily' ? days : undefined,
    })
    const active = mode === 'once' ? airdrop : daily
    const slot = airdrop.slot
    const blocker = mode === 'once'
        ? airdrop.blocker
        : daily.isFeeLoading ? '' : prizeBlocker({ prizeDenom: giftDenom, slot, feesKnown: daily.costs.feesKnown })

    const steps = useGuidedSteps<Step>(STEPS, {
        community: answered.includes('community') && picked !== undefined,
        gift: answered.includes('gift') && Boolean(giftAsset) && !slot.capReached && uAmount !== undefined,
        mode: answered.includes('mode') && (mode === 'once' || daysError === ''),
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const allAnswered = STEPS.every(k => steps.state[k] === 'done')
    const canConfirm = allAnswered && Boolean(address) && blocker === '' && active.canSign

    // Plain words stand in for tickers until the asset list loads: a raw factory denom is one long
    // unbreakable word that would push the page wider than a phone.
    const communityTicker = picked?.ticker ?? 'the token'
    const communityPossessive = picked ? `${picked.ticker}'s` : "the token's"
    const giftTicker = giftAsset?.ticker ?? ''
    const amountDisplay = uAmount !== undefined && giftAsset ? uAmountToBigNumberAmount(uAmount, giftAsset.decimals) : undefined
    const amountText = amountDisplay ? `${prettyAmount(amountDisplay)} ${giftTicker}` : ''
    const totalText = amountDisplay && days !== undefined ? `${prettyAmount(amountDisplay.multipliedBy(days))} ${giftTicker}` : ''
    const onePercentText = amountDisplay ? `${prettyAmount(amountDisplay.multipliedBy(0.01))} ${giftTicker}` : ''
    const balanceText = giftAsset
        ? `of ${prettyAmount(uAmountToBigNumberAmount(spendable.balance, giftAsset.decimals))} ${giftTicker}`
        : ''

    // Your own token, not stakable itself yet: its receivers have no reason to keep it.
    const ownPrefix = address ? `factory/${address}/` : undefined
    const giftNeedsHolderRewards = Boolean(ownPrefix && giftDenom.startsWith(ownPrefix)) && all.list !== undefined &&
        !all.list.some(dr => dr.staking_denom === giftDenom)

    const reset = () => {
        setDoneTx(undefined)
        setCommunity('')
        setAmountInput('')
        setAmountTouched(false)
        setMode('once')
        setDaysInput(DEFAULT_DAYS)
        setAnswered([])
        steps.close()
    }

    const submit = async () => {
        const msg = address && canConfirm ? active.message(address) : undefined
        if (!msg) return
        const sent = { ticker: communityTicker, denom: community }
        setIsSubmitting(true)
        try {
            await tx([msg], { onSuccess: (res) => setDoneTx({ txHash: res.txhash, ...sent }) })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (doneTx) {
        return (
            <SuccessPanel
                title={`Your gift is on its way to ${doneTx.ticker} stakers`}
                links={[
                    { label: 'Explorer', href: getExplorerTxURL(doneTx.txHash), app: 'explorer' },
                    {
                        label: 'Communities',
                        href: `${getCommunitiesApp().href}/token?denom=${encodeURIComponent(doneTx.denom)}`,
                        app: 'communities',
                    },
                ]}
                again={{ label: 'Reach another community', onClick: reset }}
            />
        )
    }

    const names = { prizeDenom: giftDenom, stakingTicker: communityTicker, stakingPossessive: communityPossessive, prizeTicker: giftTicker }
    const payRows = mode === 'once' ? airdropPayRows(airdrop, names) : schedulePayRows(daily, names)

    const aside = (
        <>
            <OutcomePanel
                techTag={`Compounded reward · ${mode === 'once' ? 'airdrop' : 'daily prize'} on ${communityTicker}`}
            >
                {mode === 'once' && amountText ? (
                    <Text data-testid="reach-outcome">
                        <Text as="span" fontWeight="600">{amountText}</Text> leaves your wallet now and is split
                        between everyone staking {communityTicker}, based on how much each one stakes. It can&apos;t be
                        taken back. You don&apos;t need to own {communityTicker} or ask its creator.
                    </Text>
                ) : mode === 'daily' && totalText ? (
                    <Text data-testid="reach-outcome">
                        <Text as="span" fontWeight="600">{totalText}</Text> leaves your wallet now and is paid as{' '}
                        {amountText} a day for {days} payout days to everyone staking {communityTicker}. It can&apos;t
                        be cancelled.
                    </Text>
                ) : (
                    <Text color="fg.muted">Pick the community, your gift and how to send it to see what leaves your wallet.</Text>
                )}
            </OutcomePanel>

            {giftNeedsHolderRewards && giftAsset && (
                <Box data-testid="reach-stakable-tip">
                    <TipNote
                        lead="Tip:"
                        action={(
                            <Button {...softButton} size="sm" onClick={() => navigate(denomRewardHref(giftDenom))}>
                                <LuSprout /> {`Make ${giftTicker} stakable`}
                            </Button>
                        )}
                    >
                        {`Make ${giftTicker} stakable before you do this, so the people who receive it have a reason to keep it.`}
                    </TipNote>
                </Box>
            )}

            <PayPanel
                rows={payRows}
                moduleFee={active.mainFee}
                txKind={mode === 'once' ? AIRDROP_TX_KIND : daily.txKind}
                isLoading={active.isFeeLoading}
                feeUnknown={mode === 'once'
                    ? airdrop.isNewPrize && !slot.capReached && !airdrop.isFeeLoading && !airdrop.costs.feesKnown
                    : daily.feeUnknown}
            />

            <SubmitBlock label={<>{mode === 'once' ? 'Send the gift' : 'Start the daily gift'}</>} onClick={submit} disabled={!canConfirm} loading={isSubmitting}>
                {!address ? (
                    <SubmitNote>Connect your wallet to send the gift.</SubmitNote>
                ) : active.costs.escrow && !active.afford.isLoading && !active.afford.canAfford && active.afford.message && (
                    <Text fontSize="14px" lineHeight="1.5" color="hg.danger.text" textAlign="center" role="alert">{active.afford.message}</Text>
                )}
            </SubmitBlock>
        </>
    )

    const communitySummary = picked ? `${picked.ticker} stakers · ${prettyAmount(picked.stakedDisplay)} ${picked.ticker} staked` : ''

    return (
        <GuidedForm
            crumb="Reach another community"
            title={<>Reach another <GradientText>community</GradientText></>}
            subtitle="Gift your token to the people who stake another token. They see it in their wallet, and your token shows up as a prize on that token's Communities page."
            aside={aside}
        >
            {blocker !== '' && (
                <Box data-testid="reach-blocker">
                    <BlockerNote>{blocker}</BlockerNote>
                </Box>
            )}

            <Question
                title="Which community?"
                {...steps.step('community')}
                summary={communitySummary}
            >
                <VStack align="stretch" gap="16px">
                    {all.isLoading ? (
                        <VStack align="stretch" gap="8px" data-testid="reach-loading">
                            <Shimmer h="56px" borderRadius="hg.md" />
                            <Shimmer h="56px" borderRadius="hg.md" />
                        </VStack>
                    ) : all.hasError ? (
                        <VStack align="stretch" gap="12px">
                            <InfoBox title="Couldn't load the communities">
                                The chain query failed. The node may be down, or not run chain v8.2.0 yet.
                            </InfoBox>
                            <Button alignSelf="start" {...softButton} size="sm" onClick={all.retry}>
                                <LuRefreshCw /> Retry
                            </Button>
                        </VStack>
                    ) : options.length === 0 ? (
                        <VStack align="stretch" gap="12px" data-testid="reach-empty">
                            <Text fontSize="14px" color="fg.muted">
                                No token has stakers yet, so there is nobody to reach this way. Try Send to a list of wallets.
                            </Text>
                            <Button alignSelf="start" {...softButton} size="sm" onClick={() => navigate('/multisend')}>
                                Send to a list of wallets
                            </Button>
                        </VStack>
                    ) : (
                        <>
                            <CommunityPicker options={options} value={community} onSelect={setCommunity} />
                            <ContinueRow disabled={!picked} onContinue={() => answer('community')} />
                        </>
                    )}
                </VStack>
            </Question>

            <Question
                title="What do you give them?"
                {...steps.step('gift')}
                summary={amountText ? `${amountText}${mode === 'daily' ? ' a day' : ''}` : ''}
            >
                <VStack align="stretch" gap="16px">
                    <PrizeTokenQuestion
                        denomReward={{ staking_denom: community }}
                        prizes={prizes}
                        maxPrizeDenoms={airdrop.maxPrizes}
                        prizeFee={airdrop.prizeFee}
                        value={giftDenom}
                        onSelect={(asset) => setGiftDenom(asset.denom)}
                        label="Your gift (paid from your wallet)"
                    />
                    {giftAsset && (
                        <Field.Root invalid={amountTouched && amountInput.trim() !== '' && amountError !== ''}>
                            <HStack justify="space-between" w="full" gap="8px" flexWrap="wrap">
                                <Field.Label>{`${mode === 'once' ? 'Amount' : 'Per day'} (${giftTicker})`}</Field.Label>
                                <HStack gap="4px">
                                    <Text fontSize="12px" color="hg.text.faint">{balanceText}</Text>
                                    {mode === 'once' && (
                                        <Button
                                            size="2xs"
                                            variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }}
                                            onClick={() => { setAmountInput(spendable.inputValue); setAmountTouched(true) }}
                                            disabled={!spendable.amount.gt(0)}
                                        >
                                            Max
                                        </Button>
                                    )}
                                </HStack>
                            </HStack>
                            <Input
                                placeholder="e.g. 1000"
                                inputMode="decimal"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                onBlur={() => setAmountTouched(true)}
                            />
                            <Field.ErrorText>{amountError}</Field.ErrorText>
                        </Field.Root>
                    )}
                    {onePercentText && (
                        <Text fontSize="13px" lineHeight="1.5" color="hg.text.faint" data-testid="reach-example">
                            {`Split by stake: someone with 1% of the staked ${communityTicker} gets ${onePercentText}${mode === 'daily' ? ' a day' : ''}.`}
                        </Text>
                    )}
                    <ContinueRow disabled={!giftAsset || slot.capReached || uAmount === undefined} onContinue={() => answer('gift')} />
                </VStack>
            </Question>

            <Question
                title="All at once, or a little every day?"
                {...steps.step('mode')}
                summary={mode === 'once' ? 'All at once' : `Every day for ${daysInput.trim()} days`}
            >
                <VStack align="stretch" gap="12px" role="radiogroup" aria-label="How to send it">
                    <ModeCard
                        selected={mode === 'once'}
                        title="All at once, now"
                        text="A splash: everyone staking right now gets their share today."
                        onClick={() => setMode('once')}
                    />
                    <ModeCard
                        selected={mode === 'daily'}
                        title={`Every day for ${daysError === '' ? daysInput.trim() : 'N'} days`}
                        text={`Your token is a prize there for ${daysError === '' ? daysInput.trim() : 'N'} days, and new stakers get some too.`}
                        onClick={() => setMode('daily')}
                    >
                        {mode === 'daily' && (
                            <Field.Root invalid={daysError !== ''}>
                                <Field.Label>Days</Field.Label>
                                <Input inputMode="numeric" value={daysInput} onChange={(e) => setDaysInput(e.target.value)} />
                                <Field.HelperText>
                                    {`${MIN_SCHEDULE_DAYS}–${MAX_SCHEDULE_DAYS.toLocaleString('en-US')} payout days. Days with nobody staking are skipped.`}
                                </Field.HelperText>
                                <Field.ErrorText>{daysError}</Field.ErrorText>
                            </Field.Root>
                        )}
                    </ModeCard>
                    <ContinueRow disabled={mode === 'daily' && daysError !== ''} onContinue={() => answer('mode')} />
                </VStack>
            </Question>
        </GuidedForm>
    )
}

export default function ReachPage() {
    return (
        <FormPage>
            <ReachContent />
        </FormPage>
    )
}
