'use client';

import {useState, useEffect, useMemo} from 'react';
import {Box, Button, HStack, Text, VStack, Dialog, Portal} from '@chakra-ui/react';
import {
    useAssets,
    useSDKTx,
    useToast,
    prettyAmount,
    uAmountToBigNumberAmount,
    getChainName,
    useAssetPrice,
    formatUsdAmount,
    truncateAddress,
} from '@bze/bze-ui-kit';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import {LuGift, LuCheck, LuWallet} from 'react-icons/lu';
import {ValidatorAvatar} from './validator-avatar';

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
    const [selectedValidators, setSelectedValidators] = useState<Set<string>>(new Set());

    const decimals = nativeAsset?.decimals ?? 6;

    // Filter to entries with actual claimable rewards
    const claimableEntries = useMemo(() =>
        rewardEntries.filter(e => uAmountToBigNumberAmount(e.rewards, decimals).gt(0.0001)),
        [rewardEntries, decimals]
    );

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            // Select all by default
            setSelectedValidators(new Set(claimableEntries.map(e => e.validatorAddress)));
            setIsSubmitting(false);
        }
    }, [isOpen, claimableEntries]);

    const selectedRewardsTotal = useMemo(() => {
        return claimableEntries
            .filter(e => selectedValidators.has(e.validatorAddress))
            .reduce((sum, e) => sum.plus(e.rewards), new BigNumber(0));
    }, [claimableEntries, selectedValidators]);

    const selectedRewardsHuman = uAmountToBigNumberAmount(selectedRewardsTotal, decimals);
    const selectedRewardsUsd = bzePrice ? selectedRewardsHuman.multipliedBy(bzePrice) : new BigNumber(0);

    const allSelected = claimableEntries.length > 0 && selectedValidators.size === claimableEntries.length;

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
        <Dialog.Root open={isOpen} onOpenChange={(e) => !isSubmitting && !e.open && onClose()}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md" p="6">
                        <Dialog.Header pb="4">
                            <Dialog.Title>Claim Staking Rewards</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="4" align="stretch">
                                {/* Total selected rewards */}
                                <Box
                                    bg="purple.500/5"
                                    p="4"
                                    borderRadius="lg"
                                    borderWidth="1px"
                                    borderColor="purple.500/20"
                                    textAlign="center"
                                >
                                    <VStack gap="1">
                                        <Box color="purple.500">
                                            <LuGift size={28} />
                                        </Box>
                                        <Text fontSize="xl" fontWeight="bold">
                                            {prettyAmount(selectedRewardsHuman)} {nativeAsset?.ticker}
                                        </Text>
                                        {selectedRewardsUsd.gt(0) && (
                                            <Text fontSize="xs" color="fg.muted">
                                                ~{formatUsdAmount(selectedRewardsUsd)}
                                            </Text>
                                        )}
                                        <Text fontSize="xs" color="fg.muted">
                                            {selectedValidators.size} of {claimableEntries.length} validator{claimableEntries.length > 1 ? 's' : ''} selected
                                        </Text>
                                    </VStack>
                                </Box>

                                {/* Select all toggle */}
                                {claimableEntries.length > 1 && (
                                    <Box
                                        px="3"
                                        py="2"
                                        cursor="pointer"
                                        borderRadius="md"
                                        bg={allSelected ? 'purple.500/10' : 'transparent'}
                                        _hover={{bg: allSelected ? 'purple.500/15' : 'bg.subtle'}}
                                        onClick={toggleAll}
                                        transition="all 0.15s"
                                    >
                                        <HStack justify="space-between">
                                            <Text fontSize="sm" fontWeight="semibold">
                                                {allSelected ? 'Deselect All' : 'Select All'}
                                            </Text>
                                            <Box
                                                w="18px"
                                                h="18px"
                                                borderRadius="sm"
                                                borderWidth="2px"
                                                borderColor={allSelected ? 'purple.500' : 'fg.muted'}
                                                bg={allSelected ? 'purple.500' : 'transparent'}
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                                transition="all 0.15s"
                                            >
                                                {allSelected && <LuCheck size={12} color="white" />}
                                            </Box>
                                        </HStack>
                                    </Box>
                                )}

                                {/* Validator list */}
                                <Box maxH="250px" overflowY="auto">
                                    <VStack gap="1" align="stretch">
                                        {claimableEntries.map(entry => {
                                            const rewardsHuman = uAmountToBigNumberAmount(entry.rewards, decimals);
                                            const isSelected = selectedValidators.has(entry.validatorAddress);

                                            return (
                                                <Box
                                                    key={entry.validatorAddress}
                                                    px="3"
                                                    py="2"
                                                    cursor="pointer"
                                                    borderRadius="md"
                                                    bg={isSelected ? 'purple.500/10' : 'transparent'}
                                                    _hover={{bg: isSelected ? 'purple.500/15' : 'bg.subtle'}}
                                                    onClick={() => toggleValidator(entry.validatorAddress)}
                                                    transition="all 0.15s"
                                                >
                                                    <HStack justify="space-between">
                                                        <HStack gap="2" flex="1" minW="0">
                                                            <ValidatorAvatar
                                                                src={entry.logoUrl}
                                                                name={entry.moniker}
                                                                size="28px"
                                                            />
                                                            <Text fontSize="sm" lineClamp={1}>
                                                                {entry.moniker || truncateAddress(entry.validatorAddress)}
                                                            </Text>
                                                        </HStack>
                                                        <HStack gap="3" flexShrink={0}>
                                                            <Text fontSize="xs" fontWeight="semibold" color="purple.500">
                                                                +{prettyAmount(rewardsHuman)}
                                                            </Text>
                                                            <Box
                                                                w="18px"
                                                                h="18px"
                                                                borderRadius="sm"
                                                                borderWidth="2px"
                                                                borderColor={isSelected ? 'purple.500' : 'fg.muted'}
                                                                bg={isSelected ? 'purple.500' : 'transparent'}
                                                                display="flex"
                                                                alignItems="center"
                                                                justifyContent="center"
                                                                transition="all 0.15s"
                                                            >
                                                                {isSelected && <LuCheck size={12} color="white" />}
                                                            </Box>
                                                        </HStack>
                                                    </HStack>
                                                </Box>
                                            );
                                        })}
                                    </VStack>
                                </Box>

                                {progressTrack && (
                                    <Text fontSize="xs" color="fg.muted" textAlign="center">{progressTrack}</Text>
                                )}

                                {!isConnected ? (
                                    <Button
                                        colorPalette="purple"
                                        w="full"
                                        onClick={() => { onClose(); connect(); }}
                                    >
                                        <LuWallet /> Connect Wallet
                                    </Button>
                                ) : (
                                    <HStack gap="3">
                                        <Button
                                            variant="outline"
                                            onClick={onClose}
                                            flex="1"
                                            disabled={isSubmitting}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            colorPalette="purple"
                                            onClick={handleClaim}
                                            loading={isSubmitting}
                                            disabled={!address || selectedValidators.size === 0}
                                            flex="1"
                                        >
                                            Claim{selectedValidators.size > 0 ? ` (${selectedValidators.size})` : ''}
                                        </Button>
                                    </HStack>
                                )}
                            </VStack>
                        </Dialog.Body>

                        <Dialog.CloseTrigger disabled={isSubmitting} />
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
