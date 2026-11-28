'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import NextLink from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {chakra, Flex} from '@chakra-ui/react';
import {LuArrowLeft} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import type {DaoVotingPowerResponse} from '@bze/bze-ui-kit';
import {
    buildSubmitProposalMsg, getChainName, getDexApp, getTxEvents, getTxLanding, PageContainer, PageState, Shimmer, useBalances, useBZETx,
} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {useProposalRedirect} from '@/hooks/useProposalRedirect';
import {useProposalSubmit, type SignAndBroadcast} from '@/hooks/useProposalSubmit';
import {liveDaoViewDeps, liveNominationChain, liveRelationDeps} from '@/lib/dao-chain';
import type {NominationChain} from '@/lib/admin/nomination';
import {daoTabHref} from '@/lib/dao-tabs';
import {loadDaoView, loadVotingPower, type DaoView, type DaoViewDeps, type Part} from '@/lib/dao-view-loader';
import {availableActions, findAction} from '@/lib/actions/registry';
import type {ActionDraft} from '@/lib/actions/types';
import {composeProposal} from '@/lib/propose/compose';
import {costRows, summarizeCost} from '@/lib/propose/cost';
import {slotsLine} from '@/lib/propose/composer-text';
import {dexSourceHref} from '@/lib/dao-voters';
import {describeAll} from '@/lib/propose/describe';
import {browserStorage, clearDraft, loadDraft, saveDraft} from '@/lib/propose/draft';
import {proposerStatus} from '@/lib/propose/eligibility';
import {loadRelations, splitStaleNominations, type RelationDeps, type Relations} from '@/lib/propose/relations';
import {shortcutDraft, shortcutInDraft, shortcutOf, type Shortcut} from '@/lib/propose/shortcuts';
import {useCoinFormat} from '@/components/dao/page/use-coin-format';
import {Unsupported} from '@/components/dao/unsupported';
import {ActionsList} from './actions-list';
import {useActionContext} from './use-action-context';
import {Basics} from './basics';
import {SizeMeter} from './review';
import {SHORTCUT_NOTE, ShortcutsBar} from './shortcuts-bar';
import {SubmitArea} from './submit-area';

const newKey = (): string => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const Composer = ({deps, view, relations, wallet, sign}: {deps: DaoViewDeps; view: DaoView; relations: Relations; wallet: string | null; sign: SignAndBroadcast}) => {
    const {dao, openProposals, sources} = view;
    const params = view.params.ok ? view.params.value : null;
    const router = useRouter();
    const pathname = usePathname();
    const coins = useCoinFormat();
    const {getBalanceByDenom, isLoading: balancesLoading} = useBalances();
    const storage = useMemo(() => browserStorage(), []);

    // a stale nomination is never offered to the actions (picker, accept form, restored draft): the picker only shows it greyed out
    const {relations: usable, stale} = useMemo(() => splitStaleNominations(relations), [relations]);
    const ctx = useActionContext(view, usable);

    // an unsent draft wins; with none, a shortcut link ("Request to join", "Leave") opens with its one action filled in
    const [opening] = useState(() => {
        const saved = loadDraft(storage, dao.id, (type) => !!findAction(type) && (!ctx || availableActions(dao, ctx).some((e) => e.id === type) || (type === 'accept-nomination' && ctx.incoming === null)), newKey, {
            allowExpedite: dao.config.allow_expedite,
            allowSummary: Number(params?.max_summary_len ?? '0') > 0,
        });
        const shortcut = typeof window === 'undefined' ? null : shortcutOf(window.location.search);
        if (saved) return {draft: saved, restored: true, shortcut};
        // the same rule as the buttons: a DAO that cannot take a proposal now (no voters, full) gets no shortcut
        const blocked = wallet && params
            ? proposerStatus({dao, params, wallet, power: {ok: false}, openCount: openProposals.ok ? openProposals.value.length : null, sources})
            : null;
        const prefilled = shortcut ? shortcutDraft(shortcut, dao, wallet, newKey, blocked) : null;
        return {draft: prefilled, restored: false, shortcut};
    });
    const restored = opening.restored ? opening.draft : null;

    const [title, setTitle] = useState(opening.draft?.title ?? '');
    const [summary, setSummary] = useState(opening.draft?.summary ?? '');
    const [expedited, setExpedited] = useState(opening.draft?.expedited ?? false);
    const [drafts, setDrafts] = useState<ActionDraft[]>(opening.draft?.actions ?? []);
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

    // the link has done its work: drop the query so a reload shows the saved draft, not a fresh shortcut
    useEffect(() => {
        if (opening.shortcut !== null) router.replace(pathname);
    }, [opening.shortcut, router, pathname]);

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

    // "Prefilled" while the wallet's own members change is in the list (from a link, a button or a restored draft): removing it offers the button again
    const applied = shortcutInDraft(drafts, wallet);
    const maxActions = Number(params?.max_msgs_per_proposal ?? '0');
    const full = drafts.length >= maxActions;

    // a shortcut button: the wallet's own members change is added, and the title filled in when there is none yet
    const applyShortcut = useCallback((shortcut: Shortcut) => {
        const prefilled = shortcutDraft(shortcut, dao, wallet, newKey, status);
        // never past the most actions a proposal may run
        if (!prefilled || drafts.length + prefilled.actions.length > maxActions) return;
        setDrafts([...drafts, ...prefilled.actions]);
        setTitle((t) => (t.trim() === '' ? prefilled.title : t));
    }, [dao, wallet, status, maxActions, drafts]);

    if (!params || !ctx || !composition) {
        return <PageState kind="error" title="The rules of the chain did not load" description="The proposal limits could not be read, so a proposal cannot be checked." />;
    }

    const {unreadable} = describeAll(composition.actions.flatMap((a) => (a.msg ? [a.msg] : [])), dao, coins.exact, ctx.subDaos);
    const problem = composition.contentError ?? composition.expeditedError ?? composition.actions.find((a) => a.error)?.error
        ?? (unreadable > 0 ? 'Some actions could not be read back: their cards say which. A proposal is only sent when everything it signs can be shown.' : undefined);
    const ready = composition.ready && unreadable === 0;
    const send = () => {
        if (!wallet || !ready) return;
        void submit(buildSubmitProposalMsg({proposer: wallet, daoId: dao.id, title: input.title, summary: input.summary, msgs: composition.msgs, expedited}));
    };
    const firstSource = sources.ok ? sources.value[0] : undefined;
    const stakeHref = firstSource ? dexSourceHref(getDexApp().href, firstSource) : null;

    return (
        <Flex wrap="wrap" gap="24px" align="flex-start" data-testid="composer">
            <Flex flex="999 1 560px" minW="0" direction="column" gap="20px">
                <chakra.section
                    aria-label="The proposal"
                    bg="hg.card"
                    borderWidth="1px"
                    borderColor="hg.hairline"
                    borderRadius="20px"
                    boxShadow="hg.card"
                    p={{base: '16px', md: '28px'}}
                    display="flex"
                    flexDirection="column"
                    gap="22px"
                    minW="0"
                    data-testid="proposal-card"
                >
                    <ShortcutsBar dao={dao} wallet={wallet} status={status} applied={applied} full={full} onApply={applyShortcut} />
                    <Basics
                        dao={dao} params={params} title={title} summary={summary} expedited={expedited}
                        onTitle={setTitle} onSummary={setSummary} onExpedited={setExpedited}
                    />
                    <Flex direction="column" gap="12px" minW="0">
                        <ActionsList
                            staged
                            wallet={wallet}
                            drafts={drafts}
                            composed={composition.actions}
                            ctx={ctx}
                            maxActions={maxActions}
                            formatCoin={coins.exact}
                            onChange={setDrafts}
                            staleNominations={stale}
                        />
                        {applied !== null && <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="shortcut-note">{SHORTCUT_NOTE[applied]}</chakra.span>}
                        <SizeMeter size={composition.size} max={composition.maxBytes} count={drafts.length} maxActions={maxActions} />
                    </Flex>
                </chakra.section>
            </Flex>
            <Flex as="aside" flex="1 1 340px" minW="0" direction="column" gap="20px" data-testid="composer-aside">
                <SubmitArea
                    dao={dao}
                    wallet={wallet}
                    status={status}
                    ready={ready}
                    short={cost.short}
                    problem={problem}
                    state={state}
                    rows={costRows(dao.config, coins.exact)}
                    requirements={cost.requirements}
                    balancesKnown={!balancesLoading && !!wallet}
                    formatCoin={coins.exact}
                    slots={openProposals.ok ? slotsLine(openProposals.value.length, Number(params.max_open_proposals)) : null}
                    stakeHref={stakeHref}
                    onSubmit={send}
                    onCheck={check}
                    onAllowResubmit={allowResubmit}
                />
                <chakra.section bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="16px" px="16px" py="14px" display="flex" flexDirection="column" gap="8px" data-testid="draft-card">
                    {notice ? (
                        <Flex gap="4px 10px" align="center" wrap="wrap" fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="draft-restored">
                            <span>{opening.shortcut !== null ? 'Your unsent draft for this DAO was restored, so the shortcut you followed was not applied. Discard the draft to start from the shortcut.' : 'Your unsent draft for this DAO was restored.'}</span>
                            <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={discard} data-testid="draft-discard">Discard it</chakra.button>
                        </Flex>
                    ) : (
                        <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="draft-note">Draft saved on this device. It&apos;s cleared once the proposal is submitted.</chakra.span>
                    )}
                </chakra.section>
            </Flex>
        </Flex>
    );
};

/** `/dao/[id]/propose`: write a proposal to a DAO and submit it. */
export const ProposePage = ({id, deps = liveDaoViewDeps, relationDeps = liveRelationDeps, nominationChain = liveNominationChain}: {
    id: string;
    deps?: DaoViewDeps;
    relationDeps?: RelationDeps;
    /** The chain reads of the stale check, run on each nomination before the composer offers to accept it. */
    nominationChain?: NominationChain;
}) => {
    const {address} = useChain(getChainName());
    const {tx} = useBZETx();
    const [reload, setReload] = useState(0);
    const result = useAsync(`${id}:${reload}`, () => loadDaoView(deps, id));
    const data = result.data;
    // what the actions need to know about the DAO's relations is read before the composer opens: a saved draft is checked against it once
    const dao = data?.state === 'ok' ? data.view.dao : null;
    const relations = useAsync(dao ? `${id}:${reload}:relations` : null, () => loadRelations(relationDeps, dao!, nominationChain));
    const waitingForWallet = !address && typeof window !== 'undefined' && shortcutOf(window.location.search) !== null;

    return (
        <PageContainer pt={{base: '20px', md: '28px'}} pb={{base: '40px', md: '64px'}}>
            <Flex direction="column" gap="24px">
                {/* the proposal page's top: back to the DAO's Proposals tab, then the title; no breadcrumb */}
                <chakra.section display="flex" flexDirection="column" gap="16px" minW="0" data-testid="propose-top">
                    {dao && (
                        <chakra.a asChild alignSelf="flex-start" display="inline-flex" alignItems="center" gap="6px" fontSize="14px" fontWeight="500" color="fg.muted" _hover={{color: 'hg.link'}} overflowWrap="anywhere">
                            <NextLink href={daoTabHref(dao.id, 'proposals')} data-testid="propose-back"><LuArrowLeft size={14} aria-hidden />{`${dao.name} · proposals`}</NextLink>
                        </chakra.a>
                    )}
                    <chakra.h1 m="0" fontSize={{base: '28px', md: '36px'}} lineHeight="1.15" fontWeight="800" letterSpacing="-0.02em" data-testid="propose-title">New proposal</chakra.h1>
                </chakra.section>
                {(result.loading || (dao !== null && relations.loading)) && (
                    <Flex wrap="wrap" gap="24px" align="flex-start" aria-hidden data-testid="propose-loading">
                        <Shimmer flex="999 1 560px" minW="0" h="520px" borderRadius="20px" />
                        <Shimmer flex="1 1 340px" minW="0" h="360px" borderRadius="20px" />
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
                {data?.state === 'ok' && !relations.loading && (waitingForWallet
                    ? <div data-testid="shortcut-needs-wallet"><PageState kind="empty" title="Connect your wallet" description="Connect a wallet to open the proposal this link prepares for you." /></div>
                    : <Composer deps={deps} view={data.view} relations={relations.data ?? {subDaos: null, incoming: null, sources: null}} wallet={address ?? null} sign={tx} />)}
            </Flex>
        </PageContainer>
    );
};
