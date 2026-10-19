'use client';

import React, {Suspense, useCallback, useMemo, useState} from 'react';
import {
    Badge,
    Box,
    Button,
    chakra,
    Flex,
    Grid,
    Skeleton,
    Slider,
} from '@chakra-ui/react';
import {
    LuArrowLeft,
    LuPlus,
    LuMinus,
    LuLock,
    LuTrendingUp,
    LuInfo,
    LuCoins,
    LuClock,
    LuExternalLink,
} from 'react-icons/lu';
import {useNavigationWithParams} from "@/hooks/useNavigation";
import {
    Asset, LP_ASSETS_DECIMALS,
    useAsset, useAssets, useAssetPrice,
    amountToBigNumberUAmount, amountToUAmount, prettyAmount, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount,
    shortNumberFormat, toPercentage, removeLeadingZeros,
    useBalance, useBZETx, useToast, getChainName, useMaxSpendable, useCanAffordTx,
    AddressRewardsStaking, ExtendedPendingUnlockParticipantSDKType,
    calculateRewardsStakingPendingRewards,
    PrettyBalance, useAssetsValue, HighlightText,
    isPoolSupportedByValidator, getValidatorPageUrl,
    useLiquidityPool,
    TokenLogo, LPTokenLogo,
    Tooltip,
    getBurnerApp, AppLink,
    HaltedBadge, HaltedNotice, useHaltedDenoms,
    hgVariant, HgCard, FeaturedCard, HeroGlow, Notice, StatusPill,
} from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";
import {bze} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {RewardsStakingUnlockAlerts, TYPE_REWARDS} from "@/components/ui/staking/rewards-staking-alerts";
import {useRewardsStakingData} from "@/hooks/useRewardsStakingData";
import {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {RewardsStakingPendingRewardsModal} from "@/components/ui/staking/rewards-staking-modals";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";
import {useLockedLiquidity} from "@/hooks/useLockedLiquidity";
import {AprChip} from "@/components/ui/pools/apr-chip";
import {
    AmountField, AprMove, FormColumn, FormTitle, InsetTile, PillTabs, PresetChip, SlippageRow, SubmitButton,
    SummaryBox, SummaryLine,
} from "@/components/ui/pools/pool-parts";
import {VenueTag} from "@/components/ui/trading/venue";

const AssetDisplay = ({ asset, amount, usdValue }: { asset?: Asset; amount: string; usdValue: BigNumber }) => (
    <Flex direction="column" align="center" textAlign="center" gap="6px" bg="hg.inset" borderRadius="16px" p="18px" minW="0">
        <Box position="relative" boxSize="48px">
            <TokenLogo
                src={asset?.logo}
                symbol={asset?.ticker || ''}
                style={{ objectFit: 'contain', borderRadius: '50%' }}
            />
        </Box>
        <span>
            <chakra.strong fontSize="16px">{asset?.ticker}</chakra.strong>{' '}
            <chakra.span fontSize="14px" color="hg.text.faint">{asset?.name}</chakra.span>
        </span>
        <HighlightText fontSize="20px" fontWeight="700">{prettyAmount(amount)}</HighlightText>
        {usdValue.gt(0) && (<HighlightText fontSize="13px" color="hg.text.faint">${prettyAmount(usdValue)}</HighlightText>)}
    </Flex>
);

const {addLiquidity, removeLiquidity} = bze.tradebin.MessageComposer.withTypeUrl;

interface AddLiquidityTabProps {
    baseAsset?: Asset;
    quoteAsset?: Asset;
    pool?: LiquidityPoolSDKType;

    onAddLiquiditySuccess?: () => void;
    calculateSharesFromAmounts?: (baseAmount: string | BigNumber, quoteAmount: string | BigNumber) => BigNumber
    calculateOppositeAmount?: (amount: string | BigNumber, isBase: boolean) => BigNumber;
}
const AddLiquidityTab = ({baseAsset, quoteAsset, pool, calculateSharesFromAmounts, onAddLiquiditySuccess, calculateOppositeAmount}: AddLiquidityTabProps) => {
    const [addLiquidityBaseAmount, setAddLiquidityBaseAmount] = useState('');
    const [addLiquidityQuoteAmount, setAddLiquidityQuoteAmount] = useState('');
    const [addLiquiditySlippage, setAddLiquiditySlippage] = useState('0.5');
    const [showSlippageEdit, setShowSlippageEdit] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {address} = useChain(getChainName())
    const {tx} = useBZETx()
    const {toast} = useToast()
    const {balance: baseBalance} = useBalance(pool?.base || '')
    const {balance: quoteBalance} = useBalance(pool?.quote || '')

    const baseBalanceAmount = useMemo(() => uAmountToAmount(baseBalance.amount, baseAsset?.decimals ?? 0), [baseAsset, baseBalance])
    const quoteBalanceAmount = useMemo(() => uAmountToAmount(quoteBalance.amount, quoteAsset?.decimals ?? 0), [quoteAsset, quoteBalance])

    // Shared gas engine: MAX keeps the gas back on the side that pays the fee, and submitting
    // checks both reserves plus the gas fee.
    const baseSpendable = useMaxSpendable(pool?.base || '', 'add-liquidity')
    const quoteSpendable = useMaxSpendable(pool?.quote || '', 'add-liquidity')
    const affordability = useCanAffordTx({
        spec: addLiquidityBaseAmount && addLiquidityQuoteAmount ? 'add-liquidity' : undefined,
        spend: [
            {denom: pool?.base || '', amount: amountToBigNumberUAmount(addLiquidityBaseAmount || '0', baseAsset?.decimals ?? 0)},
            {denom: pool?.quote || '', amount: amountToBigNumberUAmount(addLiquidityQuoteAmount || '0', quoteAsset?.decimals ?? 0)},
        ],
    })

    const onAddLiquidityBaseAmountChange = useCallback((value: string) => {
        setAddLiquidityBaseAmount(value);
        if (value === '' || !calculateOppositeAmount) {
            setAddLiquidityQuoteAmount('')
            return
        }
        const oppositeAmount = calculateOppositeAmount(amountToUAmount(value, baseAsset?.decimals ?? 0), true)
        if (oppositeAmount.lt(0)) {
            setAddLiquidityQuoteAmount('')
            return
        }
        setAddLiquidityQuoteAmount(uAmountToAmount(oppositeAmount, quoteAsset?.decimals ?? 0))
        //eslint-disable-next-line
    }, [baseAsset, quoteAsset])
    const onAddLiquidityQuoteAmountChange = useCallback((value: string) => {
        setAddLiquidityQuoteAmount(value);
        if (value === '' || !calculateOppositeAmount) {
            setAddLiquidityBaseAmount('')
            return
        }

        const oppositeAmount = calculateOppositeAmount(amountToUAmount(value, quoteAsset?.decimals ?? 0), false)
        if (oppositeAmount.lt(0)) {
            setAddLiquidityBaseAmount('')
            return
        }
        setAddLiquidityBaseAmount(uAmountToAmount(oppositeAmount, baseAsset?.decimals ?? 0))
        //eslint-disable-next-line
    }, [baseAsset, quoteAsset])
    const expectedShares = useMemo(() => {
        if (!addLiquidityBaseAmount || !addLiquidityQuoteAmount || !calculateSharesFromAmounts) return '0';

        const baseUAmount = amountToBigNumberUAmount(addLiquidityBaseAmount, baseAsset?.decimals ?? 0);
        const quoteUAmount = amountToBigNumberUAmount(addLiquidityQuoteAmount, quoteAsset?.decimals ?? 0);

        const shares = calculateSharesFromAmounts(baseUAmount, quoteUAmount);
        return uAmountToAmount(shares, LP_ASSETS_DECIMALS);
    }, [addLiquidityBaseAmount, addLiquidityQuoteAmount, baseAsset, quoteAsset, calculateSharesFromAmounts]);
    const minimumShares = useMemo(() => {
        if (!expectedShares || expectedShares === '0') return '0';

        const slippageDecimal = toBigNumber(addLiquiditySlippage).dividedBy(100);
        const expected = toBigNumber(expectedShares);
        const minimum = expected.minus(expected.multipliedBy(slippageDecimal));

        return minimum.toString();
    }, [expectedShares, addLiquiditySlippage]);
    const onAddLiquidity = useCallback(async () => {
        if (!pool) return;

        const baseAmountBN = amountToBigNumberUAmount(addLiquidityBaseAmount, baseAsset?.decimals ?? 0)
        if (baseAmountBN.isNaN() || baseAmountBN.lte(0)) {
            toast.error(`Invalid ${baseAsset?.ticker} amount provided`)
            return
        }

        const quoteAmountBN = amountToBigNumberUAmount(addLiquidityQuoteAmount, quoteAsset?.decimals ?? 0)
        if (quoteAmountBN.isNaN() || quoteAmountBN.lte(0)) {
            toast.error(`Invalid ${quoteAsset?.ticker} amount provided`)
            return
        }

        const resultedShares = amountToBigNumberUAmount(expectedShares, LP_ASSETS_DECIMALS)
        if (resultedShares.isNaN() || resultedShares.lte(0)) {
            toast.error('amounts are too low. Try again with greater amounts')
            return
        }

        if (baseAmountBN.gt(baseBalance.amount)) {
            toast.error(`You don't have enough ${baseAsset?.ticker} to add liquidity`)
            return
        }

        if (quoteAmountBN.gt(quoteBalance.amount)) {
            toast.error(`You don't have enough ${quoteAsset?.ticker} to add liquidity`)
            return
        }

        if (!affordability.canAfford) {
            toast.error(affordability.message || 'Not enough balance left for the network fee')
            return
        }

        const slippageDecimal = toBigNumber(addLiquiditySlippage).dividedBy(100);
        if (slippageDecimal.isNaN() || slippageDecimal.lt(0) || slippageDecimal.gt(1)) {
            toast.error('Slippage must be a valid number between 0 and 100')
            return
        }

        const minExpectedShares = resultedShares.multipliedBy(toBigNumber(1).minus(slippageDecimal));
        if (minExpectedShares.isNaN() || minExpectedShares.lt(0)) {
            toast.error('Something went wrong with slippage calculation. Modify the slippage percentage and try again')
            return
        }

        setIsSubmitting(true)
        const msg = addLiquidity({
            creator: address ?? '',
            poolId: pool.id,
            baseAmount: baseAmountBN.toString(),
            quoteAmount: quoteAmountBN.toString(),
            minLpTokens: minExpectedShares.toFixed(0),
        })

        const success = await tx([msg])

        setIsSubmitting(false)
        if (success && onAddLiquiditySuccess) onAddLiquiditySuccess()
        //eslint-disable-next-line
    }, [pool, addLiquidityBaseAmount, addLiquidityQuoteAmount, addLiquiditySlippage, expectedShares, quoteBalance, baseBalance, baseAsset, quoteAsset, address, affordability.canAfford, affordability.message])

    return (
        <FormColumn>
            <FormTitle>Add Liquidity</FormTitle>

            <AmountField
                label={`${baseAsset?.ticker ?? ''} Amount`}
                available={prettyAmount(baseBalanceAmount)}
                value={addLiquidityBaseAmount}
                onChange={onAddLiquidityBaseAmountChange}
                onMax={() => onAddLiquidityBaseAmountChange(baseSpendable.inputValue)}
                disabled={isSubmitting}
                maxDisabled={false}
            />

            <chakra.span textAlign="center" fontSize="20px" color="hg.text.faint" aria-hidden="true">+</chakra.span>

            <AmountField
                label={`${quoteAsset?.ticker ?? ''} Amount`}
                available={prettyAmount(quoteBalanceAmount)}
                value={addLiquidityQuoteAmount}
                onChange={onAddLiquidityQuoteAmountChange}
                onMax={() => onAddLiquidityQuoteAmountChange(quoteSpendable.inputValue)}
                disabled={isSubmitting}
                maxDisabled={false}
            />

            {/* Expected Output & Slippage */}
            {addLiquidityBaseAmount && addLiquidityQuoteAmount && (
                <SummaryBox>
                    <SummaryLine label="Expected LP Tokens">{prettyAmount(expectedShares)} LP</SummaryLine>
                    <SlippageRow
                        label="Slippage"
                        value={addLiquiditySlippage}
                        onChange={setAddLiquiditySlippage}
                        open={showSlippageEdit}
                        onToggle={() => setShowSlippageEdit(!showSlippageEdit)}
                        disabled={isSubmitting}
                    />
                    <SummaryLine label="Minimum LP Tokens" small>{prettyAmount(minimumShares)} LP</SummaryLine>
                </SummaryBox>
            )}

            <SubmitButton onClick={onAddLiquidity} disabled={isSubmitting}>
                Add Liquidity
            </SubmitButton>
        </FormColumn>
    )
}
interface RemoveLiquidityTabProps {
    pool?: LiquidityPoolSDKType;
    userShares: BigNumber;
    userReserveBase: BigNumber;
    userReserveQuote: BigNumber;
    baseAsset?: Asset;
    quoteAsset?: Asset;
    onRemove: () => void;
}

const RemoveLiquidityTab = ({pool, userShares, userReserveBase, userReserveQuote, baseAsset, quoteAsset, onRemove}: RemoveLiquidityTabProps) => {
    const [removePercentage, setRemovePercentage] = useState(0);
    const [removeAmount, setRemoveAmount] = useState('');
    const [removeSlippage, setRemoveSlippage] = useState('0.5');
    const [showSlippageEdit, setShowSlippageEdit] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {address} = useChain(getChainName())
    const {tx} = useBZETx()
    const {toast} = useToast()

    const userSharesAmount = useMemo(() => {
        return uAmountToAmount(userShares, LP_ASSETS_DECIMALS);
    }, [userShares]);

    const estimatedBaseAmount = useMemo(() => {
        if (!removeAmount || removeAmount === '0') {
            return '0';
        }

        const removeUAmount = amountToBigNumberUAmount(removeAmount, LP_ASSETS_DECIMALS);
        const ratio = removeUAmount.dividedBy(userShares);
        return uAmountToAmount(userReserveBase.multipliedBy(ratio), baseAsset?.decimals ?? 0);
    }, [removeAmount, userShares, userReserveBase, baseAsset]);

    const estimatedQuoteAmount = useMemo(() => {
        if (!removeAmount || removeAmount === '0') {
            return '0';
        }

        const removeUAmount = amountToBigNumberUAmount(removeAmount, LP_ASSETS_DECIMALS);
        const ratio = removeUAmount.dividedBy(userShares);
        return uAmountToAmount(userReserveQuote.multipliedBy(ratio), quoteAsset?.decimals ?? 0);
    }, [removeAmount, userShares, userReserveQuote, quoteAsset]);

    const minimumBaseAmount = useMemo(() => {
        if (!estimatedBaseAmount || estimatedBaseAmount === '0') return '0';

        const slippageDecimal = toBigNumber(removeSlippage).dividedBy(100);
        const expected = toBigNumber(estimatedBaseAmount);
        const minimum = expected.minus(expected.multipliedBy(slippageDecimal));

        return minimum.toString();
    }, [estimatedBaseAmount, removeSlippage]);

    const minimumQuoteAmount = useMemo(() => {
        if (!estimatedQuoteAmount || estimatedQuoteAmount === '0') return '0';

        const slippageDecimal = toBigNumber(removeSlippage).dividedBy(100);
        const expected = toBigNumber(estimatedQuoteAmount);
        const minimum = expected.minus(expected.multipliedBy(slippageDecimal));

        return minimum.toString();
    }, [estimatedQuoteAmount, removeSlippage]);

    const onPercentageChange = useCallback((percentage: number) => {
        setRemovePercentage(percentage);
        const amount = toBigNumber(userSharesAmount).multipliedBy(percentage).dividedBy(100);
        setRemoveAmount(amount.toString());
    }, [userSharesAmount]);

    const onAmountChange = useCallback((value: string) => {
        setRemoveAmount(value);
        if (!value || value === '0') {
            setRemovePercentage(0);
            return;
        }

        const percentage = toBigNumber(value).dividedBy(userSharesAmount).multipliedBy(100);
        setRemovePercentage(Math.min(100, Math.max(0, percentage.toNumber())));
    }, [userSharesAmount]);

    const canRemove = useMemo(() => !isSubmitting && userShares.gt(0), [isSubmitting, userShares]);
    // MAX removes all the LP shares (not a fee asset), but the wallet must still hold the gas fee.
    const feeCheck = useCanAffordTx({spec: address ? 'remove-liquidity' : undefined});

    const handleRemove = useCallback(async () => {
        if (!pool || !address) {
            toast.error('Please connect your wallet');
            return;
        }

        if (!removeAmount || removeAmount === '0') {
            toast.error('Please enter an amount to remove');
            return;
        }

        if (!feeCheck.canAfford) {
            toast.error(feeCheck.message || 'Not enough balance for the network fee');
            return;
        }

        const removeUAmount = amountToBigNumberUAmount(removeAmount, LP_ASSETS_DECIMALS);
        if (removeUAmount.isNaN() || removeUAmount.lte(0)) {
            toast.error('Invalid shares amount provided');
            return;
        }

        if (removeUAmount.gt(userShares)) {
            toast.error('You don\'t have enough LP shares');
            return;
        }

        const slippageDecimal = toBigNumber(removeSlippage).dividedBy(100);
        if (slippageDecimal.isNaN() || slippageDecimal.lt(0) || slippageDecimal.gt(1)) {
            toast.error('Slippage must be a valid number between 0 and 100');
            return;
        }

        const minBaseUAmount = amountToBigNumberUAmount(minimumBaseAmount, baseAsset?.decimals ?? 0);
        const minQuoteUAmount = amountToBigNumberUAmount(minimumQuoteAmount, quoteAsset?.decimals ?? 0);

        setIsSubmitting(true);

        const msg = removeLiquidity({
            creator: address,
            poolId: pool.id,
            lpTokens: removeUAmount.toFixed(0),
            minBase: minBaseUAmount.toFixed(0),
            minQuote: minQuoteUAmount.toFixed(0),
        });

        const success = await tx([msg]);

        setIsSubmitting(false);
        if (success) onRemove();
    }, [pool, address, removeAmount, userShares, removeSlippage, minimumBaseAmount, minimumQuoteAmount, baseAsset, quoteAsset, toast, tx, onRemove, feeCheck.canAfford, feeCheck.message]);

    return (
        <FormColumn>
            <FormTitle>Remove Liquidity</FormTitle>

            <AmountField
                label="LP Shares Amount"
                available={prettyAmount(userSharesAmount)}
                value={removeAmount}
                onChange={onAmountChange}
                onMax={() => onAmountChange(userSharesAmount)}
                disabled={!canRemove}
            />

            <Flex direction="column" gap="12px" w="full">
                <Flex justify="space-between" fontSize="14px">
                    <chakra.span color="hg.text.muted">Amount to Remove</chakra.span>
                    <chakra.strong>{removePercentage.toFixed(0)}%</chakra.strong>
                </Flex>
                <Slider.Root
                    min={0}
                    max={100}
                    step={1}
                    value={[removePercentage]}
                    onValueChange={(e) => onPercentageChange(e.value[0])}
                    w="full"
                    disabled={!canRemove}
                >
                    <Slider.Control>
                        <Slider.Track h="6px" bg="hg.inset" rounded="full">
                            <Slider.Range bgImage="app" />
                        </Slider.Track>
                        <Slider.Thumb
                            index={0}
                            boxSize="20px"
                            bg="white"
                            borderWidth="0"
                            boxShadow="0 0 0 4px var(--chakra-colors-app-muted)"
                            cursor="pointer"
                            _focusVisible={{ outline: '2px solid', outlineColor: 'app.focusRing', outlineOffset: '2px' }}
                        />
                    </Slider.Control>
                </Slider.Root>
                <Grid templateColumns="repeat(4, minmax(0, 1fr))" gap="8px">
                    {[25, 50, 75, 100].map((percentage) => (
                        <PresetChip
                            key={percentage}
                            h="34px"
                            active={removePercentage === percentage}
                            onClick={() => onPercentageChange(percentage)}
                            disabled={!canRemove}
                        >
                            {percentage}%
                        </PresetChip>
                    ))}
                </Grid>
            </Flex>

            {/* Expected Output & Slippage */}
            {removeAmount && removeAmount !== '0' && (
                <SummaryBox>
                    <chakra.span color="hg.text.muted">You will receive:</chakra.span>
                    <SummaryLine label={baseAsset?.ticker}>{prettyAmount(estimatedBaseAmount)}</SummaryLine>
                    <SummaryLine label={quoteAsset?.ticker}>{prettyAmount(estimatedQuoteAmount)}</SummaryLine>
                    <Box h="1px" bg="hg.divider"/>
                    <SlippageRow
                        label="Slippage Tolerance"
                        value={removeSlippage}
                        onChange={setRemoveSlippage}
                        open={showSlippageEdit}
                        onToggle={() => setShowSlippageEdit(!showSlippageEdit)}
                        disabled={!canRemove}
                    />
                    <chakra.span fontSize="12px" color="hg.text.faint">Minimum received:</chakra.span>
                    <SummaryLine label={baseAsset?.ticker} small>{prettyAmount(minimumBaseAmount)}</SummaryLine>
                    <SummaryLine label={quoteAsset?.ticker} small>{prettyAmount(minimumQuoteAmount)}</SummaryLine>
                </SummaryBox>
            )}

            <SubmitButton
                onClick={handleRemove}
                disabled={!removeAmount || removeAmount === '0' || isSubmitting || !canRemove}
                loading={isSubmitting}
            >
                Remove Liquidity
            </SubmitButton>
        </FormColumn>
    )
}

interface LockTabProps {
    pool?: LiquidityPoolSDKType;
    userShares: BigNumber;
    rewardsMap?: Map<string, StakingRewardSDKType>;
    addressData?: AddressRewardsStaking;
    onLockSuccess?: () => void;
}

const LockTab = ({ pool, userShares, rewardsMap, addressData, onLockSuccess }: LockTabProps) => {
    const [selectedRewardId, setSelectedRewardId] = useState('');
    const [lockAmount, setLockAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { address } = useChain(getChainName());
    const { tx } = useBZETx();
    const { toast } = useToast();
    const { denomTicker, denomDecimals } = useAssets();
    // MAX locks all the LP shares (not a fee asset), but the wallet must still hold the gas fee.
    const feeCheck = useCanAffordTx({spec: address ? 'join-staking' : undefined});

    // Filter staking rewards that match the pool's LP denom
    const eligibleRewards = useMemo(() => {
        if (!pool?.lp_denom || !rewardsMap) return [];

        const rewards: StakingRewardSDKType[] = [];
        rewardsMap.forEach((reward) => {
            if (reward.duration <= reward.payouts) {
                return
            }
            if (reward.staking_denom === pool.lp_denom) {
                rewards.push(reward);
            }
        });

        // Sort by remaining days (active first, then by remaining days descending)
        return rewards.sort((a, b) => {
            const aRemaining = a.duration - a.payouts;
            const bRemaining = b.duration - b.payouts;
            if (aRemaining === 0 && bRemaining > 0) return 1;
            if (bRemaining === 0 && aRemaining > 0) return -1;
            return bRemaining - aRemaining;
        });
    }, [pool, rewardsMap]);

    const selectedReward = useMemo(() => {
        if (!selectedRewardId || !rewardsMap) return undefined;
        return rewardsMap.get(selectedRewardId);
    }, [selectedRewardId, rewardsMap]);

    const userSharesAmount = useMemo(() => {
        return uAmountToAmount(userShares, LP_ASSETS_DECIMALS);
    }, [userShares]);

    const estimatedDailyRewards = useMemo(() => {
        if (!selectedReward || !lockAmount || lockAmount === '0') return null;

        const lockUAmount = amountToBigNumberUAmount(lockAmount, LP_ASSETS_DECIMALS);
        const totalStaked = toBigNumber(selectedReward.staked_amount).plus(lockUAmount);

        if (totalStaked.lte(0)) return null;

        const dailyPrize = toBigNumber(selectedReward.prize_amount);
        const userShare = dailyPrize.multipliedBy(lockUAmount).dividedBy(totalStaked);

        return {
            amount: uAmountToAmount(userShare, denomDecimals(selectedReward.prize_denom)),
            ticker: denomTicker(selectedReward.prize_denom),
            amountBN: uAmountToBigNumberAmount(userShare, denomDecimals(selectedReward.prize_denom)),
        };
    }, [selectedReward, lockAmount, denomDecimals, denomTicker]);

    const { price: rewardTokenPrice } = useAssetPrice(selectedReward?.prize_denom || '');
    const { price: lpTokenPrice } = useAssetPrice(pool?.lp_denom || '');

    const estimatedDailyRewardsUsd = useMemo(() => {
        if (!estimatedDailyRewards || !rewardTokenPrice || rewardTokenPrice.lte(0)) return null;
        return estimatedDailyRewards.amountBN.multipliedBy(rewardTokenPrice);
    }, [estimatedDailyRewards, rewardTokenPrice]);

    const stakingAPRData = useMemo(() => {
        if (!selectedReward || !lpTokenPrice || lpTokenPrice.lte(0) || !rewardTokenPrice || rewardTokenPrice.lte(0)) {
            return null;
        }

        const currentStaked = toBigNumber(selectedReward.staked_amount);
        if (currentStaked.lte(0)) return null;

        const dailyPrizeUsd = toBigNumber(uAmountToAmount(selectedReward.prize_amount, denomDecimals(selectedReward.prize_denom)))
            .multipliedBy(rewardTokenPrice);
        const annualRewardsUsd = dailyPrizeUsd.multipliedBy(365);

        // Current APR (before user's stake)
        const currentStakedUsd = toBigNumber(uAmountToAmount(currentStaked, LP_ASSETS_DECIMALS)).multipliedBy(lpTokenPrice);
        const currentAPR = currentStakedUsd.gt(0) ? annualRewardsUsd.dividedBy(currentStakedUsd).multipliedBy(100) : toBigNumber(0);

        // New APR (after user's stake)
        if (!lockAmount || lockAmount === '0') {
            return { currentAPR, newAPR: null, aprChange: null };
        }

        const lockUAmount = amountToBigNumberUAmount(lockAmount, LP_ASSETS_DECIMALS);
        const newTotalStaked = currentStaked.plus(lockUAmount);
        const newTotalStakedUsd = toBigNumber(uAmountToAmount(newTotalStaked, LP_ASSETS_DECIMALS)).multipliedBy(lpTokenPrice);
        const newAPR = newTotalStakedUsd.gt(0) ? annualRewardsUsd.dividedBy(newTotalStakedUsd).multipliedBy(100) : toBigNumber(0);

        // Calculate percentage change in APR
        const aprChange = currentAPR.gt(0) ? newAPR.minus(currentAPR).dividedBy(currentAPR).multipliedBy(100) : toBigNumber(0);

        return {
            currentAPR,
            newAPR,
            aprChange,
        };
    }, [selectedReward, lockAmount, lpTokenPrice, rewardTokenPrice, denomDecimals]);

    const remainingDays = useCallback((reward: StakingRewardSDKType) => {
        return reward.duration - reward.payouts;
    }, []);

    const isRewardActive = useCallback((reward: StakingRewardSDKType) => {
        return remainingDays(reward) > 0;
    }, [remainingDays]);

    const userActiveStake = useMemo(() => {
        if (!selectedRewardId || !addressData) return undefined;
        return addressData.active.get(selectedRewardId);
    }, [selectedRewardId, addressData]);

    const handleLock = useCallback(async () => {
        if (!pool || !address || !selectedReward) {
            toast.error('Please connect your wallet and select a staking reward');
            return;
        }

        if (!lockAmount || lockAmount === '0') {
            toast.error('Please enter an amount to lock');
            return;
        }

        const lockUAmount = amountToBigNumberUAmount(lockAmount, LP_ASSETS_DECIMALS);
        if (lockUAmount.isNaN() || lockUAmount.lte(0)) {
            toast.error('Invalid lock amount provided');
            return;
        }

        if (lockUAmount.gt(userShares)) {
            toast.error('You don\'t have enough LP shares');
            return;
        }

        const minStake = toBigNumber(selectedReward.min_stake);
        if (!userActiveStake && lockUAmount.lt(minStake)) {
            toast.error(`Minimum stake is ${uAmountToAmount(minStake, LP_ASSETS_DECIMALS)} LP shares`);
            return;
        }

        if (!isRewardActive(selectedReward)) {
            toast.error('This staking reward has ended');
            return;
        }

        if (!feeCheck.canAfford) {
            toast.error(feeCheck.message || 'Not enough balance for the network fee');
            return;
        }

        setIsSubmitting(true);

        const { joinStaking } = bze.rewards.MessageComposer.withTypeUrl;
        const msg = joinStaking({
            creator: address,
            rewardId: selectedReward.reward_id,
            amount: lockUAmount.toFixed(0),
        });

        const success = await tx([msg]);

        setIsSubmitting(false);
        if (success) {
            setLockAmount('');
            setSelectedRewardId('');
            if (onLockSuccess) onLockSuccess();
        }
    }, [pool, address, selectedReward, lockAmount, userShares, userActiveStake, isRewardActive, toast, tx, onLockSuccess, feeCheck.canAfford, feeCheck.message]);

    if (eligibleRewards.length === 0) {
        return (
            <FormColumn>
                <FormTitle>Lock LP Shares for Extra Rewards</FormTitle>
                <Flex direction="column" align="center" textAlign="center" gap="8px" bg="hg.inset" borderRadius="14px" p="22px">
                    <Box color="hg.text.faint"><LuInfo size={28} aria-hidden="true"/></Box>
                    <chakra.strong fontSize="15px">No extra rewards available for this pool at the moment.</chakra.strong>
                    <chakra.span fontSize="13px" color="fg.muted">Check back later for new rewards boost opportunities!</chakra.span>
                </Flex>
            </FormColumn>
        );
    }

    return (
        <FormColumn>
            <FormTitle>Lock LP Shares for Extra Rewards</FormTitle>

            <AmountField
                label="Amount of LP Shares to Lock"
                available={prettyAmount(userSharesAmount)}
                value={lockAmount}
                onChange={setLockAmount}
                onMax={() => setLockAmount(userSharesAmount)}
                disabled={isSubmitting || !selectedRewardId}
                maxDisabled={isSubmitting || !selectedRewardId || userShares.lte(0)}
            />

            {/* Staking Rewards Selection */}
            <Flex direction="column" gap="10px" w="full">
                <chakra.span fontSize="14px" fontWeight="600" color="hg.text.secondary">Select a Simple Reward</chakra.span>
                <Grid role="radiogroup" aria-label="Simple reward" templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="12px" w="full">
                    {eligibleRewards.map((reward) => {
                        const isSelected = selectedRewardId === reward.reward_id;
                        const isActive = isRewardActive(reward);
                        const remaining = remainingDays(reward);
                        const dailyDist = uAmountToAmount(reward.prize_amount, denomDecimals(reward.prize_denom));
                        const prizeTicker = denomTicker(reward.prize_denom);

                        return (
                            <chakra.button
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-disabled={!isActive}
                                key={reward.reward_id}
                                display="flex"
                                flexDirection="column"
                                gap="10px"
                                p="14px"
                                textAlign="left"
                                color="fg"
                                bg={isSelected ? 'app.subtle' : 'hg.inset'}
                                borderRadius="14px"
                                borderWidth="1px"
                                borderColor={isSelected ? 'app.solid' : 'hg.hairline'}
                                cursor={isActive ? "pointer" : "not-allowed"}
                                opacity={isActive ? 1 : 0.55}
                                transitionProperty="border-color, background"
                                transitionDuration="moderate"
                                focusVisibleRing="outside"
                                onClick={() => isActive && setSelectedRewardId(reward.reward_id)}
                                _hover={isActive && !isSelected ? { borderColor: 'app.border' } : undefined}
                            >
                                <Flex justify="space-between" align="center" w="full">
                                    <Flex align="center" gap="8px">
                                        <Flex
                                            as="span"
                                            boxSize="16px"
                                            borderRadius="full"
                                            borderWidth="2px"
                                            borderColor={isSelected ? 'app.solid' : 'hg.text.faint'}
                                            align="center"
                                            justify="center"
                                        >
                                            {isSelected && <Box as="span" boxSize="6px" borderRadius="full" bg="app.solid"/>}
                                        </Flex>
                                        <chakra.strong fontSize="14px">Reward #{removeLeadingZeros(reward.reward_id)}</chakra.strong>
                                    </Flex>
                                    <Badge variant={hgVariant(isActive ? 'success' : 'neutral')} borderRadius="full" px="8px">
                                        {isActive ? "Active" : "Ended"}
                                    </Badge>
                                </Flex>

                                <Box h="1px" w="full" bg="hg.divider"/>

                                <Flex direction="column" gap="8px" w="full" fontSize="13px">
                                    <Flex justify="space-between" gap="8px">
                                        <Flex as="span" align="center" gap="6px" color="hg.text.faint"><LuCoins size={12} aria-hidden="true"/>Daily Distribution</Flex>
                                        <span>{prettyAmount(dailyDist)} {prizeTicker}</span>
                                    </Flex>
                                    <Flex justify="space-between" gap="8px">
                                        <Flex as="span" align="center" gap="6px" color="hg.text.faint"><LuLock size={12} aria-hidden="true"/>Unlock Period</Flex>
                                        <span>{reward.lock} days</span>
                                    </Flex>
                                    <Flex justify="space-between" gap="8px">
                                        <Flex as="span" align="center" gap="6px" color="hg.text.faint"><LuClock size={12} aria-hidden="true"/>Remaining Days</Flex>
                                        <chakra.span color={isActive ? 'fg' : 'hg.text.faint'}>{remaining} / {reward.duration}</chakra.span>
                                    </Flex>
                                </Flex>
                            </chakra.button>
                        );
                    })}
                </Grid>
            </Flex>

            {/* Estimated Rewards & Warning */}
            {lockAmount && lockAmount !== '0' && selectedReward && estimatedDailyRewards && (
                <Flex direction="column" gap="12px" w="full">
                    <FeaturedCard p="14px 16px">
                        <Flex direction="column" gap="4px">
                            <Flex as="span" align="center" gap="6px" fontSize="13px" color="hg.text.muted">
                                <Box as="span" color="hg.accent"><LuTrendingUp size={14} aria-hidden="true"/></Box>
                                Estimated Daily Rewards
                            </Flex>
                            <chakra.strong fontSize="24px">
                                {prettyAmount(estimatedDailyRewards.amount)} {estimatedDailyRewards.ticker}
                            </chakra.strong>
                            {estimatedDailyRewardsUsd && estimatedDailyRewardsUsd.gt(0) && (
                                <chakra.span fontSize="13px" color="hg.text.faint">
                                    ≈ ${shortNumberFormat(estimatedDailyRewardsUsd)}
                                </chakra.span>
                            )}
                        </Flex>
                    </FeaturedCard>

                    {/* Show new APR if it changes by more than 10% */}
                    {stakingAPRData && stakingAPRData.newAPR && stakingAPRData.aprChange && Math.abs(stakingAPRData.aprChange.toNumber()) > 10 && (
                        <AprMove current={stakingAPRData.currentAPR} next={stakingAPRData.newAPR} change={stakingAPRData.aprChange}/>
                    )}

                    {selectedReward.lock > 0 && (
                        <Notice status="warning" title={`Unlocking Period: ${selectedReward.lock} days`}>
                            {`When you unlock your shares, you'll need to wait ${selectedReward.lock} days before receiving them back. You can unlock anytime, but the unlocking period always applies.`}
                        </Notice>
                    )}
                </Flex>
            )}

            <SubmitButton
                onClick={handleLock}
                disabled={!selectedRewardId || !lockAmount || lockAmount === '0' || isSubmitting || userShares.lte(0)}
                loading={isSubmitting}
            >
                <LuLock size={18} aria-hidden="true"/>
                Lock LP Shares
            </SubmitButton>
        </FormColumn>
    );
};

interface UserPositionProps {
    userShares: BigNumber;
    userReserveBase: BigNumber;
    userReserveQuote: BigNumber;
    userSharesPercentage: BigNumber|string;
    baseAsset: Asset;
    quoteAsset: Asset;
    pool?: LiquidityPoolSDKType;
    addressRewardsStaking?: AddressRewardsStaking;
    rewardsMap?: Map<string, StakingRewardSDKType>;
    onChange?: () => void;
}
const UserPosition = ({
                          userShares,
                          userSharesPercentage,
                          userReserveBase,
                          userReserveQuote,
                          baseAsset,
                          quoteAsset,
                          addressRewardsStaking,
                          pool,
                          rewardsMap,
                          onChange,
                      } : UserPositionProps) => {

    const [showRewardsModal, setShowRewardsModal] = useState(false);
    const [isUnstaking, setIsUnstaking] = useState(false);

    const {denomTicker, denomDecimals} = useAssets()
    const {totalUsdValue} = useAssetsValue()
    const {tx} = useBZETx()
    const {toast} = useToast()
    const {address} = useChain(getChainName())

    const lpSharesPendingUnlock = useMemo(() => {
        const result: ExtendedPendingUnlockParticipantSDKType[] = [];
        if (!addressRewardsStaking || !rewardsMap || !pool?.lp_denom) return result;

        //search for unlocks of the pool lp_denom
        addressRewardsStaking.unlocking.forEach((item, key) => {
            const stakingReward = rewardsMap.get(key)
            if (!stakingReward) return;
            if (stakingReward.staking_denom !== pool.lp_denom) return;

            result.push(...item);
        })

        return result;
    }, [addressRewardsStaking, rewardsMap, pool])
    const lockedLpShares = useMemo(() => {
        if (!addressRewardsStaking || !rewardsMap || !pool?.lp_denom) return [];

        const result: {stakeAmount: string, earnings: string, lockDays: number, rewardId: string, pendingReward: PrettyBalance}[] = [];
        addressRewardsStaking.active.forEach((item, key) => {
            const stakingReward = rewardsMap.get(key)
            if (!stakingReward) return;
            if (stakingReward.staking_denom !== pool.lp_denom) return;

            const incomePerStakedCoin = new BigNumber(stakingReward.prize_amount).dividedBy(new BigNumber(stakingReward.staked_amount))
            const dailyReward = incomePerStakedCoin.multipliedBy(item.amount)

            result.push({
                stakeAmount: uAmountToAmount(item.amount, LP_ASSETS_DECIMALS),
                earnings: `${uAmountToAmount(dailyReward, denomDecimals(stakingReward.prize_denom))} ${denomTicker(stakingReward.prize_denom)}`,
                lockDays: stakingReward.lock,
                rewardId: item.reward_id,
                pendingReward: {
                    amount: calculateRewardsStakingPendingRewards(stakingReward, item),
                    denom: stakingReward.prize_denom
                }
            });
        })

        return result;
    }, [addressRewardsStaking, denomDecimals, denomTicker, pool, rewardsMap])
    const extraRewards = useMemo(() => {
        if (lockedLpShares.length === 0) return [];

        const balances: PrettyBalance[] = [];
        lockedLpShares.forEach(item => {
            balances.push({
                denom: item.pendingReward.denom,
                amount: uAmountToBigNumberAmount(item.pendingReward.amount, denomDecimals(item.pendingReward.denom))
            })
        })

        return balances;
    }, [lockedLpShares, denomDecimals])
    const extraRewardsInUsd = useMemo(() => {
        if (extraRewards.length === 0) return '0';

        return prettyAmount(totalUsdValue(extraRewards));
    }, [extraRewards, totalUsdValue])

    const onRewardsClaimSuccess = useCallback(() => {
        if (onChange) onChange();
        setShowRewardsModal(false);
    }, [onChange])

    const unstakeShares = useCallback(async (rewardId: string) => {
        const reward = rewardsMap?.get(rewardId);
        if (!reward) {
            toast.error('Reward not found. Reload the page and try again.');
            return;
        }

        const {exitStaking} = bze.rewards.MessageComposer.withTypeUrl;
        const msg = exitStaking({
            rewardId: reward.reward_id,
            creator: address ?? '',
        })

        setIsUnstaking(true);
        const success = await tx([msg]);
        setIsUnstaking(false);
        if (success && onChange) onChange();
    }, [address, onChange, rewardsMap, toast, tx])

    return (
        <FeaturedCard as="section" aria-label="Your Shares" p={{ base: '18px', md: '22px' }} borderRadius="21px">
            <Flex direction="column" gap="16px">
                <Flex align="center" gap="10px">
                    <chakra.h2 m="0" fontSize="19px" fontWeight="700">Your Shares</chakra.h2>
                    {lockedLpShares.length > 0 ? (
                        <chakra.span fontSize="12px" fontWeight="600" px="10px" py="3px" borderRadius="full" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border">
                            Boosted
                        </chakra.span>
                    ) : (
                        <StatusPill tone={userShares.gt(0) ? 'success' : 'warning'}>{userShares.gt(0) ? 'Active' : 'Inactive'}</StatusPill>
                    )}
                </Flex>

                <Grid templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap="12px" w="full">
                    <InsetTile label="LP Shares" align="start">
                        <Flex align="center" gap="8px">
                            <LPTokenLogo
                                baseAssetLogo={baseAsset?.logo || ''}
                                quoteAssetLogo={quoteAsset?.logo || ''}
                                baseAssetSymbol={baseAsset?.ticker || ''}
                                quoteAssetSymbol={quoteAsset?.ticker || ''}
                                size="6"
                            />
                            <HighlightText fontSize="18px" fontWeight="700">{prettyAmount(uAmountToAmount(userShares, LP_ASSETS_DECIMALS))}</HighlightText>
                        </Flex>
                        <HighlightText fontSize="12px" color="hg.text.faint">{prettyAmount(userSharesPercentage)}% of pool</HighlightText>
                    </InsetTile>
                    <InsetTile label="Shares Assets" align="start">
                        <Flex align="center" gap="8px">
                            <TokenLogo src={baseAsset?.logo} symbol={baseAsset?.ticker || ''} size="5" circular={true}/>
                            <HighlightText fontSize="14px" fontWeight="700">{prettyAmount(uAmountToAmount(userReserveBase, baseAsset?.decimals ?? 0))} {baseAsset?.ticker}</HighlightText>
                        </Flex>
                        <Flex align="center" gap="8px">
                            <TokenLogo src={quoteAsset?.logo} symbol={quoteAsset?.ticker || ''} size="5" circular={true}/>
                            <HighlightText fontSize="14px" fontWeight="700">{prettyAmount(uAmountToAmount(userReserveQuote, quoteAsset?.decimals ?? 0))} {quoteAsset?.ticker}</HighlightText>
                        </Flex>
                    </InsetTile>
                    <InsetTile label="Boost Rewards" align="start">
                        <HighlightText fontSize="18px" fontWeight="700" color="hg.link">${extraRewardsInUsd}</HighlightText>
                        <RewardsStakingButton buttonType={TYPE_REWARDS} flex={0} onClick={() => setShowRewardsModal(true)}>
                            Claim
                        </RewardsStakingButton>
                    </InsetTile>
                </Grid>

                {lockedLpShares && lockedLpShares.length > 0 && lockedLpShares.map((item, index) => (
                    <Flex
                        key={index}
                        align="center"
                        gap="12px"
                        px="14px"
                        py="12px"
                        borderRadius="12px"
                        bg="hg.inset"
                        borderWidth="1px"
                        borderColor="hg.hairline"
                    >
                        <Box color="hg.accent" flex="none"><LuLock size={18} aria-hidden="true"/></Box>
                        <Flex direction="column" gap="2px" flex="1" minW="0">
                            <chakra.strong fontSize="14px">Locked: {item.stakeAmount} LP shares</chakra.strong>
                            <chakra.span fontSize="12px" color="hg.text.faint">
                                Earning {item.earnings} daily • Unlock period: {item.lockDays} {item.lockDays === 1 ? 'day' : 'days'}
                            </chakra.span>
                        </Flex>
                        <RewardsStakingButton
                            buttonType="unlock"
                            flex="none"
                            w="auto"
                            size="sm"
                            px="12px"
                            onClick={() => unstakeShares(item.rewardId)}
                            disabled={isUnstaking}
                            loading={isUnstaking}
                        >
                            Unlock
                        </RewardsStakingButton>
                    </Flex>
                ))}
                {lpSharesPendingUnlock && lpSharesPendingUnlock.length > 0 && (
                    <Flex direction="column" w="full" gap="8px">
                        <RewardsStakingUnlockAlerts ticker={'LP Shares'} decimals={LP_ASSETS_DECIMALS} userUnlocking={lpSharesPendingUnlock}/>
                    </Flex>
                )}
                {showRewardsModal && (
                    <RewardsStakingPendingRewardsModal
                        onClose={() => setShowRewardsModal(false)}
                        pendingRewards={extraRewards}
                        pendingRewardsIds={lockedLpShares.map(item => item.rewardId)}
                        onClaimSuccess={onRewardsClaimSuccess}
                    />
                )}
            </Flex>
        </FeaturedCard>
    )
}

const PoolDetailsPageContent = () => {
    const [activeTab, setActiveTab] = useState<'add' | 'remove' | 'lock'>('add');

    const {toPoolsPage, idParam} = useNavigationWithParams()

    const {
        pool,
        poolData,
        userShares,
        userSharesPercentage,
        userReserveBase,
        userReserveQuote,
        calculateOppositeAmount,
        calculateSharesFromAmounts,
    } = useLiquidityPool(idParam ?? '')
    const {asset: baseAsset, isLoading: isLoadingBaseAsset} = useAsset(pool?.base || '')
    const {asset: quoteAsset, isLoading: isLoadingQuoteAsset} = useAsset(pool?.quote || '')
    // A governance-halted pool refuses new liquidity; removing it (and the other tabs) stays open.
    const {isDenomHalted, isPoolHalted} = useHaltedDenoms()
    const isHalted = isPoolHalted(pool)
    const haltedTickers = [baseAsset, quoteAsset]
        .filter(asset => asset && isDenomHalted(asset.denom))
        .map(asset => asset!.ticker)
    const {isUSDC: baseAssetIsUsdc, totalUsdValue: baseAssetTotalUsdcValue, isLoading: baseAssetPriceLoading} = useAssetPrice(pool?.base || '')
    const {isUSDC: quoteAssetIsUsdc, totalUsdValue: quoteAssetTotalUsdcValue, isLoading: quoteAssetPriceLoading} = useAssetPrice(pool?.quote || '')
    const {rewardsMap, addressData, reload: reloadStakingData} = useRewardsStakingData()

    const poolBaseReservesAmount = useMemo(() => {
        if (!pool || !baseAsset) return '0';
        return uAmountToAmount(pool.reserve_base, baseAsset.decimals);
    }, [baseAsset, pool])
    const poolQuoteReservesAmount = useMemo(() => {
        if (!pool || !quoteAsset) return '0';
        return uAmountToAmount(pool.reserve_quote, quoteAsset.decimals);
    }, [pool, quoteAsset])
    const poolBaseReservesUsdValue = useMemo(() => {
        if (baseAssetIsUsdc) return toBigNumber(poolBaseReservesAmount);

        return baseAssetTotalUsdcValue(toBigNumber(poolBaseReservesAmount))
        //eslint-disable-next-line
    }, [poolBaseReservesAmount])
    const poolQuoteReservesUsdValue = useMemo(() => {
        if (quoteAssetIsUsdc) return toBigNumber(poolQuoteReservesAmount);

        return quoteAssetTotalUsdcValue(toBigNumber(poolQuoteReservesAmount))
        //eslint-disable-next-line
    }, [poolQuoteReservesAmount])
    const hasPoolData = useMemo(() => poolData !== undefined, [poolData]);

    const onLiquidityChanged = useCallback(() => {
        reloadStakingData()
    }, [reloadStakingData])

    // Calculate locked in boost rewards
    const totalLockedInRewards = useMemo(() => {
        if (!pool?.lp_denom || !rewardsMap) return toBigNumber(0);

        let total = toBigNumber(0);
        rewardsMap.forEach((reward) => {
            // Only count rewards for this pool
            if (reward.staking_denom === pool.lp_denom) {
                total = total.plus(toBigNumber(reward.staked_amount));
            }
        });

        return total;
    }, [pool, rewardsMap]);

    const lockedInRewardsAmount = useMemo(() => {
        return uAmountToAmount(totalLockedInRewards, LP_ASSETS_DECIMALS);
    }, [totalLockedInRewards]);

    const { price: lpTokenPrice } = useAssetPrice(pool?.lp_denom || '');

    const lockedInRewardsUsdValue = useMemo(() => {
        if (!lpTokenPrice || lpTokenPrice.lte(0)) return null;
        return toBigNumber(lockedInRewardsAmount).multipliedBy(lpTokenPrice);
    }, [lockedInRewardsAmount, lpTokenPrice]);

    // Get locked forever data
    const {
        lockedForeverAmount,
        lockedForeverUsdValue,
        isLoading: isLoadingLockedForever
    } = useLockedLiquidity(pool?.lp_denom || '');

    // Check if pool is supported by BZE Validator
    const isValidatorSupported = useMemo(() => {
        if (!pool) return false;
        return isPoolSupportedByValidator(pool.base, pool.quote);
    }, [pool]);

    const validatorPageUrl = useMemo(() => getValidatorPageUrl(), []);

    const pair = `${baseAsset?.ticker ?? ''}/${quoteAsset?.ticker ?? ''}`

    return (
        <Box position="relative" minH="100vh">
            <HeroGlow strength="inner" h="420px"/>
            <Box position="relative" zIndex="1" w="full" maxW="1000px" mx="auto" px={{base: '16px', md: '24px'}} pt="32px" pb="80px">
                <Flex direction="column" gap="20px">
                    {/* Header */}
                    <Flex align="center" gap="14px" wrap="wrap">
                        <Button size="md" variant="ghost" color="hg.text.secondary" px="12px" onClick={() => toPoolsPage()}>
                            <LuArrowLeft aria-hidden="true"/>Pools
                        </Button>
                        <Box w="1px" h="28px" bg="hg.lineStrong" aria-hidden="true"/>
                        <chakra.h1 m="0" fontSize="28px" fontWeight="800" letterSpacing="-0.02em">Pool Details</chakra.h1>
                        <VenueTag venue="amm"/>
                        {isHalted && <HaltedBadge />}
                        {baseAsset && quoteAsset && (
                            <chakra.span fontSize="13px" color="hg.text.faint">{pair} · a pool Swap trades against</chakra.span>
                        )}
                    </Flex>

                    {/* Pool Overview */}
                    <HgCard as="section" aria-label="Pool overview" borderRadius="22px" p={{base: '18px', md: '24px'}}>
                        <Flex direction="column" gap="18px">
                            {/* Assets Display */}
                            <Grid templateColumns={{base: '1fr', sm: 'minmax(0, 1fr) 40px minmax(0, 1fr)'}} alignItems="center" gap="8px">
                                <Skeleton asChild loading={isLoadingBaseAsset || baseAssetPriceLoading}>
                                    <AssetDisplay
                                        asset={baseAsset}
                                        amount={poolBaseReservesAmount}
                                        usdValue={poolBaseReservesUsdValue}
                                    />
                                </Skeleton>
                                <chakra.span textAlign="center" fontSize="28px" color="hg.text.faint" aria-hidden="true">+</chakra.span>
                                <Skeleton asChild loading={isLoadingQuoteAsset || quoteAssetPriceLoading}>
                                    <AssetDisplay
                                        asset={quoteAsset}
                                        amount={poolQuoteReservesAmount}
                                        usdValue={poolQuoteReservesUsdValue}
                                    />
                                </Skeleton>
                            </Grid>

                            {/* Exchange Rates */}
                            <Grid templateColumns={{base: '1fr', md: 'repeat(2, minmax(0, 1fr))'}} borderWidth="1px" borderColor="app.border" bg="app.subtle" borderRadius="14px">
                                <RateCell
                                    from={baseAsset?.ticker}
                                    to={quoteAsset?.ticker}
                                    loading={!pool}
                                    value={pool && baseAsset && quoteAsset
                                        ? toBigNumber(poolQuoteReservesAmount).dividedBy(toBigNumber(poolBaseReservesAmount)).toFixed(quoteAsset.decimals)
                                        : '0'}
                                    divider
                                />
                                <RateCell
                                    from={quoteAsset?.ticker}
                                    to={baseAsset?.ticker}
                                    loading={!pool}
                                    value={pool && baseAsset && quoteAsset
                                        ? toBigNumber(poolBaseReservesAmount).dividedBy(toBigNumber(poolQuoteReservesAmount)).toFixed(baseAsset.decimals)
                                        : '0'}
                                />
                            </Grid>

                            {/* Pool Stats */}
                            <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap="12px">
                                <InsetTile label="Total Liquidity">
                                    <Skeleton asChild loading={!hasPoolData}>
                                        <HighlightText fontSize="19px" fontWeight="700">${prettyAmount(poolData?.usdValue || 0)}</HighlightText>
                                    </Skeleton>
                                </InsetTile>
                                <InsetTile label="Volume (24h)">
                                    <Skeleton asChild loading={!hasPoolData}>
                                        <HighlightText fontSize="19px" fontWeight="700">${prettyAmount(poolData?.usdVolume || 0)}</HighlightText>
                                    </Skeleton>
                                </InsetTile>
                                <InsetTile label="Fees (24h)">
                                    <Skeleton asChild loading={!hasPoolData}>
                                        <HighlightText fontSize="19px" fontWeight="700">${prettyAmount(poolData?.usdFees || 0)}</HighlightText>
                                    </Skeleton>
                                </InsetTile>
                                <InsetTile label={<>APR<LuTrendingUp size={14} aria-hidden="true"/></>}>
                                    <Skeleton asChild loading={!hasPoolData}>
                                        <AprChip apr={parseFloat(poolData?.apr || '0')}/>
                                    </Skeleton>
                                </InsetTile>
                            </Grid>

                            {/* Locked Liquidity Stats */}
                            <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }} gap="12px">
                                <InsetTile label="Locked Forever">
                                    <Skeleton asChild loading={isLoadingLockedForever}>
                                        <HighlightText fontSize="19px" fontWeight="700">
                                            {lockedForeverUsdValue
                                                ? `$${prettyAmount(lockedForeverUsdValue)}`
                                                : `${prettyAmount(lockedForeverAmount)} LP`
                                            }
                                        </HighlightText>
                                    </Skeleton>
                                    <AppLink app="burner" href={`${getBurnerApp().href}/coin?coin=${pool?.lp_denom || ''}`}>Burner</AppLink>
                                </InsetTile>
                                <InsetTile label="Locked in Boost Rewards">
                                    <Skeleton asChild loading={!rewardsMap || !pool}>
                                        <HighlightText fontSize="19px" fontWeight="700">
                                            {lockedInRewardsUsdValue
                                                ? `$${prettyAmount(lockedInRewardsUsdValue)}`
                                                : `${prettyAmount(lockedInRewardsAmount)} LP`
                                            }
                                        </HighlightText>
                                    </Skeleton>
                                </InsetTile>
                            </Grid>

                            {/* Fee Information */}
                            <Flex direction="column" gap="12px" borderWidth="1px" borderColor="hg.hairline" borderRadius="14px" px="16px" py="14px">
                                <Skeleton asChild loading={!pool}>
                                    <chakra.strong fontSize="15px">Trading Fee: {toPercentage(pool?.fee || 0)}%</chakra.strong>
                                </Skeleton>
                                <Box h="1px" bg="hg.divider"/>
                                <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap="8px" textAlign="center">
                                    <FeeShare label="LP Rewards" hint="Rewards distributed to liquidity providers" loading={!pool}>
                                        {toPercentage(pool?.fee_dest?.providers || 0)}%
                                    </FeeShare>
                                    <FeeShare label="Protocol" hint="Fees used for protocol development and maintenance" loading={!pool}>
                                        {toPercentage(pool?.fee_dest?.treasury || 0)}%
                                    </FeeShare>
                                    <FeeShare label="Buyback & Burn" hint="Fees used to buyback and burn BZE tokens" loading={!pool}>
                                        {toPercentage(pool?.fee_dest?.burner || 0)}%
                                    </FeeShare>
                                </Grid>
                            </Flex>

                            {/* Validator Support Info Box */}
                            {isValidatorSupported && validatorPageUrl && (
                                <Notice status="info" title="Supported by BZE Community">
                                    <Flex as="span" direction="column" gap="6px">
                                        <span>
                                            This liquidity pool is supported by BZE Community validator. The entire commission
                                            earned by our validator on the source blockchain is exclusively used to
                                            support this liquidity pool.
                                        </span>
                                        <span>
                                            By delegating your coins to BZE Community, you directly contribute to
                                            maintaining deep liquidity for this trading pair while earning staking rewards.
                                        </span>
                                        <Button asChild mt="4px" size="md" w="full" variant={hgVariant('secondary')} gap="6px">
                                            <a href={validatorPageUrl} target="_blank" rel="noopener noreferrer">
                                                Delegate to BZE Community
                                                <LuExternalLink size={14} aria-hidden="true"/>
                                            </a>
                                        </Button>
                                    </Flex>
                                </Notice>
                            )}
                        </Flex>
                    </HgCard>

                    {/* User Position */}
                    {baseAsset && quoteAsset && userShares && toBigNumber(userShares).gt(0) && (
                        <UserPosition
                            userShares={userShares}
                            userReserveBase={userReserveBase}
                            userReserveQuote={userReserveQuote}
                            userSharesPercentage={userSharesPercentage}
                            baseAsset={baseAsset}
                            quoteAsset={quoteAsset}
                            pool={pool}
                            addressRewardsStaking={addressData}
                            rewardsMap={rewardsMap}
                            onChange={onLiquidityChanged}
                        />
                    )}

                    {/* Actions Tabs */}
                    <HgCard as="section" aria-label="Manage liquidity" borderRadius="22px" p={{base: '18px', md: '22px'}}>
                        <Flex direction="column" gap="18px">
                            <PillTabs
                                aria-label="Pool actions"
                                value={activeTab}
                                onChange={setActiveTab}
                                tabs={[
                                    {value: 'add', label: 'Add Liquidity', icon: <LuPlus size={16}/>},
                                    {value: 'remove', label: 'Remove Liquidity', icon: <LuMinus size={16}/>},
                                    {value: 'lock', label: 'Boost Rewards', icon: <LuLock size={16}/>},
                                ]}
                            />

                            {/* Tab Content */}
                            {activeTab === 'add' && isHalted && (
                                <HaltedNotice tickers={haltedTickers}>
                                    New liquidity cannot be added to this pool. Your existing position can be removed at any time.
                                </HaltedNotice>
                            )}
                            {activeTab === 'add' && !isHalted && (
                                <AddLiquidityTab
                                    baseAsset={baseAsset}
                                    quoteAsset={quoteAsset}
                                    pool={pool}
                                    onAddLiquiditySuccess={onLiquidityChanged}
                                    calculateSharesFromAmounts={calculateSharesFromAmounts}
                                    calculateOppositeAmount={calculateOppositeAmount}
                                />
                            )}

                            {activeTab === 'remove' && (
                                <RemoveLiquidityTab
                                    pool={pool}
                                    userShares={userShares}
                                    userReserveBase={userReserveBase}
                                    userReserveQuote={userReserveQuote}
                                    baseAsset={baseAsset}
                                    quoteAsset={quoteAsset}
                                    onRemove={onLiquidityChanged}
                                />
                            )}

                            {activeTab === 'lock' && (
                                <LockTab
                                    pool={pool}
                                    userShares={userShares}
                                    rewardsMap={rewardsMap}
                                    addressData={addressData}
                                    onLockSuccess={onLiquidityChanged}
                                />
                            )}
                        </Flex>
                    </HgCard>
                </Flex>
            </Box>
        </Box>
    );
}

/** One direction of the pool's rate. */
const RateCell = ({from, to, value, loading, divider}: { from?: string; to?: string; value: string; loading: boolean; divider?: boolean }) => (
    <Flex
        direction="column"
        align="center"
        textAlign="center"
        gap="4px"
        p="14px"
        borderColor="hg.hairline"
        borderRightWidth={divider ? {base: '0', md: '1px'} : '0'}
        borderBottomWidth={divider ? {base: '1px', md: '0'} : '0'}
    >
        <chakra.span fontSize="12px" color="hg.text.faint">Rate</chakra.span>
        <chakra.span fontSize="15px">
            <strong>1 {from}</strong> ={' '}
            <Skeleton asChild loading={loading}>
                <chakra.strong color="hg.link">{value} {to}</chakra.strong>
            </Skeleton>
        </chakra.span>
    </Flex>
)

/** One share of the trading fee, with its explanation on hover. */
const FeeShare = ({label, hint, loading, children}: { label: string; hint: string; loading: boolean; children: React.ReactNode }) => (
    <Tooltip content={hint}>
        <Flex direction="column" gap="4px" cursor="help" tabIndex={0} aria-label={`${label}: ${hint}`}>
            <chakra.span fontSize="12px" color="hg.text.faint" display="inline-flex" alignItems="center" justifyContent="center" gap="4px">
                {label}<LuInfo size={12} aria-hidden="true"/>
            </chakra.span>
            <Skeleton asChild loading={loading}>
                <chakra.strong fontSize="16px">{children}</chakra.strong>
            </Skeleton>
        </Flex>
    </Tooltip>
)

const PoolDetailsPage = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PoolDetailsPageContent />
        </Suspense>
    );
};

export default PoolDetailsPage;
