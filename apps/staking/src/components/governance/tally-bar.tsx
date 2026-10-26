'use client';

import {Box, chakra, Flex} from '@chakra-ui/react';
import type {GovTally} from '@bze/bze-ui-kit';
import {tallyShares, type TallyOption} from '@/lib/governance/tally';
import {formatPct} from '@/lib/governance/format';

// The stacked tally bar with its legend: Yes, No, No with veto, Abstain, each
// as a share of all votes cast.

/** The data colours of the four options; No with veto is the amber warning colour, never orange. */
export const TALLY_COLORS: Record<TallyOption, string> = {
    yes: 'hg.up',
    no: 'hg.down',
    no_with_veto: 'hg.warning',
    abstain: 'hg.flat',
};

const shareText = (pct: ReturnType<typeof tallyShares>[number]['pct']) => formatPct(pct ?? 0);

export function TallyBar({tally, height = '10px'}: {tally: GovTally | null | undefined; height?: string}) {
    const shares = tallyShares(tally);
    const label = `Tally: ${shares.map((s) => `${s.label} ${shareText(s.pct)}`).join(', ')}`;

    return (
        <Box role="img" aria-label={label} h={height} borderRadius="full" bg="hg.inset" overflow="hidden" display="flex">
            {shares.map((s) => s.pct && s.pct.gt(0) ? (
                <Box
                    key={s.option}
                    w={`${s.pct.toFixed(4)}%`}
                    bg={TALLY_COLORS[s.option]}
                    data-option={s.option}
                    data-color={TALLY_COLORS[s.option]}
                />
            ) : null)}
        </Box>
    );
}

export function TallyLegend({tally}: {tally: GovTally | null | undefined}) {
    return (
        <>
            {tallyShares(tally).map((s) => (
                <Flex key={s.option} align="center" gap="6px" fontSize="12px" color="hg.text.secondary">
                    <Box
                        boxSize="8px"
                        borderRadius="2px"
                        bg={TALLY_COLORS[s.option]}
                        flexShrink={0}
                        data-option={s.option}
                        data-color={TALLY_COLORS[s.option]}
                    />
                    <chakra.span>
                        {s.label}{' '}
                        {s.option === 'yes'
                            ? <chakra.strong color="fg">{shareText(s.pct)}</chakra.strong>
                            : shareText(s.pct)}
                    </chakra.span>
                </Flex>
            ))}
        </>
    );
}
