'use client';

import {useState} from 'react';
import {Button, chakra} from '@chakra-ui/react';
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
    hgVariant,
    Notice,
} from '@bze/bze-ui-kit';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {LuWallet} from 'react-icons/lu';
import {isPositiveAmount} from '@/lib/delegate-amount';
import {AmountField, ProgressLine, QuickAmounts, StakingDialog} from '@/components/ui/staking/dialog';

interface UndelegateModalProps {
    isOpen: boolean;
    onClose: () => void;
    validator: ValidatorSDKType | null;
    delegatedAmount: BigNumber;
    onSuccess: () => void;
    // Unbonding period in days, read from the chain's staking params.
    unbondingDays?: string;
}

export function UndelegateModal({isOpen, onClose, validator, delegatedAmount, onSuccess, unbondingDays}: UndelegateModalProps) {
    const {nativeAsset} = useAssets();
    const {address, status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const decimals = nativeAsset?.decimals ?? 6;
    const delegatedHuman = uAmountToBigNumberAmount(delegatedAmount, decimals);
    const amountValid = isPositiveAmount(amount);
    // Max undelegates the full delegation (not a wallet balance), but the wallet must still
    // hold the gas fee for the transaction.
    const feeCheck = useCanAffordTx({spec: isConnected ? 'undelegate' : undefined});

    const handleUndelegate = async () => {
        if (!address || !validator || !amountValid) {
            toast.error('Invalid amount', 'Please enter a valid amount to unstake');
            return;
        }
        if (!feeCheck.canAfford) {
            toast.error('Not enough for the network fee', feeCheck.message);
            return;
        }

        const uAmount = amountToUAmount(amount, decimals);
        if (new BigNumber(uAmount).gt(delegatedAmount)) {
            toast.error('Exceeds your stake', 'Amount exceeds what you have staked with this validator');
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
                toast.success('Unstaking started', `Unstaking ${amount} ${nativeAsset?.ticker} from ${validator.description?.moniker}`);
                onSuccess();
            }
        } catch (e) {
            console.error('Undelegate failed:', e);
            toast.error('Unstaking failed', 'Transaction failed. Please try again.');
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
            title={`Unstake from ${validator?.description?.moniker ?? ''}`}
        >
            <Notice status="warning">
                {unbondingDays ? (
                    <>
                        Unstaked tokens are locked for <chakra.strong color="fg">{unbondingDays} days</chakra.strong> (the unbonding period) and earn no rewards during that time.
                    </>
                ) : (
                    'Unstaked tokens will be locked for the unbonding period before becoming available.'
                )}
            </Notice>

            <AmountField
                value={amount}
                onChange={(value) => setAmount(sanitizeNumberInput(value))}
                aside={`Staked: ${prettyAmount(delegatedHuman)} ${nativeAsset?.ticker ?? ''}`}
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
                    onClick={handleUndelegate}
                    loading={isSubmitting}
                    disabled={!amountValid || !address || !feeCheck.canAfford}
                    w="full"
                >
                    Unstake {amountValid ? `${amount} ${nativeAsset?.ticker}` : ''}
                </Button>
            )}
        </StakingDialog>
    );
}
