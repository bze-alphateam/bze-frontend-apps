'use client';

import {Box, chakra, Flex} from '@chakra-ui/react';
import type {ProposalVoter} from '@/hooks/useVoter';
import {wholeBze} from '@/lib/governance/details';
import {singleChoice, validatorVoteLabel} from '@/lib/governance/voter';
import {ValidatorAvatar} from '@/components/staking/validator-avatar';
import {Panel} from './panel';

// "Your validators' votes": until the wallet votes, each validator's vote
// counts for the stake with it. Once the wallet has voted, the rows are struck
// through: its own vote replaces them for all of its stake.

export function ValidatorVotes({voter, logos}: {voter: ProposalVoter; logos: Record<string, string>}) {
    const replaced = !!voter.vote;

    return (
        <Panel headingId="val-h" title={"Your validators' votes"} gap="12px">
            <Flex as="ul" direction="column" gap="10px" listStyleType="none" m="0" p="0" data-testid="validator-votes">
                {voter.validators.map((v) => {
                    const yes = singleChoice(v.vote)?.key === 'yes';
                    const counted = yes && !replaced;
                    return (
                        <Flex as="li" key={v.validator.operator_address} align="center" gap="12px">
                            <ValidatorAvatar src={logos[v.validator.operator_address] || undefined} name={v.moniker} size="32px" />
                            <Flex direction="column" flex="1" minW="0">
                                <chakra.span fontSize="14px" fontWeight="600" truncate maxW="full">{v.moniker}</chakra.span>
                                <chakra.span fontSize="12px" color="hg.text.faint">{`${wholeBze(v.amount)} BZE of yours`}</chakra.span>
                            </Flex>
                            <chakra.span
                                fontSize="12px"
                                fontWeight="600"
                                px="8px"
                                py="2px"
                                borderRadius="6px"
                                bg={counted ? 'hg.up/12' : 'hg.inset'}
                                color={counted ? 'hg.up' : 'fg.muted'}
                                textDecoration={replaced ? 'line-through' : 'none'}
                            >
                                {validatorVoteLabel(v.vote)}
                            </chakra.span>
                        </Flex>
                    );
                })}
            </Flex>
            <Box fontSize="12px" lineHeight="1.5" color="hg.text.faint">
                {replaced
                    ? 'Your vote replaces these for your stake.'
                    : `Until you vote, each validator's vote counts for the BZE you staked with them, and stake with a validator that hasn't voted isn't counted. Your own vote replaces them for all ${wholeBze(voter.power.power)} BZE.`}
            </Box>
        </Panel>
    );
}
