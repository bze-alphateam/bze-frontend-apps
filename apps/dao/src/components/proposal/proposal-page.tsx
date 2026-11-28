'use client';

import type {ReactNode} from 'react';
import NextLink from 'next/link';
import {Box, chakra, Flex} from '@chakra-ui/react';
import {LuArrowLeft, LuClock} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {AppLink, getChainName, getExplorerBaseURL, HeroGlow, PageContainer, PageState, Shimmer} from '@bze/bze-ui-kit';
import {PlainText} from '@/components/ui/plain-text';
import {useCoinFormat} from '@/components/dao/page/use-coin-format';
import {Unsupported} from '@/components/dao/unsupported';
import {useAsync} from '@/hooks/useAsync';
import {useNow} from '@/hooks/useNow';
import {useProposalPage} from '@/hooks/useProposalPage';
import {liveProposalDeps} from '@/lib/dao-chain';
import {DAO_FEATURES} from '@/lib/dao-actions';
import {daoTabHref} from '@/lib/dao-tabs';
import {shortAddress} from '@/lib/format';
import {daoIdsOf, describeMessages} from '@/lib/proposal-describe';
import {loadDaoRefs, loadMyVote, type ProposalDeps, type ProposalPageData} from '@/lib/proposal-loader';
import {proposalFingerprint} from '@/lib/proposal-actions';
import {headerClock, pagePill} from '@/lib/proposal-view';
import {useProposalActions, type ProposalActions} from './actions-slot';
import {ProposalDialogs} from './dialogs';
import {StateArea} from './state-card';
import {TallyPanel} from './tally-panel';
import {MoneyPanel, TimelinePanel} from './timeline-money';
import {Card, Pill} from './ui';
import {useWeightFormat} from './use-weight-format';
import {VotesPanel} from './votes-panel';
import {WhatItDoes} from './what-it-does';
import {YourVoteCard} from './your-vote';

/** Opens the wallet drawer of the header (its wallet button, `data-wallet-trigger`): the page has no wallet modal of its own. */
const clickHeaderConnect = () => {
    document.querySelector<HTMLButtonElement>('[data-wallet-trigger]')?.click();
};

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
    onConnect: () => void;
}

/** "← <DAO name> · proposals", back to the DAO's Proposals tab. */
const BackLink = ({daoId, daoName}: {daoId: string; daoName: string | null}) => (
    <chakra.a asChild alignSelf="flex-start" display="inline-flex" alignItems="center" gap="6px" fontSize="14px" fontWeight="500" color="fg.muted" textDecoration="none" _hover={{color: 'fg'}} data-testid="proposal-back">
        <NextLink href={daoTabHref(daoId, 'proposals')}>
            <LuArrowLeft size={16} aria-hidden />
            {`${daoName ?? 'The DAO'} · proposals`}
        </NextLink>
    </chakra.a>
);

/**
 * A card's place: on a phone the two columns dissolve (`display: contents`) and `order` puts the cards in the
 * phone board's order (I3: Your vote, Tally, the actions, Summary, Timeline, Deposit, Votes); from md up each
 * column keeps its own order.
 */
const Slot = ({order, children}: {order: number; children: ReactNode}) => <Box order={{base: order, md: 0}} minW="0" _empty={{display: 'none'}}>{children}</Box>;

const Header = ({data, nowMs}: {data: ProposalPageData; nowMs: number}) => {
    const {model} = data;
    const pill = pagePill(model);
    const clock = headerClock(model, nowMs);
    const proposerName = data.scanDetail?.proposer_label?.name;
    return (
        <Flex as="section" direction="column" gap={{base: '12px', md: '16px'}} data-testid="proposal-header">
            {model.daoId && <BackLink daoId={model.daoId} daoName={model.daoName} />}
            <Flex gap="8px" align="center" wrap="wrap" fontSize="12px">
                <chakra.span fontWeight="600" color="hg.text.faint" data-testid="proposal-number"><chakra.span srOnly>Proposal </chakra.span>{`#${model.id}`}</chakra.span>
                <Pill tone={pill.tone} live={pill.live}><span data-testid="proposal-status" data-status={pill.key}>{pill.label}</span></Pill>
                {model.expedited && <Pill tone="accent" testId="proposal-expedited">Expedited</Pill>}
                {model.archived && <Pill tone="neutral" testId="proposal-archived">Archived</Pill>}
            </Flex>
            <chakra.h1 m="0" fontSize={{base: '28px', md: '36px'}} lineHeight="1.15" fontWeight="800" letterSpacing="-0.02em" overflowWrap="anywhere" data-testid="proposal-heading">{model.title}</chakra.h1>
            <Flex gap={{base: '4px 12px', md: '6px 16px'}} align="center" wrap="wrap" fontSize={{base: '13px', md: '14px'}} color="fg.muted">
                {model.daoId && (
                    <span data-testid="proposal-dao">
                        {'In '}
                        <chakra.a asChild fontWeight="600" color="hg.link" textDecoration="none" _hover={{color: 'hg.link.hover'}}>
                            <NextLink href={daoTabHref(model.daoId, 'proposals')}>{model.daoName ?? `DAO ${model.daoId}`}</NextLink>
                        </chakra.a>
                    </span>
                )}
                <span data-testid="proposal-proposer">
                    {'by '}
                    {proposerName
                        ? <chakra.span fontWeight="600" color="hg.text.secondary" title={model.proposer}>{proposerName}</chakra.span>
                        : <chakra.span fontFamily="mono" fontSize="13px" color="hg.text.secondary" title={model.proposer}>{shortAddress(model.proposer)}</chakra.span>}
                </span>
                {clock && <chakra.span display="inline-flex" gap="6px" alignItems="center" data-testid="proposal-ends"><LuClock size={14} aria-hidden />{clock}</chakra.span>}
                {model.daoId && <span data-testid="proposal-explorer"><AppLink app="explorer" href={`${getExplorerBaseURL()}/daos/${model.daoId}/proposals/${model.id}`}>Explorer</AppLink></span>}
            </Flex>
        </Flex>
    );
};

const Body = ({deps, data, wallet, nowMs, onRetryScan, refresh, version, peek, onConnect}: BodyProps) => {
    const {model} = data;
    const coins = useCoinFormat();
    const formatWeight = useWeightFormat(data.weightDenom);
    // read once for the actions and Your vote; re-read after every transaction
    const mine = useAsync(wallet ? `${model.id}:${wallet}:${model.status}:${version}` : null, () => loadMyVote(deps, model, wallet as string));
    const dao = data.dao.ok ? data.dao.value : null;
    const actions = describeMessages(model.msgs, {daoAddress: dao?.address ?? null, before: model.config, formatCoin: coins.format});
    // the DAOs the actions name by number (a SubDAO, a nominating DAO) are named from the chain; the DAO itself is already known
    const otherIds = daoIdsOf(actions).filter((id) => id !== model.daoId);
    const refs = useAsync(otherIds.length > 0 ? `${model.id}:${otherIds.join(',')}` : null, () => loadDaoRefs(deps, otherIds));
    const daoOf = (id: string) => (id === model.daoId ? {name: model.daoName ?? undefined, address: dao?.address} : refs.data?.[id]);
    const proposalActions = useProposalActions({deps, data, wallet, nowMs, mine, refresh, fingerprint: () => proposalFingerprint(peek()?.model)});
    const live: ProposalActions | null = DAO_FEATURES.proposalActions ? proposalActions : null;
    const memberCount = model.daoType === 'DAO_TYPE_STATIC_LIST' && dao ? dao.members.length : null;

    return (
        <Flex direction="column" gap={{base: '16px', md: '24px'}}>
            <Header data={data} nowMs={nowMs} />
            {data.scanFailed && (
                <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="scan-retry">
                    <span>How the settle went and the cleanup could not be loaded from BZE Scan.</span>
                    <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={onRetryScan}>Retry</chakra.button>
                </Flex>
            )}
            <Flex direction={{base: 'column', md: 'row'}} wrap={{md: 'wrap'}} gap={{base: '16px', md: '24px'}} align={{md: 'flex-start'}} data-testid="proposal-columns">
                <Flex display={{base: 'contents', md: 'flex'}} direction="column" gap="20px" flex={{md: '999 1 560px'}} minW="0" data-testid="proposal-main">
                    <Slot order={0}><StateArea actions={live} model={model} nowMs={nowMs} /></Slot>
                    {model.summary && (
                        <Slot order={4}>
                            <Card id="summary" title="Summary" testId="summary-panel">
                                <PlainText text={model.summary} testId="proposal-summary" color="hg.text.secondary" />
                            </Card>
                        </Slot>
                    )}
                    <Slot order={3}>
                        <WhatItDoes actions={actions} raw={model.msgs} formatCoin={coins.format} nameOf={(a) => (a === dao?.address ? dao.name : undefined)} daoOf={daoOf} memberCount={memberCount} />
                    </Slot>
                    <Slot order={2}><TallyPanel model={model} formatWeight={formatWeight} /></Slot>
                    <Slot order={7}><VotesPanel key={version} deps={deps} proposalId={model.id} daoType={model.daoType} formatWeight={formatWeight} /></Slot>
                </Flex>
                <Flex as="aside" display={{base: 'contents', md: 'flex'}} direction="column" gap="20px" flex={{md: '1 1 360px'}} minW="0" data-testid="proposal-aside">
                    {live && <Slot order={1}><YourVoteCard actions={live} model={model} mine={mine} formatWeight={formatWeight} onConnect={onConnect} /></Slot>}
                    <Slot order={5}><TimelinePanel data={data} nowMs={nowMs} proposerName={data.scanDetail?.proposer_label?.name ?? undefined} /></Slot>
                    <Slot order={6}><MoneyPanel data={data} formatCoin={coins.format} /></Slot>
                </Flex>
            </Flex>
            {live && <ProposalDialogs actions={live} model={model} mine={mine} formatWeight={formatWeight} formatCoin={coins.format} />}
        </Flex>
    );
};

/** The page of one proposal (E2): header, then the main column (what next, summary, actions, tally, votes) and the aside (your vote, timeline, money). */
export const ProposalPage = ({id, deps = liveProposalDeps, onConnect = clickHeaderConnect}: {id: string; deps?: ProposalDeps; onConnect?: () => void}) => {
    const {address} = useChain(getChainName());
    const {load, data, reload, refresh, version, peek} = useProposalPage(deps, id);
    const nowMs = useNow();
    const state = load.data;

    return (
        <Box position="relative" overflow="hidden">
            <HeroGlow strength="inner" h="420px" />
            <PageContainer position="relative" zIndex="1" pt={{base: '20px', md: '28px'}} pb={{base: '48px', md: '64px'}}>
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
                {data && <Body deps={deps} data={data} wallet={address ?? null} nowMs={nowMs} onRetryScan={reload} refresh={refresh} version={version} peek={peek} onConnect={onConnect} />}
            </PageContainer>
        </Box>
    );
};
