'use client';

import {useState, useMemo, useRef} from 'react';
import {Button} from '@chakra-ui/react';
import {LuWallet} from 'react-icons/lu';
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
    hgVariant,
    Notice,
} from '@bze/bze-ui-kit';
import {
    validateDelegationAmount,
    exceedsSpendable as computeExceedsSpendable,
    isPositiveAmount,
    quickAmount,
} from '@/lib/delegate-amount';
import {formatCommissionRate} from '@/lib/validator-list';
import {useChain} from '@interchain-kit/react';
import {getChainName} from '@bze/bze-ui-kit';
import {WalletState} from '@interchain-kit/core';
import {cosmos} from '@bze/bzejs';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {BondStatus, bondStatusFromJSON} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {CopyStakeLinkButton} from './copy-stake-link-button';
import {AmountField, InsetRow, ProgressLine, QuickAmounts, StakingDialog} from '@/components/ui/staking/dialog';

interface DelegateModalProps {
    isOpen: boolean;
    onClose: () => void;
    validator: ValidatorSDKType | null;
    onSuccess: () => void;
    // Opens the page's wallet sidebar for a user without a wallet. The page sets the form aside
    // while the sidebar is up and brings it back afterwards. Without it, the button closes the
    // form and opens the wallet modal.
    onConnectWallet?: () => void;
}

export function DelegateModal({isOpen, onClose, validator, onSuccess, onConnectWallet}: DelegateModalProps) {
    const {nativeAsset} = useAssets();
    const {balance} = useBalance(getChainNativeAssetDenom());
    const {address, status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const amountInputRef = useRef<HTMLInputElement>(null);

    const decimals = nativeAsset?.decimals ?? 6;
    const availableHuman = uAmountToBigNumberAmount(balance.amount, decimals);
    // Shared gas engine: the balance minus the estimated delegate gas fee (BZE is both the
    // delegated coin and, by default, the fee coin).
    const maxSpendable = useMaxSpendable(getChainNativeAssetDenom(), 'delegate');
    const spendableHuman = maxSpendable.displayAmount;
    const commission = formatCommissionRate(validator?.commission?.commission_rates?.rate);
    const earnsNoRewards = !!validator
        && (validator.jailed || bondStatusFromJSON(validator.status) !== BondStatus.BOND_STATUS_BONDED);

    const handleDelegate = async () => {
        if (!address || !validator) {
            toast.error('Invalid amount', 'Please enter a valid amount to stake');
            return;
        }

        const amountError = validateDelegationAmount(amount, balance.amount, decimals, maxSpendable.amount);
        if (amountError) {
            if (amountError === 'insufficient-balance') {
                toast.error('Insufficient balance', 'You do not have enough tokens');
            } else if (amountError === 'no-fee-reserve') {
                toast.error('Not enough left for fees', `Keep ≈ ${prettyAmount(maxSpendable.gasFee.displayAmount)} ${maxSpendable.gasFee.ticker} for the network fee.`);
            } else {
                toast.error('Invalid amount', 'Please enter a valid amount to stake');
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
                toast.success('Staked', `Staked ${amount} ${nativeAsset?.ticker} to ${validator.description?.moniker}`);
                onSuccess();
            }
        } catch (e) {
            console.error('Delegate failed:', e);
            toast.error('Staking failed', 'Transaction failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const amountValid = isPositiveAmount(amount);
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

    // On open the dialog focuses its first tabbable element, which is the copy-link icon in the
    // title. When the form opens from a stake link (no click before it), the browser treats
    // that focus as keyboard focus and draws the focus ring around the icon. Focus the amount
    // field instead, or the dialog itself while the field is disabled (no wallet).
    const initialFocusEl = () => (isConnected ? amountInputRef.current : null) ?? contentRef.current;

    return (
        <StakingDialog
            isOpen={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            contentRef={contentRef}
            initialFocusEl={initialFocusEl}
            title={`Stake with ${validator?.description?.moniker ?? ''}`}
            titleAside={validator && <CopyStakeLinkButton operatorAddress={validator.operator_address} />}
        >
            <InsetRow label="Commission">{commission}%</InsetRow>

            {earnsNoRewards && (
                <Notice status="warning">
                    {validator?.jailed ? 'This validator is jailed. ' : 'This validator is outside the active set. '}
                    It does not earn rewards while jailed or outside the active set, so your stake earns nothing until it is back.
                </Notice>
            )}

            <AmountField
                value={amount}
                onChange={(value) => setAmount(sanitizeNumberInput(value, decimals))}
                aside={`Available: ${prettyAmount(availableHuman)} ${nativeAsset?.ticker ?? ''}`}
                ticker={nativeAsset?.ticker}
                disabled={!isConnected}
                warning={amountValid && exceedsSpendable}
                inputRef={amountInputRef}
            >
                <QuickAmounts onPick={setQuickAmount} disabled={!isConnected} />
            </AmountField>

            {amountValid && exceedsSpendable && (
                <Notice status="warning">
                    This amount leaves less than the network fee
                    (≈ {prettyAmount(maxSpendable.gasFee.displayAmount)} {maxSpendable.gasFee.ticker}) in your wallet,
                    so the transaction would fail.
                    {maxSpendable.amount.gt(0) && (
                        <Button
                            display="flex"
                            mt="8px"
                            size="xs"
                            variant="outline"
                            color="hg.warning.text"
                            borderColor="hg.warning/45"
                            bg="transparent"
                            _hover={{bg: 'hg.warning/12'}}
                            onClick={useSpendableMax}
                        >
                            Stake {prettyAmount(spendableHuman)} {nativeAsset?.ticker} instead
                        </Button>
                    )}
                </Notice>
            )}

            <ProgressLine>{progressTrack}</ProgressLine>

            {!isConnected ? (
                <Button
                    variant={hgVariant('primary')}
                    size="lg"
                    w="full"
                    onClick={onConnectWallet ?? (() => { onClose(); connect(); })}
                >
                    <LuWallet /> Connect Wallet
                </Button>
            ) : (
                <Button
                    variant={hgVariant('primary')}
                    size="lg"
                    onClick={handleDelegate}
                    loading={isSubmitting}
                    disabled={!amountValid || !address || exceedsSpendable}
                    w="full"
                >
                    Stake {amountValid ? `${amount} ${nativeAsset?.ticker}` : ''}
                </Button>
            )}
        </StakingDialog>
    );
}
