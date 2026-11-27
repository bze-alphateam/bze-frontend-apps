'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import type {Dao} from '@bze/bze-ui-kit';
import {getDexApp, Notice, Shimmer} from '@bze/bze-ui-kit';
import {dexSourceHref, memberPreview, sourceName, totalVotingPower, type StakeSource} from '@/lib/dao-voters';
import type {Part} from '@/lib/dao-view-loader';
import {AddressLine, Panel, Row} from './panel';
import {useCoinFormat} from './use-coin-format';

/** Who votes: the member list of a static-list DAO, or the sources a stake DAO counts stake in. */
export const VotersPanel = ({dao, sources, nameOf}: {dao: Dao; sources: Part<StakeSource[]>; nameOf: (address: string) => string | undefined}) => {
    const coins = useCoinFormat();
    const [showAll, setShowAll] = useState(false);

    if (dao.type === 'DAO_TYPE_STATIC_LIST') {
        const {shown, hidden} = memberPreview(dao.members, showAll);
        return (
            <Panel id="voters" title="Who votes" testId="voters-panel">
                <chakra.p m="0" fontSize="14px" data-testid="member-count">
                    {`${dao.members.length} ${dao.members.length === 1 ? 'member' : 'members'} · one member, one vote`}
                </chakra.p>
                {dao.members.length === 0 && <chakra.p m="0" color="fg.muted" data-testid="no-voters">No voters yet.</chakra.p>}
                <Flex direction="column" gap="6px">
                    {shown.map((member) => (
                        <Flex key={member} data-testid="member"><AddressLine address={member} name={nameOf(member)} /></Flex>
                    ))}
                </Flex>
                {hidden > 0 && (
                    <chakra.button type="button" alignSelf="flex-start" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setShowAll(true)}>
                        {`Show all ${dao.members.length}`}
                    </chakra.button>
                )}
            </Panel>
        );
    }

    const dexHref = getDexApp().href;
    return (
        <Panel id="voters" title="Who votes" testId="voters-panel">
            {!sources.ok && <Notice status="warning">The voting sources could not be read from the chain right now.</Notice>}
            {sources.ok && sources.value.length === 0 && (
                <chakra.p m="0" color="fg.muted" data-testid="no-voters">No voters yet: this DAO has no voting sources set.</chakra.p>
            )}
            {sources.ok && sources.value.length > 0 && (
                <>
                    <Flex direction="column" gap="10px">
                        {sources.value.map((source) => (
                            <Row key={source.kind === 'sr' ? `sr/${source.id}` : `dr/${source.stakingDenom}`} label={sourceName(source, coins.ticker(source.stakingDenom))} testId="source-row">
                                {`${coins.format({denom: source.stakingDenom, amount: source.staked})} staked · unstaking locks ${source.lockDays} ${source.lockDays === 1 ? 'day' : 'days'} · `}
                                <chakra.a href={dexSourceHref(dexHref, source)} target="_blank" rel="noopener noreferrer" color="hg.link" fontWeight="600" data-testid="source-link">Stake on DEX</chakra.a>
                            </Row>
                        ))}
                    </Flex>
                    <chakra.p m="0" fontWeight="600" data-testid="total-power">
                        {`Total voting power: ${coins.format({denom: sources.value[0].stakingDenom, amount: totalVotingPower(sources.value)})}`}
                    </chakra.p>
                </>
            )}
        </Panel>
    );
};

export const VotersLoading = () => <Shimmer h="140px" borderRadius="16px" aria-hidden />;
