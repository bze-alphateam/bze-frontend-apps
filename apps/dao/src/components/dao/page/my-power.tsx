'use client';

import {useState, type ReactNode} from 'react';
import NextLink from 'next/link';
import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoProposal} from '@bze/bze-ui-kit';
import {Notice, Shimmer} from '@bze/bze-ui-kit';
import {describeVotingPower, type PowerOnProposal} from '@/lib/dao-power';
import {loadMyVotes, loadVotingPower, type DaoViewDeps, type Part} from '@/lib/dao-view-loader';
import {stakingDenomFor, type StakeSource} from '@/lib/dao-voters';
import {useAsync} from '@/hooks/useAsync';
import {Dl, Eyebrow, Note, Pill, Rule, type PillTone} from './bits';
import {ScanRetry} from './panel';
import {useCoinFormat} from './use-coin-format';

const OPTION: Record<string, {label: string; tone: PillTone}> = {
    YES: {label: 'Yes', tone: 'green'},
    NO: {label: 'No', tone: 'red'},
    ABSTAIN: {label: 'Abstain', tone: 'neutral'},
};
const optionOf = (option: string) => OPTION[option.replace(/^VOTE_OPTION_/, '')] ?? {label: option, tone: 'neutral' as const};

const mix = (percent: number) => `color-mix(in srgb, var(--chakra-colors-hg-accent) ${percent}%, transparent)`;

/** The featured card of the aside: the indigo edge and glow of the board. */
const FeaturedCard = ({children}: {children: ReactNode}) => (
    <chakra.section
        aria-labelledby="power-title"
        bgImage={`linear-gradient(160deg, ${mix(10)}, var(--chakra-colors-hg-card) 55%)`}
        borderWidth="1px"
        borderColor={mix(40)}
        borderRadius="20px"
        p={{base: '16px', md: '24px'}}
        display="flex"
        flexDirection="column"
        gap={{base: '8px', md: '12px'}}
        minW="0"
        boxShadow={`0 30px 80px -50px ${mix(70)}`}
        data-testid="power-panel"
    >
        {children}
    </chakra.section>
);

const ProposalLink = ({id, label}: {id: string; label: string}) => (
    <chakra.a asChild color="hg.link" textDecoration="none" _hover={{color: 'hg.link.hover'}} overflowWrap="anywhere">
        <NextLink href={`/proposal/${id}`}>{label}</NextLink>
    </chakra.a>
);

/** The connected wallet's voting power in this DAO, what counts on each open proposal, and its votes here. */
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
    const stakingDenom = stakingDenomFor(sources.ok ? sources.value : [], openProposals.ok ? openProposals.value.map((p) => p.pinned_electorate) : []);
    const titles = new Map((openProposals.ok ? openProposals.value : []).map((p) => [p.id, p.title]));

    const votedOn = (id: string): string | null | undefined => {
        if (!votes.data) return undefined;
        return votes.data.items.find((v) => String(v.proposal.id) === id)?.option ?? null;
    };
    const view = power.data ? describeVotingPower(dao.type, power.data, (id) => titles.get(id), votedOn) : null;
    const amount = (base: string) => (stakingDenom ? coins.amountOf(stakingDenom, base) : base);

    // I2's one line under the amount on a phone: the first proposal where not all of the stake counts
    const partialLine = view?.lines.find((l) => l.value.kind === 'weight' && l.value.of !== null);
    const phoneNote = !view ? null
        : partialLine && partialLine.value.kind === 'weight'
            ? `On #${partialLine.proposalId} only ${amount(partialLine.value.amount)} counts: you joined or added to your stake after it started.`
            : view.zeroWeight[0]
                ? `On #${view.zeroWeight[0].proposalId} your stake doesn't count: you joined or added to it after it started.`
                : view.notes[0] ?? null;

    const valueOf = (value: PowerOnProposal): ReactNode => {
        if (value.kind === 'weight') {
            return value.of
                ? <>{amount(value.amount)} <chakra.span color="hg.text.faint">{`of ${amount(value.of)}`}</chakra.span></>
                : amount(value.amount);
        }
        if (value.kind === 'member') {
            if (value.voted === undefined) return <Pill tone="neutral">Can vote</Pill>;
            if (value.voted === null) return <Pill tone="amber" testId="power-not-voted">Not voted</Pill>;
            const o = optionOf(value.voted);
            return <Pill tone={o.tone}>{o.label}</Pill>;
        }
        return <chakra.span color="hg.text.faint">{view?.stake ? '0' : "Can't vote"}</chakra.span>;
    };

    return (
        <FeaturedCard>
            <Flex gap="16px" align="center" justify="space-between" wrap="wrap">
                <chakra.h2 id="power-title" m="0" fontSize="17px" fontWeight="700">Your voting power</chakra.h2>
                {view && <Pill tone={view.role.active ? 'indigo' : 'neutral'} testId="power-role">{view.role.label}</Pill>}
            </Flex>
            {power.loading && <Shimmer h="40px" borderRadius="12px" aria-hidden />}
            {!power.loading && !!power.error && <Notice status="warning">Your voting power could not be read from the chain right now.</Notice>}
            {view && (
                <chakra.strong fontSize={{base: '26px', md: '30px'}} fontWeight="800" lineHeight="1.2" data-testid="power-headline">
                    {view.stake
                        ? <>{amount(view.current)}{stakingDenom && <chakra.span fontSize={{base: '26px', md: '16px'}} color={{base: 'fg', md: 'fg.muted'}} fontWeight={{base: '800', md: '600'}}>{` ${coins.ticker(stakingDenom)}`}</chakra.span>}</>
                        : view.role.active ? '1 vote' : 'No vote'}
                </chakra.strong>
            )}
            {phoneNote && (
                <chakra.span display={{base: 'block', md: 'none'}} fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="power-phone-note">{phoneNote}</chakra.span>
            )}
            {/* I2: on a phone the card is the amount and one note; the lists are for wider screens */}
            <Flex direction="column" gap="12px" display={{base: 'none', md: 'flex'}} data-testid="power-details">
            {view && view.lines.length > 0 && (
                <>
                    <Rule />
                    <Eyebrow>On open proposals</Eyebrow>
                    <Dl rows={view.lines.map((line) => ({
                        key: line.proposalId,
                        testId: 'power-proposal',
                        label: <ProposalLink id={line.proposalId} label={line.label} />,
                        value: valueOf(line.value),
                    }))} />
                    {view.notes.map((note) => (
                        <chakra.span key={note} fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="power-note">{note}</chakra.span>
                    ))}
                    {view.zeroWeight.map((line) => (
                        <Note key={line.proposalId} tone="blue" title={`Eligible weight 0 on #${line.proposalId}`} testId="power-zero-weight">
                            You joined or added to your stake after this proposal started, so it doesn&apos;t count on it. It counts on every proposal submitted from now on.
                        </Note>
                    ))}
                </>
            )}

            <Rule />
            <Eyebrow>Your votes here</Eyebrow>
            {votes.loading && <Shimmer h="40px" borderRadius="12px" aria-hidden />}
            {!votes.loading && !!votes.error && <ScanRetry what="Your votes" onRetry={() => setRetry((n) => n + 1)} />}
            {votes.data && votes.data.items.length === 0 && (
                <chakra.p m="0" fontSize="13px" color="hg.text.faint" data-testid="no-votes">You haven&apos;t voted here yet.</chakra.p>
            )}
            {votes.data && votes.data.items.length > 0 && (
                <Dl rows={votes.data.items.map((v) => {
                    const id = String(v.proposal.id);
                    const o = optionOf(v.option);
                    return {
                        key: id,
                        testId: 'my-vote',
                        label: <ProposalLink id={id} label={`#${id} ${v.proposal.title ?? `Proposal #${id}`}`} />,
                        value: <Pill tone={o.tone}>{o.label}</Pill>,
                    };
                })} />
            )}
            {votes.data?.truncated && <chakra.span fontSize="12px" color="hg.text.faint">Only your latest votes were searched.</chakra.span>}
            </Flex>
        </FeaturedCard>
    );
};
