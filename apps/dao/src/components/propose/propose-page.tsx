'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import NextLink from 'next/link';
import {useRouter} from 'next/navigation';
import {chakra, Flex} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import type {DaoVotingPowerResponse} from '@bze/bze-ui-kit';
import {
    buildSubmitProposalMsg, getChainName, getTxEvents, getTxLanding, Notice, PageContainer, PageState, Shimmer, useAssets, useBalances, useBZETx,
} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {useProposalRedirect} from '@/hooks/useProposalRedirect';
import {useProposalSubmit, type SignAndBroadcast} from '@/hooks/useProposalSubmit';
import {liveDaoViewDeps} from '@/lib/dao-chain';
import {loadDaoView, loadVotingPower, type DaoView, type DaoViewDeps, type Part} from '@/lib/dao-view-loader';
import {availableActions, findAction} from '@/lib/actions/registry';
import type {ActionContext, ActionDraft} from '@/lib/actions/types';
import {composeProposal} from '@/lib/propose/compose';
import {summarizeCost} from '@/lib/propose/cost';
import {describeAll} from '@/lib/propose/describe';
import {browserStorage, clearDraft, loadDraft, saveDraft} from '@/lib/propose/draft';
import {proposerStatus} from '@/lib/propose/eligibility';
import {InnerHero} from '@/components/ui/layout-hero';
import {useCoinFormat} from '@/components/dao/page/use-coin-format';
import {Unsupported} from '@/components/dao/unsupported';
import {ActionsList} from './actions-list';
import {Basics} from './basics';
import {Review} from './review';
import {SubmitArea} from './submit-area';

const newKey = (): string => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const Composer = ({deps, view, wallet, sign}: {deps: DaoViewDeps; view: DaoView; wallet: string | null; sign: SignAndBroadcast}) => {
    const {dao, treasury, openProposals, sources} = view;
    const params = view.params.ok ? view.params.value : null;
    const router = useRouter();
    const coins = useCoinFormat();
    const {getAsset} = useAssets();
    const {getBalanceByDenom, isLoading: balancesLoading} = useBalances();
    const storage = useMemo(() => browserStorage(), []);
    const [restored] = useState(() => loadDraft(storage, dao.id, (type) => availableActions(dao).some((e) => e.id === type) && !!findAction(type), newKey, {
        allowExpedite: dao.config.allow_expedite,
        allowSummary: Number(params?.max_summary_len ?? '0') > 0,
    }));

    const [title, setTitle] = useState(restored?.title ?? '');
    const [summary, setSummary] = useState(restored?.summary ?? '');
    const [expedited, setExpedited] = useState(restored?.expedited ?? false);
    const [drafts, setDrafts] = useState<ActionDraft[]>(restored?.actions ?? []);
    const [notice, setNotice] = useState(restored !== null);
    const finished = useRef(false);
    const {state, submit, check, allowResubmit} = useProposalSubmit({sign, daoId: dao.id, storage, getTxLanding, fetchTxEvents: getTxEvents});

    const power = useAsync<Part<DaoVotingPowerResponse | null>>(
        wallet ? `${dao.id}:${wallet}` : null,
        () => loadVotingPower(deps, dao.id, wallet ?? '').then(
            (value): Part<DaoVotingPowerResponse | null> => ({ok: true, value}),
            (): Part<DaoVotingPowerResponse | null> => ({ok: false}),
        ),
    );

    const ctx: ActionContext | null = useMemo(() => params && {
        dao,
        params,
        treasury: treasury.ok ? treasury.value : null,
        decimalsOf: (denom: string) => getAsset(denom)?.decimals ?? null,
        ticker: coins.ticker,
    }, [dao, params, treasury, getAsset, coins.ticker]);

    // what is sent is what is shown: trimmed text, once
    const input = useMemo(() => ({title: title.trim(), summary: summary.trim(), expedited, actions: drafts}), [title, summary, expedited, drafts]);
    const composition = useMemo(() => (ctx ? composeProposal(input, ctx) : null), [input, ctx]);
    const cost = useMemo(() => summarizeCost(
        dao.config,
        coins.exact,
        (denom) => (balancesLoading ? null : getBalanceByDenom(denom).amount),
    ), [dao.config, coins.exact, balancesLoading, getBalanceByDenom]);

    const status = wallet && params
        ? proposerStatus({
            dao, params, wallet,
            power: power.data ?? {ok: false},
            openCount: openProposals.ok ? openProposals.value.length : null,
            sources,
        })
        : null;

    const onDone = useCallback(() => {
        finished.current = true;
        clearDraft(storage, dao.id);
    }, [storage, dao.id]);
    useProposalRedirect(state, router.push, onDone);

    useEffect(() => {
        if (finished.current) return;
        saveDraft(storage, dao.id, {title, summary, expedited, actions: drafts});
    }, [storage, dao.id, title, summary, expedited, drafts]);

    const discard = useCallback(() => {
        clearDraft(storage, dao.id);
        setTitle('');
        setSummary('');
        setExpedited(false);
        setDrafts([]);
        setNotice(false);
    }, [storage, dao.id]);

    if (!params || !ctx || !composition) {
        return <PageState kind="error" title="The rules of the chain did not load" description="The proposal limits could not be read, so a proposal cannot be checked." />;
    }

    const {actions: described, unreadable} = describeAll(composition.actions.flatMap((a) => (a.msg ? [a.msg] : [])), dao, coins.exact);
    const problem = composition.contentError ?? composition.expeditedError ?? composition.actions.find((a) => a.error)?.error
        ?? (unreadable > 0 ? 'Some actions could not be read back, so they are shown below as raw JSON. A proposal is only sent when everything it signs can be shown.' : undefined);
    const ready = composition.ready && unreadable === 0;
    const send = () => {
        if (!wallet || !ready) return;
        void submit(buildSubmitProposalMsg({proposer: wallet, daoId: dao.id, title: input.title, summary: input.summary, msgs: composition.msgs, expedited}));
    };

    return (
        <Flex direction="column" gap="18px">
            {notice && (
                <Notice status="info">
                    <Flex gap="10px" align="center" wrap="wrap" data-testid="draft-restored">
                        <span>Your unsent draft for this DAO was restored.</span>
                        <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={discard} data-testid="draft-discard">Discard it</chakra.button>
                    </Flex>
                </Notice>
            )}
            <Basics
                dao={dao} params={params} title={title} summary={summary} expedited={expedited}
                onTitle={setTitle} onSummary={setSummary} onExpedited={setExpedited}
            />
            <ActionsList drafts={drafts} composed={composition.actions} ctx={ctx} maxActions={Number(params.max_msgs_per_proposal)} formatCoin={coins.exact} onChange={setDrafts} />
            <Review
                dao={dao}
                composition={composition}
                actions={described}
                cost={cost}
                formatCoin={coins.exact}
                nameOf={(a) => (a === dao.address ? dao.name : undefined)}
                expedited={expedited}
                balancesKnown={!balancesLoading && !!wallet}
            />
            <SubmitArea
                dao={dao}
                wallet={wallet}
                status={status}
                ready={ready}
                short={cost.short}
                problem={problem}
                state={state}
                onSubmit={send}
                onCheck={check}
                onAllowResubmit={allowResubmit}
            />
        </Flex>
    );
};

/** `/dao/[id]/propose`: write a proposal to a DAO and submit it. */
export const ProposePage = ({id, deps = liveDaoViewDeps}: {id: string; deps?: DaoViewDeps}) => {
    const {address} = useChain(getChainName());
    const {tx} = useBZETx();
    const [reload, setReload] = useState(0);
    const result = useAsync(`${id}:${reload}`, () => loadDaoView(deps, id));
    const data = result.data;
    const title = data?.state === 'ok' ? `New proposal for ${data.view.dao.name}` : 'New proposal';

    return (
        <>
            <InnerHero title={title} />
            <PageContainer py={{base: '24px', md: '36px'}}>
                {result.loading && (
                    <Flex direction="column" gap="16px" aria-hidden data-testid="propose-loading">
                        <Shimmer h="240px" borderRadius="16px" />
                        <Shimmer h="180px" borderRadius="16px" />
                    </Flex>
                )}
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
                    <PageState
                        kind="empty"
                        title="DAO not found"
                        description={`There is no DAO with the number ${id}.`}
                        action={<chakra.a asChild color="hg.link" fontWeight="600"><NextLink href="/">Back to the DAOs</NextLink></chakra.a>}
                    />
                )}
                {data?.state === 'ok' && (
                    <Flex direction="column" gap="14px">
                        <chakra.a asChild color="hg.link" fontWeight="600" fontSize="14px" alignSelf="flex-start"><NextLink href={`/dao/${data.view.dao.id}`}>{`← ${data.view.dao.name}`}</NextLink></chakra.a>
                        <Composer deps={deps} view={data.view} wallet={address ?? null} sign={tx} />
                    </Flex>
                )}
            </PageContainer>
        </>
    );
};
