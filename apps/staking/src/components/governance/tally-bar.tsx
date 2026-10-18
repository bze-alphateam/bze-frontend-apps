'use client';

import {Box, HStack, Text} from '@chakra-ui/react';
import type {GovTally} from '@bze/bze-ui-kit';
import {tallyShares, type TallyOption} from '@/lib/governance/tally';
import {formatPct} from '@/lib/governance/format';

// The stacked tally bar with its legend: Yes, No, No with veto, Abstain, each
// as a share of all votes cast.

export const TALLY_COLORS: Record<TallyOption, {base: string; _dark: string}> = {
    yes: {base: 'green.600', _dark: 'green.500'},
    no: {base: 'red.600', _dark: 'red.500'},
    no_with_veto: {base: 'orange.900', _dark: 'orange.300'},
    abstain: {base: 'gray.400', _dark: 'gray.500'},
};

const shareText = (pct: ReturnType<typeof tallyShares>[number]['pct']) => formatPct(pct ?? 0);

export function TallyBar({tally, height = '10px'}: {tally: GovTally | null | undefined; height?: string}) {
    const shares = tallyShares(tally);
    const label = `Tally: ${shares.map((s) => `${s.label} ${shareText(s.pct)}`).join(', ')}`;

    return (
        <Box role="img" aria-label={label} h={height} borderRadius="full" bg="bg.muted" overflow="hidden" display="flex">
            {shares.map((s) => s.pct && s.pct.gt(0) ? (
                <Box key={s.option} w={`${s.pct.toFixed(4)}%`} bg={TALLY_COLORS[s.option]} />
            ) : null)}
        </Box>
    );
}

export function TallyLegend({tally}: {tally: GovTally | null | undefined}) {
    return (
        <>
            {tallyShares(tally).map((s) => (
                <HStack key={s.option} gap="1.5" fontSize="xs" color="fg.muted">
                    <Box w="2" h="2" borderRadius="xs" bg={TALLY_COLORS[s.option]} flexShrink={0} />
                    <Text as="span">
                        {s.label}{' '}
                        {s.option === 'yes'
                            ? <Text as="strong" color="fg">{shareText(s.pct)}</Text>
                            : shareText(s.pct)}
                    </Text>
                </HStack>
            ))}
        </>
    );
}
