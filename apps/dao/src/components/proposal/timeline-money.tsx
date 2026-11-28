'use client';

import {chakra, Flex} from '@chakra-ui/react';
import {getExplorerBlockURL, getExplorerTxURL, type DaoCoin} from '@bze/bze-ui-kit';
import {shortAddress} from '@/lib/format';
import {moneyRows} from '@/lib/proposal-money';
import {buildTimeline, type TimelineItem} from '@/lib/proposal-timeline';
import {countdown, shortStampOf, stampOf} from '@/lib/proposal-view';
import type {ProposalPageData} from '@/lib/proposal-loader';
import {Card, Rows} from './ui';

type Dot = 'done' | 'next' | 'later';

const DOT: Record<Dot, {bg: string; border: string}> = {
    done: {bg: 'hg.accent', border: 'hg.accent'},
    next: {bg: 'hg.warning', border: 'hg.warning'},
    later: {bg: 'hg.card', border: 'hg.lineStrong'},
};

/** The line under a step: its time, how long until it, its block; the settle still to come says from when and by whom. */
function lineOf(item: TimelineItem, ended: boolean, nowMs: number): string {
    if (item.kind === 'settle-next') return ended ? 'Now, by anyone' : item.time ? `From ${shortStampOf(item.time).replace(',', '')}, by anyone` : 'After voting ends, by anyone';
    if (item.kind === 'retry-until') return item.time ? `Until ${stampOf(item.time)}` : '';
    if (item.kind === 'early' && !item.time) return item.detail;
    const parts = [stampOf(item.time)];
    if (item.upcoming) parts.push(countdown(item.time, nowMs, true));
    return parts.filter(Boolean).join(' · ');
}

/** E2 Timeline: the life of the proposal, a dot per step (done, the next one, later ones) joined by a line. */
export const TimelinePanel = ({data, nowMs, proposerName}: {data: ProposalPageData; nowMs: number; proposerName?: string}) => {
    const {model} = data;
    const items = buildTimeline(model, data.params.ok ? data.params.value : null, nowMs);
    const firstUpcoming = items.findIndex((i) => i.upcoming);
    const proposer = proposerName ?? shortAddress(model.proposer);

    return (
        <Card id="timeline" title="Timeline" testId="timeline-panel">
            <chakra.ol m="0" p="0" listStyleType="none">
                {items.map((item, i) => {
                    const href = item.height ? (item.kind === 'submitted' && model.outcome?.submitTxHash ? getExplorerTxURL(model.outcome.submitTxHash) : getExplorerBlockURL(item.height)) : null;
                    const dot: Dot = !item.upcoming ? 'done' : i === firstUpcoming ? 'next' : 'later';
                    const label = item.kind === 'submitted' ? `Submitted${model.expedited ? ' (expedited)' : ''} by ${proposer}` : item.label;
                    const line = lineOf(item, model.votingEnded, nowMs);
                    const last = i === items.length - 1;
                    return (
                        <chakra.li key={item.kind} position="relative" display="flex" gap="14px" pb={last ? '0' : '14px'} data-testid="timeline-item" data-kind={item.kind} data-dot={dot}>
                            {!last && <chakra.span aria-hidden position="absolute" left="6px" top="18px" bottom="-2px" w="2px" bg="hg.divider" />}
                            <chakra.span aria-hidden position="relative" boxSize="14px" flex="none" mt="3px" borderRadius="999px" bg={DOT[dot].bg} borderWidth="2px" borderColor={DOT[dot].border} />
                            <Flex direction="column" gap="2px" minW="0">
                                <chakra.strong fontSize="14px">{label}</chakra.strong>
                                {(line || href) && (
                                    <chakra.span fontSize="13px" color="hg.text.faint">
                                        {line && <span data-testid="timeline-time">{line}</span>}
                                        {href && <>{line ? ' · ' : ''}<chakra.a href={href} target="_blank" rel="noopener noreferrer" color="hg.link" data-testid="timeline-block">{`block ${item.height?.toLocaleString('en-US')}`}</chakra.a></>}
                                    </chakra.span>
                                )}
                                {item.detail && item.kind !== 'early' && <chakra.span fontSize="13px" color="hg.text.faint" data-testid="timeline-detail">{item.detail}</chakra.span>}
                                {item.detail && item.kind === 'early' && item.time && <chakra.span fontSize="13px" color="hg.text.faint" data-testid="timeline-detail">{item.detail}</chakra.span>}
                            </Flex>
                        </chakra.li>
                    );
                })}
            </chakra.ol>
            {model.outcome === null && <chakra.p m="0" fontSize="12px" color="hg.text.faint" data-testid="timeline-no-scan">How it was settled, and when it was cleaned up, come from BZE Scan, which is not answering.</chakra.p>}
        </Card>
    );
};

/** E2 Deposit and cost: the deposit, what happens to it (or what did), and the cost. */
export const MoneyPanel = ({data, formatCoin}: {data: ProposalPageData; formatCoin: (coin: DaoCoin) => string}) => {
    const money = moneyRows(data.model, formatCoin);
    return (
        <Card id="money" title="Deposit and cost" testId="money-panel">
            {money.note && <chakra.p m="0" fontSize="14px" lineHeight="1.55" color="hg.text.secondary" data-testid={money.note.testId}>{money.note.text}</chakra.p>}
            {money.rows.length > 0 && <Rows rows={money.rows.map((r) => ({label: r.label, value: r.value, testId: r.testId}))} labelWidth="140px" />}
        </Card>
    );
};
