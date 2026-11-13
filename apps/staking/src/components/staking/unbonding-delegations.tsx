'use client';

import {useMemo, useState} from 'react';
import {Button, chakra, Flex, Grid} from '@chakra-ui/react';
import {LuClock, LuUndo2} from 'react-icons/lu';
import {
    useAssets,
    prettyAmount,
    uAmountToBigNumberAmount,
    truncateAddress,
    HgCard,
    StatusPill,
} from '@bze/bze-ui-kit';
import type {UnbondingDelegationSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {ValidatorAvatar} from './validator-avatar';
import {CancelUnbondingModal} from './cancel-unbonding-modal';
import {InfoRow, neutralButton, SectionHeader} from '@/components/ui/staking/parts';
import {
    buildUnbondingEntries,
    CANCEL_BLOCK_REASON_TEXT,
    splitCancellable,
    type UnbondingEntryView,
} from '@/lib/cancel-unbonding';

interface UnbondingDelegationsProps {
    unbondingDelegations: UnbondingDelegationSDKType[];
    /** Every validator the page knows: the bonded list plus the unbonding entries' own (jailed included). */
    allValidators: ValidatorSDKType[];
    logos: Record<string, string>;
    /** Validators whose lookup failed: their jailed status is unknown. */
    uncheckedValidators?: string[];
    /** After a cancel (sent or failed): reload the unbonding list and the delegations. */
    onActionComplete?: () => void;
}

export function UnbondingDelegations({unbondingDelegations, allValidators, logos, uncheckedValidators, onActionComplete}: UnbondingDelegationsProps) {
    const {nativeAsset} = useAssets();
    const decimals = nativeAsset?.decimals ?? 6;
    // Capture "now" once at mount rather than calling the impure Date.now() during render.
    // Unbonding countdowns are day-granular and the list re-fetches on chain events, so a
    // per-render clock read isn't needed. The cancel dialog re-checks the clock before sending.
    const [now] = useState(() => Date.now());
    const [toCancel, setToCancel] = useState<{entries: UnbondingEntryView[]; skipped: number} | null>(null);
    // Bumped on each open so the dialog remounts with fresh local state.
    const [modalNonce, setModalNonce] = useState(0);

    const entries = useMemo(() => buildUnbondingEntries({
        unbondingDelegations,
        validators: allValidators,
        now,
        fallbackName: truncateAddress,
        uncheckedValidators,
    }), [unbondingDelegations, allValidators, now, uncheckedValidators]);
    const {cancellable, skipped} = splitCancellable(entries);

    if (entries.length === 0) {
        return null;
    }

    const openCancel = (list: UnbondingEntryView[], skippedCount: number) => {
        setToCancel({entries: list, skipped: skippedCount});
        setModalNonce(n => n + 1);
    };

    const handleSuccess = () => {
        setToCancel(null);
        onActionComplete?.();
    };

    const actions = cancellable.length > 1 || (cancellable.length === 1 && skipped.length > 0) ? (
        <Flex align="center" gap="10px" wrap="wrap">
            {skipped.length > 0 && (
                <chakra.span fontSize="12px" color="hg.text.faint">
                    {skipped.length} not included
                </chakra.span>
            )}
            <Button size="md" {...neutralButton} onClick={() => openCancel(cancellable, skipped.length)}>
                <LuUndo2 /> Cancel all ({cancellable.length})
            </Button>
        </Flex>
    ) : undefined;

    return (
        <Flex as="section" direction="column" gap={{base: '12px', md: '16px'}}>
            <SectionHeader
                title="Unbonding Delegations"
                tag={<StatusPill tone="warning">{entries.length}</StatusPill>}
                actions={actions}
            />

            <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(auto-fill, minmax(340px, 1fr))'}} gap={{base: '12px', md: '16px'}}>
                {entries.map((entry) => {
                    const amountHuman = uAmountToBigNumberAmount(entry.balance, decimals);
                    const timeRemaining = entry.completionTime.getTime() - now;
                    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

                    return (
                        <HgCard
                            key={entry.key}
                            px={{base: '16px', md: '20px'}}
                            py={{base: '16px', md: '18px'}}
                            display="flex"
                            flexDirection="column"
                            gap="12px"
                            minW="0"
                        >
                            <Flex justify="space-between" align="center" gap="10px">
                                <Flex align="center" gap="10px" minW="0">
                                    <ValidatorAvatar
                                        src={logos[entry.validatorAddress]}
                                        name={entry.moniker}
                                        size="28px"
                                    />
                                    <chakra.strong fontSize="14px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {entry.moniker}
                                    </chakra.strong>
                                    {entry.jailed && <StatusPill tone="danger">Jailed</StatusPill>}
                                </Flex>
                                <UnbondingTag completed={entry.completed} daysLeft={daysRemaining} />
                            </Flex>

                            <InfoRow label="Amount">
                                <chakra.strong fontSize="14px">{prettyAmount(amountHuman)} {nativeAsset?.ticker}</chakra.strong>
                            </InfoRow>

                            <Flex align="center" gap="6px" fontSize="12px" color="hg.text.faint">
                                <LuClock size={12} aria-hidden />
                                {entry.completed ? 'Completed' : `Completes ${entry.completionTime.toLocaleDateString()}`}
                            </Flex>

                            <Flex direction="column" gap="6px">
                                <Button
                                    size={{base: 'lg', md: 'sm'}}
                                    {...neutralButton}
                                    disabled={!!entry.blockReason}
                                    onClick={() => openCancel([entry], 0)}
                                    aria-label={`Cancel unbonding from ${entry.moniker}`}
                                >
                                    <LuUndo2 /> Cancel unbonding
                                </Button>
                                {entry.blockReason && (
                                    <chakra.span fontSize="12px" color="hg.text.faint">
                                        {CANCEL_BLOCK_REASON_TEXT[entry.blockReason]}
                                    </chakra.span>
                                )}
                                {!entry.blockReason && entry.statusUnknown && (
                                    <chakra.span fontSize="12px" color="hg.warning.text">
                                        Could not check whether {entry.moniker} is jailed: refresh to retry. You can still cancel this entry on its own; it is left out of Cancel all.
                                    </chakra.span>
                                )}
                            </Flex>
                        </HgCard>
                    );
                })}
            </Grid>

            <CancelUnbondingModal
                key={`cancel-unbonding-${modalNonce}`}
                isOpen={toCancel !== null}
                onClose={() => setToCancel(null)}
                entries={toCancel?.entries ?? []}
                skippedCount={toCancel?.skipped ?? 0}
                logos={logos}
                onSuccess={handleSuccess}
                onFailure={() => onActionComplete?.()}
            />
        </Flex>
    );
}

/** An unbonding entry's state: amber "Nd left" while it runs, green "Ready" once it completed. */
export function UnbondingTag({completed, daysLeft}: {completed: boolean; daysLeft: number}) {
    return completed
        ? <StatusPill tone="success">Ready</StatusPill>
        : <StatusPill tone="warning">{`${daysLeft}d left`}</StatusPill>;
}
