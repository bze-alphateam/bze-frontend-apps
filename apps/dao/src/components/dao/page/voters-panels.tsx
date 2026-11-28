'use client';

import {useState, type ReactNode} from 'react';
import NextLink from 'next/link';
import {Button, chakra, Flex} from '@chakra-ui/react';
import type {Dao} from '@bze/bze-ui-kit';
import {getDexApp, hgVariant, Notice, Shimmer} from '@bze/bze-ui-kit';
import {shortAddress} from '@/lib/format';
import {dexSourceHref, memberPreview, sourceDetail, sourceName, totalVotingPower, type StakeSource} from '@/lib/dao-voters';
import type {Part} from '@/lib/dao-view-loader';
import {Card, CardTitle, CopyAddress, Note, OutLink, Pill} from './bits';
import {useCoinFormat} from './use-coin-format';

const same = (a: string, b: string | null | undefined): boolean => !!b && a.toLowerCase() === b.toLowerCase();

const Head = ({pill, children}: {pill: string; children?: ReactNode}) => (
    <Flex gap="10px" align="center" wrap="wrap">
        <CardTitle id="voters-title">Who votes</CardTitle>
        <Pill tone="neutral" testId="voters-kind">{pill}</Pill>
        {children}
    </Flex>
);

/** Who votes: the member list of a static-list DAO, or the sources a stake DAO counts stake in. */
export const VotersPanel = ({dao, sources, nameOf, wallet = null, joinHref = null}: {
    dao: Dao;
    sources: Part<StakeSource[]>;
    nameOf: (address: string) => string | undefined;
    /** The connected wallet: its row says "You". */
    wallet?: string | null;
    /** The composer opened with the join shortcut, when the wallet can ask to join (`shortcutApplies`); null hides it. */
    joinHref?: string | null;
}) => {
    const coins = useCoinFormat();
    const [showAll, setShowAll] = useState(false);

    if (dao.type === 'DAO_TYPE_STATIC_LIST') {
        const n = dao.members.length;
        const {shown, hidden} = memberPreview(dao.members, showAll);
        return (
            <Card testId="voters-panel" gap="12px">
                <Head pill="Member list">
                    <chakra.span fontSize="13px" lineHeight="1.5" color="hg.text.faint" data-testid="member-count">
                        {`${n} ${n === 1 ? 'member' : 'members'} · one vote each`}
                    </chakra.span>
                </Head>
                {n === 0 && (
                    <Note tone="neutral" title="Empty electorate" testId="no-voters">
                        No voters yet. This member list is empty. Its admin adds the first members; nobody can vote until then.
                    </Note>
                )}
                {joinHref && (
                    <Note
                        tone="indigo"
                        testId="join-note"
                        action={(
                            <Button asChild variant={hgVariant('primary')} size="sm" h="32px" px="12px" fontSize="13px">
                                <NextLink href={joinHref} data-testid="request-to-join">Request to join</NextLink>
                            </Button>
                        )}
                    >
                        You&apos;re not a member. Proposals here are open to anyone: ask to join with a proposal that adds you.
                    </Note>
                )}
                {n > 0 && (
                    <div>
                        {shown.map((member) => {
                            const label = nameOf(member);
                            return (
                                <chakra.div key={member} display="grid" gridTemplateColumns="minmax(0, 1fr) auto" gap="12px" alignItems="center" py="12px" borderTopWidth="1px" borderColor="hg.divider" data-testid="member">
                                    <Flex align="center" gap="10px" minW="0" wrap="wrap">
                                        <chakra.span fontFamily="mono" fontSize="13px" color="fg" title={member} data-testid="member-address">{shortAddress(member)}</chakra.span>
                                        {same(member, wallet) && <Pill tone="indigo" testId="member-you">You</Pill>}
                                        {label && <chakra.span fontSize="13px" lineHeight="1.5" color="fg.muted" overflowWrap="anywhere">{label}</chakra.span>}
                                    </Flex>
                                    <CopyAddress address={member} label={`Copy address ${member}`} />
                                </chakra.div>
                            );
                        })}
                    </div>
                )}
                {hidden > 0 && (
                    <chakra.button type="button" alignSelf="flex-start" py="4px" border="0" bg="transparent" color="hg.link" fontWeight="600" fontSize="13px" cursor="pointer" onClick={() => setShowAll(true)}>
                        {`Show all ${n}`}
                    </chakra.button>
                )}
            </Card>
        );
    }

    const dexHref = getDexApp().href;
    const list = sources.ok ? sources.value : null;
    const tickers = list ? [...new Set(list.map((s) => coins.ticker(s.stakingDenom)))] : [];
    return (
        <Card testId="voters-panel">
            <Head pill="Stakers" />
            {!list && <Notice status="warning">The voting sources could not be read from the chain right now.</Notice>}
            {list?.length === 0 && (
                <Note tone="neutral" title="Empty electorate" testId="no-voters">
                    No voters yet. This DAO has no staking rewards to count stake in. Its admin sets it up; nobody can vote until someone stakes.
                </Note>
            )}
            {list && list.length > 0 && (
                <>
                    <chakra.p m="0" fontSize="14px" lineHeight="1.55" color="hg.text.secondary">
                        {`Anyone staking ${tickers.join(' or ')} in ${list.length === 1 ? 'this reward' : 'these rewards'}. Voting power = stake.`}
                    </chakra.p>
                    <div>
                        {list.map((source) => (
                            <chakra.div
                                key={source.kind === 'sr' ? `sr/${source.id}` : `dr/${source.stakingDenom}`}
                                display="grid"
                                gridTemplateColumns={{base: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) auto auto'}}
                                gap={{base: '4px 16px', md: '16px'}}
                                alignItems="center"
                                py="14px"
                                borderTopWidth="1px"
                                borderColor="hg.divider"
                                data-testid="source-row"
                            >
                                <Flex direction="column" gap="2px" minW="0">
                                    <chakra.strong fontSize="15px">{sourceName(source)}</chakra.strong>
                                    <chakra.span fontSize="13px" color="hg.text.faint">{sourceDetail(source, coins.ticker(source.stakingDenom))}</chakra.span>
                                </Flex>
                                <chakra.span fontSize="14px" fontWeight="600" textAlign="end" data-testid="source-staked">{coins.format({denom: source.stakingDenom, amount: source.staked})}</chakra.span>
                                <chakra.span gridColumn={{base: '1 / -1', md: 'auto'}}>
                                    <OutLink href={dexSourceHref(dexHref, source)} tone="dex" testId="source-link">Stake on DEX</OutLink>
                                </chakra.span>
                            </chakra.div>
                        ))}
                    </div>
                    <Flex gap="10px" align="center" wrap="wrap" data-testid="total-power">
                        <chakra.span fontSize="13px" lineHeight="1.5" color="hg.text.faint">Total voting power</chakra.span>
                        <chakra.strong fontSize="15px">{coins.format({denom: list[0].stakingDenom, amount: totalVotingPower(list)})}</chakra.strong>
                        <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint">(the DAO&apos;s own stake never counts)</chakra.span>
                    </Flex>
                </>
            )}
        </Card>
    );
};

export const VotersLoading = () => <Shimmer h="140px" borderRadius="16px" aria-hidden />;
