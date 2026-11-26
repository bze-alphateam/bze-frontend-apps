'use client';

import {chakra, Flex} from '@chakra-ui/react';
import {getExplorerBlockURL, getExplorerTxURL, type DaoCoin} from '@bze/bze-ui-kit';
import {Panel, Row} from '@/components/dao/page/panel';
import {formatDateTime, formatRelative} from '@/lib/format';
import {describeMoney} from '@/lib/proposal-money';
import {buildTimeline} from '@/lib/proposal-timeline';
import type {ProposalPageData} from '@/lib/proposal-loader';

/** The life of the proposal in order; times from the chain, the settle and cleanup from Scan (heights). */
export const TimelinePanel = ({data, nowMs}: {data: ProposalPageData; nowMs: number}) => {
    const {model} = data;
    const items = buildTimeline(model, data.params.ok ? data.params.value : null, nowMs);

    return (
        <Panel id="timeline" title="Timeline" testId="timeline-panel">
            <Flex as="ol" direction="column" gap="12px" m="0" p="0" listStyleType="none">
                {items.map((item) => {
                    const href = item.height ? (item.kind === 'submitted' && model.outcome?.submitTxHash ? getExplorerTxURL(model.outcome.submitTxHash) : getExplorerBlockURL(item.height)) : null;
                    const relative = formatRelative(item.time, nowMs);
                    return (
                        <chakra.li key={item.kind} display="flex" flexDirection="column" gap="2px" opacity={item.upcoming ? 0.7 : 1} data-testid="timeline-item" data-kind={item.kind}>
                            <chakra.span fontWeight="600" fontSize="14px">{item.label}</chakra.span>
                            <Flex gap="4px 12px" wrap="wrap" fontSize="13px" color="fg.muted">
                                {item.time && <span data-testid="timeline-time">{formatDateTime(item.time)}</span>}
                                {relative && <span>{relative}</span>}
                                {href && <chakra.a href={href} target="_blank" rel="noopener noreferrer" color="hg.link" data-testid="timeline-block">{`Block ${item.height}`}</chakra.a>}
                            </Flex>
                            {item.detail && <chakra.span fontSize="13px" color="fg.muted" data-testid="timeline-detail">{item.detail}</chakra.span>}
                        </chakra.li>
                    );
                })}
            </Flex>
            {model.outcome === null && <chakra.p m="0" fontSize="12px" color="hg.text.faint" data-testid="timeline-no-scan">How it was settled, and when it was cleaned up, come from BZE Scan, which is not answering.</chakra.p>}
        </Panel>
    );
};

/** What the proposal cost and what happens to its deposit. */
export const MoneyPanel = ({data, formatCoin}: {data: ProposalPageData; formatCoin: (coin: DaoCoin) => string}) => {
    const money = describeMoney(data.model, formatCoin);
    const nothing = !money.cost && !money.deposit;

    return (
        <Panel id="money" title="Cost and deposit" testId="money-panel">
            {nothing && <chakra.p m="0" color="fg.muted" data-testid="money-none">{data.model.config ? 'This proposal had no cost and no deposit.' : 'The cost and deposit of this proposal are not known.'}</chakra.p>}
            <Flex direction="column" gap="10px">
                {money.cost && <Row label="Proposal cost" testId="money-cost">{money.cost}</Row>}
                {money.deposit && (
                    <Row label="Deposit" testId="money-deposit">
                        <Flex direction="column" gap="2px">
                            <span>{money.deposit}</span>
                            {money.depositRule && <chakra.span color="fg.muted" data-testid="deposit-rule">{money.depositRule}</chakra.span>}
                            {money.released && <chakra.span color="fg.muted" data-testid="deposit-released">{money.released}</chakra.span>}
                        </Flex>
                    </Row>
                )}
            </Flex>
        </Panel>
    );
};
