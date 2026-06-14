'use client';

import {Box, Container, Text, VStack, HStack, Badge, Grid} from '@chakra-ui/react';
import {LuClock} from 'react-icons/lu';
import {
    useAssets,
    prettyAmount,
    uAmountToBigNumberAmount,
    truncateAddress,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import type {UnbondingDelegationSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';
import {ValidatorAvatar} from './validator-avatar';

interface UnbondingDelegationsProps {
    unbondingDelegations: UnbondingDelegationSDKType[];
    allValidators: ValidatorSDKType[];
    logos: Record<string, string>;
}

export function UnbondingDelegations({unbondingDelegations, allValidators, logos}: UnbondingDelegationsProps) {
    const {nativeAsset} = useAssets();
    const decimals = nativeAsset?.decimals ?? 6;

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
        <Container maxW="7xl" py="2">
            <VStack align="stretch" gap="4">
                <HStack gap="2">
                    <Text fontSize="lg" fontWeight="bold">
                        Unbonding Delegations
                    </Text>
                    <Badge colorPalette="orange" size="sm">{entries.length}</Badge>
                </HStack>

                <Grid templateColumns={{base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)'}} gap="3">
                    {entries.map((entry, idx) => {
                        const amountHuman = uAmountToBigNumberAmount(entry.amount, decimals);
                        const isCompleted = entry.completionTime.getTime() < Date.now();
                        const timeRemaining = entry.completionTime.getTime() - Date.now();
                        const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

                        return (
                            <Box
                                key={`${entry.validatorAddress}-${idx}`}
                                bg="bg.panel"
                                borderWidth="1px"
                                borderColor="orange.500/15"
                                borderRadius="lg"
                                p="4"
                            >
                                <VStack align="stretch" gap="3">
                                    <HStack justify="space-between">
                                        <HStack gap="2" flex="1" minW="0">
                                            <ValidatorAvatar
                                                src={logos[entry.validatorAddress]}
                                                name={entry.moniker}
                                                size="28px"
                                            />
                                            <Text fontWeight="semibold" fontSize="sm" lineClamp={1}>
                                                {entry.moniker}
                                            </Text>
                                        </HStack>
                                        <Badge
                                            colorPalette={isCompleted ? 'green' : 'orange'}
                                            size="sm"
                                        >
                                            {isCompleted ? 'Ready' : `${daysRemaining}d left`}
                                        </Badge>
                                    </HStack>

                                    <HStack justify="space-between">
                                        <Text fontSize="xs" color="fg.muted">Amount</Text>
                                        <Text fontSize="sm" fontWeight="semibold">
                                            {prettyAmount(amountHuman)} {nativeAsset?.ticker}
                                        </Text>
                                    </HStack>

                                    <HStack gap="1" fontSize="xs" color="fg.muted">
                                        <LuClock size={12} />
                                        <Text>
                                            {isCompleted ? 'Completed' : `Completes ${entry.completionTime.toLocaleDateString()}`}
                                        </Text>
                                    </HStack>
                                </VStack>
                            </Box>
                        );
                    })}
                </Grid>
            </VStack>
        </Container>
    );
}
