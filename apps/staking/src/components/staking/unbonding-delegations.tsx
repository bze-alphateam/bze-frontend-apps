'use client';

import {useState} from 'react';
import {chakra, Flex, Grid} from '@chakra-ui/react';
import {LuClock} from 'react-icons/lu';
import {
    useAssets,
    prettyAmount,
    uAmountToBigNumberAmount,
    truncateAddress,
    HgCard,
    StatusPill,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import type {UnbondingDelegationSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {ValidatorAvatar} from './validator-avatar';
import {InfoRow, SectionHeader} from '@/components/ui/staking/parts';

interface UnbondingDelegationsProps {
    unbondingDelegations: UnbondingDelegationSDKType[];
    allValidators: ValidatorSDKType[];
    logos: Record<string, string>;
}

export function UnbondingDelegations({unbondingDelegations, allValidators, logos}: UnbondingDelegationsProps) {
    const {nativeAsset} = useAssets();
    const decimals = nativeAsset?.decimals ?? 6;
    // Capture "now" once at mount rather than calling the impure Date.now() during render.
    // Unbonding countdowns are day-granular and the list re-fetches on chain events, so a
    // per-render clock read isn't needed.
    const [now] = useState(() => Date.now());

    if (unbondingDelegations.length === 0) {
        return null;
    }

    const validatorMap = new Map<string, ValidatorSDKType>();
    allValidators.forEach(v => validatorMap.set(v.operator_address, v));

    const entries = unbondingDelegations.flatMap(d =>
        d.entries.map(entry => ({
            validatorAddress: d.validator_address,
            moniker: validatorMap.get(d.validator_address)?.description?.moniker || truncateAddress(d.validator_address),
            amount: new BigNumber(entry.balance),
            completionTime: new Date(entry.completion_time),
        }))
    ).sort((a, b) => a.completionTime.getTime() - b.completionTime.getTime());

    return (
        <Flex as="section" direction="column" gap={{base: '12px', md: '16px'}}>
            <SectionHeader title="Unbonding Delegations" tag={<StatusPill tone="warning">{entries.length}</StatusPill>} />

            <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(auto-fill, minmax(340px, 1fr))'}} gap={{base: '12px', md: '16px'}}>
                {entries.map((entry, idx) => {
                    const amountHuman = uAmountToBigNumberAmount(entry.amount, decimals);
                    const isCompleted = entry.completionTime.getTime() < now;
                    const timeRemaining = entry.completionTime.getTime() - now;
                    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

                    return (
                        <HgCard
                            key={`${entry.validatorAddress}-${idx}`}
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
                                </Flex>
                                <UnbondingTag completed={isCompleted} daysLeft={daysRemaining} />
                            </Flex>

                            <InfoRow label="Amount">
                                <chakra.strong fontSize="14px">{prettyAmount(amountHuman)} {nativeAsset?.ticker}</chakra.strong>
                            </InfoRow>

                            <Flex align="center" gap="6px" fontSize="12px" color="hg.text.faint">
                                <LuClock size={12} aria-hidden />
                                {isCompleted ? 'Completed' : `Completes ${entry.completionTime.toLocaleDateString()}`}
                            </Flex>
                        </HgCard>
                    );
                })}
            </Grid>
        </Flex>
    );
}

/** An unbonding entry's state: amber "Nd left" while it runs, green "Ready" once it completed. */
export function UnbondingTag({completed, daysLeft}: {completed: boolean; daysLeft: number}) {
    return completed
        ? <StatusPill tone="success">Ready</StatusPill>
        : <StatusPill tone="warning">{`${daysLeft}d left`}</StatusPill>;
}
