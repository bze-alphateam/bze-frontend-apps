'use client';

import {Button, chakra, Flex, Grid} from '@chakra-ui/react';
import {LuArrowUpRight, LuArrowDownRight, LuShuffle, LuGift} from 'react-icons/lu';
import {
    useAssets,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssetPrice,
    formatUsdAmount,
    truncateAddress,
    HgCard,
    hgVariant,
    Notice,
    StatusPill,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import {ValidatorWithDelegation} from '@/hooks/useNativeStakingData';
import {useState, useMemo, type ReactNode} from 'react';
import {InfoRow, neutralButton, SectionHeader, softButton} from '@/components/ui/staking/parts';
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
    unbondingDays?: string;
    /** Buttons before Claim All (Refresh). */
    actions?: ReactNode;
}

type ModalType = 'delegate' | 'undelegate' | 'redelegate' | 'claim' | null;

function isValidatorActive(validator: ValidatorSDKType): boolean {
    return bondStatusFromJSON(validator.status) === BondStatus.BOND_STATUS_BONDED;
}

export function MyValidators({myValidators, allValidators, onActionComplete, logos, unbondingDays, actions}: MyValidatorsProps) {
    const {nativeAsset} = useAssets();
    const {price: bzePrice} = useAssetPrice(nativeAsset?.denom ?? '');
    const decimals = nativeAsset?.decimals ?? 6;
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [selectedValidator, setSelectedValidator] = useState<ValidatorWithDelegation | null>(null);
    // Bumped on each open so the modals remount with fresh local state (replaces the
    // former reset-on-close effects inside each modal).
    const [modalNonce, setModalNonce] = useState(0);

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
        setModalNonce(n => n + 1);
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
        <Flex as="section" direction="column" gap={{base: '12px', md: '16px'}}>
            <SectionHeader
                title="My Validators"
                actions={(actions || hasClaimableRewards) && (
                    <>
                        {actions}
                        {hasClaimableRewards && (
                            <Button size="md" {...softButton} borderRadius="hg.md" onClick={() => openModal('claim')}>
                                <LuGift /> Claim All ({prettyAmount(totalRewardsHuman)} {nativeAsset?.ticker})
                            </Button>
                        )}
                    </>
                )}
            />

            <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(auto-fill, minmax(340px, 1fr))'}} gap={{base: '12px', md: '16px'}}>
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
                        <HgCard
                            key={item.validator.operator_address}
                            borderColor={isInactive ? 'hg.danger/45' : 'app.subtle'}
                            p={{base: '16px', md: '20px'}}
                            display="flex"
                            flexDirection="column"
                            gap={{base: '14px', md: '16px'}}
                            minW="0"
                        >
                            <Flex justify="space-between" align="center" gap="10px">
                                <Flex align="center" gap="12px" minW="0">
                                    <ValidatorAvatar
                                        src={logos[item.validator.operator_address]}
                                        name={item.validator.description?.moniker}
                                        size="36px"
                                    />
                                    <Flex direction="column" minW="0">
                                        <chakra.strong fontSize="15px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                            {item.validator.description?.moniker || truncateAddress(item.validator.operator_address)}
                                        </chakra.strong>
                                        <chakra.span fontSize="12px" color="hg.text.faint">
                                            Commission: {commission}%
                                        </chakra.span>
                                    </Flex>
                                </Flex>
                                {item.validator.jailed && <StatusPill tone="danger">Jailed</StatusPill>}
                            </Flex>

                            {isInactive && (
                                <Notice status="danger" title="Not Earning Rewards">
                                    This validator is {item.validator.jailed ? 'jailed' : item.validator.status === BondStatus.BOND_STATUS_UNBONDING ? 'unbonding' : 'inactive'} and not producing rewards. Redelegate to an active validator to continue earning.
                                    <Button
                                        display="flex"
                                        size="sm"
                                        variant={hgVariant('danger')}
                                        onClick={() => openModal('redelegate', item)}
                                        mt="8px"
                                    >
                                        <LuShuffle /> Redelegate Now
                                    </Button>
                                </Notice>
                            )}

                            <Flex direction="column" gap="6px">
                                <InfoRow label="Delegated">
                                    <chakra.strong fontSize="14px">{prettyAmount(delegatedHuman)} {nativeAsset?.ticker}</chakra.strong>
                                </InfoRow>
                                {delegatedUsd.gt(0) && (
                                    <chakra.span fontSize="12px" color="hg.text.faint" alignSelf="flex-end">
                                        ~{formatUsdAmount(delegatedUsd)}
                                    </chakra.span>
                                )}
                                {rewardsHuman.gt(0.0001) && (
                                    <InfoRow label="Rewards">
                                        <chakra.strong fontSize="14px" color="hg.accent">
                                            +{prettyAmount(rewardsHuman)} {nativeAsset?.ticker}
                                        </chakra.strong>
                                    </InfoRow>
                                )}
                            </Flex>

                            <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap="8px">
                                <Button size={{base: 'lg', md: 'sm'}} {...softButton} onClick={() => openModal('delegate', item)}>
                                    <LuArrowUpRight /> Delegate
                                </Button>
                                <Button size={{base: 'lg', md: 'sm'}} {...neutralButton} onClick={() => openModal('undelegate', item)}>
                                    <LuArrowDownRight /> Undelegate
                                </Button>
                                <Button size={{base: 'lg', md: 'sm'}} {...neutralButton} onClick={() => openModal('redelegate', item)}>
                                    <LuShuffle /> Redelegate
                                </Button>
                            </Grid>
                        </HgCard>
                    );
                })}
            </Grid>

            {/* Modals — always rendered, controlled by isOpen */}
            <DelegateModal
                key={`delegate-${modalNonce}`}
                isOpen={activeModal === 'delegate'}
                onClose={closeModal}
                validator={selectedValidator?.validator ?? null}
                onSuccess={handleActionComplete}
            />
            <UndelegateModal
                key={`undelegate-${modalNonce}`}
                isOpen={activeModal === 'undelegate'}
                onClose={closeModal}
                validator={selectedValidator?.validator ?? null}
                delegatedAmount={new BigNumber(selectedValidator?.delegation?.balance?.amount ?? '0')}
                onSuccess={handleActionComplete}
                unbondingDays={unbondingDays}
            />
            <RedelegateModal
                key={`redelegate-${modalNonce}`}
                isOpen={activeModal === 'redelegate'}
                onClose={closeModal}
                sourceValidator={selectedValidator?.validator ?? null}
                allValidators={allValidators}
                delegatedAmount={new BigNumber(selectedValidator?.delegation?.balance?.amount ?? '0')}
                onSuccess={handleActionComplete}
                logos={logos}
            />
            <ClaimRewardsModal
                key={`claim-${modalNonce}`}
                isOpen={activeModal === 'claim'}
                onClose={closeModal}
                rewardEntries={rewardEntries}
                onSuccess={handleActionComplete}
            />
        </Flex>
    );
}
