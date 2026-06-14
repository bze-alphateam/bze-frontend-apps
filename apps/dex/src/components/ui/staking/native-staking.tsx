import {
    Badge,
    Box, Button,
    Card,
    Heading,
    HStack,
    Skeleton, Stack,
    Text,
    VStack,
    SimpleGrid
} from "@chakra-ui/react";
import {LuClock, LuCoins, LuGift, LuInfinity, LuLock, LuLockOpen, LuShield, LuTrendingUp} from "react-icons/lu";
import React, {useMemo, useState} from "react";
import {useAssets, prettyAmount, uAmountToAmount, uAmountToBigNumberAmount, shortNumberFormat, openExternalLink, useToast, getChainName, useSDKTx, NativeStakingData, TokenLogo} from "@bze/bze-ui-kit";
import {cosmos} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";
import {
    RewardStakingAlert,
    TYPE_REWARDS,
    TYPE_STAKING,
    TYPE_UNLOCK
} from "@/components/ui/staking/rewards-staking-alerts";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";

interface NativeStakingCardProps {
    stakingData: NativeStakingData|undefined;
    isLoading: boolean;
    onClaimSuccess?: () => void;
}

const MIN_CLAIM_AMOUNT = 100_000;

export const NativeStakingCard = ({ stakingData, isLoading, onClaimSuccess }: NativeStakingCardProps) => {
    const [modalType, setModalType] = useState('');
    const [pendingClaim, setPendingClaim] = useState(false);

    const hasUserStake = !!stakingData?.currentStaking?.staked.amount.gt(0);
    const hasUnbonding = !!stakingData?.currentStaking?.unbonding.total.amount.gt(0);
    const hasRewards = !!stakingData?.currentStaking?.pendingRewards.total.amount.gt(MIN_CLAIM_AMOUNT);

    const {nativeAsset} = useAssets()
    const {toast} = useToast()
    const {address} = useChain(getChainName())
    const {tx} = useSDKTx(getChainName())

    const yourStake = useMemo(() => {
        return `${prettyAmount(uAmountToAmount(stakingData?.currentStaking?.staked.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.currentStaking?.staked.amount, nativeAsset])

    const pendingRewards = useMemo(() => {
        return `${prettyAmount(uAmountToAmount(stakingData?.currentStaking?.pendingRewards.total.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.currentStaking?.pendingRewards.total.amount, nativeAsset])

    const pendingUnlock = useMemo(() => {
        return `${prettyAmount(uAmountToAmount(stakingData?.currentStaking?.unbonding.total.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.currentStaking?.unbonding.total.amount, nativeAsset])

    const pendingUnlockAlert = useMemo(() => {
        const firstUnlockAmount = prettyAmount(uAmountToAmount(stakingData?.currentStaking?.unbonding.firstUnlock.amount?.amount, nativeAsset?.decimals || 0))

        return `${firstUnlockAmount} ${nativeAsset?.ticker} will be unlocked on ${stakingData?.currentStaking?.unbonding.firstUnlock.unlockTime?.toLocaleDateString()} at ${stakingData?.currentStaking?.unbonding.firstUnlock.unlockTime?.toLocaleTimeString()}`
    }, [stakingData?.currentStaking, nativeAsset])

    const dailyDistribution = useMemo(() => {
        return `${shortNumberFormat(uAmountToBigNumberAmount(stakingData?.averageDailyDistribution.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.averageDailyDistribution.amount, nativeAsset])

    const totalStaked = useMemo(() => {
        return `${shortNumberFormat(uAmountToBigNumberAmount(stakingData?.totalStaked.amount, nativeAsset?.decimals || 0))} ${nativeAsset?.ticker}`
    }, [stakingData?.totalStaked.amount, nativeAsset])

    const openModal = (type: string) => {
        setModalType(type);
    };

    const closeModal = () => {
        setModalType('');
    };

    const onClaimRewards = async () => {
        if (!hasRewards || !stakingData?.currentStaking?.pendingRewards.validators || !address) {
            toast.error('Error', `Rewards amount is too low to claim. Minimum amount is ${uAmountToAmount(MIN_CLAIM_AMOUNT, nativeAsset?.decimals || 6)} ${nativeAsset?.ticker}.`)
            return
        }

        setPendingClaim(true)
        const { withdrawDelegatorReward } = cosmos.distribution.v1beta1.MessageComposer.fromPartial;
        const msgs = stakingData.currentStaking.pendingRewards.validators.map(validator => {
            return withdrawDelegatorReward({
                delegatorAddress: address,
                validatorAddress: validator,
            })
        })

        const success = await tx(msgs);

        setPendingClaim(false)
        if (success) {
            closeModal()
            if (onClaimSuccess) {
                onClaimSuccess()
            }
        }
    }

    return (
        <>
            <Skeleton asChild loading={isLoading}>
            <Card.Root
                borderWidth={hasUserStake ? "2px" : "1px"}
                borderColor={hasUserStake ? "blue.500" : (hasUnbonding ? "orange.500" : "purple.500")}
                cursor="pointer"
                transition="all 0.2s"
                bgGradient="to-br"
                gradientFrom={hasUserStake ? "blue.500/8" : (hasUnbonding ? "orange.500/8" : "blue.400/8")}
                gradientTo={hasUserStake ? "blue.600/8" : (hasUnbonding ? "yellow.500/8" : "cyan.500/8")}
                _hover={{
                    gradientFrom: hasUserStake ? "blue.500/12" : (hasUnbonding ? "orange.500/12" : "blue.400/12"),
                    gradientTo: hasUserStake ? "blue.600/12" : (hasUnbonding ? "yellow.500/12" : "cyan.500/12"),
                    transform: "translateY(-2px)",
                    shadow: "lg"
                }}
                onClick={() => openModal('actions')}
                shadow="sm"
            >
                <Card.Header pb="0">
                    <HStack gap="3" justify="space-between" align="center" flexWrap="wrap">
                        <HStack gap="3" flex="1" minW="0">
                            <Box
                                p="2"
                                bg="bg.subtle"
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor="border"
                                flexShrink="0"
                            >
                                <TokenLogo src={'/images/bze_alternative_512x512.png'} symbol={nativeAsset?.ticker ?? ''} size="8"/>
                            </Box>
                            <VStack align="start" gap="0.5" minW="0">
                                <Heading size="md" lineHeight="1.2">BZE Native Staking</Heading>
                                <HStack flexWrap="wrap" gap="1.5" fontSize="xs">
                                    <Badge colorPalette="purple" variant="solid" size="sm">Native</Badge>
                                    <Badge colorPalette="green" variant="outline" size="sm">
                                        <HStack gap="1">
                                            <LuShield size={10} />
                                            <Text>Verified</Text>
                                        </HStack>
                                    </Badge>
                                </HStack>
                            </VStack>
                        </HStack>

                        {/* APR Box - Far Right */}
                        <Box flexShrink="0" display={{base: 'none', md: 'flex'}}>
                            <Box
                                bgGradient="to-br"
                                gradientFrom="green.500/15"
                                gradientTo="green.600/15"
                                borderWidth="1px"
                                borderColor="green.500/30"
                                borderRadius="lg"
                                px={{base: '3', md: '4'}}
                                py="2.5"
                                minW={{base: '90px', md: '110px'}}
                            >
                                <VStack gap="0.5" align="center">
                                    <HStack gap="1" color="green.600">
                                        <LuTrendingUp size={12} />
                                        <Text fontSize="xs" textTransform="uppercase" fontWeight="semibold">APR</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize={{base: 'lg', md: 'xl'}} color="green.600" lineHeight="1">≈{stakingData?.averageApr}%</Text>
                                </VStack>
                            </Box>
                        </Box>
                    </HStack>
                    <Box flexShrink="0" display={{base: 'flex', md: 'none'}}>
                        <Box
                            bgGradient="to-br"
                            gradientFrom="green.500/15"
                            gradientTo="green.600/15"
                            borderWidth="1px"
                            borderColor="green.500/30"
                            borderRadius="lg"
                            px={{base: '3', md: '4'}}
                            py="2.5"
                            w="full"
                        >
                            <VStack gap="0.5" align="center">
                                <HStack gap="1" color="green.600">
                                    <LuTrendingUp size={12} />
                                    <Text fontSize="xs" textTransform="uppercase" fontWeight="semibold">APR</Text>
                                </HStack>
                                <Text fontWeight="bold" fontSize={{base: 'lg', md: 'xl'}} color="green.600" lineHeight="1">≈{stakingData?.averageApr}%</Text>
                            </VStack>
                        </Box>
                    </Box>
                </Card.Header>

                {/* Perpetual indicator as separator */}
                <Box px="6" py="2">
                    <HStack justify="center" gap="2" opacity="0.7">
                        <LuInfinity size={14} />
                        <Text fontSize="xs" fontWeight="medium" color="fg.muted">Rolling rewards for years ahead</Text>
                    </HStack>
                </Box>

                <Card.Body pt="0">
                    <VStack align="stretch" gap="2">
                        {/* Stake → Earn - Large and prominent */}
                        <Box
                            p="4"
                            bg="bg.emphasized"
                            borderRadius="lg"
                            borderWidth="1px"
                            borderColor="border.emphasized"
                        >
                            <VStack gap="2">
                                <Text fontSize="xs" color="fg.muted" textTransform="uppercase" fontWeight="semibold">Stake to Earn</Text>
                                <HStack gap={{base: '3', md: '4'}} justify="center" flexWrap="wrap">
                                    <VStack gap="1" align="center">
                                        <Box p="1.5" bg="bg.panel" borderRadius="md" borderWidth="1px">
                                            <TokenLogo src={'/images/bze_alternative_512x512.png'} symbol={nativeAsset?.ticker ?? ''} size="8"/>
                                        </Box>
                                        <VStack align="center" gap="0">
                                            <Text fontSize="xs" color="fg.muted">Stake</Text>
                                            <Text fontWeight="bold" fontSize="md">{nativeAsset?.ticker}</Text>
                                        </VStack>
                                    </VStack>
                                    <Box color="fg.muted" fontSize="xl" display="flex" alignItems="center">→</Box>
                                    <VStack gap="1" align="center">
                                        <Box p="1.5" bg="bg.panel" borderRadius="md" borderWidth="1px">
                                            <TokenLogo src={'/images/bze_alternative_512x512.png'} symbol={nativeAsset?.ticker ?? ''} size="8"/>
                                        </Box>
                                        <VStack align="center" gap="0">
                                            <Text fontSize="xs" color="fg.muted">Earn</Text>
                                            <Text fontWeight="bold" fontSize="md">{nativeAsset?.ticker}</Text>
                                        </VStack>
                                    </VStack>
                                </HStack>
                            </VStack>
                        </Box>

                        {/* User Metrics - Colored Boxes on Same Row */}
                        {(hasUserStake || hasUnbonding) && (
                            <SimpleGrid
                                columns={{
                                    base: 1,
                                    sm: hasUserStake && hasUnbonding ? 2 : (hasUserStake ? 2 : 1),
                                    md: hasUserStake && hasUnbonding ? 3 : (hasUserStake ? 2 : 1)
                                }}
                                gap="2"
                            >
                                {/* Your Stake */}
                                {hasUserStake && (
                                    <Box
                                        bgGradient="to-br"
                                        gradientFrom="blue.500/15"
                                        gradientTo="blue.600/15"
                                        borderWidth="1px"
                                        borderColor="blue.500/30"
                                        borderRadius="md"
                                        p="3"
                                    >
                                        <VStack align="start" gap="0.5">
                                            <HStack gap="1" color="blue.600">
                                                <LuLock size={12} />
                                                <Text fontSize="xs" textTransform="uppercase" fontWeight="semibold">Your Stake</Text>
                                            </HStack>
                                            <Text fontWeight="bold" fontSize="lg">{yourStake}</Text>
                                        </VStack>
                                    </Box>
                                )}

                                {/* Pending Rewards */}
                                {hasUserStake && (
                                    <Box
                                        bgGradient="to-br"
                                        gradientFrom="blue.500/15"
                                        gradientTo="blue.600/15"
                                        borderWidth="1px"
                                        borderColor="blue.500/30"
                                        borderRadius="md"
                                        p="3"
                                    >
                                        <VStack align="start" gap="0.5">
                                            <HStack gap="1" color="purple.600">
                                                <LuGift size={12} />
                                                <Text fontSize="xs" textTransform="uppercase" fontWeight="semibold">Rewards</Text>
                                            </HStack>
                                            <Text fontWeight="bold" fontSize="lg">{pendingRewards}</Text>
                                        </VStack>
                                    </Box>
                                )}

                                {/* Pending Unlock */}
                                {hasUnbonding && (
                                    <Box
                                        bgGradient="to-br"
                                        gradientFrom="orange.500/15"
                                        gradientTo="orange.600/15"
                                        borderWidth="1px"
                                        borderColor="orange.500/30"
                                        borderRadius="md"
                                        p="3"
                                    >
                                        <VStack align="start" gap="0.5">
                                            <HStack gap="1" color="orange.600">
                                                <LuLockOpen size={12} />
                                                <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase">Pending Unlock</Text>
                                            </HStack>
                                            <Text fontWeight="bold" fontSize="lg">{pendingUnlock}</Text>
                                            <Text fontSize="2xs" color="fg.muted" lineClamp={1}>{pendingUnlockAlert}</Text>
                                        </VStack>
                                    </Box>
                                )}
                            </SimpleGrid>
                        )}

                        {/* Stats Grid */}
                        <SimpleGrid columns={{ base: 2, md: 4 }} gap="2">
                            <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
                                <VStack align="start" gap="0.5">
                                    <HStack gap="1" color="fg.muted">
                                        <LuClock size={11} />
                                        <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">Unlock</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize="sm">{stakingData?.unlockDuration} days</Text>
                                </VStack>
                            </Box>

                            <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
                                <VStack align="start" gap="0.5">
                                    <HStack gap="1" color="fg.muted">
                                        <LuCoins size={11} />
                                        <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">Daily</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize="sm">≈{dailyDistribution}</Text>
                                </VStack>
                            </Box>

                            <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
                                <VStack align="start" gap="0.5">
                                    <HStack gap="1" color="fg.muted">
                                        <LuTrendingUp size={11} />
                                        <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">Minimum</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize="sm">None</Text>
                                </VStack>
                            </Box>

                            <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
                                <VStack align="start" gap="0.5">
                                    <HStack gap="1" color="fg.muted">
                                        <LuLock size={11} />
                                        <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">Total</Text>
                                    </HStack>
                                    <Text fontWeight="bold" fontSize="sm">{totalStaked}</Text>
                                </VStack>
                            </Box>
                        </SimpleGrid>
                    </VStack>
                </Card.Body>
            </Card.Root>
        </Skeleton>
            {modalType && (
                <Box
                    position="fixed"
                    inset="0"
                    bg="blackAlpha.600"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    zIndex="modal"
                >
                    <Card.Root maxW="md" w="full" mx="4">
                        <Card.Header>
                            <HStack justify="space-between" align="center">
                                <Heading size="lg">
                                    {modalType === 'stake' && 'Stake Tokens'}
                                    {modalType === 'unstake' && 'Unstake Tokens'}
                                    {modalType === 'claim' && 'Claim Rewards'}
                                    {modalType === 'actions' && 'BZE Native Staking'}
                                </Heading>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={closeModal}
                                >
                                    ✕
                                </Button>
                            </HStack>
                        </Card.Header>

                        <Card.Body>
                            {modalType === 'actions' && (
                                <VStack gap="4">
                                    <Text color="gray.600">{'Secure the BeeZee network and earn rewards by staking your BZE coins.'}</Text>

                                    <Stack direction={{ base: 'column', sm: 'row' }} width="full" gap="3">
                                        <RewardsStakingButton
                                            buttonType={TYPE_STAKING}
                                            variant='outline'
                                            onClick={() => openExternalLink('https://staking.getbze.com')}
                                        >
                                            <HStack gap="2">
                                                <Text>Stake</Text>
                                            </HStack>
                                        </RewardsStakingButton>

                                        <RewardsStakingButton
                                            buttonType={TYPE_UNLOCK}
                                            disabled={!hasUserStake}
                                            onClick={() => openExternalLink('https://staking.getbze.com')}
                                        >
                                            <HStack gap="2">
                                                <Text>Unstake</Text>
                                            </HStack>
                                        </RewardsStakingButton>

                                        <RewardsStakingButton
                                            buttonType={TYPE_REWARDS}
                                            disabled={!hasRewards}
                                            onClick={() => openModal('claim')}
                                        >
                                            <HStack gap="2">
                                                <Text>Claim</Text>
                                            </HStack>
                                        </RewardsStakingButton>
                                    </Stack>
                                </VStack>
                            )}

                            {modalType === 'claim' && hasRewards && (
                                <VStack gap="4">
                                    <RewardStakingAlert type={TYPE_REWARDS} text={pendingRewards} />
                                    <RewardsStakingButton
                                        buttonType={TYPE_REWARDS}
                                        onClick={onClaimRewards}
                                        disabled={pendingClaim}
                                    >
                                        Claim Rewards
                                    </RewardsStakingButton>
                                </VStack>
                            )}
                        </Card.Body>
                    </Card.Root>
                </Box>
            )}
        </>
    );
};
