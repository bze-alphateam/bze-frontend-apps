'use client';

import {Box, chakra, Flex} from '@chakra-ui/react';
import {LuCircleCheck, LuCircleHelp, LuCircleX} from 'react-icons/lu';
import {shortNumberFormat, uAmountToBigNumberAmount, type GovParams, type GovProposal, type GovTally} from '@bze/bze-ui-kit';
import {passingChecks, quorumStatus, tallyShares} from '@/lib/governance/tally';
import {finalChecks, isOpen, tallyFootnote, wholeBze} from '@/lib/governance/details';
import {statusInfo} from '@/lib/governance/proposal';
import {formatPct, fractionPct} from '@/lib/governance/format';
import {TALLY_COLORS} from '../tally-bar';
import {Panel} from './panel';

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
    const color = row.ok === null ? 'hg.text.faint' : row.ok ? 'hg.success' : 'hg.danger';
    return (
        <Flex as="li" align="flex-start" gap="8px" fontSize="13px" lineHeight="1.45" color="fg.muted">
            <Box color={color} mt="1px" flex="none"><Icon size={15} aria-label={row.ok === null ? 'unknown' : row.ok ? 'met' : 'not met'} /></Box>
            <chakra.span><chakra.strong color="fg">{row.name}</chakra.strong>{` ${row.text}`}</chakra.span>
        </Flex>
    );
}

function Turnout({tally, params, bondedTokens}: Omit<ProposalTallyProps, 'proposal'>) {
    const {turnout, quorum} = quorumStatus(tally, bondedTokens, params);
    if (turnout == null) return null;
    const fill = clampPct(turnout.toNumber());
    const marker = clampPct(quorum.toNumber());
    const bonded = shortNumberFormat(uAmountToBigNumberAmount(bondedTokens, 6));

    return (
        <Flex direction="column" gap="6px">
            <Flex justify="space-between" fontSize="13px">
                <chakra.span color="fg.muted">Turnout</chakra.span>
                <chakra.span>
                    <chakra.strong>{formatPct(turnout)}</chakra.strong>
                    <chakra.span color="fg.muted">{` of ${bonded} staked BZE`}</chakra.span>
                </chakra.span>
            </Flex>
            <Box role="img" aria-label={`Turnout ${formatPct(turnout)}, quorum line at ${formatPct(quorum)}`} position="relative" h="10px" borderRadius="full" bg="hg.inset">
                <Box position="absolute" left="0" top="0" bottom="0" w={`${fill}%`} borderRadius="full" bgImage="app" />
                <Box position="absolute" left={`${marker}%`} top="-4px" bottom="-4px" w="2px" bg="fg" />
            </Box>
            <Box position="relative" h="16px">
                <chakra.span position="absolute" left={`${marker}%`} transform="translateX(-50%)" fontSize="12px" color="fg.muted" whiteSpace="nowrap">
                    {`▲ quorum ${formatPct(quorum)}`}
                </chakra.span>
            </Box>
        </Flex>
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
        <Panel
            headingId="tally-h"
            title={open ? 'Current tally' : 'Final tally'}
            gap="16px"
            aside={open && (
                <Flex align="center" gap="6px" fontSize="12px" color="fg.muted">
                    <Box boxSize="8px" borderRadius="full" bg={TALLY_COLORS.yes} aria-hidden />
                    <chakra.span>Live</chakra.span>
                </Flex>
            )}
        >
            {open && tally === null ? (
                <chakra.span fontSize="14px" color="fg.muted" role="status">{"The live tally didn't load. It's retried every minute."}</chakra.span>
            ) : (
                <>
                    {open && <Turnout tally={tally} params={params} bondedTokens={bondedTokens} />}
                    <Flex direction="column" gap="12px" data-testid="tally-rows">
                        {tallyShares(tally).map((s) => (
                            <Flex key={s.option} direction="column" gap="5px">
                                <Flex justify="space-between" align="baseline" fontSize="13px" gap="8px">
                                    <Flex align="center" gap="8px" fontWeight="600">
                                        <Box boxSize="10px" borderRadius="3px" bg={TALLY_COLORS[s.option]} aria-hidden />
                                        <chakra.span>{s.label}</chakra.span>
                                    </Flex>
                                    <chakra.span textAlign="right">
                                        <chakra.span color="fg.muted">{`${wholeBze(s.amount)} BZE`}</chakra.span>
                                        {' · '}
                                        <chakra.strong>{formatPct(s.pct ?? 0)}</chakra.strong>
                                    </chakra.span>
                                </Flex>
                                <Box h="6px" borderRadius="full" bg="hg.inset" overflow="hidden" aria-hidden>
                                    <Box h="full" w={`${s.pct ? s.pct.toFixed(4) : 0}%`} bg={TALLY_COLORS[s.option]} />
                                </Box>
                            </Flex>
                        ))}
                    </Flex>

                    <Flex
                        direction="column"
                        data-testid="tally-result"
                        data-good={result.good}
                        bg={result.good ? 'hg.success/8' : 'hg.warning/8'}
                        borderWidth="1px"
                        borderColor={result.good ? 'hg.success/30' : 'hg.warning/30'}
                        borderRadius="14px"
                        p="14px"
                        gap="8px"
                    >
                        <chakra.strong fontSize="14px" color={result.good ? 'hg.success.text' : 'hg.warning.text'}>{result.title}</chakra.strong>
                        <Flex as="ul" direction="column" gap="8px" listStyleType="none" m="0" p="0">
                            {result.rows.map((row) => <CheckLine key={row.name} row={row} />)}
                        </Flex>
                    </Flex>
                </>
            )}
            <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="tally-footnote">{tallyFootnote(params)}</chakra.span>
        </Panel>
    );
}
