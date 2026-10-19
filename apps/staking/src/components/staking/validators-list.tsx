'use client';

import {Button, chakra, Flex, Grid, Input, InputGroup} from '@chakra-ui/react';
import {LuSearch, LuArrowUpRight} from 'react-icons/lu';
import {
    useAssets,
    prettyAmount,
    uAmountToBigNumberAmount,
    truncateAddress,
    HgCard,
    PageState,
    StatusPill,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import {filterValidators, formatCommissionRate, VALIDATORS_ANCHOR} from '@/lib/validator-list';
import {validatorRowId} from '@/lib/stake-link';
import {useState, type ReactNode} from 'react';
import {ValidatorAvatar} from './validator-avatar';
import {CopyStakeLinkButton} from './copy-stake-link-button';
import {cardsGrid, InfoRow, SectionHeader, softButton} from '@/components/ui/staking/parts';
import type {ValidatorSDKType} from '@bze/bzejs/cosmos/staking/v1beta1/staking';

interface ValidatorsListProps {
    validators: ValidatorSDKType[];
    // Opens the delegate form; the page owns it so stake links can open it too.
    onStake: (validator: ValidatorSDKType) => void;
    logos: Record<string, string>;
    // Operator address of a row to highlight (a followed stake link).
    highlightedOperator?: string | null;
    /** Buttons next to the search (Refresh, when My Validators is not shown). */
    actions?: ReactNode;
}

export function ValidatorsList({validators, onStake, logos, highlightedOperator, actions}: ValidatorsListProps) {
    const {nativeAsset} = useAssets();
    const decimals = nativeAsset?.decimals ?? 6;
    const [search, setSearch] = useState('');

    const filtered = filterValidators(validators, search);

    return (
        <Flex as="section" id={VALIDATORS_ANCHOR} direction="column" gap="16px" scrollMarginTop="96px">
            <SectionHeader
                title={`All Validators (${validators.length})`}
                actions={
                    <>
                        <InputGroup startElement={<LuSearch size={16} />} w={{base: 'full', sm: '320px'}}>
                            <Input
                                placeholder="Search validators..."
                                aria-label="Search validators"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                h="40px"
                                borderRadius="hg.md"
                            />
                        </InputGroup>
                        {actions}
                    </>
                }
            />

            <Grid {...cardsGrid}>
                {filtered.map((validator, idx) => {
                    const votingPower = uAmountToBigNumberAmount(new BigNumber(validator.tokens), decimals);
                    const commission = formatCommissionRate(validator.commission?.commission_rates?.rate);
                    const isHighlighted = validator.operator_address === highlightedOperator;

                    return (
                        <HgCard
                            key={validator.operator_address}
                            id={validatorRowId(validator.operator_address)}
                            data-highlighted={isHighlighted || undefined}
                            interactive
                            bg={isHighlighted ? 'app.subtle' : 'hg.card'}
                            borderColor={isHighlighted ? 'app.solid' : 'hg.hairline'}
                            px="20px"
                            py="18px"
                            display="flex"
                            flexDirection="column"
                            gap="14px"
                            minW="0"
                        >
                            <Flex align="center" justify="space-between" gap="10px">
                                <Flex align="center" gap="12px" minW="0">
                                    <ValidatorAvatar
                                        src={logos[validator.operator_address]}
                                        name={validator.description?.moniker}
                                        size="36px"
                                    />
                                    <Flex direction="column" minW="0">
                                        <chakra.span fontSize="12px" color="hg.text.faint">#{idx + 1}</chakra.span>
                                        <Flex align="center" gap="8px" minW="0">
                                            <chakra.strong fontSize="15px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                                {validator.description?.moniker || truncateAddress(validator.operator_address)}
                                            </chakra.strong>
                                            {validator.jailed && <StatusPill tone="danger">Jailed</StatusPill>}
                                        </Flex>
                                    </Flex>
                                </Flex>

                                <Flex align="center" gap="4px" flex="none">
                                    <CopyStakeLinkButton operatorAddress={validator.operator_address} />
                                    <Button size="sm" {...softButton} onClick={() => onStake(validator)}>
                                        <LuArrowUpRight /> Stake
                                    </Button>
                                </Flex>
                            </Flex>

                            <InfoRow label="Voting power">{prettyAmount(votingPower)} {nativeAsset?.ticker}</InfoRow>
                            <InfoRow label="Commission">{commission}%</InfoRow>
                        </HgCard>
                    );
                })}
            </Grid>

            {filtered.length === 0 && (
                <HgCard p="0">
                    <PageState kind="empty" title="No validators found" description={`No validators found matching "${search}"`} />
                </HgCard>
            )}
        </Flex>
    );
}
