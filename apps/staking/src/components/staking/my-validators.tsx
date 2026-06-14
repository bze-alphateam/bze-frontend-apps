'use client';

import {Box, Container, Text, VStack, HStack, Badge, Button, Grid} from '@chakra-ui/react';
import {LuArrowUpRight, LuArrowDownRight, LuShuffle, LuGift, LuTriangleAlert} from 'react-icons/lu';
import {
    useAssets,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssetPrice,
    formatUsdAmount,
    truncateAddress,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import {ValidatorWithDelegation} from '@/hooks/useNativeStakingData';
import {useState, useMemo} from 'react';
import {DelegateModal} from './delegate-modal';
import {UndelegateModal} from './undelegate-modal';
import {RedelegateModal} from './redelegate-modal';
import {ClaimRewardsModal, ValidatorRewardEntry} from './claim-rewards-modal';
import {ValidatorAvatar} from './validator-avatar';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {BondStatus, bondStatusFromJSON} from '@bze/bzejs/cosmos/staking/v1beta1/staking';

interface MyValidatorsProps {
    myValidators: ValidatorWithDelegation[];
    allValidators: ValidatorSDKType[];
    onActionComplete: () => void;
    logos: Record<string, string>;
}

type ModalType = 'delegate' | 'undelegate' | 'redelegate' | 'claim' | null;

function isValidatorActive(validator: ValidatorSDKType): boolean {
    return bondStatusFromJSON(validator.status) === BondStatus.BOND_STATUS_BONDED;
}

export function MyValidators({myValidators, allValidators, onActionComplete, logos}: MyValidatorsProps) {
    const {nativeAsset} = useAssets();
    const {price: bzePrice} = useAssetPrice(nativeAsset?.denom ?? '');
    const decimals = nativeAsset?.decimals ?? 6;
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [selectedValidator, setSelectedValidator] = useState<ValidatorWithDelegation | null>(null);

    const rewardEntries: ValidatorRewardEntry[] = useMemo(() =>
        myValidators.map(item => ({
            validatorAddress: item.validator.operator_address,
            moniker: item.validator.description?.moniker ?? '',
            rewards: item.rewards,
            logoUrl: logos[item.validator.operator_address],
        })),
        [myValidators, logos]
    );

    if (myValidators.length === 0) {
        return null;
    }

    const openModal = (modal: ModalType, validator?: ValidatorWithDelegation) => {
        if (validator) setSelectedValidator(validator);
        setActiveModal(modal);
    };

    const closeModal = () => {
        setActiveModal(null);
    };

    const handleActionComplete = () => {
        setActiveModal(null);
        onActionComplete();
    };

    const totalRewards = myValidators.reduce((sum, v) => sum.plus(v.rewards), new BigNumber(0));
    const totalRewardsHuman = uAmountToBigNumberAmount(totalRewards, decimals);
    const hasClaimableRewards = totalRewardsHuman.gt(0.0001);

    return (
        <Container maxW="7xl" py="2">
            <VStack align="stretch" gap="4">
                <HStack justify="space-between" align="center">
                    <Text fontSize="lg" fontWeight="bold">
                        My Validators
                    </Text>
                    {hasClaimableRewards && (
                        <Button
                            size="sm"
                            colorPalette="purple"
                            variant="subtle"
                            onClick={() => openModal('claim')}
                        >
                            <LuGift /> Claim All ({prettyAmount(totalRewardsHuman)} {nativeAsset?.ticker})
                        </Button>
                    )}
                </HStack>

                <Grid templateColumns={{base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)'}} gap="4">
                    {myValidators.map((item) => {
                        const delegatedAmount = new BigNumber(item.delegation?.balance?.amount ?? '0');
                        const delegatedHuman = uAmountToBigNumberAmount(delegatedAmount, decimals);
                        const delegatedUsd = bzePrice ? delegatedHuman.multipliedBy(bzePrice) : new BigNumber(0);
                        const rewardsHuman = uAmountToBigNumberAmount(item.rewards, decimals);
                        const commission = new BigNumber(item.validator.commission?.commission_rates?.rate ?? '0')
                            .multipliedBy(100)
                            .decimalPlaces(1)
                            .toString();

                        const isInactive = !isValidatorActive(item.validator);

                        return (
                            <Box
                                key={item.validator.operator_address}
                                bg="bg.panel"
                                borderWidth={isInactive ? '2px' : '1px'}
                                borderColor={isInactive ? 'red.500/40' : 'purple.500/15'}
                                borderRadius="lg"
                                p="5"
                                transition="all 0.2s"
                                _hover={{borderColor: isInactive ? 'red.500/60' : 'purple.500/30', shadow: 'md'}}
                            >
                                <VStack align="stretch" gap="4">
                                    <HStack justify="space-between">
                                        <HStack gap="3">
                                            <ValidatorAvatar
                                                src={logos[item.validator.operator_address]}
                                                name={item.validator.description?.moniker}
                                                size="36px"
                                            />
                                            <VStack align="start" gap="0">
                                                <Text fontWeight="bold" fontSize="sm" lineClamp={1}>
                                                    {item.validator.description?.moniker || truncateAddress(item.validator.operator_address)}
                                                </Text>
                                                <Text fontSize="xs" color="fg.muted">
                                                    Commission: {commission}%
                                                </Text>
                                            </VStack>
                                        </HStack>
                                        {item.validator.jailed && (
                                            <Badge colorPalette="red" size="sm">Jailed</Badge>
                                        )}
                                    </HStack>

                                    {!isValidatorActive(item.validator) && (
                                        <Box
                                            bg="red.500/10"
                                            borderWidth="1px"
                                            borderColor="red.500/30"
                                            borderRadius="md"
                                            p="3"
                                        >
                                            <HStack gap="2" align="start">
                                                <Box color="red.500" mt="0.5">
                                                    <LuTriangleAlert size={16} />
                                                </Box>
                                                <VStack align="start" gap="1">
                                                    <Text fontSize="xs" fontWeight="bold" color="red.500">
                                                        Not Earning Rewards
                                                    </Text>
                                                    <Text fontSize="xs" color="fg.muted">
                                                        This validator is {item.validator.jailed ? 'jailed' : item.validator.status === BondStatus.BOND_STATUS_UNBONDING ? 'unbonding' : 'inactive'} and not producing rewards. Redelegate to an active validator to continue earning.
                                                    </Text>
                                                    <Button
                                                        size="xs"
                                                        colorPalette="red"
                                                        variant="solid"
                                                        onClick={() => openModal('redelegate', item)}
                                                        mt="1"
                                                    >
                                                        <LuShuffle /> Redelegate Now
                                                    </Button>
                                                </VStack>
                                            </HStack>
                                        </Box>
                                    )}

                                    <VStack align="start" gap="1">
                                        <HStack justify="space-between" w="full">
                                            <Text fontSize="xs" color="fg.muted">Delegated</Text>
                                            <Text fontSize="sm" fontWeight="semibold">
                                                {prettyAmount(delegatedHuman)} {nativeAsset?.ticker}
                                            </Text>
                                        </HStack>
                                        {delegatedUsd.gt(0) && (
                                            <Text fontSize="xs" color="fg.muted" alignSelf="end">
                                                ~{formatUsdAmount(delegatedUsd)}
                                            </Text>
                                        )}
                                        {rewardsHuman.gt(0.0001) && (
                                            <HStack justify="space-between" w="full">
                                                <Text fontSize="xs" color="fg.muted">Rewards</Text>
                                                <Text fontSize="sm" fontWeight="semibold" color="purple.500">
                                                    +{prettyAmount(rewardsHuman)} {nativeAsset?.ticker}
                                                </Text>
                                            </HStack>
                                        )}
                                    </VStack>

                                    <HStack gap="2" flexWrap="wrap">
                                        <Button
                                            size="xs"
                                            colorPalette="purple"
                                            variant="subtle"
                                            onClick={() => openModal('delegate', item)}
                                            flex="1"
                                        >
                                            <LuArrowUpRight /> Delegate
                                        </Button>
                                        <Button
                                            size="xs"
                                            colorPalette="orange"
                                            variant="subtle"
                                            onClick={() => openModal('undelegate', item)}
                                            flex="1"
                                        >
                                            <LuArrowDownRight /> Undelegate
                                        </Button>
                                        <Button
                                            size="xs"
                                            colorPalette="blue"
                                            variant="subtle"
                                            onClick={() => openModal('redelegate', item)}
                                            flex="1"
                                        >
                                            <LuShuffle /> Redelegate
                                        </Button>
                                    </HStack>
                                </VStack>
                            </Box>
                        );
                    })}
                </Grid>
            </VStack>

            {/* Modals — always rendered, controlled by isOpen */}
            <DelegateModal
                isOpen={activeModal === 'delegate'}
                onClose={closeModal}
                validator={selectedValidator?.validator ?? null}
                onSuccess={handleActionComplete}
            />
            <UndelegateModal
                isOpen={activeModal === 'undelegate'}
                onClose={closeModal}
                validator={selectedValidator?.validator ?? null}
                delegatedAmount={new BigNumber(selectedValidator?.delegation?.balance?.amount ?? '0')}
                onSuccess={handleActionComplete}
            />
            <RedelegateModal
                isOpen={activeModal === 'redelegate'}
                onClose={closeModal}
                sourceValidator={selectedValidator?.validator ?? null}
                allValidators={allValidators}
                delegatedAmount={new BigNumber(selectedValidator?.delegation?.balance?.amount ?? '0')}
                onSuccess={handleActionComplete}
                logos={logos}
            />
            <ClaimRewardsModal
                isOpen={activeModal === 'claim'}
                onClose={closeModal}
                rewardEntries={rewardEntries}
                onSuccess={handleActionComplete}
            />
        </Container>
    );
}
