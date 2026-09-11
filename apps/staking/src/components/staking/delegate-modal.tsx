'use client';

import {useState, useMemo} from 'react';
import {Box, Button, HStack, Input, Text, VStack, Dialog, Portal} from '@chakra-ui/react';
import {LuTriangleAlert, LuWallet} from 'react-icons/lu';
import {
    useAssets,
    useBalance,
    useMaxSpendable,
    useSDKTx,
    useToast,
    getChainNativeAssetDenom,
    prettyAmount,
    uAmountToBigNumberAmount,
    amountToUAmount,
    sanitizeNumberInput,
} from '@bze/bze-ui-kit';
import {
    validateDelegationAmount,
    exceedsSpendable as computeExceedsSpendable,
    quickAmount,
} from '@/lib/delegate-amount';
import {formatCommissionRate} from '@/lib/validator-list';
import {useChain} from '@interchain-kit/react';
import {getChainName} from '@bze/bze-ui-kit';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';

interface DelegateModalProps {
    isOpen: boolean;
    onClose: () => void;
    validator: ValidatorSDKType | null;
    onSuccess: () => void;
}

export function DelegateModal({isOpen, onClose, validator, onSuccess}: DelegateModalProps) {
    const {nativeAsset} = useAssets();
    const {balance} = useBalance(getChainNativeAssetDenom());
    const {address, status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const decimals = nativeAsset?.decimals ?? 6;
    const availableHuman = uAmountToBigNumberAmount(balance.amount, decimals);
    // Shared gas engine: the balance minus the estimated delegate gas fee (BZE is both the
    // delegated coin and, by default, the fee coin).
    const maxSpendable = useMaxSpendable(getChainNativeAssetDenom(), 'delegate');
    const spendableHuman = maxSpendable.displayAmount;
    const commission = formatCommissionRate(validator?.commission?.commission_rates?.rate);

    const handleDelegate = async () => {
        if (!address || !validator) {
            toast.error('Invalid amount', 'Please enter a valid amount to delegate');
            return;
        }

        const amountError = validateDelegationAmount(amount, balance.amount, decimals, maxSpendable.amount);
        if (amountError) {
            if (amountError === 'insufficient-balance') {
                toast.error('Insufficient balance', 'You do not have enough tokens');
            } else if (amountError === 'no-fee-reserve') {
                toast.error('Not enough left for fees', `Keep ≈ ${prettyAmount(maxSpendable.gasFee.displayAmount)} ${maxSpendable.gasFee.ticker} for the network fee.`);
            } else {
                toast.error('Invalid amount', 'Please enter a valid amount to delegate');
            }
            return;
        }

        const uAmount = amountToUAmount(amount, decimals);

        setIsSubmitting(true);
        try {
            const {delegate} = cosmos.staking.v1beta1.MessageComposer.withTypeUrl;
            const msg = delegate({
                delegatorAddress: address,
                validatorAddress: validator.operator_address,
                amount: {
                    denom: getChainNativeAssetDenom(),
                    amount: uAmount,
                },
            });

            const success = await tx([msg]);
            if (success) {
                toast.success('Delegation successful', `Delegated ${amount} ${nativeAsset?.ticker} to ${validator.description?.moniker}`);
                onSuccess();
            }
        } catch (e) {
            console.error('Delegate failed:', e);
            toast.error('Delegation failed', 'Transaction failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const exceedsSpendable = useMemo(
        () => computeExceedsSpendable(amount, spendableHuman, availableHuman),
        [amount, spendableHuman, availableHuman],
    );

    // Quick amounts are fractions of the spendable balance, so 100 % (Max) already keeps
    // the gas fee back.
    const setQuickAmount = (fraction: number) => {
        setAmount(quickAmount(spendableHuman, fraction, decimals));
    };

    const useSpendableMax = () => {
        setAmount(maxSpendable.inputValue);
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !isSubmitting && !e.open && onClose()}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md" p="6">
                        <Dialog.Header pb="4">
                            <Dialog.Title>Delegate to {validator?.description?.moniker}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="4" align="stretch">
                                <Box bg="purple.500/5" p="3" borderRadius="md" borderWidth="1px" borderColor="purple.500/15">
                                    <HStack justify="space-between" fontSize="sm">
                                        <Text color="fg.muted">Commission</Text>
                                        <Text fontWeight="semibold">{commission}%</Text>
                                    </HStack>
                                </Box>

                                <VStack align="stretch" gap="2">
                                    <HStack justify="space-between">
                                        <Text fontSize="sm" fontWeight="medium">Amount</Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            Available: {prettyAmount(availableHuman)} {nativeAsset?.ticker}
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

                                {exceedsSpendable && (
                                    <Box bg="orange.500/10" p="3" borderRadius="md" borderWidth="1px" borderColor="orange.500/20">
                                        <HStack gap="2" align="start">
                                            <Box color="orange.500" mt="0.5"><LuTriangleAlert size={14} /></Box>
                                            <VStack align="stretch" gap="2" flex="1">
                                                <Text fontSize="xs" color="fg.muted">
                                                    This amount leaves less than the network fee
                                                    (≈ {prettyAmount(maxSpendable.gasFee.displayAmount)} {maxSpendable.gasFee.ticker}) in your wallet,
                                                    so the transaction would fail.
                                                </Text>
                                                {maxSpendable.amount.gt(0) && (
                                                    <Button
                                                        size="xs"
                                                        variant="outline"
                                                        colorPalette="orange"
                                                        onClick={useSpendableMax}
                                                        alignSelf="start"
                                                    >
                                                        Delegate {prettyAmount(spendableHuman)} {nativeAsset?.ticker} instead
                                                    </Button>
                                                )}
                                            </VStack>
                                        </HStack>
                                    </Box>
                                )}

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
                                    <Button
                                        colorPalette="purple"
                                        onClick={handleDelegate}
                                        loading={isSubmitting}
                                        disabled={!amount || new BigNumber(amount).lte(0) || !address || exceedsSpendable}
                                        w="full"
                                    >
                                        Delegate {amount ? `${amount} ${nativeAsset?.ticker}` : ''}
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
