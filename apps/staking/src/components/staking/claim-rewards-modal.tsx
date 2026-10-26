'use client';

import {useState, useMemo, type ReactNode} from 'react';
import {Box, Button, chakra, Flex, Grid} from '@chakra-ui/react';
import {
    useAssets,
    useSDKTx,
    useCanAffordTx,
    useToast,
    prettyAmount,
    uAmountToBigNumberAmount,
    getChainName,
    useAssetPrice,
    formatUsdAmount,
    truncateAddress,
    FeaturedCard,
    hgVariant,
    IconTile,
} from '@bze/bze-ui-kit';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import {LuGift, LuCheck, LuWallet} from 'react-icons/lu';
import {ValidatorAvatar} from './validator-avatar';
import {ProgressLine, StakingDialog} from '@/components/ui/staking/dialog';

export interface ValidatorRewardEntry {
    validatorAddress: string;
    moniker: string;
    rewards: BigNumber;
    logoUrl?: string;
}

interface ClaimRewardsModalProps {
    isOpen: boolean;
    onClose: () => void;
    rewardEntries: ValidatorRewardEntry[];
    onSuccess: () => void;
}

export function ClaimRewardsModal({isOpen, onClose, rewardEntries, onSuccess}: ClaimRewardsModalProps) {
    const {nativeAsset} = useAssets();
    const {address, status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const {price: bzePrice} = useAssetPrice(nativeAsset?.denom ?? '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const decimals = nativeAsset?.decimals ?? 6;

    // Filter to entries with actual claimable rewards
    const claimableEntries = useMemo(() =>
        rewardEntries.filter(e => uAmountToBigNumberAmount(e.rewards, decimals).gt(0.0001)),
        [rewardEntries, decimals]
    );

    // Select all claimable validators by default. The parent remounts this modal via a
    // `key` prop on each open, so this initializer re-runs and reselects all every time.
    const [selectedValidators, setSelectedValidators] = useState<Set<string>>(
        () => new Set(claimableEntries.map(e => e.validatorAddress))
    );

    const selectedRewardsTotal = useMemo(() => {
        return claimableEntries
            .filter(e => selectedValidators.has(e.validatorAddress))
            .reduce((sum, e) => sum.plus(e.rewards), new BigNumber(0));
    }, [claimableEntries, selectedValidators]);

    const selectedRewardsHuman = uAmountToBigNumberAmount(selectedRewardsTotal, decimals);
    const selectedRewardsUsd = bzePrice ? selectedRewardsHuman.multipliedBy(bzePrice) : new BigNumber(0);

    const allSelected = claimableEntries.length > 0 && selectedValidators.size === claimableEntries.length;

    // One MsgWithdrawDelegatorReward per selected validator — the gas grows with the count,
    // and the wallet (not the rewards) must hold the fee.
    const feeCheck = useCanAffordTx({
        spec: isConnected && selectedValidators.size > 0
            ? {kind: 'withdraw-delegator-reward', count: selectedValidators.size}
            : undefined,
    });

    const toggleValidator = (validatorAddress: string) => {
        setSelectedValidators(prev => {
            const next = new Set(prev);
            if (next.has(validatorAddress)) {
                next.delete(validatorAddress);
            } else {
                next.add(validatorAddress);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (allSelected) {
            setSelectedValidators(new Set());
        } else {
            setSelectedValidators(new Set(claimableEntries.map(e => e.validatorAddress)));
        }
    };

    const handleClaim = async () => {
        if (!address || selectedValidators.size === 0) {
            toast.error('No validators selected', 'Please select at least one validator to claim from');
            return;
        }
        if (!feeCheck.canAfford) {
            toast.error('Not enough for the network fee', feeCheck.message);
            return;
        }

        setIsSubmitting(true);
        try {
            const {withdrawDelegatorReward} = cosmos.distribution.v1beta1.MessageComposer.withTypeUrl;
            const messages = Array.from(selectedValidators).map(validatorAddr =>
                withdrawDelegatorReward({
                    delegatorAddress: address,
                    validatorAddress: validatorAddr,
                })
            );

            const success = await tx(messages);
            if (success) {
                toast.success('Rewards claimed!', `Claimed ${prettyAmount(selectedRewardsHuman)} ${nativeAsset?.ticker} from ${selectedValidators.size} validator${selectedValidators.size > 1 ? 's' : ''}`);
                onSuccess();
            }
        } catch (e) {
            console.error('Claim rewards failed:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <StakingDialog isOpen={isOpen} onClose={onClose} busy={isSubmitting} title="Claim Staking Rewards">
            {/* Total selected rewards */}
            <FeaturedCard p="18px" bg="hg.raised" display="flex" flexDirection="column" alignItems="center" gap="4px" textAlign="center">
                <Box mb="6px"><IconTile icon={<LuGift />} size={44} /></Box>
                <chakra.strong fontSize="24px">
                    {prettyAmount(selectedRewardsHuman)} {nativeAsset?.ticker}
                </chakra.strong>
                {selectedRewardsUsd.gt(0) && (
                    <chakra.span fontSize="12px" color="hg.text.faint">
                        ~{formatUsdAmount(selectedRewardsUsd)}
                    </chakra.span>
                )}
                <chakra.span fontSize="12px" color="hg.text.faint">
                    {selectedValidators.size} of {claimableEntries.length} validator{claimableEntries.length > 1 ? 's' : ''} selected
                </chakra.span>
            </FeaturedCard>

            {/* Select all toggle */}
            {claimableEntries.length > 1 && (
                <CheckRow checked={allSelected} onToggle={toggleAll}>
                    <chakra.span fontSize="14px" fontWeight="600">{allSelected ? 'Deselect All' : 'Select All'}</chakra.span>
                </CheckRow>
            )}

            {/* Validator list */}
            <Flex direction="column" gap="4px" maxH="250px" overflowY="auto" role="group" aria-label="Validators">
                {claimableEntries.map(entry => {
                    const rewardsHuman = uAmountToBigNumberAmount(entry.rewards, decimals);
                    const isSelected = selectedValidators.has(entry.validatorAddress);

                    return (
                        <CheckRow
                            key={entry.validatorAddress}
                            checked={isSelected}
                            onToggle={() => toggleValidator(entry.validatorAddress)}
                            aside={
                                <chakra.span fontSize="12px" fontWeight="600" color="hg.accent">
                                    +{prettyAmount(rewardsHuman)}
                                </chakra.span>
                            }
                        >
                            <Flex align="center" gap="8px" minW="0">
                                <ValidatorAvatar src={entry.logoUrl} name={entry.moniker} size="24px" />
                                <chakra.span fontSize="14px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                    {entry.moniker || truncateAddress(entry.validatorAddress)}
                                </chakra.span>
                            </Flex>
                        </CheckRow>
                    );
                })}
            </Flex>

            {feeCheck.message && (
                <chakra.span fontSize="12px" color="hg.danger.text" textAlign="center">{feeCheck.message}</chakra.span>
            )}

            <ProgressLine>{progressTrack}</ProgressLine>

            {!isConnected ? (
                <Button
                    variant={hgVariant('primary')}
                    size="lg"
                    w="full"
                    onClick={() => { onClose(); connect(); }}
                >
                    <LuWallet /> Connect Wallet
                </Button>
            ) : (
                <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="10px">
                    <Button
                        variant={hgVariant('secondary')}
                        size="lg"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant={hgVariant('primary')}
                        size="lg"
                        onClick={handleClaim}
                        loading={isSubmitting}
                        disabled={!address || selectedValidators.size === 0 || !feeCheck.canAfford}
                    >
                        Claim{selectedValidators.size > 0 ? ` (${selectedValidators.size})` : ''}
                    </Button>
                </Grid>
            )}
        </StakingDialog>
    );
}

interface CheckRowProps {
    checked: boolean;
    onToggle: () => void;
    children: ReactNode;
    /** Before the box: the row's rewards. */
    aside?: ReactNode;
}

/** A selectable row with the Staking check box on the right; selected rows take the app tint. */
function CheckRow({checked, onToggle, children, aside}: CheckRowProps) {
    return (
        <chakra.button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onToggle}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            gap="10px"
            w="full"
            px="12px"
            py="10px"
            borderRadius="hg.md"
            bg={checked ? 'app.subtle' : 'transparent'}
            color="fg"
            textAlign="start"
            cursor="pointer"
            transition="background 0.15s"
            _hover={{bg: checked ? 'app.muted' : 'hg.hoverFill'}}
            focusVisibleRing="inside"
        >
            {children}
            <Flex align="center" gap="12px" flex="none">
                {aside}
                <Flex
                    as="span"
                    aria-hidden
                    boxSize="18px"
                    borderRadius="5px"
                    borderWidth="2px"
                    borderColor={checked ? 'app.solid' : 'hg.text.faint'}
                    bg={checked ? 'app.solid' : 'transparent'}
                    color="hg.buttonText"
                    align="center"
                    justify="center"
                    transition="all 0.15s"
                >
                    {checked && <LuCheck size={12} />}
                </Flex>
            </Flex>
        </chakra.button>
    );
}
