'use client';

import {useState} from 'react';
import {Button, chakra, Flex, Grid} from '@chakra-ui/react';
import {
    useAssets,
    useSDKTx,
    useCanAffordTx,
    useToast,
    getChainNativeAssetDenom,
    prettyAmount,
    uAmountToBigNumberAmount,
    getChainName,
    hgVariant,
    Notice,
} from '@bze/bze-ui-kit';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import {cosmos} from '@bze/bzejs';
import {LuWallet} from 'react-icons/lu';
import {ValidatorAvatar} from './validator-avatar';
import {InsetRow, ProgressLine, StakingDialog} from '@/components/ui/staking/dialog';
import {
    anyCompletesSoon,
    cancelUnbondingValues,
    totalBalance,
    type UnbondingEntryView,
} from '@/lib/cancel-unbonding';

interface CancelUnbondingModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** The entries to cancel, all cancellable. */
    entries: UnbondingEntryView[];
    /** Entries "Cancel all" leaves out (jailed validator, completed). */
    skippedCount?: number;
    logos: Record<string, string>;
    onSuccess: () => void;
    /**
     * After a tx that did not confirm: it may still have landed (a confirmation timeout), so the
     * page reloads the entries rather than showing stale ones.
     */
    onFailure?: () => void;
}

/**
 * Confirms and sends one `MsgCancelUnbondingDelegation` per entry, in one transaction: each puts
 * the entry's full balance back into delegation with its validator.
 */
export function CancelUnbondingModal({isOpen, onClose, entries, skippedCount = 0, logos, onSuccess, onFailure}: CancelUnbondingModalProps) {
    const {nativeAsset} = useAssets();
    const {address, status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const decimals = nativeAsset?.decimals ?? 6;
    const ticker = nativeAsset?.ticker ?? '';
    const totalHuman = uAmountToBigNumberAmount(totalBalance(entries), decimals);
    const validatorCount = new Set(entries.map(e => e.validatorAddress)).size;

    const feeCheck = useCanAffordTx({
        spec: isConnected && entries.length > 0
            ? {kind: 'cancel-unbonding-delegation', count: entries.length}
            : undefined,
    });

    const handleConfirm = async () => {
        if (!address || entries.length === 0) {
            return;
        }
        if (!feeCheck.canAfford) {
            toast.error('Not enough for the network fee', feeCheck.message);
            return;
        }
        // The page's clock was read when it loaded: re-check that no entry completed since.
        if (anyCompletesSoon(entries)) {
            toast.error('Unbonding completed', 'An entry completed while the page was open. Refresh the page and try again.');
            return;
        }

        setIsSubmitting(true);
        try {
            const {cancelUnbondingDelegation} = cosmos.staking.v1beta1.MessageComposer.withTypeUrl;
            const messages = cancelUnbondingValues(address, getChainNativeAssetDenom(), entries)
                .map(value => cancelUnbondingDelegation(value));

            // Never sign with the 500k default gas when the simulation fails: with several
            // messages it runs out of gas, and a failing simulation means the chain refuses it.
            const success = await tx(messages, {abortOnSimulationError: true});
            if (success) {
                toast.success(
                    'Unbonding cancelled',
                    `${prettyAmount(totalHuman)} ${ticker} staked again with ${validatorCount} validator${validatorCount > 1 ? 's' : ''}`,
                );
                onSuccess();
            } else {
                onFailure?.();
            }
        } catch (e) {
            console.error('Cancel unbonding failed:', e);
            toast.error('Cancel unbonding failed', 'Transaction failed. Please try again.');
            onFailure?.();
        } finally {
            setIsSubmitting(false);
        }
    };

    const single = entries.length === 1;

    return (
        <StakingDialog
            isOpen={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            title={single ? 'Cancel unbonding' : `Cancel ${entries.length} unbondings`}
        >
            <Notice status="info">
                The tokens go back to staking with the same validator{single ? '' : 's'} and start earning rewards again. Unstaking them later starts a new unbonding period.
            </Notice>

            <InsetRow label="Total">{prettyAmount(totalHuman)} {ticker}</InsetRow>

            <Flex direction="column" gap="4px" maxH="260px" overflowY="auto" role="list" aria-label="Unbonding entries to cancel">
                {entries.map(entry => (
                    <Flex
                        key={entry.key}
                        role="listitem"
                        justify="space-between"
                        align="center"
                        gap="10px"
                        px="12px"
                        py="8px"
                        borderRadius="hg.md"
                        bg="hg.inset"
                    >
                        <Flex align="center" gap="8px" minW="0">
                            <ValidatorAvatar src={logos[entry.validatorAddress]} name={entry.moniker} size="22px" />
                            <chakra.span fontSize="14px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                {entry.moniker}
                            </chakra.span>
                        </Flex>
                        <chakra.span fontSize="13px" fontWeight="600" flex="none">
                            {prettyAmount(uAmountToBigNumberAmount(entry.balance, decimals))} {ticker}
                        </chakra.span>
                    </Flex>
                ))}
            </Flex>

            {skippedCount > 0 && (
                <chakra.span fontSize="12px" color="hg.text.faint" textAlign="center">
                    {skippedCount} entr{skippedCount > 1 ? 'ies' : 'y'} left out: jailed validator, unbonding completed, or validator status unknown.
                </chakra.span>
            )}

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
                        Keep unbonding
                    </Button>
                    <Button
                        variant={hgVariant('primary')}
                        size="lg"
                        onClick={handleConfirm}
                        loading={isSubmitting}
                        disabled={!address || entries.length === 0 || !feeCheck.canAfford}
                    >
                        {single ? 'Cancel unbonding' : `Cancel ${entries.length} unbondings`}
                    </Button>
                </Grid>
            )}
        </StakingDialog>
    );
}
