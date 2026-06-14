'use client';

import {useState, useEffect} from 'react';
import {Box, Button, HStack, Input, Text, VStack, Dialog, Portal} from '@chakra-ui/react';
import {
    useAssets,
    useSDKTx,
    useToast,
    getChainNativeAssetDenom,
    prettyAmount,
    uAmountToBigNumberAmount,
    amountToUAmount,
    sanitizeNumberInput,
    getChainName,
} from '@bze/bze-ui-kit';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {LuTriangleAlert, LuWallet} from 'react-icons/lu';

interface UndelegateModalProps {
    isOpen: boolean;
    onClose: () => void;
    validator: ValidatorSDKType | null;
    delegatedAmount: BigNumber;
    onSuccess: () => void;
}

export function UndelegateModal({isOpen, onClose, validator, delegatedAmount, onSuccess}: UndelegateModalProps) {
    const {nativeAsset} = useAssets();
    const {address, status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setAmount('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const decimals = nativeAsset?.decimals ?? 6;
    const delegatedHuman = uAmountToBigNumberAmount(delegatedAmount, decimals);

    const handleUndelegate = async () => {
        if (!address || !validator || !amount || new BigNumber(amount).lte(0)) {
            toast.error('Invalid amount', 'Please enter a valid amount to undelegate');
            return;
        }

        const uAmount = amountToUAmount(amount, decimals);
        if (new BigNumber(uAmount).gt(delegatedAmount)) {
            toast.error('Exceeds delegation', 'Amount exceeds your delegated balance');
            return;
        }

        setIsSubmitting(true);
        try {
            const {undelegate} = cosmos.staking.v1beta1.MessageComposer.withTypeUrl;
            const msg = undelegate({
                delegatorAddress: address,
                validatorAddress: validator.operator_address,
                amount: {
                    denom: getChainNativeAssetDenom(),
                    amount: uAmount,
                },
            });

            const success = await tx([msg]);
            if (success) {
                toast.success('Undelegation started', `Undelegating ${amount} ${nativeAsset?.ticker} from ${validator.description?.moniker}`);
                onSuccess();
            }
        } catch (e) {
            console.error('Undelegate failed:', e);
            toast.error('Undelegation failed', 'Transaction failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const setQuickAmount = (fraction: number) => {
        const val = delegatedHuman.multipliedBy(fraction).decimalPlaces(decimals).toString();
        setAmount(val);
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !isSubmitting && !e.open && onClose()}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md" p="6">
                        <Dialog.Header pb="4">
                            <Dialog.Title>Undelegate from {validator?.description?.moniker}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="4" align="stretch">
                                <Box bg="orange.500/10" p="3" borderRadius="md" borderWidth="1px" borderColor="orange.500/20">
                                    <HStack gap="2">
                                        <Box color="orange.500"><LuTriangleAlert size={16} /></Box>
                                        <Text fontSize="xs" color="fg.muted">
                                            Undelegated tokens will be locked for the unbonding period before becoming available.
                                        </Text>
                                    </HStack>
                                </Box>

                                <VStack align="stretch" gap="2">
                                    <HStack justify="space-between">
                                        <Text fontSize="sm" fontWeight="medium">Amount</Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            Delegated: {prettyAmount(delegatedHuman)} {nativeAsset?.ticker}
                                        </Text>
                                    </HStack>
                                    <Input
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(sanitizeNumberInput(e.target.value))}
                                        type="text"
                                        disabled={!isConnected}
                                    />
                                    <HStack gap="2">
                                        <Button size="xs" variant="outline" onClick={() => setQuickAmount(0.25)} disabled={!isConnected}>25%</Button>
                                        <Button size="xs" variant="outline" onClick={() => setQuickAmount(0.5)} disabled={!isConnected}>50%</Button>
                                        <Button size="xs" variant="outline" onClick={() => setQuickAmount(0.75)} disabled={!isConnected}>75%</Button>
                                        <Button size="xs" variant="outline" onClick={() => setQuickAmount(1)} disabled={!isConnected}>Max</Button>
                                    </HStack>
                                </VStack>

                                {progressTrack && (
                                    <Text fontSize="xs" color="fg.muted" textAlign="center">{progressTrack}</Text>
                                )}

                                {!isConnected ? (
                                    <Button
                                        colorPalette="orange"
                                        w="full"
                                        onClick={() => { onClose(); connect(); }}
                                    >
                                        <LuWallet /> Connect Wallet
                                    </Button>
                                ) : (
                                    <Button
                                        colorPalette="orange"
                                        onClick={handleUndelegate}
                                        loading={isSubmitting}
                                        disabled={!amount || new BigNumber(amount).lte(0) || !address}
                                        w="full"
                                    >
                                        Undelegate {amount ? `${amount} ${nativeAsset?.ticker}` : ''}
                                    </Button>
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
