'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoProposal} from '@bze/bze-ui-kit';
import {Notice, Shimmer} from '@bze/bze-ui-kit';
import {describeVotingPower} from '@/lib/dao-power';
import {loadMyVotes, loadVotingPower, type DaoViewDeps, type Part} from '@/lib/dao-view-loader';
import type {StakeSource} from '@/lib/dao-voters';
import {useAsync} from '@/hooks/useAsync';
import {formatDay} from '@/lib/format';
import {Panel, ScanRetry} from './panel';
import {useCoinFormat} from './use-coin-format';

const OPTION: Record<string, string> = {YES: 'Yes', NO: 'No', ABSTAIN: 'Abstain'};

/** The connected wallet's voting power in this DAO, per open proposal, and its past votes here. */
export const MyPower = ({deps, dao, wallet, sources, openProposals}: {
    deps: DaoViewDeps;
    dao: Dao;
    wallet: string;
    sources: Part<StakeSource[]>;
    openProposals: Part<DaoProposal[]>;
}) => {
    const coins = useCoinFormat();
    const [retry, setRetry] = useState(0);
    const power = useAsync(`${dao.id}:${wallet}`, () => loadVotingPower(deps, dao.id, wallet));
    const votes = useAsync(`${dao.id}:${wallet}:${retry}`, () => loadMyVotes(deps, dao.id, wallet));
    const stakingDenom = sources.ok ? sources.value[0]?.stakingDenom : undefined;
    const titles = new Map((openProposals.ok ? openProposals.value : []).map((p) => [p.id, p.title]));

    const formatStake = (amount: string) => stakingDenom ? coins.format({denom: stakingDenom, amount}) : amount;
    const view = power.data ? describeVotingPower(dao.type, power.data, formatStake, (id) => titles.get(id)) : null;

    return (
        <Panel id="power" title="My voting power" testId="power-panel">
            {power.loading && <Shimmer h="40px" borderRadius="12px" aria-hidden />}
            {!power.loading && !!power.error && <Notice status="warning">Your voting power could not be read from the chain right now.</Notice>}
            {view && (
                <>
                    <chakra.p m="0" fontWeight="600" data-testid="power-headline">{view.headline}</chakra.p>
                    <Flex direction="column" gap="6px">
                        {view.lines.map((line) => (
                            <chakra.p key={line.proposalId} m="0" fontSize="14px" color={line.counts ? undefined : 'fg.muted'} data-testid="power-proposal">{line.text}</chakra.p>
                        ))}
                    </Flex>
                </>
            )}

            <chakra.h3 m="0" mt="6px" fontSize="15px" fontWeight="700">My votes in this DAO</chakra.h3>
            {votes.loading && <Shimmer h="40px" borderRadius="12px" aria-hidden />}
            {!votes.loading && !!votes.error && <ScanRetry what="Your votes" onRetry={() => setRetry((n) => n + 1)} />}
            {votes.data && votes.data.items.length === 0 && (
                <chakra.p m="0" fontSize="14px" color="fg.muted" data-testid="no-votes">You have not voted in this DAO yet.</chakra.p>
            )}
            {votes.data && votes.data.items.length > 0 && (
                <Flex direction="column" gap="6px">
                    {votes.data.items.map((v) => (
                        <chakra.p key={`${v.proposal.id}`} m="0" fontSize="14px" data-testid="my-vote">
                            {`${OPTION[v.option] ?? v.option} on ${v.proposal.title ?? `proposal #${v.proposal.id}`} · ${formatDay(v.time)}`}
                        </chakra.p>
                    ))}
                </Flex>
            )}
            {votes.data?.truncated && <chakra.p m="0" fontSize="12px" color="hg.text.faint">Only your latest votes were searched.</chakra.p>}
        </Panel>
    );
};
