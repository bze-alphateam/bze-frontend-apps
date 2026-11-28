'use client';

import {Suspense, useState} from 'react';
import NextLink from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Box, chakra, Flex} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {getChainName, HeroGlow, PageContainer, PageState, Shimmer} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {useDaoExtras} from '@/hooks/useDaoExtras';
import {liveDaoViewDeps, liveProposalDeps, liveSubDaoDeps} from '@/lib/dao-chain';
import {actionsFor, DAO_FEATURES} from '@/lib/dao-actions';
import type {SubDaoDeps} from '@/lib/dao-subdaos';
import {parseDaoTab} from '@/lib/dao-tabs';
import {loadDaoView, type DaoView, type DaoViewDeps} from '@/lib/dao-view-loader';
import type {ProposalDeps} from '@/lib/proposal-loader';
import {proposerStatus} from '@/lib/propose/eligibility';
import {shortcutApplies, shortcutHref} from '@/lib/propose/shortcuts';
import {Unsupported} from '../unsupported';
import {ControlBox} from './control-box';
import {DaoShell} from './dao-shell';
import {HistoryTab} from './history-tab';
import {MyPower} from './my-power';
import {ProposalsTab} from './proposals-tab';
import {TreasuryPanel} from './panels';
import {VotersPanel} from './voters-panels';
import {Note} from './bits';

interface Deps {
    deps: DaoViewDeps;
    proposalDeps: ProposalDeps;
    subDaoDeps: SubDaoDeps;
}

const Body = ({deps, proposalDeps, subDaoDeps, view, wallet}: Deps & {view: DaoView; wallet: string | null}) => {
    const {dao} = view;
    const tab = parseDaoTab(useSearchParams()?.get('tab'));
    const extras = useDaoExtras(deps, dao.id);

    // Names Scan knows (creator, admin, controller, the DAO) and the DAOs of the admin chain.
    const labels = new Map<string, string>();
    const detail = extras.data;
    for (const [address, label] of [
        [detail?.creator, detail?.creator_label], [detail?.admin, detail?.admin_label],
        [dao.address, detail?.address_label], [detail?.controller?.address, detail?.controller?.label],
    ] as const) {
        if (address && label) labels.set(address, label.name);
    }
    for (const [address, known] of view.knownDaos) labels.set(address, labels.get(address) ?? known.name);
    const nameOf = (address: string) => labels.get(address);

    const actions = actionsFor(DAO_FEATURES, dao, wallet);
    // "Request to join" follows the composer's rule: a member list open to anyone, a wallet not on it, a DAO that can take a proposal now
    const params = view.params.ok ? view.params.value : null;
    const status = wallet && params
        ? proposerStatus({dao, params, wallet, power: {ok: false}, openCount: view.openProposals.ok ? view.openProposals.value.length : null, sources: view.sources})
        : null;
    const joinHref = DAO_FEATURES.memberComposer && shortcutApplies('join', dao, wallet, status) ? shortcutHref(dao.id, 'join') : null;

    return (
        <DaoShell dao={dao} active={tab} wallet={wallet} extras={extras} openProposals={view.openProposals}>
            {tab === 'overview' && (
                <chakra.div
                    display="grid"
                    gridTemplateColumns={{base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px'}}
                    gap={{base: '16px', lg: '24px'}}
                    alignItems="start"
                    data-testid="overview-tab"
                >
                    {/* desktop: two columns; on a phone the columns dissolve (display: contents) and the
                        cards follow the phone board's order: voting power, who controls it, treasury, who votes */}
                    <Flex direction="column" gap="20px" minW="0" display={{base: 'contents', lg: 'flex'}}>
                        <Box minW="0" order={{base: 2, lg: 0}}>
                            <ControlBox view={view} wallet={wallet} detail={detail} nameOf={nameOf} subDaoDeps={subDaoDeps} />
                        </Box>
                        <Box minW="0" order={{base: 4, lg: 0}}>
                            <VotersPanel dao={dao} sources={view.sources} nameOf={nameOf} wallet={wallet} joinHref={joinHref} />
                        </Box>
                    </Flex>
                    <Flex direction="column" gap="20px" minW="0" display={{base: 'contents', lg: 'flex'}}>
                        {wallet && (
                            <Box minW="0" order={{base: 1, lg: 0}}>
                                <MyPower deps={deps} dao={dao} wallet={wallet} sources={view.sources} openProposals={view.openProposals} />
                            </Box>
                        )}
                        <Box minW="0" order={{base: 3, lg: 0}}>
                            <TreasuryPanel treasury={view.treasury} />
                        </Box>
                    </Flex>
                </chakra.div>
            )}
            {tab === 'proposals' && <ProposalsTab deps={proposalDeps} daoId={dao.id} nameOf={nameOf} newProposal={actions.newProposal} />}
            {tab === 'history' && <HistoryTab deps={deps} daoId={dao.id} daoAddress={dao.address} nameOf={nameOf} creator={detail?.creator} />}
        </DaoShell>
    );
};

const Loading = () => (
    <Flex direction="column" gap="16px" aria-hidden data-testid="dao-loading">
        <Shimmer h="140px" borderRadius="16px" />
        <Shimmer h="260px" borderRadius="16px" />
    </Flex>
);

const Page = ({id, deps, proposalDeps, subDaoDeps}: Deps & {id: string}) => {
    const {address} = useChain(getChainName());
    const [reload, setReload] = useState(0);
    const result = useAsync(`${id}:${reload}`, () => loadDaoView(deps, id));
    const data = result.data;

    return (
        <Box position="relative">
        <HeroGlow strength="inner" h="420px" />
        <PageContainer position="relative" pt={{base: '20px', md: '28px'}} pb={{base: '48px', md: '64px'}}>
            {result.loading && <Loading />}
            {!result.loading && !!result.error && (
                <PageState
                    kind="error"
                    title="This DAO did not load"
                    description="The chain did not answer."
                    action={<chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setReload((n) => n + 1)}>Try again</chakra.button>}
                />
            )}
            {data?.state === 'unsupported' && <Unsupported />}
            {data?.state === 'not-found' && (
                <Note
                    tone="neutral"
                    title="Not found"
                    testId="dao-not-found"
                    action={(
                        <chakra.a asChild display="inline-flex" alignItems="center" h="32px" px="12px" borderRadius="12px" fontSize="13px" fontWeight="600" color="fg" textDecoration="none" bg="hg.secondaryFill" borderWidth="1px" borderColor="hg.lineStrong">
                            <NextLink href="/">All DAOs</NextLink>
                        </chakra.a>
                    )}
                >
                    {/^\d+$/.test(id) ? `No DAO #${id} on this network. It may be on mainnet or testnet only.` : 'There is no such DAO on this network.'}
                </Note>
            )}
            {data?.state === 'ok' && (
                <Body deps={deps} proposalDeps={proposalDeps} subDaoDeps={subDaoDeps} view={data.view} wallet={address ?? null} />
            )}
        </PageContainer>
        </Box>
    );
};

/**
 * The page of one DAO: the shared header and tabs (`DaoShell`), then the tab in `?tab=` (`daoTabHref`):
 * Overview (who controls it, who votes, the wallet's power, the treasury), Proposals or History.
 */
export const DaoPage = ({id, deps = liveDaoViewDeps, proposalDeps = liveProposalDeps, subDaoDeps = liveSubDaoDeps}: {id: string; deps?: DaoViewDeps; proposalDeps?: ProposalDeps; subDaoDeps?: SubDaoDeps}) => (
    <Suspense fallback={<PageContainer pt={{base: '20px', md: '28px'}} pb={{base: '48px', md: '64px'}}><Loading /></PageContainer>}>
        <Page id={id} deps={deps} proposalDeps={proposalDeps} subDaoDeps={subDaoDeps} />
    </Suspense>
);
