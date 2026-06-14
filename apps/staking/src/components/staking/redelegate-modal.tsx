'use client';

import {useState, useMemo, useEffect} from 'react';
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
    truncateAddress,
} from '@bze/bze-ui-kit';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {LuSearch, LuWallet} from 'react-icons/lu';
import {ValidatorAvatar} from './validator-avatar';

interface RedelegateModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceValidator: ValidatorSDKType | null;
    allValidators: ValidatorSDKType[];
    delegatedAmount: BigNumber;
    onSuccess: () => void;
    logos?: Record<string, string>;
}

export function RedelegateModal({isOpen, onClose, sourceValidator, allValidators, delegatedAmount, onSuccess, logos = {}}: RedelegateModalProps) {
    const {nativeAsset} = useAssets();
    const {address, status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [destValidator, setDestValidator] = useState<ValidatorSDKType | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setAmount('');
            setIsSubmitting(false);
            setDestValidator(null);
            setSearch('');
        }
    }, [isOpen]);

    const decimals = nativeAsset?.decimals ?? 6;
    const delegatedHuman = uAmountToBigNumberAmount(delegatedAmount, decimals);

    const filteredValidators = useMemo(() => {
        return allValidators
            .filter(v => v.operator_address !== sourceValidator?.operator_address)
            .filter(v => {
                if (!search) return true;
                return (v.description?.moniker?.toLowerCase() ?? '').includes(search.toLowerCase());
            })
            .sort((a, b) => new BigNumber(a.tokens).minus(new BigNumber(b.tokens)).toNumber());
    }, [allValidators, sourceValidator, search]);

    const handleRedelegate = async () => {
        if (!address || !sourceValidator || !amount || new BigNumber(amount).lte(0) || !destValidator) {
            toast.error('Invalid input', 'Please select a destination validator and enter an amount');
            return;
        }

        const uAmount = amountToUAmount(amount, decimals);
        if (new BigNumber(uAmount).gt(delegatedAmount)) {
            toast.error('Exceeds delegation', 'Amount exceeds your delegated balance');
            return;
        }

        setIsSubmitting(true);
        try {
            const {beginRedelegate} = cosmos.staking.v1beta1.MessageComposer.withTypeUrl;
            const msg = beginRedelegate({
                delegatorAddress: address,
                validatorSrcAddress: sourceValidator.operator_address,
                validatorDstAddress: destValidator.operator_address,
                amount: {
                    denom: getChainNativeAssetDenom(),
                    amount: uAmount,
                },
            });

            const success = await tx([msg]);
            if (success) {
                toast.success('Redelegation started', `Redelegated ${amount} ${nativeAsset?.ticker} to ${destValidator.description?.moniker}`);
                onSuccess();
            }
        } catch (e) {
            console.error('Redelegate failed:', e);
            toast.error('Redelegation failed', 'Transaction failed. Please try again.');
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
                    <Dialog.Content maxW="lg" p="6">
                        <Dialog.Header pb="4">
                            <Dialog.Title>Redelegate from {sourceValidator?.description?.moniker}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="4" align="stretch">
                                {/* Destination Validator Selection */}
                                <VStack align="stretch" gap="2">
                                    <Text fontSize="sm" fontWeight="medium">Destination Validator</Text>
                                    {destValidator ? (
                                        <HStack justify="space-between" bg="blue.500/5" p="3" borderRadius="md" borderWidth="1px" borderColor="blue.500/15">
                                            <HStack gap="2">
                                                <ValidatorAvatar
                                                    src={logos[destValidator.operator_address]}
                                                    name={destValidator.description?.moniker}
                                                    size="24px"
                                                />
                                                <Text fontSize="sm" fontWeight="semibold">
                                                    {destValidator.description?.moniker || truncateAddress(destValidator.operator_address)}
                                                </Text>
                                            </HStack>
                                            <Button size="xs" variant="ghost" onClick={() => setDestValidator(null)}>Change</Button>
                                        </HStack>
                                    ) : (
                                        <VStack align="stretch" gap="2">
                                            <Box position="relative">
                                                <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color="fg.muted">
                                                    <LuSearch size={14} />
                                                </Box>
                                                <Input
                                                    pl="9"
                                                    placeholder="Search validators..."
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                    size="sm"
                                                />
                                            </Box>
                                            <Box maxH="300px" overflowY="auto" borderWidth="1px" borderRadius="md">
                                                {filteredValidators.map(v => (
                                                    <Box
                                                        key={v.operator_address}
                                                        px="3"
                                                        py="2"
                                                        cursor="pointer"
                                                        _hover={{bg: 'purple.500/5'}}
                                                        onClick={() => {
                                                            setDestValidator(v);
                                                            setSearch('');
                                                        }}
                                                        borderBottomWidth="1px"
                                                    >
                                                        <HStack justify="space-between">
                                                            <HStack gap="2">
                                                                <ValidatorAvatar
                                                                    src={logos[v.operator_address]}
                                                                    name={v.description?.moniker}
                                                                    size="24px"
                                                                />
                                                                <Text fontSize="sm">{v.description?.moniker || truncateAddress(v.operator_address)}</Text>
                                                            </HStack>
                                                            <Text fontSize="xs" color="fg.muted">
                                                                {new BigNumber(v.commission?.commission_rates?.rate ?? '0').multipliedBy(100).decimalPlaces(1).toString()}% commission
                                                            </Text>
                                                        </HStack>
                                                    </Box>
                                                ))}
                                            </Box>
                                        </VStack>
                                    )}
                                </VStack>

                                {/* Amount Input */}
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
                                        colorPalette="blue"
                                        w="full"
                                        onClick={() => { onClose(); connect(); }}
                                    >
                                        <LuWallet /> Connect Wallet
                                    </Button>
                                ) : (
                                    <Button
                                        colorPalette="blue"
                                        onClick={handleRedelegate}
                                        loading={isSubmitting}
                                        disabled={!amount || new BigNumber(amount).lte(0) || !address || !destValidator}
                                        w="full"
                                    >
                                        Redelegate {amount ? `${amount} ${nativeAsset?.ticker}` : ''}
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
