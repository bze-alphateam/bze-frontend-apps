'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoCoin} from '@bze/bze-ui-kit';
import type {MsgAction} from '@/lib/proposal-describe';
import type {Composition} from '@/lib/propose/compose';
import type {CostSummary} from '@/lib/propose/cost';
import {Panel} from '@/components/dao/page/panel';
import {ActionsPanel} from '@/components/proposal/actions-panel';

/** The packed size of the actions against the DAO's limit. */
export const SizeMeter = ({size, max}: {size: number; max: number}) => {
    const percent = max > 0 ? Math.min(100, Math.round((size / max) * 100)) : 0;
    const over = size > max;
    return (
        <Flex direction="column" gap="4px" data-testid="size-meter">
            <chakra.div h="8px" borderRadius="999px" bg="hg.inset" overflow="hidden" role="meter" aria-label="Size of the actions" aria-valuemin={0} aria-valuemax={max} aria-valuenow={size}>
                <chakra.div h="100%" w={`${percent}%`} bg={over ? 'red.500' : 'hg.link'} />
            </chakra.div>
            <chakra.span fontSize="12px" color={over ? 'red.500' : 'hg.text.faint'} data-testid="size-text">
                {`${size.toLocaleString('en-US')} of ${max.toLocaleString('en-US')} bytes`}
            </chakra.span>
        </Flex>
    );
};

interface Props {
    dao: Pick<Dao, 'name'>;
    composition: Composition;
    actions: MsgAction[];
    cost: CostSummary;
    formatCoin: (coin: DaoCoin) => string;
    nameOf: (address: string) => string | undefined;
    expedited: boolean;
    /** Whether a wallet's balances are known (the "you have" lines). */
    balancesKnown: boolean;
    /** The account every message is signed by. */
    signer?: string;
}

/** What is signed and paid: the actions, their size, the cost and the deposit with the wallet's balance. */
export const Review = ({dao, composition, actions, cost, formatCoin, nameOf, expedited, balancesKnown, signer}: Props) => (
    <Flex direction="column" gap="16px" data-testid="review">
        <ActionsPanel actions={actions} formatCoin={formatCoin} nameOf={nameOf} signer={signer} />
        {composition.actions.length > 0 && <SizeMeter size={composition.size} max={composition.maxBytes} />}
        <Panel id="cost" title="What you pay" testId="cost-panel">
            {cost.lines.length === 0 && <chakra.p m="0" fontSize="14px" data-testid="cost-free">{`${dao.name} charges nothing to submit a proposal: no cost and no deposit.`}</chakra.p>}
            {cost.lines.map((line) => (
                <chakra.p key={line.kind} m="0" fontSize="14px" data-testid={`cost-${line.kind}`}>
                    <chakra.span fontWeight="700">{line.kind === 'cost' ? 'Cost: ' : 'Deposit: '}</chakra.span>
                    {line.text}
                </chakra.p>
            ))}
            {cost.requirements.map((r) => (
                <chakra.p key={r.denom} m="0" fontSize="13px" color={r.short ? 'red.500' : 'fg.muted'} data-testid="cost-balance">
                    {balancesKnown
                        ? `You need ${formatCoin({denom: r.denom, amount: r.needed})}${r.balance === null ? '' : ` and have ${formatCoin({denom: r.denom, amount: r.balance})}`}${r.short ? ': not enough.' : '.'}`
                        : `You need ${formatCoin({denom: r.denom, amount: r.needed})}.`}
                </chakra.p>
            ))}
            {cost.lines.length > 0 && <chakra.p m="0" fontSize="12px" color="hg.text.faint">These are paid in their own token and never swapped. The network fee is paid on top.</chakra.p>}
            {expedited && <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid="review-expedited">This proposal is expedited: its voting period is the shorter one.</chakra.p>}
        </Panel>
    </Flex>
);
