'use client';

import {useState, type ReactNode} from 'react';
import NextLink from 'next/link';
import {chakra, Flex} from '@chakra-ui/react';
import {LuChevronDown} from 'react-icons/lu';
import {HgCard} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {describeControl, type ControlStep} from '@/lib/dao-control';
import {loadSubDaoCounts, loadSubDaos, SUBDAO_PREVIEW, subDaoOpenText, type SubDaoDeps} from '@/lib/dao-subdaos';
import {daoTabHref} from '@/lib/dao-tabs';
import type {ScanDaoDetail} from '@/lib/dao-types';
import type {DaoView} from '@/lib/dao-view-loader';
import {AddressLine} from './panel';
import {RulesRows} from './panels';
import {governancePill} from './header';
import {useCoinFormat} from './use-coin-format';

type NameOf = (address: string) => string | undefined;

const same = (a: string, b: string | null): boolean => !!b && a !== '' && a.toLowerCase() === b.toLowerCase();

const Label = ({children}: {children: ReactNode}) => (
    <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="hg.text.faint">{children}</chakra.span>
);

const Cell = ({amber, testId, kind, children}: {amber: boolean; testId: string; kind?: string; children: ReactNode}) => (
    <Flex
        direction="column"
        gap="4px"
        p="14px"
        borderRadius="14px"
        bg="hg.inset"
        borderWidth="1px"
        borderColor={amber ? 'border.warning' : 'hg.hairline'}
        minW="0"
        data-testid={testId}
        data-kind={kind}
    >
        {children}
    </Flex>
);

const Line = ({children}: {children: ReactNode}) => <chakra.span fontSize="13px" lineHeight="1.5" color="fg.muted">{children}</chakra.span>;
const NoVote = ({here}: {here?: boolean}) => <chakra.strong color="fg">{here ? 'without a vote here' : 'without a vote'}</chakra.strong>;

const Step = ({step, nameOf}: {step: ControlStep; nameOf: NameOf}) => {
    if (step.kind === 'dao') {
        return step.dao
            ? <chakra.a asChild color="hg.link" fontWeight="600" overflowWrap="anywhere"><NextLink href={daoTabHref(step.dao.id)}>{step.dao.name}</NextLink></chakra.a>
            : <AddressLine address={step.address} />;
    }
    if (step.kind === 'account') return <AddressLine address={step.address} name={nameOf(step.address)} />;
    if (step.kind === 'loop') return <span>{`back to ${step.dao?.name ?? step.address}`}</span>;
    if (step.kind === 'cap') return <span>{`the 16th DAO${step.dao ? `, ${step.dao.name}` : ''}`}</span>;
    return <span>{`voters of ${step.of.dao?.name ?? 'the last DAO'}`}</span>;
};

/** The Admin cell: no admin, an account (you, maybe), or a parent DAO, each with what it can do without a vote. */
const AdminCell = ({view, wallet, detail, nameOf}: {view: DaoView; wallet: string | null; detail: ScanDaoDetail | null | undefined; nameOf: NameOf}) => {
    const {dao} = view;
    const state = describeControl(dao, view.controller.ok ? view.controller.value : null, view.knownDaos, view.unresolved);
    // the chain could not tell what the admin is: Scan's label may still say it is a DAO
    const scanDao = state.kind === 'unknown' && detail?.admin_label?.kind === 'dao' ? detail.admin_label.name : null;
    const kind = state.kind === 'self-owned' ? 'none'
        : state.kind === 'dao' || scanDao ? 'dao'
            : same(dao.admin, wallet) ? 'you'
                : state.kind;
    const parent = view.knownDaos.get(dao.admin);

    return (
        <Cell amber={kind !== 'none'} testId="control-admin" kind={kind}>
            <Label>Admin</Label>
            {kind === 'none' && (
                <>
                    <chakra.strong fontSize="16px" data-testid="control-headline">No admin</chakra.strong>
                    <Line>Nobody can act for the DAO on their own. Every change, payment or rule needs a passed proposal.</Line>
                </>
            )}
            {kind === 'you' && (
                <>
                    <Flex gap="8px" align="center" wrap="wrap" data-testid="control-headline">
                        <chakra.strong fontSize="16px" color="hg.warning.text">You</chakra.strong>
                        <AddressLine address={dao.admin} />
                    </Flex>
                    <Line>You can run any action as the DAO and change its rules <NoVote />, from the Admin console tab.</Line>
                </>
            )}
            {kind === 'account' && (
                <>
                    <Flex data-testid="control-headline"><AddressLine address={dao.admin} name={nameOf(dao.admin)} /></Flex>
                    <Line>One account. It can run any action as the DAO and change its rules <NoVote />.</Line>
                </>
            )}
            {kind === 'unknown' && (
                <>
                    <Flex data-testid="control-headline"><AddressLine address={dao.admin} name={nameOf(dao.admin)} /></Flex>
                    <Line>It could not be checked right now whether this is an account or a DAO. Either way it can run any action as the DAO and change its rules <NoVote />.</Line>
                </>
            )}
            {kind === 'dao' && (
                <>
                    {parent
                        ? <chakra.a asChild fontSize="16px" fontWeight="700" color="hg.warning.text" alignSelf="flex-start" overflowWrap="anywhere"><NextLink href={daoTabHref(parent.id)} data-testid="control-headline">{parent.name}</NextLink></chakra.a>
                        : <chakra.strong fontSize="16px" color="hg.warning.text" overflowWrap="anywhere" data-testid="control-headline">{scanDao ?? nameOf(dao.admin) ?? dao.admin}</chakra.strong>}
                    <Line>Its parent DAO. Its proposals can act for this DAO and change its rules <NoVote here />.</Line>
                    {(state.steps.length > 3 || (state.steps.length > 2 && state.steps[state.steps.length - 1].kind !== 'voters')) && (
                        <Flex gap="6px 8px" align="center" wrap="wrap" fontSize="13px" data-testid="control-chain">
                            {state.steps.map((step, i) => (
                                <Flex key={i} align="center" gap="8px" minW="0">
                                    {i > 0 && <span aria-hidden>→</span>}
                                    <Step step={step} nameOf={nameOf} />
                                </Flex>
                            ))}
                        </Flex>
                    )}
                    {state.warning && <Line>{state.warning}</Line>}
                    {state.note && <Line>{state.note}</Line>}
                    {!view.controller.ok && <Line>The rest of the admin chain could not be read right now.</Line>}
                </>
            )}
            {state.pending && (
                <chakra.span fontSize="13px" lineHeight="1.5" color="hg.warning.text" data-testid="control-pending">{state.pending.text}</chakra.span>
            )}
        </Cell>
    );
};

/** The Voters cell: the member count of a member list, or the token staked in a stakers DAO's sources. */
const VotersCell = ({view}: {view: DaoView}) => {
    const {dao} = view;
    const coins = useCoinFormat();
    const alongside = dao.admin === dao.address
        ? 'Their passed proposals are the only way the DAO acts.'
        : 'Their passed proposals act as the DAO too, next to the admin.';

    if (dao.type === 'DAO_TYPE_STATIC_LIST') {
        const n = dao.members.length;
        return (
            <Cell amber={false} testId="control-voters">
                <Label>Voters</Label>
                <chakra.strong fontSize="16px" data-testid="member-total">{`${n} ${n === 1 ? 'member' : 'members'}`}</chakra.strong>
                <Line>{`A member list, one vote each. ${alongside}`}</Line>
            </Cell>
        );
    }

    const sources = view.sources.ok ? view.sources.value : null;
    const tickers = sources ? [...new Set(sources.map((s) => coins.ticker(s.stakingDenom)))] : [];
    const rewards = sources?.length === 1 ? 'the reward' : `the ${sources?.length ?? ''} rewards`;
    return (
        <Cell amber={false} testId="control-voters">
            <Label>Voters</Label>
            <chakra.strong fontSize="16px">{tickers.length > 0 ? `${tickers.join(', ')} stakers` : 'Stakers'}</chakra.strong>
            {!sources && <Line>The staking sources could not be read right now.</Line>}
            {sources?.length === 0 && <Line>No staking source is set yet, so nobody can vote.</Line>}
            {sources && sources.length > 0 && (
                <Line>{`Anyone staking ${tickers.join(' or ')} in ${rewards} below, voting power = stake. ${alongside}`}</Line>
            )}
        </Cell>
    );
};

const SubDaoOpen = ({open}: {open: number | null}) => (open === null ? null : (
    <chakra.span flex="none" fontSize="13px" color={open > 0 ? 'fg' : 'hg.text.faint'} data-testid="subdao-open">{subDaoOpenText(open)}</chakra.span>
));

/** The DAOs this DAO administers, up to 5 rows and then "Show all"; nothing when there are none. */
const SubDaos = ({deps, view}: {deps: SubDaoDeps; view: DaoView}) => {
    const {dao} = view;
    const [all, setAll] = useState(false);
    const [retry, setRetry] = useState(0);
    const list = useAsync(`${dao.id}:subdaos:${retry}`, () => loadSubDaos(deps, dao));
    // the counts come from Scan once there are rows to count for; the rows never wait for them, and a failure leaves them out
    const hasRows = !!list.data && list.data.length > 0;
    const counts = useAsync(hasRows ? `${dao.id}:subdao-counts:${retry}` : null, () => loadSubDaoCounts(deps, dao));
    const openOf = (id: string): number | null => counts.data?.get(id) ?? null;

    if (list.loading) return null;
    if (list.error || !list.data) {
        return (
            <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="subdaos-error">
                <span>The SubDAOs could not be read from the chain right now.</span>
                <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setRetry((n) => n + 1)}>Retry</chakra.button>
            </Flex>
        );
    }
    const rows = list.data;
    if (rows.length === 0) return null;
    const shown = all ? rows : rows.slice(0, SUBDAO_PREVIEW);

    return (
        <Flex direction="column" gap="6px" pt="4px" data-testid="subdaos">
            <Label>{`SubDAOs · ${rows.length}`}</Label>
            {shown.map((row) => (
                <chakra.a key={row.id} asChild _hover={{bg: 'hg.inset'}} borderRadius="10px">
                    <NextLink href={daoTabHref(row.id)} data-testid="subdao-row">
                        <Flex justify="space-between" align="center" gap="12px" px="10px" py="8px" minW="0">
                            <Flex direction="column" minW="0">
                                <chakra.strong color="hg.link" overflowWrap="anywhere">{row.name}</chakra.strong>
                                <chakra.span fontSize="13px" color="fg.muted">{governancePill(row.type)}</chakra.span>
                            </Flex>
                            <SubDaoOpen open={openOf(row.id)} />
                        </Flex>
                    </NextLink>
                </chakra.a>
            ))}
            {!all && rows.length > SUBDAO_PREVIEW && (
                <chakra.button type="button" alignSelf="flex-start" color="hg.link" fontWeight="600" fontSize="14px" cursor="pointer" onClick={() => setAll(true)} data-testid="subdaos-all">
                    {`Show all ${rows.length}`}
                </chakra.button>
            )}
        </Flex>
    );
};

export interface ControlBoxProps {
    view: DaoView;
    wallet: string | null;
    /** Scan's detail of the DAO, for names the chain cannot give. */
    detail: ScanDaoDetail | null | undefined;
    nameOf: NameOf;
    subDaoDeps: SubDaoDeps;
}

/** "Who controls it": the admin and the voters side by side, the SubDAOs, and the governance rules on demand. */
export const ControlBox = ({view, wallet, detail, nameOf, subDaoDeps}: ControlBoxProps) => {
    const [rules, setRules] = useState(false);

    return (
        <HgCard as="section" aria-labelledby="control-title" data-testid="control-panel">
            <Flex direction="column" gap="12px" p={{base: '16px', md: '20px'}} minW="0">
                <chakra.h2 id="control-title" m="0" fontSize="18px" fontWeight="700">Who controls it</chakra.h2>
                <chakra.div display="grid" gridTemplateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'}} gap="12px">
                    <AdminCell view={view} wallet={wallet} detail={detail} nameOf={nameOf} />
                    <VotersCell view={view} />
                </chakra.div>
                <SubDaos deps={subDaoDeps} view={view} />
                <Flex justify="flex-end">
                    <chakra.button
                        type="button"
                        display="inline-flex"
                        alignItems="center"
                        gap="6px"
                        minH="44px"
                        color="hg.link"
                        fontWeight="600"
                        fontSize="14px"
                        cursor="pointer"
                        aria-expanded={rules}
                        aria-controls="governance-rules"
                        onClick={() => setRules((open) => !open)}
                        data-testid="rules-toggle"
                    >
                        {rules ? 'Hide governance rules' : 'See governance rules'}
                        <chakra.span display="inline-flex" transform={rules ? 'rotate(180deg)' : undefined} transition="transform .15s"><LuChevronDown size={14} aria-hidden /></chakra.span>
                    </chakra.button>
                </Flex>
                {rules && (
                    <Flex id="governance-rules" direction="column" gap="10px" borderTopWidth="1px" borderColor="hg.divider" pt="12px" data-testid="rules-list">
                        <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint">
                            Changed only by a passed proposal or the admin. Open proposals keep the rules they started with.
                        </chakra.span>
                        <RulesRows dao={view.dao} params={view.params} />
                    </Flex>
                )}
            </Flex>
        </HgCard>
    );
};
