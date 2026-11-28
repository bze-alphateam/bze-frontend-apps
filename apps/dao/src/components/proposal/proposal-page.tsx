'use client';

import NextLink from 'next/link';
import {chakra, Flex, SimpleGrid} from '@chakra-ui/react';
import {LuArrowLeft} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {getChainName, HgCard, Notice, PageContainer, PageState, Shimmer} from '@bze/bze-ui-kit';
import {InnerHero} from '@/components/ui/layout-hero';
import {PlainText} from '@/components/ui/plain-text';
import {AddressLine, Panel, Tag} from '@/components/dao/page/panel';
import {useCoinFormat} from '@/components/dao/page/use-coin-format';
import {Unsupported} from '@/components/dao/unsupported';
import {useAsync} from '@/hooks/useAsync';
import {useNow} from '@/hooks/useNow';
import {useProposalPage} from '@/hooks/useProposalPage';
import {liveProposalDeps} from '@/lib/dao-chain';
import {DAO_FEATURES} from '@/lib/dao-actions';
import {daoTabHref} from '@/lib/dao-tabs';
import {formatDateTime, formatRelative} from '@/lib/format';
import {daoIdsOf, describeMessages} from '@/lib/proposal-describe';
import {loadDaoNames, loadMyVote, type ProposalDeps, type ProposalPageData} from '@/lib/proposal-loader';
import {proposalFingerprint} from '@/lib/proposal-actions';
import {canSettleNow, describeStatus} from '@/lib/proposal-status';
import {ActionsPanel} from './actions-panel';
import {ProposalActionsSlot} from './actions-slot';
import {MyVotePanel} from './my-vote';
import {ProposalStatusPill} from './status-pill';
import {TallyPanel} from './tally-panel';
import {MoneyPanel, TimelinePanel} from './timeline-money';
import {useWeightFormat} from './use-weight-format';
import {VotesPanel} from './votes-panel';

interface BodyProps {
    deps: ProposalDeps;
    data: ProposalPageData;
    wallet: string | null;
    nowMs: number;
    onRetryScan: () => void;
    refresh: () => Promise<'ok' | 'gone' | 'failed'>;
    /** Changes after every in-place refresh: the wallet's own reads and the votes list follow it. */
    version: number;
    peek: () => ProposalPageData | null;
}

/** "← <DAO name> · proposals", back to the DAO's Proposals tab. */
const BackLink = ({daoId, daoName}: {daoId: string; daoName: string | null}) => (
    <chakra.a asChild alignSelf="flex-start" display="inline-flex" alignItems="center" gap="6px" fontSize="14px" fontWeight="500" color="fg.muted" _hover={{color: 'fg'}} data-testid="proposal-back">
        <NextLink href={daoTabHref(daoId, 'proposals')}>
            <LuArrowLeft size={14} aria-hidden />
            {`${daoName ?? 'The DAO'} · proposals`}
        </NextLink>
    </chakra.a>
);

const Body = ({deps, data, wallet, nowMs, onRetryScan, refresh, version, peek}: BodyProps) => {
    const {model} = data;
    const coins = useCoinFormat();
    const formatWeight = useWeightFormat(data.weightDenom);
    const status = describeStatus(model);
    // read once for both the actions and the "My vote" panel; re-read after every transaction
    const mine = useAsync(wallet ? `${model.id}:${wallet}:${model.status}:${version}` : null, () => loadMyVote(deps, model, wallet as string));
    const dao = data.dao.ok ? data.dao.value : null;
    const actions = describeMessages(model.msgs, {daoAddress: dao?.address ?? null, before: model.config, formatCoin: coins.format});
    // the DAOs the actions name by number (a SubDAO, a nominating DAO) are named from the chain; the DAO itself is already known
    const otherIds = daoIdsOf(actions).filter((id) => id !== model.daoId);
    const names = useAsync(otherIds.length > 0 ? `${model.id}:${otherIds.join(',')}` : null, () => loadDaoNames(deps, otherIds));
    const daoOf = (id: string) => (id === model.daoId ? model.daoName ?? undefined : names.data?.[id]);
    const proposerName = data.scanDetail?.proposer_label?.name;
    const stake = model.daoType === 'DAO_TYPE_STAKE';
    const ends = formatRelative(model.votingEnd, nowMs);

    return (
        <Flex direction="column" gap="18px">
            {model.daoId && <BackLink daoId={model.daoId} daoName={model.daoName} />}
            <HgCard data-testid="proposal-header">
                <Flex direction="column" gap="12px" p={{base: '16px', md: '22px'}}>
                    <Flex gap="10px" align="center" wrap="wrap">
                        <ProposalStatusPill view={status} />
                        {model.expedited && <Tag testId="proposal-expedited">Expedited</Tag>}
                        {model.archived && <Tag testId="proposal-archived">Archived</Tag>}
                        <chakra.span fontSize="13px" color="hg.text.faint" data-testid="proposal-number">{`Proposal #${model.id}`}</chakra.span>
                    </Flex>
                    {status.note && <chakra.p m="0" fontSize="14px" color="fg.muted" data-testid="status-note">{status.note}</chakra.p>}
                    <Flex gap="8px 18px" wrap="wrap" fontSize="14px" align="center" color="fg.muted">
                        <Flex gap="6px" align="center" data-testid="proposal-proposer"><span>by</span><AddressLine address={model.proposer} name={proposerName} /></Flex>
                        {model.status === 'VOTING' && model.votingEnd && <span data-testid="proposal-ends">{`Voting ends ${formatDateTime(model.votingEnd)}${ends ? ` (${ends})` : ''}`}</span>}
                    </Flex>
                </Flex>
            </HgCard>

            {model.archived && (
                <Notice status="info" title="Archived">
                    The chain cleaned this proposal up, so it is read from BZE Scan. Its votes may still be listed; whether it was settled early and its latest tally are as Scan indexed them.
                </Notice>
            )}
            {canSettleNow(model) && (
                <div data-testid="settle-banner">
                    <Notice status="warning" title="Anyone can settle this proposal now">
                        {model.votingEnded ? 'Its voting period is over; settling decides it from the tally below.' : 'It already meets the expedite bars, so it does not have to wait for the voting period to end.'}
                    </Notice>
                </div>
            )}
            {data.scanFailed && (
                <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="scan-retry">
                    <span>How the settle went and the cleanup could not be loaded from BZE Scan.</span>
                    <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={onRetryScan}>Retry</chakra.button>
                </Flex>
            )}

            {DAO_FEATURES.proposalActions && (
                <ProposalActionsSlot deps={deps} data={data} wallet={wallet} nowMs={nowMs} mine={mine} formatWeight={formatWeight} formatCoin={coins.format} refresh={refresh} fingerprint={() => proposalFingerprint(peek()?.model)} />
            )}

            {model.summary && (
                <Panel id="summary" title="Summary" testId="summary-panel">
                    <PlainText text={model.summary} testId="proposal-summary" />
                </Panel>
            )}
            <ActionsPanel actions={actions} formatCoin={coins.format} nameOf={(a) => (a === dao?.address ? dao.name : undefined)} daoOf={daoOf} raw={model.msgs} />
            <TallyPanel model={model} formatWeight={formatWeight} unit={stake ? '' : 'members'} />
            <SimpleGrid columns={{base: 1, lg: 2}} gap="16px" alignItems="start">
                <TimelinePanel data={data} nowMs={nowMs} />
                <MoneyPanel data={data} formatCoin={coins.format} />
            </SimpleGrid>
            {wallet && <MyVotePanel model={model} mine={mine} formatWeight={formatWeight} />}
            <VotesPanel key={version} deps={deps} proposalId={model.id} daoType={model.daoType} formatWeight={formatWeight} />
        </Flex>
    );
};

/** The page of one proposal: status, summary, actions, the tally against its bars, timeline, money and votes. Read only. */
export const ProposalPage = ({id, deps = liveProposalDeps}: {id: string; deps?: ProposalDeps}) => {
    const {address} = useChain(getChainName());
    const {load, data, reload, refresh, version, peek} = useProposalPage(deps, id);
    const nowMs = useNow();
    const state = load.data;

    return (
        <>
            <InnerHero title={data ? data.model.title : `Proposal ${id}`} />
            <PageContainer py={{base: '24px', md: '36px'}}>
                {load.loading && (
                    <Flex direction="column" gap="16px" aria-hidden data-testid="proposal-loading">
                        <Shimmer h="120px" borderRadius="16px" />
                        <Shimmer h="240px" borderRadius="16px" />
                    </Flex>
                )}
                {!load.loading && !!load.error && (
                    <PageState
                        kind="error"
                        title="This proposal did not load"
                        description="The chain or BZE Scan did not answer."
                        action={<chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={reload}>Try again</chakra.button>}
                    />
                )}
                {state?.state === 'unsupported' && <Unsupported />}
                {state?.state === 'not-found' && (
                    <PageState
                        kind="empty"
                        title="Proposal not found"
                        description={`There is no proposal with the number ${id}.`}
                        action={<chakra.a asChild color="hg.link" fontWeight="600"><NextLink href="/">Back to the DAOs</NextLink></chakra.a>}
                    />
                )}
                {data && <Body deps={deps} data={data} wallet={address ?? null} nowMs={nowMs} onRetryScan={reload} refresh={refresh} version={version} peek={peek} />}
            </PageContainer>
        </>
    );
};
