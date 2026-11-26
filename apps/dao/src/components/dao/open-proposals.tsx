'use client';

import NextLink from 'next/link';
import {chakra, Flex} from '@chakra-ui/react';
import {HgCard, Shimmer} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {loadOpenProposals, type DaoDeps} from '@/lib/dao-loader';
import {formatDay} from '@/lib/format';

/** Proposals open for voting across every DAO, soonest end first. Hidden when there is nothing to show. */
export const OpenProposals = ({deps}: {deps: DaoDeps}) => {
    const feed = useAsync('open', () => loadOpenProposals(deps));
    const items = feed.data ?? [];

    if (feed.loading) return <Shimmer h="96px" borderRadius="16px" aria-hidden />;
    if (items.length === 0) return null;

    return (
        <Flex direction="column" gap="16px" as="section" aria-labelledby="open-proposals-title" data-testid="open-proposals">
            <chakra.h2 id="open-proposals-title" m="0" fontSize="22px" fontWeight="700">Open proposals</chakra.h2>
            <Flex direction="column" gap="10px">
                {items.map((p) => (
                    <HgCard key={p.id} interactive asChild>
                        <NextLink href={`/proposal/${p.id}`} data-testid="open-proposal">
                            <Flex justify="space-between" align="center" gap="16px" wrap="wrap" px="18px" py="14px">
                                <Flex direction="column" gap="2px" minW="0">
                                    <chakra.span fontWeight="600" lineClamp={2}>{p.title || `Proposal #${p.id}`}</chakra.span>
                                    <chakra.span fontSize="13px" color="fg.muted">{p.dao?.name ?? `DAO ${p.dao_id ?? ''}`}</chakra.span>
                                </Flex>
                                {p.voting_end && (
                                    <chakra.span fontSize="13px" color="hg.text.faint" whiteSpace="nowrap">{`Voting ends ${formatDay(p.voting_end)}`}</chakra.span>
                                )}
                            </Flex>
                        </NextLink>
                    </HgCard>
                ))}
            </Flex>
        </Flex>
    );
};
