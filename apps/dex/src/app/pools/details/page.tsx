'use client';

import React, {Suspense, useCallback, useMemo, useState} from 'react';
import {
    Box,
    Container,
    VStack,
    HStack,
    Text,
    Button,
    Input,
    Grid,
    Badge,
    Separator,
    Slider,
    Skeleton,
    Link,
} from '@chakra-ui/react';
import {
    LuArrowLeft,
    LuPlus,
    LuMinus,
    LuLock,
    LuTrendingUp,
    LuInfo,
    LuSettings,
    LuCoins,
    LuClock,
    LuExternalLink,
} from 'react-icons/lu';
import {useNavigationWithParams} from "@/hooks/useNavigation";
import {
    Asset, LP_ASSETS_DECIMALS,
    useAsset, useAssets, useAssetPrice,
    amountToBigNumberUAmount, amountToUAmount, prettyAmount, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount,
    shortNumberFormat, sanitizeNumberInput, toPercentage, removeLeadingZeros,
    useBalance, useBZETx, useToast, getChainName,
    AddressRewardsStaking, ExtendedPendingUnlockParticipantSDKType,
    calculateRewardsStakingPendingRewards,
    PrettyBalance, useAssetsValue, HighlightText,
    isPoolSupportedByValidator, getValidatorPageUrl,
    useLiquidityPool,
    TokenLogo, LPTokenLogo,
    Tooltip,
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

const AssetDisplay = ({ asset, amount, usdValue }: { asset?: Asset; amount: string; usdValue: BigNumber }) => (
    <VStack bg="bg.surface" p="4" rounded="lg" flex="1" align="center" gap="3">
        <Box position="relative" w="12" h="12">
            <TokenLogo
                src={asset?.logo}
                symbol={asset?.ticker || ''}
                style={{ objectFit: 'contain', borderRadius: '50%' }}
            />
        </Box>
        <VStack align="center" gap="2" textAlign="center">
            <HStack>
                <Text fontWeight="bold" color="fg.emphasized">{asset?.ticker}</Text>
                <Text fontSize="sm" color="fg.muted">{asset?.name}</Text>
            </HStack>
            <VStack align="center" gap="1">
                <HighlightText fontSize="lg" fontWeight="semibold" color="fg.emphasized">{prettyAmount(amount)}</HighlightText>
                {usdValue.gt(0) && (<HighlightText fontSize="sm" color="fg.muted">${prettyAmount(usdValue)}</HighlightText>)}
            </VStack>
        </VStack>
    </VStack>
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
    }, [pool, addLiquidityBaseAmount, addLiquidityQuoteAmount, addLiquiditySlippage, expectedShares, quoteBalance, baseBalance, baseAsset, quoteAsset, address])

    return (
        <VStack gap="4" w="full">
            <Text fontSize="lg" fontWeight="semibold" color="fg.emphasized">Add Liquidity</Text>

            <VStack w="full" gap="4">
                <Box w="full">
                    <HStack justify="space-between" mb="2">
                        <Text fontSize="sm" color="fg.muted">{baseAsset?.ticker} Amount</Text>
                        <Text fontSize="xs" color="fg.muted">Available: {prettyAmount(baseBalanceAmount)}</Text>
                    </HStack>
                    <HStack>
                        <Input
                            placeholder="0.0"
                            value={addLiquidityBaseAmount}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAddLiquidityBaseAmountChange(sanitizeNumberInput(e.target.value))}
                            flex="1"
                            disabled={isSubmitting}
                        />
                        <Button variant="outline" size="sm" onClick={() => onAddLiquidityBaseAmountChange(baseBalanceAmount)}>MAX</Button>
                    </HStack>
                </Box>

                <Box fontSize="lg" color="fg.muted" fontWeight="bold" textAlign="center">+</Box>

                <Box w="full">
                    <HStack justify="space-between" mb="2">
                        <Text fontSize="sm" color="fg.muted">{quoteAsset?.ticker} Amount</Text>
                        <Text fontSize="xs" color="fg.muted">Available: {prettyAmount(quoteBalanceAmount)}</Text>
                    </HStack>
                    <HStack>
                        <Input
                            placeholder="0.0"
                            value={addLiquidityQuoteAmount}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAddLiquidityQuoteAmountChange(sanitizeNumberInput(e.target.value))}
                            flex="1"
                            disabled={isSubmitting}
                        />
                        <Button variant="outline" size="sm" onClick={() => onAddLiquidityQuoteAmountChange(quoteBalanceAmount)}>MAX</Button>
                    </HStack>
                </Box>

                {/* Expected Output & Slippage */}
                {addLiquidityBaseAmount && addLiquidityQuoteAmount && (
                    <Box w="full" p="3" bg="bg.muted" borderRadius="md" borderWidth="1px">
                        <VStack align="stretch" gap="2">
                            <HStack justify="space-between">
                                <Text fontSize="sm" color="fg.muted">Expected LP Tokens</Text>
                                <Text fontSize="sm" fontWeight="medium" color="fg.emphasized">
                                    {prettyAmount(expectedShares)} LP
                                </Text>
                            </HStack>

                            <HStack justify="space-between">
                                <HStack gap="1">
                                    <Text fontSize="sm" color="fg.muted">Slippage</Text>
                                    <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => setShowSlippageEdit(!showSlippageEdit)}
                                        px="1"
                                        disabled={isSubmitting}
                                    >
                                        <LuSettings size={14} />
                                    </Button>
                                </HStack>
                                <Text fontSize="sm" fontWeight="medium" color="fg.emphasized">
                                    {addLiquiditySlippage}%
                                </Text>
                            </HStack>

                            {showSlippageEdit && (
                                <VStack align="stretch" gap="2" pt="2" borderTopWidth="1px">
                                    <HStack gap="2" flexWrap="wrap">
                                        <Button
                                            size="xs"
                                            variant={addLiquiditySlippage === '0.5' ? 'solid' : 'outline'}
                                            onClick={() => setAddLiquiditySlippage('0.5')}
                                            disabled={isSubmitting}
                                        >
                                            0.5%
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant={addLiquiditySlippage === '1' ? 'solid' : 'outline'}
                                            onClick={() => setAddLiquiditySlippage('1')}
                                            disabled={isSubmitting}
                                        >
                                            1%
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant={addLiquiditySlippage === '3' ? 'solid' : 'outline'}
                                            onClick={() => setAddLiquiditySlippage('3')}
                                            disabled={isSubmitting}
                                        >
                                            3%
                                        </Button>
                                        <HStack flex="1" minW="120px">
                                            <Input
                                                size="xs"
                                                placeholder="Custom"
                                                value={addLiquiditySlippage}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddLiquiditySlippage(sanitizeNumberInput(e.target.value))}
                                                maxW="80px"
                                                disabled={isSubmitting}
                                            />
                                            <Text fontSize="xs" color="fg.muted">%</Text>
                                        </HStack>
                                    </HStack>

                                    {parseFloat(addLiquiditySlippage) > 5 && (
                                        <Text fontSize="xs" color="orange.500">
                                            ⚠️ High slippage may result in unfavorable rates
                                        </Text>
                                    )}
                                </VStack>
                            )}

                            <HStack justify="space-between">
                                <Text fontSize="xs" color="fg.muted">Minimum LP Tokens</Text>
                                <Text fontSize="xs" color="fg.muted">
                                    {prettyAmount(minimumShares)} LP
                                </Text>
                            </HStack>
                        </VStack>
                    </Box>
                )}
            </VStack>

            <Button
                w="full"
                colorPalette="blue"
                size="lg"
                onClick={onAddLiquidity}
                disabled={isSubmitting}
            >
                Add Liquidity
            </Button>
        </VStack>
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

    const handleRemove = useCallback(async () => {
        if (!pool || !address) {
            toast.error('Please connect your wallet');
            return;
        }

        if (!removeAmount || removeAmount === '0') {
            toast.error('Please enter an amount to remove');
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
    }, [pool, address, removeAmount, userShares, removeSlippage, minimumBaseAmount, minimumQuoteAmount, baseAsset, quoteAsset, toast, tx, onRemove]);

    return (
        <VStack gap="4" w="full">
            <Text fontSize="lg" fontWeight="semibold" color="fg.emphasized">Remove Liquidity</Text>

            <VStack w="full" gap="4">
                <Box w="full">
                    <HStack justify="space-between" mb="2">
                        <Text fontSize="sm" color="fg.muted">LP Shares Amount</Text>
                        <Text fontSize="xs" color="fg.muted">Available: {prettyAmount(userSharesAmount)}</Text>
                    </HStack>
                    <HStack>
                        <Input
                            placeholder="0.0"
                            value={removeAmount}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAmountChange(sanitizeNumberInput(e.target.value))}
                            flex="1"
                            disabled={!canRemove}
                        />
                        <Button variant="outline" size="sm" onClick={() => onAmountChange(userSharesAmount)} disabled={!canRemove}>MAX</Button>
                    </HStack>
                </Box>

                <Box w="full">
                    <HStack justify="space-between" mb="3">
                        <Text fontSize="sm" color="fg.muted">Amount to Remove</Text>
                        <Text fontSize="sm" fontWeight="semibold" color="fg.emphasized">{removePercentage.toFixed(0)}%</Text>
                    </HStack>
                    <Box w="full">
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
                                <Slider.Track h="2" bg="bg.muted" rounded="full">
                                    <Slider.Range bg="blue.500" />
                                </Slider.Track>
                                <Slider.Thumb
                                    index={0}
                                    boxSize="4"
                                    bg="blue.500"
                                    border="2px solid"
                                    borderColor="white"
                                    cursor="pointer"
                                    _focus={{ boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.6)" }}
                                />
                            </Slider.Control>
                        </Slider.Root>
                    </Box>
                    <HStack justify="space-between" mt="3">
                        {[25, 50, 75, 100].map((percentage) => (
                            <Button
                                key={percentage}
                                size="sm"
                                variant={removePercentage === percentage ? "solid" : "outline"}
                                onClick={() => onPercentageChange(percentage)}
                                disabled={!canRemove}
                            >
                                {percentage}%
                            </Button>
                        ))}
                    </HStack>
                </Box>

                {/* Expected Output & Slippage */}
                {removeAmount && removeAmount !== '0' && (
                    <Box w="full" p="3" bg="bg.muted" borderRadius="md" borderWidth="1px">
                        <VStack align="stretch" gap="2">
                            <Text fontSize="sm" color="fg.muted" mb="1">You will receive:</Text>

                            <HStack justify="space-between">
                                <Text fontSize="sm" color="fg.muted">{baseAsset?.ticker}</Text>
                                <Text fontSize="sm" fontWeight="medium" color="fg.emphasized">
                                    {prettyAmount(estimatedBaseAmount)}
                                </Text>
                            </HStack>

                            <HStack justify="space-between">
                                <Text fontSize="sm" color="fg.muted">{quoteAsset?.ticker}</Text>
                                <Text fontSize="sm" fontWeight="medium" color="fg.emphasized">
                                    {prettyAmount(estimatedQuoteAmount)}
                                </Text>
                            </HStack>

                            <Box borderTopWidth="1px" pt="2" mt="1">
                                <HStack justify="space-between">
                                    <HStack gap="1">
                                        <Text fontSize="sm" color="fg.muted">Slippage Tolerance</Text>
                                        <Button
                                            size="xs"
                                            variant="ghost"
                                            onClick={() => setShowSlippageEdit(!showSlippageEdit)}
                                            px="1"
                                            disabled={!canRemove}
                                        >
                                            <LuSettings size={14} />
                                        </Button>
                                    </HStack>
                                    <Text fontSize="sm" fontWeight="medium" color="fg.emphasized">
                                        {removeSlippage}%
                                    </Text>
                                </HStack>

                                {showSlippageEdit && (
                                    <VStack align="stretch" gap="2" pt="2" borderTopWidth="1px" mt="2">
                                        <HStack gap="2" flexWrap="wrap">
                                            <Button
                                                size="xs"
                                                variant={removeSlippage === '0.5' ? 'solid' : 'outline'}
                                                onClick={() => setRemoveSlippage('0.5')}
                                                disabled={!canRemove}
                                            >
                                                0.5%
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant={removeSlippage === '1' ? 'solid' : 'outline'}
                                                onClick={() => setRemoveSlippage('1')}
                                                disabled={!canRemove}
                                            >
                                                1%
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant={removeSlippage === '3' ? 'solid' : 'outline'}
                                                onClick={() => setRemoveSlippage('3')}
                                                disabled={!canRemove}
                                            >
                                                3%
                                            </Button>
                                            <HStack flex="1" minW="120px">
                                                <Input
                                                    size="xs"
                                                    placeholder="Custom"
                                                    value={removeSlippage}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemoveSlippage(sanitizeNumberInput(e.target.value))}
                                                    maxW="80px"
                                                    disabled={!canRemove}
                                                />
                                                <Text fontSize="xs" color="fg.muted">%</Text>
                                            </HStack>
                                        </HStack>

                                        {parseFloat(removeSlippage) > 5 && (
                                            <Text fontSize="xs" color="orange.500">
                                                ⚠️ High slippage may result in unfavorable rates
                                            </Text>
                                        )}
                                    </VStack>
                                )}

                                <VStack align="stretch" gap="1" mt="2" pt="2" borderTopWidth="1px">
                                    <Text fontSize="xs" color="fg.muted" mb="1">Minimum received:</Text>
                                    <HStack justify="space-between">
                                        <Text fontSize="xs" color="fg.muted">{baseAsset?.ticker}</Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            {prettyAmount(minimumBaseAmount)}
                                        </Text>
                                    </HStack>
                                    <HStack justify="space-between">
                                        <Text fontSize="xs" color="fg.muted">{quoteAsset?.ticker}</Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            {prettyAmount(minimumQuoteAmount)}
                                        </Text>
                                    </HStack>
                                </VStack>
                            </Box>
                        </VStack>
                    </Box>
                )}
            </VStack>

            <Button
                w="full"
                colorPalette="red"
                size="lg"
                onClick={handleRemove}
                disabled={!removeAmount || removeAmount === '0' || isSubmitting || !canRemove}
                loading={isSubmitting}
            >
                Remove Liquidity
            </Button>
        </VStack>
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
    }, [pool?.lp_denom, rewardsMap]);

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
    }, [pool, address, selectedReward, lockAmount, userShares, userActiveStake, isRewardActive, toast, tx, onLockSuccess]);

    if (eligibleRewards.length === 0) {
        return (
            <VStack gap="4" w="full">
                <Text fontSize="lg" fontWeight="semibold" color="fg.emphasized">Lock LP Shares for Extra Rewards</Text>
                <Box
                    w="full"
                    bgGradient="to-br"
                    gradientFrom="blue.500/5"
                    gradientTo="blue.600/5"
                    p="6"
                    rounded="lg"
                    borderWidth="1px"
                    borderColor="blue.500/15"
                    textAlign="center"
                >
                    <VStack gap="3">
                        <LuInfo size={32} />
                        <Text color="fg.muted">No extra rewards available for this pool at the moment.</Text>
                        <Text fontSize="sm" color="fg.muted">Check back later for new rewards boost opportunities!</Text>
                    </VStack>
                </Box>
            </VStack>
        );
    }

    return (
        <VStack gap="4" w="full">
            <Text fontSize="lg" fontWeight="semibold" color="fg.emphasized">Lock LP Shares for Extra Rewards</Text>

            <VStack w="full" gap="4">
                {/* Amount Input */}
                <Box w="full">
                    <HStack justify="space-between" mb="2">
                        <Text fontSize="sm" color="fg.muted">Amount of LP Shares to Lock</Text>
                        <Text fontSize="xs" color="fg.muted">Available: {prettyAmount(userSharesAmount)}</Text>
                    </HStack>
                    <HStack>
                        <Input
                            placeholder="0.0"
                            value={lockAmount}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLockAmount(sanitizeNumberInput(e.target.value))}
                            flex="1"
                            disabled={isSubmitting || !selectedRewardId}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLockAmount(userSharesAmount)}
                            disabled={isSubmitting || !selectedRewardId || userShares.lte(0)}
                        >
                            MAX
                        </Button>
                    </HStack>
                </Box>

                {/* Staking Rewards Selection */}
                <Box w="full">
                    <Text fontSize="sm" color="fg.muted" mb="3">Select a Staking Reward</Text>
                    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="3" w="full">
                        {eligibleRewards.map((reward) => {
                            const isSelected = selectedRewardId === reward.reward_id;
                            const isActive = isRewardActive(reward);
                            const remaining = remainingDays(reward);
                            const dailyDist = uAmountToAmount(reward.prize_amount, denomDecimals(reward.prize_denom));
                            const prizeTicker = denomTicker(reward.prize_denom);

                            return (
                                <Box
                                    key={reward.reward_id}
                                    p="4"
                                    bg={isSelected ? "purple.50" : "bg.panel"}
                                    _dark={{
                                        bg: isSelected ? "purple.900/30" : "bg.panel",
                                        borderColor: isSelected ? "purple.500" : "border",
                                    }}
                                    rounded="lg"
                                    borderWidth="2px"
                                    borderColor={isSelected ? "purple.500" : "border"}
                                    cursor={isActive ? "pointer" : "not-allowed"}
                                    opacity={isActive ? 1 : 0.6}
                                    transition="all 0.2s"
                                    onClick={() => isActive && setSelectedRewardId(reward.reward_id)}
                                    _hover={isActive ? {
                                        borderColor: "purple.400",
                                        transform: "translateY(-2px)",
                                        shadow: "md",
                                    } : {}}
                                >
                                    <VStack align="start" gap="3" w="full">
                                        <HStack justify="space-between" w="full">
                                            <HStack gap="2">
                                                <Box
                                                    w="4"
                                                    h="4"
                                                    rounded="full"
                                                    borderWidth="2px"
                                                    borderColor={isSelected ? "purple.500" : "border"}
                                                    bg={isSelected ? "purple.500" : "transparent"}
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="center"
                                                >
                                                    {isSelected && (
                                                        <Box w="2" h="2" rounded="full" bg="white" />
                                                    )}
                                                </Box>
                                                <Text fontWeight="bold" fontSize="sm" color="fg.emphasized">
                                                    Reward #{removeLeadingZeros(reward.reward_id)}
                                                </Text>
                                            </HStack>
                                            <Badge
                                                colorPalette={isActive ? "green" : "gray"}
                                                variant="subtle"
                                                size="sm"
                                            >
                                                {isActive ? "Active" : "Ended"}
                                            </Badge>
                                        </HStack>

                                        <Separator />

                                        <VStack align="stretch" gap="2" w="full" fontSize="xs">
                                            <HStack justify="space-between">
                                                <HStack gap="1.5" color="fg.muted">
                                                    <LuCoins size={12} />
                                                    <Text>Daily Distribution</Text>
                                                </HStack>
                                                <Text fontWeight="semibold" color="fg.emphasized">
                                                    {prettyAmount(dailyDist)} {prizeTicker}
                                                </Text>
                                            </HStack>

                                            <HStack justify="space-between">
                                                <HStack gap="1.5" color="fg.muted">
                                                    <LuLock size={12} />
                                                    <Text>Unlock Period</Text>
                                                </HStack>
                                                <Text fontWeight="semibold" color="fg.emphasized">
                                                    {reward.lock} days
                                                </Text>
                                            </HStack>

                                            <HStack justify="space-between">
                                                <HStack gap="1.5" color="fg.muted">
                                                    <LuClock size={12} />
                                                    <Text>Remaining Days</Text>
                                                </HStack>
                                                <Text fontWeight="semibold" color={isActive ? "fg.emphasized" : "fg.muted"}>
                                                    {remaining} / {reward.duration}
                                                </Text>
                                            </HStack>
                                        </VStack>
                                    </VStack>
                                </Box>
                            );
                        })}
                    </Grid>
                </Box>

                {/* Estimated Rewards & Warning */}
                {lockAmount && lockAmount !== '0' && selectedReward && estimatedDailyRewards && (
                    <VStack gap="3" w="full">
                        <Box
                            w="full"
                            bg="green.50"
                            _dark={{ bg: "green.900/20", borderColor: "green.600" }}
                            p="4"
                            rounded="lg"
                            borderWidth="1px"
                            borderColor="green.200"
                        >
                            <VStack align="stretch" gap="2">
                                <HStack gap="2">
                                    <Box color="green.500">
                                        <LuTrendingUp size={18} />
                                    </Box>
                                    <Text fontSize="sm" fontWeight="semibold" color="green.700" _dark={{ color: "green.300" }}>
                                        Estimated Daily Rewards
                                    </Text>
                                </HStack>
                                <Text fontSize="2xl" fontWeight="bold" color="green.600">
                                    {prettyAmount(estimatedDailyRewards.amount)} {estimatedDailyRewards.ticker}
                                </Text>
                                {estimatedDailyRewardsUsd && estimatedDailyRewardsUsd.gt(0) && (
                                    <Text fontSize="md" fontWeight="medium" color="green.600" _dark={{ color: "green.400" }}>
                                        ≈ ${shortNumberFormat(estimatedDailyRewardsUsd)}
                                    </Text>
                                )}
                            </VStack>
                        </Box>

                        {/* Show new APR if it changes by more than 10% */}
                        {stakingAPRData && stakingAPRData.newAPR && stakingAPRData.aprChange && Math.abs(stakingAPRData.aprChange.toNumber()) > 10 && (
                            <Box
                                w="full"
                                bg="blue.50"
                                _dark={{ bg: "blue.900/20", borderColor: "blue.600" }}
                                p="4"
                                rounded="lg"
                                borderWidth="1px"
                                borderColor="blue.200"
                            >
                                <VStack align="stretch" gap="2">
                                    <HStack gap="2" justify="space-between">
                                        <HStack gap="2">
                                            <Box color="blue.500">
                                                <LuTrendingUp size={18} />
                                            </Box>
                                            <Text fontSize="sm" fontWeight="semibold" color="blue.700" _dark={{ color: "blue.300" }}>
                                                New Staking APR
                                            </Text>
                                        </HStack>
                                        <Badge
                                            colorPalette={stakingAPRData.aprChange.lt(0) ? "red" : "green"}
                                            size="sm"
                                        >
                                            {stakingAPRData.aprChange.lt(0) ? '' : '+'}{stakingAPRData.aprChange.toFixed(1)}%
                                        </Badge>
                                    </HStack>
                                    <HStack justify="space-between" align="baseline">
                                        <Text fontSize="sm" color="blue.600" _dark={{ color: "blue.400" }}>
                                            Current: {stakingAPRData.currentAPR.toFixed(2)}%
                                        </Text>
                                        <Text fontSize="lg" fontWeight="bold" color="blue.600">
                                            New: {stakingAPRData.newAPR.toFixed(2)}%
                                        </Text>
                                    </HStack>
                                </VStack>
                            </Box>
                        )}

                        {selectedReward.lock > 0 && (
                            <Box
                                w="full"
                                bg="orange.50"
                                _dark={{ bg: "orange.900/20", borderColor: "orange.600" }}
                                p="4"
                                rounded="lg"
                                borderWidth="1px"
                                borderColor="orange.200"
                            >
                                <HStack>
                                    <Box color="orange.500">
                                        <LuInfo size={18} />
                                    </Box>
                                    <VStack align="start" gap="1" flex="1">
                                        <Text fontSize="sm" fontWeight="semibold" color="orange.700" _dark={{ color: "orange.300" }}>
                                            Unlocking Period: {selectedReward.lock} days
                                        </Text>
                                        <Text fontSize="xs" color="orange.600" _dark={{ color: "orange.400" }}>
                                            {`When you unlock your shares, you'll need to wait ${selectedReward.lock} days before receiving them back. You can unlock anytime, but the unlocking period always applies.`}
                                        </Text>
                                    </VStack>
                                </HStack>
                            </Box>
                        )}
                    </VStack>
                )}
            </VStack>

            <Button
                w="full"
                colorPalette="purple"
                size="lg"
                onClick={handleLock}
                disabled={!selectedRewardId || !lockAmount || lockAmount === '0' || isSubmitting || userShares.lte(0)}
                loading={isSubmitting}
            >
                <HStack gap="2">
                    <LuLock size={18} />
                    <Text>Lock LP Shares</Text>
                </HStack>
            </Button>
        </VStack>
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
    }, [addressRewardsStaking, rewardsMap, pool?.lp_denom])
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
    }, [addressRewardsStaking, denomDecimals, denomTicker, pool?.lp_denom, rewardsMap])
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
        <Box w="full" bg="bg.surface" p={{ base: "4", md: "6" }} rounded="xl" borderWidth="1px" borderColor="border">
            <VStack gap={{ base: "4", md: "6" }}>
                <HStack w="full" justify="space-between">
                    <Text fontSize="lg" fontWeight="bold" color="fg.emphasized">Your Shares</Text>
                    <Badge variant="surface" colorPalette={lockedLpShares.length > 0 ? 'purple' : userShares.gt(0) ? 'green' : 'yellow'}>{lockedLpShares.length > 0 ? 'Boosted' : userShares.gt(0) ? 'Active' : 'Inactive'}</Badge>
                </HStack>

                <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={{ base: "3", md: "4" }} w="full">
                    <VStack
                        align="center"
                        gap="2"
                        p={{ base: "3", md: "4" }}
                        bgGradient="to-br"
                        gradientFrom="blue.500/8"
                        gradientTo="blue.600/8"
                        rounded="lg"
                        borderWidth="1px"
                        borderColor="blue.500/20"
                    >
                        <Text fontSize="sm" color="fg.muted" textAlign="center">LP Shares</Text>
                        <LPTokenLogo
                            baseAssetLogo={baseAsset?.logo || ''}
                            quoteAssetLogo={quoteAsset?.logo || ''}
                            baseAssetSymbol={baseAsset?.ticker || ''}
                            quoteAssetSymbol={quoteAsset?.ticker || ''}
                            size="10"
                        />
                        <HighlightText fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="fg.emphasized">{prettyAmount(uAmountToAmount(userShares, LP_ASSETS_DECIMALS))}</HighlightText>
                        <HighlightText fontSize="xs" color="fg.muted">{prettyAmount(userSharesPercentage)}% of pool</HighlightText>
                    </VStack>
                    <VStack
                        align="center"
                        gap="2"
                        p={{ base: "3", md: "4" }}
                        bgGradient="to-br"
                        gradientFrom="green.500/8"
                        gradientTo="blue.500/8"
                        rounded="lg"
                        borderWidth="1px"
                        borderColor="green.500/20"
                    >
                        <Text fontSize="sm" color="fg.muted" textAlign="center">Shares Assets</Text>
                        <VStack gap="2">
                            <HStack gap="2">
                                <TokenLogo
                                    src={baseAsset?.logo}
                                    symbol={baseAsset?.ticker || ''}
                                    size="6"
                                    circular={true}
                                />
                                <HighlightText fontSize="sm" color="fg.emphasized" fontWeight="medium">{prettyAmount(uAmountToAmount(userReserveBase, baseAsset?.decimals ?? 0))} {baseAsset?.ticker}</HighlightText>
                            </HStack>
                            <HStack gap="2">
                                <TokenLogo
                                    src={quoteAsset?.logo}
                                    symbol={quoteAsset?.ticker || ''}
                                    size="6"
                                    circular={true}
                                />
                                <HighlightText fontSize="sm" color="fg.emphasized" fontWeight="medium">{prettyAmount(uAmountToAmount(userReserveQuote, quoteAsset?.decimals ?? 0))} {quoteAsset?.ticker}</HighlightText>
                            </HStack>
                        </VStack>
                    </VStack>
                    <VStack
                        align="center"
                        gap="2"
                        p={{ base: "3", md: "4" }}
                        bgGradient="to-br"
                        gradientFrom="blue.500/8"
                        gradientTo="cyan.500/8"
                        rounded="lg"
                        borderWidth="1px"
                        borderColor="blue.500/20"
                    >
                        <Text fontSize="sm" color="fg.muted" textAlign="center">Boost Rewards</Text>
                        <HighlightText fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="purple.500">${extraRewardsInUsd}</HighlightText>
                        <RewardsStakingButton buttonType={TYPE_REWARDS} flex={0} w={undefined} onClick={() => setShowRewardsModal(true)}>
                            Claim
                        </RewardsStakingButton>
                    </VStack>
                </Grid>

                {lockedLpShares && lockedLpShares.length > 0 && lockedLpShares.map((item, index) => (
                    <Box
                        key={index}
                        w="full"
                        bg="purple.50"
                        _dark={{ bg: "purple.900/20", borderColor: "purple.600" }}
                        p="4"
                        rounded="lg"
                        borderWidth="1px"
                        borderColor="purple.200"
                    >
                        <HStack>
                            <Box color="purple.500">
                                <LuLock size={20} />
                            </Box>
                            <VStack align="start" gap="1" flex="1">
                                <Text
                                    fontSize="sm"
                                    fontWeight="semibold"
                                    color="purple.700"
                                    _dark={{ color: "purple.300" }}
                                >
                                    Locked: {item.stakeAmount} LP shares
                                </Text>
                                <Text
                                    fontSize="xs"
                                    color="purple.600"
                                    _dark={{ color: "purple.400" }}
                                >
                                    Earning {item.earnings} daily • Unlock period: {item.lockDays} {item.lockDays === 1 ? 'day' : 'days'}
                                </Text>
                            </VStack>
                            <Button
                                size="xs"
                                variant="outline"
                                colorPalette="orange"
                                onClick={() => unstakeShares(item.rewardId)}
                                disabled={isUnstaking}
                                loading={isUnstaking}
                            >
                                Unlock
                            </Button>
                        </HStack>
                    </Box>
                ))}
                {lpSharesPendingUnlock && lpSharesPendingUnlock.length > 0 && (
                    <VStack w="full" gap={"2"}>
                        <RewardsStakingUnlockAlerts ticker={'LP Shares'} decimals={LP_ASSETS_DECIMALS} userUnlocking={lpSharesPendingUnlock}/>
                    </VStack>
                )}
                {showRewardsModal && (
                    <RewardsStakingPendingRewardsModal
                        onClose={() => setShowRewardsModal(false)}
                        pendingRewards={extraRewards}
                        pendingRewardsIds={lockedLpShares.map(item => item.rewardId)}
                        onClaimSuccess={onRewardsClaimSuccess}
                    />
                )}
            </VStack>
        </Box>
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
    }, [pool?.lp_denom, rewardsMap]);

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

    // Custom tabs
    const TabButton = ({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: React.ReactNode }) => (
        <Button
            variant={isActive ? "solid" : "ghost"}
            colorPalette={isActive ? "blue" : undefined}
            onClick={onClick}
            size="sm"
        >
            {children}
        </Button>
    );

    return (
        <Container maxW="4xl" py={{ base: "4", md: "8" }} px={{ base: "4", md: "6" }} bg="bg.subtle">
            <VStack align="start" gap={{ base: "4", md: "6" }} mb={{ base: "4", md: "8" }}>
                {/* Header */}
                <HStack>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toPoolsPage()}
                    >
                        <LuArrowLeft />Pools
                    </Button>
                    <Box h="4" w="1px" bg="border" />
                    <Text ml={2} fontSize="2xl" fontWeight="bold" color="fg.emphasized">Pool Details</Text>
                </HStack>

                {/* Pool Overview */}
                <Box w="full" bg="bg.surface" p={{ base: "4", md: "6" }} rounded="xl" borderWidth="1px" borderColor="border">
                    <VStack gap={{ base: "4", md: "6" }}>
                        {/* Assets Display */}
                        <VStack w="full" gap="4">
                            <HStack
                                w="full"
                                gap={{ base: "2", md: "4" }}
                                align="center"
                                direction={{ base: "column", sm: "row" }}
                            >
                                <Skeleton asChild loading={isLoadingBaseAsset || baseAssetPriceLoading}>
                                    <AssetDisplay
                                        asset={baseAsset}
                                        amount={poolBaseReservesAmount}
                                        usdValue={poolBaseReservesUsdValue}
                                    />
                                </Skeleton>
                                <Box
                                    fontSize={{ base: "xl", md: "2xl" }}
                                    color="fg.muted"
                                    fontWeight="bold"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    minW="6"
                                    py={{ base: "2", sm: "0" }}
                                >
                                    +
                                </Box>
                                <Skeleton asChild loading={isLoadingQuoteAsset || quoteAssetPriceLoading}>
                                    <AssetDisplay
                                        asset={quoteAsset}
                                        amount={poolQuoteReservesAmount}
                                        usdValue={poolQuoteReservesUsdValue}
                                    />
                                </Skeleton>
                            </HStack>
                        </VStack>

                        {/* Exchange Rates */}
                        <Box w="full" bgGradient="to-br" gradientFrom="purple.500/8" gradientTo="blue.500/8" p={{ base: "3", md: "4" }} rounded="lg" borderWidth="1px" borderColor="purple.500/20">
                            <HStack justify="space-around" flexWrap="wrap" gap={{ base: "3", md: "4" }}>
                                <VStack align="center" gap="1">
                                    <Text fontSize="xs" color="fg.muted" fontWeight="medium">Rate</Text>
                                    <HStack gap="2">
                                        <Text fontSize={{ base: "sm", md: "md" }} fontWeight="bold" color="fg.emphasized">1 {baseAsset?.ticker}</Text>
                                        <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted">=</Text>
                                        <Skeleton asChild loading={!pool}>
                                            <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="purple.500">
                                                {pool && baseAsset && quoteAsset
                                                    ? toBigNumber(poolQuoteReservesAmount).dividedBy(toBigNumber(poolBaseReservesAmount)).toFixed(quoteAsset.decimals)
                                                    : '0'} {quoteAsset?.ticker}
                                            </Text>
                                        </Skeleton>
                                    </HStack>
                                </VStack>
                                <Box h={{ base: "1px", md: "8" }} w={{ base: "full", md: "1px" }} bg="border" />
                                <VStack align="center" gap="1">
                                    <Text fontSize="xs" color="fg.muted" fontWeight="medium">Rate</Text>
                                    <HStack gap="2">
                                        <Text fontSize={{ base: "sm", md: "md" }} fontWeight="bold" color="fg.emphasized">1 {quoteAsset?.ticker}</Text>
                                        <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted">=</Text>
                                        <Skeleton asChild loading={!pool}>
                                            <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="blue.500">
                                                {pool && baseAsset && quoteAsset
                                                    ? toBigNumber(poolBaseReservesAmount).dividedBy(toBigNumber(poolQuoteReservesAmount)).toFixed(baseAsset.decimals)
                                                    : '0'} {baseAsset?.ticker}
                                            </Text>
                                        </Skeleton>
                                    </HStack>
                                </VStack>
                            </HStack>
                        </Box>

                        {/* Pool Stats */}
                        <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={{ base: "3", md: "4" }} w="full">
                            <VStack align="center" gap="2" p={{ base: "3", md: "4" }} bgGradient="to-br" gradientFrom="blue.500/5" gradientTo="blue.600/5" rounded="lg" borderWidth="1px" borderColor="blue.500/15">
                                <Text fontSize="sm" color="fg.muted" textAlign="center">Total Liquidity</Text>
                                <Skeleton asChild loading={!hasPoolData}>
                                    <HighlightText fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="fg.emphasized">${prettyAmount(poolData?.usdValue || 0)}</HighlightText>
                                </Skeleton>
                            </VStack>
                            <VStack align="center" gap="2" p={{ base: "3", md: "4" }} bgGradient="to-br" gradientFrom="blue.500/5" gradientTo="blue.600/5" rounded="lg" borderWidth="1px" borderColor="blue.500/15">
                                <Text fontSize="sm" color="fg.muted" textAlign="center">Volume (24h)</Text>
                                <Skeleton asChild loading={!hasPoolData}>
                                    <HighlightText fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="fg.emphasized">${prettyAmount(poolData?.usdVolume || 0)}</HighlightText>
                                </Skeleton>
                            </VStack>
                            <VStack align="center" gap="2" p={{ base: "3", md: "4" }} bgGradient="to-br" gradientFrom="blue.500/5" gradientTo="blue.600/5" rounded="lg" borderWidth="1px" borderColor="blue.500/15">
                                <Text fontSize="sm" color="fg.muted" textAlign="center">Fees (24h)</Text>
                                <Skeleton asChild loading={!hasPoolData}>
                                    <HighlightText fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="fg.emphasized">${prettyAmount(poolData?.usdFees || 0)}</HighlightText>
                                </Skeleton>
                            </VStack>
                            <VStack align="center" gap="2" p={{ base: "3", md: "4" }} bgGradient="to-br" gradientFrom="blue.500/5" gradientTo="blue.600/5" rounded="lg" borderWidth="1px" borderColor="blue.500/15">
                                <HStack justify="center">
                                    <Text fontSize="sm" color="fg.muted">APR</Text>
                                    <LuTrendingUp size={16} />
                                </HStack>
                                <Skeleton asChild loading={!hasPoolData}>
                                    <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="green.500">{poolData?.apr || 0}%</Text>
                                </Skeleton>
                            </VStack>
                        </Grid>

                        {/* Locked Liquidity Stats */}
                        <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }} gap={{ base: "3", md: "4" }} w="full">
                            <VStack align="center" gap="2" p={{ base: "3", md: "4" }} bgGradient="to-br" gradientFrom="blue.500/5" gradientTo="blue.600/5" rounded="lg" borderWidth="1px" borderColor="blue.500/15">
                                <Text fontSize="sm" color="fg.muted" textAlign="center">Locked Forever</Text>
                                <Skeleton asChild loading={isLoadingLockedForever}>
                                    <HighlightText fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="fg.emphasized">
                                        {lockedForeverUsdValue
                                            ? `$${prettyAmount(lockedForeverUsdValue)}`
                                            : `${prettyAmount(lockedForeverAmount)} LP`
                                        }
                                    </HighlightText>
                                </Skeleton>
                                <Link
                                    href={`https://burner.getbze.com/coin?coin=${pool?.lp_denom || ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    fontSize="xs"
                                    color="fg.muted"
                                    display="flex"
                                    alignItems="center"
                                    gap="1"
                                    textDecoration="none"
                                    transition="color 0.2s"
                                    _hover={{
                                        color: 'colorPalette.fg',
                                        textDecoration: 'none',
                                    }}
                                >
                                    <LuExternalLink size={12} />
                                    <Text>See in Burner App</Text>
                                </Link>
                            </VStack>
                            <VStack align="center" gap="2" p={{ base: "3", md: "4" }} bgGradient="to-br" gradientFrom="blue.500/5" gradientTo="blue.600/5" rounded="lg" borderWidth="1px" borderColor="blue.500/15">
                                <Text fontSize="sm" color="fg.muted" textAlign="center">Locked in Boost Rewards</Text>
                                <Skeleton asChild loading={!rewardsMap || !pool}>
                                    <HighlightText fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="fg.emphasized">
                                        {lockedInRewardsUsdValue
                                            ? `$${prettyAmount(lockedInRewardsUsdValue)}`
                                            : `${prettyAmount(lockedInRewardsAmount)} LP`
                                        }
                                    </HighlightText>
                                </Skeleton>
                            </VStack>
                        </Grid>

                        {/* Fee Information */}
                        <Box w="full" bgGradient="to-br" gradientFrom="orange.500/5" gradientTo="yellow.500/5" p={{ base: "3", md: "4" }} rounded="lg" borderWidth="1px" borderColor="orange.500/15">
                            <VStack gap={{ base: "3", md: "4" }}>
                                <HStack w="full" justify="space-between">
                                    <Skeleton asChild loading={!pool}>
                                        <Text fontWeight="semibold" color="fg.emphasized" fontSize={{ base: "sm", md: "md" }}>Trading Fee: {toPercentage(pool?.fee || 0)}%</Text>
                                    </Skeleton>
                                </HStack>
                                <Separator borderColor="border.emphasized" />
                                <Grid templateColumns="repeat(3, 1fr)" gap={{ base: "2", md: "4" }} w="full">
                                    <Tooltip content="Rewards distributed to liquidity providers">
                                        <VStack align="center" gap="2" cursor="pointer">
                                            <Text fontSize="xs" color="fg.muted" fontWeight="medium" textAlign="center">LP Rewards</Text>
                                            <Skeleton asChild loading={!pool}>
                                                <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color="green.500">{toPercentage(pool?.fee_dest?.providers || 0)}%</Text>
                                            </Skeleton>
                                        </VStack>
                                    </Tooltip>
                                    <Tooltip content="Fees used for protocol development and maintenance">
                                        <VStack align="center" gap="2" cursor="pointer">
                                            <Text fontSize="xs" color="fg.muted" fontWeight="medium" textAlign="center">Protocol</Text>
                                            <Skeleton asChild loading={!pool}>
                                                <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color="blue.500">{toPercentage(pool?.fee_dest?.treasury || 0)}%</Text>
                                            </Skeleton>
                                        </VStack>
                                    </Tooltip>
                                    <Tooltip content="Fees used to buyback and burn BZE tokens">
                                        <VStack align="center" gap="2" cursor="pointer">
                                            <Text fontSize="xs" color="fg.muted" fontWeight="medium" textAlign="center">Buyback & Burn</Text>
                                            <Skeleton asChild loading={!pool}>
                                                <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color="orange.500">{toPercentage(pool?.fee_dest?.burner || 0)}%</Text>
                                            </Skeleton>
                                        </VStack>
                                    </Tooltip>
                                </Grid>
                            </VStack>
                        </Box>

                        {/* Validator Support Info Box */}
                        {isValidatorSupported && validatorPageUrl && (
                            <Box
                                w="full"
                                p={{ base: "4", md: "5" }}
                                rounded="xl"
                                borderWidth="1px"
                                borderColor="blue.500/20"
                                bgGradient="to-br"
                                gradientFrom="blue.500/3"
                                gradientTo="blue.600/3"
                            >
                                <VStack gap={{ base: "3", md: "4" }} align="start">
                                    <HStack gap="2">
                                        <Box color="blue.500">
                                            <LuInfo size={18} />
                                        </Box>
                                        <Text fontSize="md" fontWeight="semibold" color="fg.emphasized">
                                            Supported by BZE Community
                                        </Text>
                                    </HStack>

                                    <Text fontSize="sm" color="fg.muted" lineHeight="1.6">
                                        This liquidity pool is supported by BZE Community validator. The entire commission
                                        earned by our validator on the source blockchain is exclusively used to
                                        support this liquidity pool.
                                    </Text>

                                    <Text fontSize="sm" color="fg.muted" lineHeight="1.6">
                                        By delegating your coins to BZE Community, you directly contribute to
                                        maintaining deep liquidity for this trading pair while earning staking rewards.
                                    </Text>

                                    <Link
                                        href={validatorPageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        w="full"
                                    >
                                        <Button
                                            w="full"
                                            variant="outline"
                                            colorPalette="blue"
                                            size="sm"
                                            display="flex"
                                            alignItems="center"
                                            gap="2"
                                        >
                                            <Text>Delegate to BZE Community</Text>
                                            <LuExternalLink size={14} />
                                        </Button>
                                    </Link>
                                </VStack>
                            </Box>
                        )}
                    </VStack>
                </Box>

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
                <Box w="full" bg="bg.surface" p={{ base: "4", md: "6" }} rounded="xl" borderWidth="1px" borderColor="border">
                    <VStack gap={{ base: "4", md: "6" }}>
                        {/* Tab Navigation */}
                        <VStack w="full" gap="2">
                            <HStack gap="2" w="full" justify="center" flexWrap="wrap">
                                <TabButton
                                    isActive={activeTab === 'add'}
                                    onClick={() => setActiveTab('add')}
                                >
                                    <LuPlus />
                                    Add Liquidity
                                </TabButton>
                                <TabButton
                                    isActive={activeTab === 'remove'}
                                    onClick={() => setActiveTab('remove')}
                                >
                                    <LuMinus />
                                    Remove Liquidity
                                </TabButton>
                                <TabButton
                                    isActive={activeTab === 'lock'}
                                    onClick={() => setActiveTab('lock')}
                                >
                                    <LuLock />
                                    Boost Rewards
                                </TabButton>
                            </HStack>
                            <Separator borderColor="border.emphasized" />
                        </VStack>
                        {/* Tab Content */}
                        {activeTab === 'add' && (
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
                    </VStack>
                </Box>
            </VStack>
        </Container>
    );
}

const PoolDetailsPage = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PoolDetailsPageContent />
        </Suspense>
    );
};

export default PoolDetailsPage;
