'use client';

import {Box, HStack, Stack, Text} from '@chakra-ui/react';
import {LuCircleCheck, LuCircleHelp, LuCircleX} from 'react-icons/lu';
import {shortNumberFormat, uAmountToBigNumberAmount, type GovParams, type GovProposal, type GovTally} from '@bze/bze-ui-kit';
import {passingChecks, quorumStatus, tallyShares} from '@/lib/governance/tally';
import {finalChecks, isOpen, tallyFootnote, wholeBze} from '@/lib/governance/details';
import {statusInfo} from '@/lib/governance/proposal';
import {formatPct, fractionPct} from '@/lib/governance/format';
import {TALLY_COLORS} from '../tally-bar';

// The tally panel: turnout against the quorum (while voting), each option's
// votes, and the chain's three checks — "if voting ended now" while open, the
// final result once decided.

interface ProposalTallyProps {
    proposal: GovProposal;
    tally: GovTally | null;
    params: GovParams;
    bondedTokens: string;
}

/** A percentage as a bar position: 0–100. */
const clampPct = (pct: number) => Math.max(0, Math.min(pct, 100));

interface CheckRow {
    ok: boolean | null;
    name: string;
    text: string;
}

function CheckLine({row}: {row: CheckRow}) {
    const Icon = row.ok === null ? LuCircleHelp : row.ok ? LuCircleCheck : LuCircleX;
    const color = row.ok === null ? 'fg.muted' : row.ok ? 'green.fg' : 'red.fg';
    return (
        <HStack as="li" align="flex-start" gap="2" fontSize="13px" color="fg.muted">
            <Box color={color} mt="0.5" flex="none"><Icon size={15} aria-label={row.ok === null ? 'unknown' : row.ok ? 'met' : 'not met'} /></Box>
            <Text as="span"><Text as="strong" color="fg">{row.name}</Text>{` ${row.text}`}</Text>
        </HStack>
    );
}

function Turnout({tally, params, bondedTokens}: Omit<ProposalTallyProps, 'proposal'>) {
    const {turnout, quorum} = quorumStatus(tally, bondedTokens, params);
    if (turnout == null) return null;
    const fill = clampPct(turnout.toNumber());
    const marker = clampPct(quorum.toNumber());
    const bonded = shortNumberFormat(uAmountToBigNumberAmount(bondedTokens, 6));

    return (
        <Stack gap="1.5">
            <HStack justify="space-between" fontSize="13px">
                <Text color="fg.muted">Turnout</Text>
                <Text>
                    <Text as="strong">{formatPct(turnout)}</Text>
                    <Text as="span" color="fg.muted">{` of ${bonded} staked BZE`}</Text>
                </Text>
            </HStack>
            <Box role="img" aria-label={`Turnout ${formatPct(turnout)}, quorum line at ${formatPct(quorum)}`} position="relative" h="10px" borderRadius="full" bg="bg.muted">
                <Box position="absolute" left="0" top="0" bottom="0" w={`${fill}%`} borderRadius="full" bg="purple.600" />
                <Box position="absolute" left={`${marker}%`} top="-4px" bottom="-4px" w="2px" bg="fg" />
            </Box>
            <Box position="relative" h="4">
                <Text position="absolute" left={`${marker}%`} transform="translateX(-50%)" fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                    {`▲ quorum ${formatPct(quorum)}`}
                </Text>
            </Box>
        </Stack>
    );
}

function checkRows({proposal, tally, params, bondedTokens}: ProposalTallyProps): {title: string; good: boolean; rows: CheckRow[]} {
    const veto = fractionPct(params.veto_threshold);
    if (isOpen(proposal)) {
        const c = passingChecks(tally, bondedTokens, params, proposal.expedited);
        return {
            title: c.passing ? 'Passing if voting ended now' : 'Not passing if voting ended now',
            good: c.passing,
            rows: [
                {
                    ok: c.quorum.value == null ? null : c.quorum.ok,
                    name: 'Quorum',
                    text: c.quorum.value == null
                        ? `needs ${formatPct(c.quorum.need)} of staked BZE to vote`
                        : `${formatPct(c.quorum.value)} voted, needs ${formatPct(c.quorum.need)}`,
                },
                {ok: c.threshold.ok, name: `Yes ${formatPct(c.threshold.value ?? 0)}`, text: `of Yes, No and veto votes, needs more than ${formatPct(c.threshold.need)}`},
                {ok: c.veto.ok, name: `Veto ${formatPct(c.veto.value ?? 0)}`, text: `of all votes, fails above ${veto}`},
            ],
        };
    }
    const c = finalChecks(proposal, params);
    const status = statusInfo(proposal.status);
    const quorum = formatPct(c.quorum.need);
    return {
        title: status.text,
        good: proposal.status === 'PROPOSAL_STATUS_PASSED',
        rows: [
            {
                ok: c.quorum.ok,
                name: 'Quorum',
                text: c.quorum.ok === null
                    ? `needed ${quorum} of staked BZE; the chain doesn't keep the turnout`
                    : `${c.quorum.ok ? 'reached' : 'not reached'} (needed ${quorum} of staked BZE)`,
            },
            {ok: c.threshold.ok, name: `Yes ${formatPct(c.threshold.value ?? 0)}`, text: `of Yes, No and veto votes (needed more than ${formatPct(c.threshold.need)})`},
            {ok: c.veto.ok, name: `Veto ${formatPct(c.veto.value ?? 0)}`, text: `of all votes (fails above ${veto})`},
        ],
    };
}

export function ProposalTally(props: ProposalTallyProps) {
    const {proposal, tally, params, bondedTokens} = props;
    const open = isOpen(proposal);
    const result = checkRows(props);

    return (
        <Stack as="section" aria-labelledby="tally-h" bg="bg.panel" borderWidth="1px" borderRadius="lg" p={{base: '4', md: '5'}} gap="4">
            <HStack justify="space-between" align="baseline">
                <Text as="h2" id="tally-h" fontSize="md" fontWeight="bold">{open ? 'Current tally' : 'Final tally'}</Text>
                {open && (
                    <HStack gap="1.5" fontSize="xs" color="fg.muted">
                        <Box w="2" h="2" borderRadius="full" bg={TALLY_COLORS.yes} aria-hidden />
                        <Text as="span">Live</Text>
                    </HStack>
                )}
            </HStack>

            {open && tally === null ? (
                <Text fontSize="sm" color="fg.muted" role="status">{"The live tally didn't load. It's retried every minute."}</Text>
            ) : (
                <>
                    {open && <Turnout tally={tally} params={params} bondedTokens={bondedTokens} />}
                    <Stack gap="3" data-testid="tally-rows">
                        {tallyShares(tally).map((s) => (
                            <Stack key={s.option} gap="1">
                                <HStack justify="space-between" align="baseline" fontSize="13px" gap="2">
                                    <HStack gap="2" fontWeight="semibold">
                                        <Box w="2.5" h="2.5" borderRadius="xs" bg={TALLY_COLORS[s.option]} aria-hidden />
                                        <Text as="span">{s.label}</Text>
                                    </HStack>
                                    <Text textAlign="right">
                                        <Text as="span" color="fg.muted">{`${wholeBze(s.amount)} BZE`}</Text>
                                        {' · '}
                                        <Text as="strong">{formatPct(s.pct ?? 0)}</Text>
                                    </Text>
                                </HStack>
                                <Box h="6px" borderRadius="full" bg="bg.muted" overflow="hidden" aria-hidden>
                                    <Box h="full" w={`${s.pct ? s.pct.toFixed(4) : 0}%`} bg={TALLY_COLORS[s.option]} />
                                </Box>
                            </Stack>
                        ))}
                    </Stack>

                    <Stack
                        data-testid="tally-result"
                        bg={result.good ? 'green.500/7' : 'orange.500/8'}
                        borderWidth="1px"
                        borderColor={result.good ? 'green.500/30' : 'orange.500/30'}
                        borderRadius="lg"
                        px="3.5"
                        py="3"
                        gap="2"
                    >
                        <Text fontSize="sm" fontWeight="bold" color={result.good ? 'green.fg' : 'orange.fg'}>{result.title}</Text>
                        <Stack as="ul" gap="2" listStyleType="none" m="0" p="0">
                            {result.rows.map((row) => <CheckLine key={row.name} row={row} />)}
                        </Stack>
                    </Stack>
                </>
            )}
            <Text fontSize="xs" color="fg.muted" data-testid="tally-footnote">{tallyFootnote(params)}</Text>
        </Stack>
    );
}
