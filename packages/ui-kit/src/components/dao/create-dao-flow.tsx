'use client';

import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {Button, chakra, Flex} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {getChainName, getExplorerTxURL} from '../../constants/chain';
import {getChainNativeAssetDenom} from '../../constants/assets';
import {Dao, DaoParams} from '../../types/dao';
import {DaoModuleNotSupportedError, getDaoByAddress, getDaoParams} from '../../query/dao';
import {getDaoStakeSources, getTxEvents, getTxLanding, type TxLanding} from '../../query/dao_sources';
import {useAssets} from '../../hooks/useAssets';
import {useBalance} from '../../hooks/useBalances';
import {useBZETx} from '../../hooks/useTx';
import {useCreateDao} from '../../hooks/useCreateDao';
import {useFeeEstimate} from '../../hooks/useFeeEstimate';
import {useGasFeeEstimate} from '../../hooks/useGasFeeEstimate';
import {useTxFeeDenom} from '../../hooks/useTxFeeDenom';
import {FeeEstimateRow} from '../fee-estimate';
import {prettyAmount, uAmountToBigNumberAmount} from '../../utils/amount';
import {DaoCreated, FetchTxEvents} from '../../utils/dao/created';
import {
    adminOf,
    buildCreateDaoFromDraft,
    CREATE_DAO_STEPS,
    CreateDaoContext,
    CreateDaoDraft,
    CreateDaoLocked,
    CreateDaoPreset,
    CreateDaoStep,
    daoCreationFeeText,
    describeProposalMoney,
    freeProposalsWarning,
    withPresetDeposit,
    initialDraft,
    memberRows,
    presetRules,
    restoreDraft,
    rulesSentence,
    rulesToConfig,
    stakingDenomOf,
    validateCreateDaoStep,
    validMembers,
} from '../../utils/dao/create';
import {
    DaoStakeSource,
    daoSourceRows,
    summarizeDaoElectorate,
    toggleDaoSource,
} from '../../utils/dao/create-sources';
import {hgVariant} from '../../theme/variants';
import {Notice, PageState} from '../hive-glow/status';
import {Shimmer} from '../hive-glow/cards';
import {Choice, Field, TextArea, TextInput} from './dao-form-parts';
import {DaoRulesForm} from './dao-rules-form';
import {DaoSourcePicker} from './dao-source-picker';

/** What the flow reads from the chain. Every part can be swapped (tests, another host). */
export interface CreateDaoServices {
    getParams: () => Promise<DaoParams>;
    getSources: () => Promise<DaoStakeSource[]>;
    /** The DAO that owns an address (null when none), to name a DAO admin. */
    getDaoByAddress: (address: string) => Promise<Dao | null>;
    fetchTxEvents: FetchTxEvents;
    /** Looks a broadcast transaction up by hash (resolves a timed-out creation). */
    getTxLanding: (txHash: string) => Promise<TxLanding>;
}

export const defaultCreateDaoServices: CreateDaoServices = {
    getParams: getDaoParams,
    getSources: getDaoStakeSources,
    getDaoByAddress,
    fetchTxEvents: getTxEvents,
    getTxLanding,
};

export interface CreateDaoFlowProps {
    /** Fills the form in beforehand (the Factory's stake DAO of a token). */
    preset?: CreateDaoPreset;
    /** What the host fixes: the type step, the staking token (the token itself, not a flag). */
    locked?: CreateDaoLocked;
    /** Who fixed it, for "Set by …" on a locked step. Default "the app". */
    lockedBy?: string;
    /** Called once the DAO exists. The host routes to it. */
    onCreated: (created: DaoCreated) => void;
    /** An unsent draft the host kept. Every field the `preset` fills in, and a locked type or token, wins over it; the rest of the draft is kept. */
    draft?: CreateDaoDraft;
    /** The draft changed; `undefined` once the DAO was created, so the host can forget it. */
    onDraftChange?: (draft: CreateDaoDraft | undefined) => void;
    services?: Partial<CreateDaoServices>;
}

const STEP_TITLES: Record<CreateDaoStep, string> = {type: 'Type', name: 'Name', voters: 'Voters', admin: 'Admin', rules: 'Rules', review: 'Review'};

type Loaded<T> = {status: 'idle'} | {status: 'loading'} | {status: 'error'; message: string; unsupported?: boolean} | {status: 'ready'; data: T};

/**
 * The guided Create-DAO flow: type, name, voters, admin, rules, review, then one MsgCreateDao
 * signed in direct mode. It draws steps only (no page title), in the host app's colours, so a
 * host mounts it inside its own page: the DAO app at `/create`, the Factory with a stake preset.
 */
export const CreateDaoFlow = (props: CreateDaoFlowProps) => {
    const services = useMemo<CreateDaoServices>(() => ({...defaultCreateDaoServices, ...props.services}), [props.services]);
    const {address} = useChain(getChainName());
    const [attempt, setAttempt] = useState(0);
    const [params, setParams] = useState<Loaded<DaoParams>>({status: 'loading'});

    useEffect(() => {
        let cancelled = false;
        services.getParams().then(
            (data) => { if (!cancelled) setParams({status: 'ready', data}); },
            (e) => {
                if (cancelled) return;
                setParams({status: 'error', message: e instanceof Error ? e.message : String(e), unsupported: e instanceof DaoModuleNotSupportedError});
            },
        );
        return () => { cancelled = true; };
    }, [services, attempt]);

    if (params.status === 'loading' || params.status === 'idle') return <Shimmer h="320px" borderRadius="16px" aria-hidden/>;
    if (params.status === 'error') {
        return params.unsupported
            ? <PageState kind="empty" title="DAOs arrive with the v8.3.0 upgrade" description="This network does not run the DAO module yet."/>
            : <Notice status="danger" title="Could not read the DAO settings">
                {params.message}{' '}
                <Button size="xs" variant="outline" onClick={() => { setParams({status: 'loading'}); setAttempt(a => a + 1); }}>Retry</Button>
            </Notice>;
    }
    if (!address) {
        return <Notice status="info" title="Connect your wallet">You sign the creation with your wallet, and it pays the creation fee. Connect it to start.</Notice>;
    }

    return <Wizard {...props} services={services} params={params.data} creator={address}/>;
};

const StepCard = ({n, title, state, summary, onEdit, locked, children}: {
    n: number; title: string; state: 'done' | 'current' | 'todo'; summary?: ReactNode; onEdit?: () => void; locked?: string; children?: ReactNode;
}) => {
    if (state === 'current') {
        return (
            <chakra.section aria-label={title} display="flex" flexDirection="column" gap="18px" p={{base: '20px', md: '28px'}} borderRadius="hg.lg" borderWidth="1px" borderColor="app.border" bg="hg.card" data-testid={`step-${title.toLowerCase()}`} data-state="current">
                <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="app.fg">Step {n} of 6 · {title}</chakra.span>
                {children}
            </chakra.section>
        );
    }
    return (
        <Flex align="center" gap="16px" p="14px 16px" borderRadius="hg.md" borderWidth="1px" borderStyle={state === 'todo' ? 'dashed' : 'solid'} borderColor="hg.hairline" bg={state === 'done' ? 'hg.card' : 'transparent'} data-testid={`step-${title.toLowerCase()}`} data-state={state}>
            <chakra.span flex="none" w="24px" h="24px" borderRadius="999px" borderWidth="1px" borderColor="hg.hairline" display="inline-flex" alignItems="center" justifyContent="center" fontSize="12px" fontWeight="600" color="fg.muted">{state === 'done' ? '✓' : n}</chakra.span>
            <Flex direction="column" gap="2px" flex="1" minW="0">
                <chakra.span fontSize="12px" fontWeight="600" color="fg.muted">{title}</chakra.span>
                {state === 'done' && <chakra.span fontSize="15px" overflow="hidden" textOverflow="ellipsis">{summary}</chakra.span>}
            </Flex>
            {state === 'done' && (locked
                ? <chakra.span fontSize="12px" fontWeight="600" color="fg.muted">Set by {locked}</chakra.span>
                : onEdit && <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${title}`}>Edit</Button>)}
        </Flex>
    );
};

const Nav = ({onBack, backLabel = 'Back', onNext, nextLabel = 'Continue', error, disabled}: {
    onBack?: () => void; backLabel?: string; onNext: () => void; nextLabel?: string; error?: string; disabled?: boolean;
}) => (
    <Flex direction="column" gap="10px" pt="8px" borderTopWidth="1px" borderColor="hg.hairline">
        {error && <chakra.span fontSize="13px" color="hg.danger" role="alert" data-testid="step-error">{error}</chakra.span>}
        <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
            {onBack ? <Button variant="ghost" onClick={onBack}>← {backLabel}</Button> : <span/>}
            <Button variant={hgVariant('primary')} onClick={onNext} disabled={disabled || !!error}>{nextLabel}</Button>
        </Flex>
    </Flex>
);

interface WizardProps extends CreateDaoFlowProps {
    services: CreateDaoServices;
    params: DaoParams;
    creator: string;
}

const Wizard = ({preset, locked, lockedBy = 'the app', onCreated, draft: savedDraft, onDraftChange, services, params, creator}: WizardProps) => {
    const {denomTicker, denomDecimals} = useAssets();
    const nativeDenom = getChainNativeAssetDenom();
    const lockedStakingDenom = locked?.stakingDenom;
    const [draft, setDraft] = useState<CreateDaoDraft>(() =>
        restoreDraft(savedDraft, initialDraft({creator, preset, locked, ctx: {decimalsOf: denomDecimals, nativeDenom}}), locked, preset));
    const [step, setStep] = useState<CreateDaoStep>(locked?.type ? 'name' : 'type');
    const [attempt, setAttempt] = useState(draft.type === 'DAO_TYPE_STAKE' ? 1 : 0);
    const [sources, setSources] = useState<Loaded<DaoStakeSource[]>>({status: draft.type === 'DAO_TYPE_STAKE' ? 'loading' : 'idle'});

    useEffect(() => {
        if (attempt === 0) return;
        let cancelled = false;
        services.getSources().then(
            (data) => { if (!cancelled) setSources({status: 'ready', data}); },
            (e) => { if (!cancelled) setSources({status: 'error', message: e instanceof Error ? e.message : String(e)}); },
        );
        return () => { cancelled = true; };
    }, [services, attempt]);

    useEffect(() => { onDraftChange?.(draft); }, [draft, onDraftChange]);

    const ctx: CreateDaoContext = {
        creator,
        params,
        sources: sources.status === 'ready' ? sources.data : [],
        lockedStakingDenom,
        nativeDenom,
        decimalsOf: denomDecimals,
        tickerOf: denomTicker,
    };
    const stake = draft.type === 'DAO_TYPE_STAKE';
    const sourcesPending = stake && sources.status !== 'ready';
    const errorOf = (s: CreateDaoStep): string | undefined => {
        if (sourcesPending && (s === 'voters' || s === 'admin' || s === 'review')) return sources.status === 'error' ? 'The rewards could not be read.' : 'Loading the rewards…';
        return validateCreateDaoStep(s, draft, ctx);
    };

    const patch = (p: Partial<CreateDaoDraft>) => setDraft(d => ({...d, ...p}));
    const idx = CREATE_DAO_STEPS.indexOf(step);
    // the Token community deposit is paid in the staking token, known once the voters are picked
    const goTo = (s: CreateDaoStep) => {
        if (s === 'rules' || s === 'review') setDraft(d => withPresetDeposit(d, stakingDenomOf(d, ctx)));
        setStep(s);
    };
    const next = () => goTo(CREATE_DAO_STEPS[idx + 1]);
    const back = () => goTo(CREATE_DAO_STEPS[Math.max(idx - 1, locked?.type ? 1 : 0)]);
    const stateOf = (s: CreateDaoStep) => (s === step ? 'current' : CREATE_DAO_STEPS.indexOf(s) < idx ? 'done' : 'todo') as 'done' | 'current' | 'todo';

    const chooseType = (type: CreateDaoDraft['type']) => {
        if (type === draft.type) return;
        const keepPreset = draft.presetId === 'custom';
        const presetId = type === 'DAO_TYPE_STAKE' ? 'token-community' : 'simple-majority';
        patch({
            type,
            ...(keepPreset ? {} : {presetId, rules: presetRules(presetId, type === 'DAO_TYPE_STAKE' ? lockedStakingDenom : undefined)}),
        });
        if (type === 'DAO_TYPE_STAKE' && sources.status === 'idle') {
            setSources({status: 'loading'});
            setAttempt(a => a + 1);
        }
    };

    const stakingDenom = stakingDenomOf(draft, ctx);
    const rows = daoSourceRows({sources: ctx.sources, electorate: draft.electorate, params, lockedDenom: lockedStakingDenom, tickerOf: denomTicker});
    const summary = summarizeDaoElectorate(draft.electorate, ctx.sources, lockedStakingDenom);
    const members = memberRows(draft.membersText);
    const parsed = rulesToConfig(draft.rules, ctx);
    const voters = stake ? 'voting power' : 'members';

    const summaries: Record<CreateDaoStep, ReactNode> = {
        type: stake ? 'Stakers' : 'Member list',
        name: draft.name,
        voters: stake
            ? `${summary.count} reward${summary.count === 1 ? '' : 's'}${summary.stakingDenom ? ` staking ${denomTicker(summary.stakingDenom)}` : ''}`
            : `${validMembers(draft.membersText).length} members`,
        admin: draft.adminChoice === 'voters' ? 'Nobody: its voters decide' : draft.adminChoice === 'me' ? 'You, for now' : draft.adminAddress,
        rules: 'config' in parsed ? rulesSentence(parsed.config, voters) : '',
        review: '',
    };

    const [adminDao, setAdminDao] = useState<{address: string; dao: Dao | null} | undefined>();
    const adminTyped = draft.adminAddress.trim().toLowerCase();
    const adminValid = draft.adminChoice === 'other' && !validateCreateDaoStep('admin', {...draft, adminChoice: 'other'}, ctx);
    useEffect(() => {
        if (!adminValid) return;
        let cancelled = false;
        services.getDaoByAddress(adminTyped).then(
            (dao) => { if (!cancelled) setAdminDao({address: adminTyped, dao}); },
            () => { if (!cancelled) setAdminDao({address: adminTyped, dao: null}); },
        );
        return () => { cancelled = true; };
    }, [services, adminTyped, adminValid]);
    const adminIsDao = adminValid && adminDao?.address === adminTyped ? adminDao.dao : null;

    const {tx} = useBZETx();
    const {submit, check, status, error: submitError, txHash} = useCreateDao({tx, fetchTxEvents: services.fetchTxEvents, getTxLanding: services.getTxLanding});
    const fee = params.dao_creation_fee;
    const hasFee = /[1-9]/.test(fee.amount);
    const gas = useGasFeeEstimate('create-dao');
    const estimate = useFeeEstimate(hasFee ? {denom: fee.denom, amount: fee.amount} : undefined, {gasFee: gas.estimate});
    const {denom: txFeeDenom} = useTxFeeDenom();
    // what the chain will really take (fee token or BZE) and the balance it is taken from
    const payDenom = estimate.resolvedFee?.denom ?? fee.denom;
    const {balance} = useBalance(payDenom);
    const feeText = daoCreationFeeText({fee, destination: params.dao_creation_fee_destination, txFeeDenom, decimalsOf: denomDecimals, tickerOf: denomTicker});
    const cannotPay = hasFee && !estimate.isLoading && estimate.method === 'insufficient';

    const finish = (result: {status: string; created?: DaoCreated}) => {
        // the DAO exists, so the draft is spent, whether or not its id could be read
        if (result.status === 'created' || result.status === 'unread') onDraftChange?.(undefined);
        if (result.status === 'created' && result.created) onCreated(result.created);
    };
    const create = async () => {
        const built = buildCreateDaoFromDraft(draft, ctx);
        if ('error' in built) return;
        finish(await submit(built.msg));
    };

    const reviewError = errorOf('review');
    const denoms = [...new Set([nativeDenom, ...(stakingDenom ? [stakingDenom] : []), ...(stake && lockedStakingDenom ? [lockedStakingDenom] : [])])];
    const done = status === 'created' || status === 'unread' || status === 'pending';

    return (
        <Flex direction="column" gap="12px" data-testid="create-dao-flow">
            {CREATE_DAO_STEPS.map((s, i) => {
                const state = stateOf(s);
                const common = {n: i + 1, title: STEP_TITLES[s], state, summary: summaries[s], onEdit: done ? undefined : () => goTo(s)};
                if (s === 'type') {
                    return (
                        <StepCard key={s} {...common} locked={locked?.type ? lockedBy : undefined}>
                            <chakra.h2 m="0" fontSize="22px" fontWeight="700">Who votes in your DAO?</chakra.h2>
                            <Flex direction="column" gap="10px" role="radiogroup" aria-label="DAO type">
                                <Choice type="radio" name="dao-type" testId="type-static" checked={!stake} onChange={() => chooseType('DAO_TYPE_STATIC_LIST')} title="Member list">
                                    A fixed list of addresses, one vote each. Good for a team, a council or a small group that knows each other. Members are added and removed by the DAO's own proposals.
                                </Choice>
                                <Choice type="radio" name="dao-type" testId="type-stake" checked={stake} onChange={() => chooseType('DAO_TYPE_STAKE')} title="Stakers">
                                    Everyone who stakes a token in the rewards you pick. Voting power = stake. Good for a token community. People join by staking, on the DEX.
                                </Choice>
                            </Flex>
                            <Notice status="info">You can't switch between the two later. A member list stays a member list; a Stakers DAO can change which rewards count.</Notice>
                            <Nav onNext={next}/>
                        </StepCard>
                    );
                }
                if (s === 'name') {
                    const nameError = errorOf('name');
                    return (
                        <StepCard key={s} {...common}>
                            <chakra.h2 m="0" fontSize="22px" fontWeight="700">What is it called?</chakra.h2>
                            <Field label="Name" hint="1 to 64 bytes. Shown on its page, in lists and on the explorer.">
                                <TextInput value={draft.name} onChange={(e) => patch({name: e.target.value})} placeholder="Hive Council"/>
                            </Field>
                            <Field label="Description (optional)" hint="Up to 2,000 bytes. Plain text with line breaks; links are shown but not clickable.">
                                <TextArea rows={4} value={draft.description} onChange={(e) => patch({description: e.target.value})}/>
                            </Field>
                            <Notice status="info">Names don't have to be unique, so the DAO number and its address are what identify it. Name and description can change later by proposal.</Notice>
                            <Nav onBack={locked?.type ? undefined : back} onNext={next} error={nameError}/>
                        </StepCard>
                    );
                }
                if (s === 'voters') {
                    const votersError = errorOf('voters');
                    return (
                        <StepCard key={s} {...common}>
                            <chakra.h2 m="0" fontSize="22px" fontWeight="700">{stake ? 'Whose stake votes?' : 'Who are the members?'}</chakra.h2>
                            {stake ? (
                                sources.status === 'loading' ? <Shimmer h="160px" borderRadius="16px" aria-hidden/>
                                : sources.status === 'error'
                                    ? <Notice status="danger" title="Could not read the rewards">{sources.message}{' '}
                                        <Button size="xs" variant="outline" onClick={() => { setSources({status: 'loading'}); setAttempt(a => a + 1); }}>Retry</Button></Notice>
                                    : <DaoSourcePicker
                                        rows={rows}
                                        summary={summary}
                                        params={params}
                                        locked={!!lockedStakingDenom}
                                        tickerOf={denomTicker}
                                        decimalsOf={denomDecimals}
                                        onToggle={(source, on) => patch({electorate: toggleDaoSource(draft.electorate, source, on)})}
                                    />
                            ) : (
                                <>
                                    <Field label="Members" hint={`One address per line, or paste a list. Up to ${params.max_static_members} members. You are added first; remove yourself if you only set it up.`}>
                                        <TextArea rows={6} value={draft.membersText} onChange={(e) => patch({membersText: e.target.value})} placeholder="bze1…" style={{fontFamily: 'monospace'}} aria-label="Members"/>
                                    </Field>
                                    <chakra.label fontSize="13px" color="fg.muted">
                                        Import CSV{' '}
                                        <input type="file" accept=".csv,.txt,text/csv,text/plain" aria-label="Import CSV" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) patch({membersText: `${draft.membersText.trim()}\n${await file.text()}`.trim()});
                                            e.target.value = '';
                                        }}/>
                                    </chakra.label>
                                    <chakra.span fontSize="13px" color="fg.muted" data-testid="member-count">
                                        {members.filter(r => !r.error).length} valid · {members.filter(r => r.error).length} to fix · up to {params.max_static_members} members
                                    </chakra.span>
                                    {members.filter(r => r.error).map(r => (
                                        <chakra.span key={r.line} fontSize="12px" color="hg.danger" data-testid="member-error">Line {r.line}: {r.address.length > 18 ? `${r.address.slice(0, 10)}…${r.address.slice(-4)}` : r.address}: {r.error}</chakra.span>
                                    ))}
                                    <Notice status="info">Every member gets one vote. A member added later votes only on proposals submitted after they joined.</Notice>
                                </>
                            )}
                            <Nav onBack={back} onNext={next} error={votersError}/>
                        </StepCard>
                    );
                }
                if (s === 'admin') {
                    const live = validateCreateDaoStep('admin', {...draft, adminChoice: 'voters'}, ctx);
                    const adminError = errorOf('admin');
                    return (
                        <StepCard key={s} {...common}>
                            <chakra.h2 m="0" fontSize="22px" fontWeight="700">Who can change the DAO without a vote?</chakra.h2>
                            <Flex direction="column" gap="10px" role="radiogroup" aria-label="Admin">
                                <Choice type="radio" name="dao-admin" testId="admin-voters" checked={draft.adminChoice === 'voters'} disabled={!!live} onChange={() => patch({adminChoice: 'voters'})} title="Nobody: its voters decide" badge="Most DAOs">
                                    The DAO governs itself. Every change, payment and rule goes through a proposal and a vote.
                                    {live && <><br/><chakra.span fontSize="12px" color="hg.warning">{live}</chakra.span></>}
                                </Choice>
                                <Choice type="radio" name="dao-admin" testId="admin-me" checked={draft.adminChoice === 'me'} onChange={() => patch({adminChoice: 'me'})} title="Me, for now">
                                    You ({creator.slice(0, 8)}…{creator.slice(-4)}) can run anything as the DAO. Useful while you set things up. Hand it to the voters later from the admin console.
                                </Choice>
                                <Choice type="radio" name="dao-admin" testId="admin-other" checked={draft.adminChoice === 'other'} onChange={() => patch({adminChoice: 'other'})} title="Another address or DAO">
                                    A person or another DAO becomes the admin, for example a parent DAO that oversees this one.
                                </Choice>
                            </Flex>
                            {draft.adminChoice === 'other' && (
                                <Field label="Admin address" hint={adminIsDao ? `Checked against the chain: this is DAO #${adminIsDao.id} · ${adminIsDao.name}. Its voters would run this DAO.` : undefined}>
                                    <TextInput value={draft.adminAddress} onChange={(e) => patch({adminAddress: e.target.value})} placeholder="bze1…" style={{fontFamily: 'monospace'}}/>
                                </Field>
                            )}
                            {draft.adminChoice !== 'voters' && (
                                <Notice status="warning" title="About admins">An admin is a superuser: it can run any message as the DAO, including spending the treasury, and change the members and rules. Voters can't remove it; only the admin can hand over, and it can later hand the DAO to its voters.</Notice>
                            )}
                            <Nav onBack={back} onNext={next} error={adminError}/>
                        </StepCard>
                    );
                }
                if (s === 'rules') {
                    return (
                        <StepCard key={s} {...common}>
                            <chakra.h2 m="0" fontSize="22px" fontWeight="700">How are decisions made?</chakra.h2>
                            <DaoRulesForm
                                presetId={draft.presetId}
                                rules={draft.rules}
                                onChange={(presetId, rules) => patch({presetId, rules})}
                                params={params}
                                voters={voters}
                                denoms={denoms}
                                depositDenom={stakingDenom}
                                tickerOf={denomTicker}
                                decimalsOf={denomDecimals}
                                nativeDenom={nativeDenom}
                                error={errorOf('rules')}
                            />
                            <Nav onBack={back} onNext={next} nextLabel="Continue to review →" error={errorOf('rules')}/>
                        </StepCard>
                    );
                }
                // review
                const config = 'config' in parsed ? parsed.config : undefined;
                const money = config ? describeProposalMoney(config, {decimalsOf: denomDecimals, tickerOf: denomTicker}) : {cost: '', deposit: ''};
                const freeWarning = config ? freeProposalsWarning(config, params.max_open_proposals) : null;
                const rowsText: [string, ReactNode][] = [
                    ['Type', stake ? 'Stakers: voting power = stake' : 'Member list: one vote per member'],
                    ['Name', draft.name],
                    ...(draft.description ? [['Description', <chakra.span key="d" whiteSpace="pre-wrap">{draft.description}</chakra.span>] as [string, ReactNode]] : []),
                    ['Voters', stake
                        ? `${summary.count} reward${summary.count === 1 ? '' : 's'}${summary.stakingDenom ? ` staking ${denomTicker(summary.stakingDenom)}` : ''}${summary.count === 0 ? ': to be set up later' : ''}`
                        : `${validMembers(draft.membersText).length}: ${validMembers(draft.membersText).map(a => a.toLowerCase() === creator.toLowerCase() ? 'you' : `${a.slice(0, 6)}…${a.slice(-4)}`).join(', ')}`],
                    ['Admin', draft.adminChoice === 'voters' ? 'None: the DAO governs itself' : adminIsDao ? `DAO #${adminIsDao.id} · ${adminIsDao.name}` : adminOf(draft, creator) === creator ? 'You' : adminOf(draft, creator)],
                    ['Rules', config ? rulesSentence(config, voters) : ''],
                    ['Proposals', draft.rules.openSubmission ? 'Anyone can submit' : stake ? 'Stakers only' : 'Members only'],
                    ...(config ? ([['Proposal cost', money.cost], ['Proposal deposit', money.deposit]] as [string, ReactNode][]) : []),
                ];
                return (
                    <StepCard key={s} {...common}>
                        <chakra.h2 m="0" fontSize="22px" fontWeight="700">Review</chakra.h2>
                        <chakra.dl m="0" display="flex" flexDirection="column" data-testid="review">
                            {rowsText.map(([k, v]) => (
                                <Flex key={k} gap="16px" py="10px" borderTopWidth="1px" borderColor="hg.hairline" fontSize="14px">
                                    <chakra.dt w="120px" flex="none" color="fg.muted">{k}</chakra.dt>
                                    <chakra.dd m="0" minW="0" wordBreak="break-word" data-testid={`review-${k.toLowerCase()}`}>{v}</chakra.dd>
                                </Flex>
                            ))}
                        </chakra.dl>
                        <Flex direction="column" gap="8px" p="16px" borderRadius="hg.md" bg="hg.inset" data-testid="review-fee">
                            <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="fg.muted">What leaves your wallet</chakra.span>
                            {hasFee && <FeeEstimateRow txKind="create-dao" fee={{denom: fee.denom, amount: fee.amount}} label="Creation fee" description={`A one-time payment to create the DAO. It ${feeText.destination}.`}/>}
                            <chakra.span fontSize="14px" data-testid="fee-amount">{hasFee ? <><strong>{feeText.amount}</strong>, {feeText.destination}</> : 'No creation fee'}</chakra.span>
                            {hasFee && <chakra.span fontSize="13px" color="fg.muted">Paid in: {feeText.paidIn} {feeText.transferFeeNote}</chakra.span>}
                            <chakra.span fontSize="14px" data-testid="fee-balance">
                                You hold {prettyAmount(uAmountToBigNumberAmount(balance.amount, denomDecimals(payDenom)))} {denomTicker(payDenom)}{' '}
                                {hasFee && (cannotPay ? <chakra.span color="hg.danger">not enough</chakra.span> : <chakra.span color="hg.success">✓ enough</chakra.span>)}
                            </chakra.span>
                        </Flex>
                        {freeWarning && <Notice status="warning" title="Free proposals">{freeWarning}</Notice>}
                        <Notice status="info">Permanent: the DAO, its address and its type can never be deleted. Members, rules and admin can change later by proposal.</Notice>
                        {status === 'unread' && (
                            <Notice status="success" title="The DAO was created">
                                The transaction went through, but its number could not be read.{' '}
                                {txHash && <a href={getExplorerTxURL(txHash)} target="_blank" rel="noreferrer">View the transaction</a>} Find the DAO in the list of all DAOs.
                            </Notice>
                        )}
                        {status === 'pending' && (
                            <Notice status="warning" title="Waiting for the chain">
                                The transaction was sent but is not confirmed yet. It may still land, so it cannot be sent again.{' '}
                                {txHash && <><a href={getExplorerTxURL(txHash)} target="_blank" rel="noreferrer">View the transaction</a>{' '}</>}
                                <Button size="xs" variant="outline" onClick={async () => finish(await check())} data-testid="check-tx">Check again</Button>
                                {submitError && <><br/>{submitError}</>}
                            </Notice>
                        )}
                        {status === 'failed' && submitError && <Notice status="danger" title="The DAO was not created" >{submitError}</Notice>}
                        <Nav
                            onBack={done ? undefined : back}
                            onNext={create}
                            nextLabel={status === 'signing' ? 'Waiting for your wallet…' : `Create DAO${hasFee ? ` · pay ${feeText.amount}` : ''}`}
                            error={reviewError}
                            disabled={status === 'signing' || done || cannotPay}
                        />
                    </StepCard>
                );
            })}
        </Flex>
    );
};
