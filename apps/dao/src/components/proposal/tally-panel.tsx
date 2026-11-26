'use client';

import {Box, chakra, Flex} from '@chakra-ui/react';
import {LuCheck, LuMinus} from 'react-icons/lu';
import {Panel} from '@/components/dao/page/panel';
import {tallyView, type TallyBar} from '@/lib/proposal-tally';
import type {ProposalModel} from '@/lib/proposal-model';

const COLORS = {yes: 'hg.up', no: 'hg.down', abstain: 'hg.flat'} as const;

const Meter = ({bar}: {bar: TallyBar}) => (
    <Box position="relative" h="8px" borderRadius="full" bg="hg.inset" aria-hidden>
        <Box h="100%" w={`${bar.widthHundredths / 100}%`} borderRadius="full" bg={bar.met ? 'hg.up' : 'hg.flat'} />
        <Box position="absolute" top="-3px" bottom="-3px" w="2px" bg="fg" left={`${bar.markerHundredths / 100}%`} />
    </Box>
);

const BarRow = ({bar}: {bar: TallyBar}) => (
    <Flex direction="column" gap="6px" data-testid={`bar-${bar.id}`} data-met={bar.met}>
        <Flex justify="space-between" gap="12px" wrap="wrap" fontSize="14px">
            <chakra.span fontWeight="600">{bar.label}</chakra.span>
            <Flex gap="6px" align="center" color={bar.met ? 'hg.up' : 'fg.muted'}>
                {bar.met ? <LuCheck aria-hidden /> : <LuMinus aria-hidden />}
                <span data-testid="bar-text">{`${bar.achieved}, needs ${bar.comparison} ${bar.required}`}</span>
                <chakra.span srOnly>{bar.met ? 'met' : 'not met'}</chakra.span>
            </Flex>
        </Flex>
        <Meter bar={bar} />
    </Flex>
);

interface Props {
    model: ProposalModel;
    formatWeight: (amount: string) => string;
    /** What a weight is, for the legend ("members" or empty for a stake DAO that shows coins). */
    unit: string;
}

/** The tally against the bars pinned at submission: counts, the stacked share of everyone, and each bar met or not. */
export const TallyPanel = ({model, formatWeight, unit}: Props) => {
    const {tally, config} = model;
    const view = tallyView(config, tally, model.expedited);

    return (
        <Panel id="tally" title="Tally" testId="tally-panel">
            {!tally && <chakra.p m="0" color="fg.muted" data-testid="tally-missing">The tally of this proposal could not be read.</chakra.p>}
            {tally && (
                <>
                    {view && (
                        <Flex h="12px" borderRadius="full" bg="hg.inset" overflow="hidden" role="img" aria-label="Yes, no and abstain shares of all voting power" data-testid="tally-stack">
                            {(['yes', 'no', 'abstain'] as const).map((k) => view.shares[k] > 0 && <Box key={k} w={`${view.shares[k] / 100}%`} bg={COLORS[k]} data-option={k} />)}
                        </Flex>
                    )}
                    <Flex gap="8px 22px" wrap="wrap" fontSize="14px" data-testid="tally-counts">
                        <span data-testid="tally-yes">{`Yes ${formatWeight(tally.yes)}`}</span>
                        <span data-testid="tally-no">{`No ${formatWeight(tally.no)}`}</span>
                        <span data-testid="tally-abstain">{`Abstain ${formatWeight(tally.abstain)}`}</span>
                        <chakra.span color="fg.muted" data-testid="tally-denominator">{`of ${formatWeight(tally.denominator)}${unit ? ` ${unit}` : ''} when it started`}</chakra.span>
                    </Flex>
                </>
            )}
            {tally && !view && <chakra.p m="0" fontSize="14px" color="fg.muted" data-testid="bars-missing">The voting rules pinned at submission are not known, so the bars cannot be drawn.</chakra.p>}
            {view && (
                <>
                    <Flex direction="column" gap="14px">{view.bars.map((bar) => <BarRow key={bar.id} bar={bar} />)}</Flex>
                    <chakra.p m="0" fontSize="14px" fontWeight="600" data-testid="tally-verdict">
                        {model.status === 'VOTING'
                            ? view.passesRegular ? 'As it stands, it would pass when voting ends.' : 'As it stands, it would not pass when voting ends.'
                            : view.passesRegular ? 'The tally meets the regular bars.' : 'The tally does not meet the regular bars.'}
                    </chakra.p>
                    {model.expedited && view.passesExpedite !== null && model.status === 'VOTING' && (
                        <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid="tally-expedite">
                            {view.passesExpedite ? 'The expedite bars are met: it can be settled early.' : 'The expedite bars are not met yet.'}
                        </chakra.p>
                    )}
                    {model.status === 'VOTING' && <chakra.p m="0" fontSize="13px" color="fg.muted">{`Not voted yet: ${formatWeight(view.remaining)}`}</chakra.p>}
                </>
            )}
            {config && <chakra.p m="0" fontSize="12px" color="hg.text.faint">These are the rules pinned when the proposal was submitted; a later change to the DAO does not touch them.</chakra.p>}
        </Panel>
    );
};
