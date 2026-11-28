'use client';

import type {ReactNode} from 'react';
import {Box, chakra, Flex, SimpleGrid} from '@chakra-ui/react';
import {tallyView, type TallyBar} from '@/lib/proposal-tally';
import type {ProposalModel} from '@/lib/proposal-model';
import {spaced} from '@/lib/proposal-view';
import {Caption, Card, Note, OPTION_COLOR, Pill, Swatch} from './ui';

interface Props {
    model: ProposalModel;
    formatWeight: (amount: string) => string;
}

/** A bar's name on the board: the expedite pair names its whole ("of all members", "of all voting power"). */
function labelOf(bar: TallyBar, memberList: boolean): string {
    switch (bar.id) {
        case 'quorum':
        case 'expedite-quorum':
            return 'Turnout';
        case 'threshold':
            return 'Yes share';
        case 'expedite-yes':
            return memberList ? 'Yes of all members' : 'Yes of all voting power';
    }
}

/** What the bar has reached: a share, or on a member list "2 of 5" for the bars counted against every member. */
function valueOf(bar: TallyBar, memberList: boolean): string {
    return memberList && bar.id !== 'threshold' ? `${bar.part} of ${bar.whole}` : spaced(bar.achieved);
}

/** The line under the meter: what it needs, and of what. */
function needOf(bar: TallyBar, memberList: boolean, denominator: string): string {
    const need = `Needs ${bar.comparison} ${spaced(bar.required)}`;
    switch (bar.id) {
        case 'threshold':
            return `${need} of yes + no`;
        case 'quorum':
            return memberList ? `${need} of members` : `${need} of ${denominator}`;
        case 'expedite-quorum':
            return need;
        case 'expedite-yes':
            return memberList ? `${need}, so ${bar.needed} of ${bar.whole}` : `${need} of ${denominator}`;
    }
}

const Meter = ({bar, memberList, denominator, open}: {bar: TallyBar; memberList: boolean; denominator: string; open: boolean}) => {
    const label = labelOf(bar, memberList);
    const value = valueOf(bar, memberList);
    const need = needOf(bar, memberList, denominator);
    return (
        <Flex direction="column" gap="8px" data-testid={`bar-${bar.id}`} data-met={bar.met}>
            <Flex justify="space-between" gap="12px" fontSize="14px">
                <chakra.span color="hg.text.secondary" fontWeight="600">{label}</chakra.span>
                <Flex as="span" gap="8px" align="center">
                    <strong data-testid="bar-value">{value}</strong>
                    <chakra.span fontSize="12px" fontWeight="600" color={bar.met ? 'hg.success.text' : 'hg.warning.text'} data-testid="bar-met">
                        {bar.met ? 'Met' : open ? 'Not met yet' : 'Not met'}
                    </chakra.span>
                </Flex>
            </Flex>
            <Box position="relative" h="10px" borderRadius="999px" bg="hg.inset" overflow="visible" role="img" aria-label={`${label}: ${value}, ${need.charAt(0).toLowerCase()}${need.slice(1)}`}>
                <Box position="absolute" left="0" top="0" bottom="0" w={`${bar.widthHundredths / 100}%`} borderRadius="999px" bgImage="app" />
                <Box position="absolute" top="-5px" w="2px" h="20px" borderRadius="2px" bg="fg" left={`${bar.markerHundredths / 100}%`} />
            </Box>
            <chakra.span fontSize="12px" color="hg.text.faint" data-testid="bar-text">{need}</chakra.span>
        </Flex>
    );
};

const Group = ({caption, children}: {caption?: string; children: ReactNode}) => (
    <Flex direction="column" gap="12px">
        {caption && <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="hg.text.faint">{caption}</chakra.span>}
        <SimpleGrid columns={{base: 1, sm: 2}} gap={{base: '16px', sm: '24px'}}>{children}</SimpleGrid>
    </Flex>
);

/**
 * The tally (E2, E3): the votes cast as one bar, the amounts, each bar met or not against the rules pinned at
 * submission (the expedite pair first, for an expedited proposal) and what that means if voting ended now.
 */
export const TallyPanel = ({model, formatWeight}: Props) => {
    const {tally, config} = model;
    const view = tallyView(config, tally, model.expedited);
    const memberList = model.daoType === 'DAO_TYPE_STATIC_LIST';
    const open = model.status === 'VOTING';
    const denominator = tally ? (memberList ? `${tally.denominator} members` : formatWeight(tally.denominator)) : '';
    const meter = (bar: TallyBar) => <Meter key={bar.id} bar={bar} memberList={memberList} denominator={denominator} open={open} />;
    const regular = view?.bars.filter((b) => b.id === 'quorum' || b.id === 'threshold') ?? [];
    // the board leads the expedite pair with the yes bar
    const fast = (['expedite-yes', 'expedite-quorum'] as const).map((id) => view?.bars.find((b) => b.id === id)).filter((b): b is TallyBar => !!b);

    const aside = model.expedited
        ? <Pill tone="accent">Expedited</Pill>
        : open && !model.votingEnded ? <Caption>Updated every 60 s while voting</Caption> : undefined;

    return (
        <Card id="tally" title="Tally" aside={aside} testId="tally-panel">
            {!tally && <chakra.p m="0" color="fg.muted" data-testid="tally-missing">The tally of this proposal could not be read.</chakra.p>}
            {tally && (
                <Flex direction="column" gap="10px">
                    {view && (
                        <Flex h="12px" borderRadius="999px" bg="hg.inset" overflow="hidden" role="img" aria-label="Yes, no and abstain shares of the votes cast" data-testid="tally-stack">
                            {(['YES', 'NO', 'ABSTAIN'] as const).map((k) => {
                                const share = view.castShares[k.toLowerCase() as 'yes' | 'no' | 'abstain'];
                                return share > 0 && <Box key={k} w={`${share / 100}%`} bg={OPTION_COLOR[k]} data-option={k.toLowerCase()} />;
                            })}
                        </Flex>
                    )}
                    <Flex gap="8px 18px" wrap="wrap" data-testid="tally-counts">
                        {([['YES', 'Yes', tally.yes, 'tally-yes'], ['NO', 'No', tally.no, 'tally-no'], ['ABSTAIN', 'Abstain', tally.abstain, 'tally-abstain']] as const).map(([k, label, amount, id]) => (
                            <chakra.span key={k} display="inline-flex" alignItems="center" gap="6px" fontSize="13px" color="hg.text.secondary" data-testid={id}>
                                <Swatch option={k} />
                                {label} <chakra.strong color="fg">{formatWeight(amount)}</chakra.strong>
                            </chakra.span>
                        ))}
                    </Flex>
                </Flex>
            )}
            {tally && !view && <chakra.p m="0" fontSize="14px" color="fg.muted" data-testid="bars-missing">The voting rules pinned at submission are not known, so the bars cannot be drawn.</chakra.p>}
            {view && model.expedited && fast.length > 0 && (
                <>
                    <Group caption={`To settle early (expedite bars, against all ${denominator})`}>{fast.map(meter)}</Group>
                    <Group caption="At the end of voting (regular bars)">{regular.map(meter)}</Group>
                </>
            )}
            {view && !model.expedited && <Group>{regular.map(meter)}</Group>}
            {view && tally && (
                <Note tone={view.passesRegular ? 'success' : 'warning'}>
                    <span data-testid="tally-verdict">
                        {open
                            ? <>If voting ended now, this proposal would <strong>{view.passesRegular ? 'pass' : 'not pass'}</strong>.</>
                            : view.passesRegular ? 'The tally meets the regular bars.' : 'The tally does not meet the regular bars.'}
                    </span>
                    {` Counted against ${denominator}, the voting power when it was submitted, and the rules it started with.`}
                </Note>
            )}
        </Card>
    );
};
