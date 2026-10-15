'use client';

import {Box, Container, Text, VStack, HStack, Input, Button, Badge, Grid} from '@chakra-ui/react';
import {LuSearch, LuArrowUpRight} from 'react-icons/lu';
import {
    useAssets,
    prettyAmount,
    uAmountToBigNumberAmount,
    truncateAddress,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import {filterValidators, formatCommissionRate} from '@/lib/validator-list';
import {validatorRowId} from '@/lib/stake-link';
import {useState} from 'react';
import {ValidatorAvatar} from './validator-avatar';
import {CopyStakeLinkButton} from './copy-stake-link-button';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';

interface ValidatorsListProps {
    validators: ValidatorSDKType[];
    // Opens the delegate form; the page owns it so stake links can open it too.
    onStake: (validator: ValidatorSDKType) => void;
    logos: Record<string, string>;
    // Operator address of a row to highlight (a followed stake link).
    highlightedOperator?: string | null;
}

export function ValidatorsList({validators, onStake, logos, highlightedOperator}: ValidatorsListProps) {
    const {nativeAsset} = useAssets();
    const decimals = nativeAsset?.decimals ?? 6;
    const [search, setSearch] = useState('');

    const filtered = filterValidators(validators, search);

    return (
        <Container maxW="7xl" py="2">
            <VStack align="stretch" gap="4">
                <HStack justify="space-between" align="center">
                    <Text fontSize="lg" fontWeight="bold">
                        All Validators ({validators.length})
                    </Text>
                </HStack>

                <HStack>
                    <Box position="relative" flex="1" maxW="400px">
                        <Box position="absolute" left="3" top="50%" transform="translateY(-50%)" color="fg.muted">
                            <LuSearch size={16} />
                        </Box>
                        <Input
                            pl="10"
                            placeholder="Search validators..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            size="sm"
                        />
                    </Box>
                </HStack>

                <Grid templateColumns={{base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)'}} gap="3">
                    {filtered.map((validator, idx) => {
                        const votingPower = uAmountToBigNumberAmount(new BigNumber(validator.tokens), decimals);
                        const commission = formatCommissionRate(validator.commission?.commission_rates?.rate);
                        const isHighlighted = validator.operator_address === highlightedOperator;

                        return (
                            <Box
                                key={validator.operator_address}
                                id={validatorRowId(validator.operator_address)}
                                data-highlighted={isHighlighted || undefined}
                                bg={isHighlighted ? 'purple.500/10' : 'bg.panel'}
                                borderWidth="1px"
                                borderColor={isHighlighted ? 'purple.500' : undefined}
                                borderRadius="lg"
                                p="4"
                                transition="all 0.2s"
                                _hover={{borderColor: 'purple.500/25', shadow: 'sm'}}
                            >
                                <HStack justify="space-between" align="start">
                                    <HStack gap="3" flex="1" minW="0" align="start">
                                        <ValidatorAvatar
                                            src={logos[validator.operator_address]}
                                            name={validator.description?.moniker}
                                            size="36px"
                                        />
                                        <VStack align="start" gap="2" flex="1" minW="0">
                                            <HStack gap="2">
                                                <Text
                                                    fontWeight="bold"
                                                    fontSize="sm"
                                                    color="fg.muted"
                                                    opacity={0.6}
                                                >
                                                    #{idx + 1}
                                                </Text>
                                                <Text fontWeight="semibold" fontSize="sm" lineClamp={1}>
                                                    {validator.description?.moniker || truncateAddress(validator.operator_address)}
                                                </Text>
                                                {validator.jailed && (
                                                    <Badge colorPalette="red" size="sm">Jailed</Badge>
                                                )}
                                            </HStack>

                                        <HStack gap="4" fontSize="xs" color="fg.muted">
                                            <Text>
                                                VP: {prettyAmount(votingPower)} {nativeAsset?.ticker}
                                            </Text>
                                            <Text>
                                                Commission: {commission}%
                                            </Text>
                                        </HStack>
                                    </VStack>
                                    </HStack>

                                    <HStack gap="1" flexShrink={0}>
                                        <CopyStakeLinkButton operatorAddress={validator.operator_address} />
                                        <Button
                                            size="xs"
                                            colorPalette="purple"
                                            variant="subtle"
                                            onClick={() => onStake(validator)}
                                        >
                                            <LuArrowUpRight /> Stake
                                        </Button>
                                    </HStack>
                                </HStack>
                            </Box>
                        );
                    })}
                </Grid>

                {filtered.length === 0 && (
                    <Box textAlign="center" py="8">
                        <Text color="fg.muted">No validators found matching &quot;{search}&quot;</Text>
                    </Box>
                )}
            </VStack>
        </Container>
    );
}
