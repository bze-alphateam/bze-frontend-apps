'use client';

import {useState, useMemo} from 'react';
import {Box, Button, chakra, Flex, Input, InputGroup} from '@chakra-ui/react';
import {
    useAssets,
    useSDKTx,
    useCanAffordTx,
    useToast,
    getChainNativeAssetDenom,
    prettyAmount,
    uAmountToBigNumberAmount,
    amountToUAmount,
    sanitizeNumberInput,
    getChainName,
    truncateAddress,
    hgVariant,
} from '@bze/bze-ui-kit';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {LuSearch, LuWallet} from 'react-icons/lu';
import {AmountField, ProgressLine, QuickAmounts, StakingDialog} from '@/components/ui/staking/dialog';
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

    const decimals = nativeAsset?.decimals ?? 6;
    const delegatedHuman = uAmountToBigNumberAmount(delegatedAmount, decimals);
    // Max redelegates the full delegation (not a wallet balance), but the wallet must still
    // hold the gas fee for the transaction.
    const feeCheck = useCanAffordTx({spec: isConnected ? 'redelegate' : undefined});

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
        if (!feeCheck.canAfford) {
            toast.error('Not enough for the network fee', feeCheck.message);
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
        <StakingDialog
            isOpen={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            width="512px"
            title={`Redelegate from ${sourceValidator?.description?.moniker ?? ''}`}
        >
            {/* Destination Validator Selection */}
            <Flex direction="column" gap="8px">
                <chakra.span fontSize="14px" fontWeight="600">Destination Validator</chakra.span>
                {destValidator ? (
                    <Flex justify="space-between" align="center" gap="8px" px="12px" py="10px" borderRadius="hg.md" bg="app.subtle" borderWidth="1px" borderColor="app.border">
                        <Flex align="center" gap="8px" minW="0">
                            <ValidatorAvatar
                                src={logos[destValidator.operator_address]}
                                name={destValidator.description?.moniker}
                                size="24px"
                            />
                            <chakra.strong fontSize="14px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                {destValidator.description?.moniker || truncateAddress(destValidator.operator_address)}
                            </chakra.strong>
                        </Flex>
                        <Button size="xs" variant="ghost" color="hg.link" onClick={() => setDestValidator(null)}>Change</Button>
                    </Flex>
                ) : (
                    <>
                        <InputGroup startElement={<LuSearch size={14} />}>
                            <Input
                                placeholder="Search validators..."
                                aria-label="Search validators"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                h="40px"
                                borderRadius="hg.md"
                            />
                        </InputGroup>
                        <Box maxH="300px" overflowY="auto" borderWidth="1px" borderColor="hg.hairline" borderRadius="hg.md" aria-label="Destination validator">
                            {filteredValidators.map(v => (
                                <chakra.button
                                    key={v.operator_address}
                                    type="button"
                                    display="flex"
                                    w="full"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    gap="8px"
                                    px="12px"
                                    py="9px"
                                    bg="transparent"
                                    color="fg"
                                    textAlign="start"
                                    cursor="pointer"
                                    borderBottomWidth="1px"
                                    borderColor="hg.divider"
                                    _hover={{bg: 'app.subtle'}}
                                    _focusVisible={{bg: 'app.subtle', outline: 'none', boxShadow: 'inset 0 0 0 2px var(--chakra-colors-app-focus-ring)'}}
                                    onClick={() => {
                                        setDestValidator(v);
                                        setSearch('');
                                    }}
                                >
                                    <Flex align="center" gap="8px" minW="0">
                                        <ValidatorAvatar
                                            src={logos[v.operator_address]}
                                            name={v.description?.moniker}
                                            size="24px"
                                        />
                                        <chakra.span fontSize="14px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                            {v.description?.moniker || truncateAddress(v.operator_address)}
                                        </chakra.span>
                                    </Flex>
                                    <chakra.span fontSize="12px" color="hg.text.faint" flex="none">
                                        {new BigNumber(v.commission?.commission_rates?.rate ?? '0').multipliedBy(100).decimalPlaces(1).toString()}% commission
                                    </chakra.span>
                                </chakra.button>
                            ))}
                        </Box>
                    </>
                )}
            </Flex>

            <AmountField
                value={amount}
                onChange={(value) => setAmount(sanitizeNumberInput(value))}
                aside={`Delegated: ${prettyAmount(delegatedHuman)} ${nativeAsset?.ticker ?? ''}`}
                ticker={nativeAsset?.ticker}
                disabled={!isConnected}
            >
                <QuickAmounts onPick={setQuickAmount} disabled={!isConnected} />
            </AmountField>

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
                <Button
                    variant={hgVariant('primary')}
                    size="lg"
                    onClick={handleRedelegate}
                    loading={isSubmitting}
                    disabled={!amount || new BigNumber(amount).lte(0) || !address || !destValidator || !feeCheck.canAfford}
                    w="full"
                >
                    Redelegate {amount ? `${amount} ${nativeAsset?.ticker}` : ''}
                </Button>
            )}
        </StakingDialog>
    );
}
