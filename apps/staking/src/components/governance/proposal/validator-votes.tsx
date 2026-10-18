'use client';

import {Box, HStack, Text, VStack} from '@chakra-ui/react';
import type {ProposalVoter} from '@/hooks/useVoter';
import {wholeBze} from '@/lib/governance/details';
import {singleChoice, validatorVoteLabel} from '@/lib/governance/voter';
import {ValidatorAvatar} from '@/components/staking/validator-avatar';

// "Your validators' votes": until the wallet votes, each validator's vote
// counts for the stake with it. Once the wallet has voted, the rows are struck
// through: its own vote replaces them for all of its stake.

export function ValidatorVotes({voter, logos}: {voter: ProposalVoter; logos: Record<string, string>}) {
    const replaced = !!voter.vote;

    return (
        <VStack as="section" aria-labelledby="val-h" align="stretch" gap="3" bg="bg.panel" borderWidth="1px" borderRadius="lg" p={{base: '4', md: '5'}}>
            <Text as="h2" id="val-h" fontSize="md" fontWeight="bold">{"Your validators' votes"}</Text>
            <VStack as="ul" align="stretch" gap="2.5" listStyleType="none" data-testid="validator-votes">
                {voter.validators.map((v) => {
                    const yes = singleChoice(v.vote)?.key === 'yes';
                    return (
                        <HStack as="li" key={v.validator.operator_address} gap="3">
                            <ValidatorAvatar src={logos[v.validator.operator_address] || undefined} name={v.moniker} size="32px" />
                            <VStack align="start" gap="0" flex="1" minW="0">
                                <Text fontSize="sm" fontWeight="semibold" truncate maxW="full">{v.moniker}</Text>
                                <Text fontSize="xs" color="fg.muted">{`${wholeBze(v.amount)} BZE of yours`}</Text>
                            </VStack>
                            <Text
                                as="span"
                                fontSize="xs"
                                fontWeight="semibold"
                                px="2"
                                py="0.5"
                                borderRadius="sm"
                                bg={yes && !replaced ? 'green.subtle' : 'bg.muted'}
                                color={yes && !replaced ? 'green.fg' : 'fg.muted'}
                                textDecoration={replaced ? 'line-through' : 'none'}
                            >
                                {validatorVoteLabel(v.vote)}
                            </Text>
                        </HStack>
                    );
                })}
            </VStack>
            <Box fontSize="xs" color="fg.muted">
                {replaced
                    ? 'Your vote replaces these for your stake.'
                    : `Until you vote, each validator's vote counts for the BZE you staked with them, and stake with a validator that hasn't voted isn't counted. Your own vote replaces them for all ${wholeBze(voter.power.power)} BZE.`}
            </Box>
        </VStack>
    );
}
