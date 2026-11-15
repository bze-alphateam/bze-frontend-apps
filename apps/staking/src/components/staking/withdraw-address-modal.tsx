'use client';

import {useEffect, useState} from 'react';
import {Button, chakra, Flex, Grid, Input} from '@chakra-ui/react';
import {
    useSDKTx,
    useCanAffordTx,
    useToast,
    getChainName,
    getChainAddressPrefix,
    getDelegatorWithdrawAddress,
    validateBech32Address,
    hgVariant,
    Notice,
} from '@bze/bze-ui-kit';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import {cosmos} from '@bze/bzejs';
import {LuWallet} from 'react-icons/lu';
import {ProgressLine, StakingDialog} from '@/components/ui/staking/dialog';
import {checkWithdrawAddress, withdrawTarget} from '@/lib/withdraw-address';

interface WithdrawAddressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type CurrentAddress = {loaded: false} | {loaded: true; address?: string};

/**
 * Shows where the wallet's staking rewards are paid and sends one `MsgSetWithdrawAddress` to
 * change it. The chain keeps a single withdraw address per account, so it covers every
 * delegation; unstaked tokens are never affected.
 */
export function WithdrawAddressModal({isOpen, onClose, onSuccess}: WithdrawAddressModalProps) {
    const {address, status, connect} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [input, setInput] = useState('');
    const [current, setCurrent] = useState<CurrentAddress>({loaded: false});

    // Read on open: the parent remounts the dialog on each open, so this is always fresh.
    useEffect(() => {
        if (!isOpen || !address) {
            return;
        }
        let cancelled = false;
        getDelegatorWithdrawAddress(address).then(withdrawAddress => {
            if (!cancelled) {
                setCurrent({loaded: true, address: withdrawAddress});
            }
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, address]);

    const currentAddress = current.loaded ? current.address : undefined;
    const target = withdrawTarget(currentAddress, address);
    const prefix = getChainAddressPrefix();
    const check = checkWithdrawAddress(input, {prefix, current: currentAddress, validate: validateBech32Address});

    const feeCheck = useCanAffordTx({
        spec: isConnected ? {kind: 'set-withdraw-address'} : undefined,
    });

    const handleConfirm = async () => {
        if (!address || !check.ok) {
            return;
        }
        if (!feeCheck.canAfford) {
            toast.error('Not enough for the network fee', feeCheck.message);
            return;
        }

        setIsSubmitting(true);
        try {
            const {setWithdrawAddress} = cosmos.distribution.v1beta1.MessageComposer.withTypeUrl;
            const message = setWithdrawAddress({delegatorAddress: address, withdrawAddress: check.address});
            // A refused address (a module account) fails the simulation: stop before signing.
            const success = await tx([message], {abortOnSimulationError: true});
            if (success) {
                toast.success(
                    'Rewards address updated',
                    check.address === address ? 'Rewards are paid to this wallet again.' : `Rewards are now paid to ${check.address}.`,
                );
                onSuccess();
            }
        } catch (e) {
            console.error('Set withdraw address failed:', e);
            toast.error('Could not update the rewards address', 'Transaction failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <StakingDialog isOpen={isOpen} onClose={onClose} busy={isSubmitting} title="Rewards address">
            <Notice status="info" title="This only changes where your staking rewards are paid">
                <Flex as="ul" direction="column" gap="6px" ps="16px" m="0" listStyleType="disc">
                    <li>One address receives the rewards of <strong>all</strong> your delegations, with every validator.</li>
                    <li>Rewards are paid to it when you claim them, and also automatically whenever you stake, unstake or move stake.</li>
                    <li><strong>Unstaked BZE always returns to this wallet.</strong> This setting never changes where your staked tokens go.</li>
                    <li>Rewards you already claimed stay where they are.</li>
                </Flex>
            </Notice>

            <Flex direction="column" gap="6px" px="14px" py="12px" borderRadius="hg.md" bg="hg.inset" fontSize="14px">
                <chakra.span color="hg.text.secondary">Rewards are paid to</chakra.span>
                {!current.loaded && isConnected && (
                    <chakra.span color="hg.text.faint">Loading…</chakra.span>
                )}
                {current.loaded && target === 'self' && (
                    <chakra.strong>This wallet</chakra.strong>
                )}
                {current.loaded && target === 'other' && (
                    <chakra.strong color="hg.warning.text" overflowWrap="anywhere" data-testid="current-withdraw-address">
                        {currentAddress}
                    </chakra.strong>
                )}
                {current.loaded && target === 'unknown' && (
                    <chakra.span color="hg.text.faint">Could not load the current address. You can still set a new one.</chakra.span>
                )}
                {target === 'other' && (
                    <chakra.span fontSize="12px" color="hg.warning.text">
                        This is not the connected wallet. If you did not set it, change it back.
                    </chakra.span>
                )}
            </Flex>

            <Flex direction="column" gap="8px">
                <Flex justify="space-between" align="baseline" gap="12px">
                    <chakra.label htmlFor="withdraw-address-input" fontSize="14px" fontWeight="600">New rewards address</chakra.label>
                    {address && target !== 'self' && (
                        <Button
                            size="xs"
                            variant="ghost"
                            color="hg.link"
                            fontWeight="600"
                            onClick={() => setInput(address)}
                            disabled={isSubmitting}
                        >
                            Use this wallet
                        </Button>
                    )}
                </Flex>
                <Input
                    id="withdraw-address-input"
                    data-hg-keep-font-size
                    placeholder={`${prefix}1…`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="off"
                    spellCheck={false}
                    h="48px"
                    borderRadius="hg.md"
                    fontSize="14px"
                    {...(!check.ok && check.message ? {borderColor: 'hg.danger/55', 'aria-invalid': true} : {})}
                />
                {!check.ok && check.message && (
                    <chakra.span fontSize="12px" color="hg.danger.text" role="alert">{check.message}</chakra.span>
                )}
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
                        onClick={handleConfirm}
                        loading={isSubmitting}
                        disabled={!address || !check.ok || !feeCheck.canAfford}
                    >
                        Set address
                    </Button>
                </Grid>
            )}
        </StakingDialog>
    );
}
