'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoCoin, DaoParams} from '@bze/bze-ui-kit';
import {Notice} from '@bze/bze-ui-kit';
import {describeRules} from '@/lib/dao-rules';
import {treasuryView} from '@/lib/dao-treasury';
import type {Part} from '@/lib/dao-view-loader';
import {Card, Dl} from './bits';
import {Panel} from './panel';
import {useCoinFormat} from './use-coin-format';

/** The DAO account's balances: the USD total on the right of the title, one row per token with its letter badge. */
export const TreasuryPanel = ({treasury}: {treasury: Part<DaoCoin[]>}) => {
    const coins = useCoinFormat();
    const view = treasury.ok ? treasuryView(treasury.value, {ticker: coins.ticker, amount: coins.amountOf, usdValue: coins.usdValue}) : null;
    const total = view?.total
        ? (
            <Flex direction="column" align="flex-end" display={{base: 'none', md: 'flex'}}>
                <chakra.strong fontSize="15px" color="fg" data-testid="treasury-total" data-partial={view.partial ? 'true' : undefined}>
                    {view.total}
                </chakra.strong>
                {view.partial && <chakra.span fontSize="12px" color="hg.text.faint" data-testid="treasury-partial">priced tokens only</chakra.span>}
            </Flex>
        )
        : undefined;

    return (
        <Card title="Treasury" titleId="treasury-title" aside={total} gap="10px" testId="treasury-panel">
            {!treasury.ok && <Notice status="warning">The treasury balances could not be read from the chain right now.</Notice>}
            {view && view.rows.length === 0 && <chakra.p m="0" fontSize="14px" color="fg.muted" data-testid="treasury-empty">The treasury is empty.</chakra.p>}
            {view && view.rows.length > 0 && (
                // I2: on a phone the treasury is a plain ticker → amount list
                <chakra.dl m="0" display={{base: 'flex', md: 'none'}} flexDirection="column" data-testid="treasury-phone">
                    {view.rows.map((row, i) => (
                        <chakra.div key={row.denom} display="grid" gridTemplateColumns="minmax(0, 1fr) auto" gap="16px" py="7px" borderTopWidth={i === 0 ? '0' : '1px'} borderColor="hg.divider">
                            <chakra.dt fontSize="14px" color="fg.muted" overflowWrap="anywhere">{row.ticker}</chakra.dt>
                            <chakra.dd m="0" fontSize="14px" color="fg" fontVariantNumeric="tabular-nums">{row.amount}</chakra.dd>
                        </chakra.div>
                    ))}
                </chakra.dl>
            )}
            {view && view.rows.length > 0 && (
                <chakra.div display={{base: 'none', md: 'block'}}>
                    {view.rows.map((row) => (
                        <Flex key={row.denom} justify="space-between" align="center" gap="12px" py="10px" borderTopWidth="1px" borderColor="hg.divider" data-testid="treasury-row">
                            <Flex align="center" gap="10px" minW="0">
                                <chakra.span
                                    aria-hidden
                                    boxSize="28px"
                                    flex="none"
                                    borderRadius="999px"
                                    bgImage={`linear-gradient(135deg, ${row.badge.from}, ${row.badge.to})`}
                                    color={row.badge.ink}
                                    fontWeight="800"
                                    fontSize="11px"
                                    display="inline-flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    data-testid="treasury-badge"
                                >
                                    {row.badge.letter}
                                </chakra.span>
                                <chakra.strong fontSize="14px" overflowWrap="anywhere" minW="0">{row.ticker}</chakra.strong>
                            </Flex>
                            <Flex direction="column" align="flex-end" flex="none">
                                <chakra.strong fontSize="14px" fontVariantNumeric="tabular-nums" data-testid="treasury-amount">{row.amount}</chakra.strong>
                                {row.usd && <chakra.span fontSize="12px" color="hg.text.faint" data-testid="treasury-usd">{row.usd}</chakra.span>}
                            </Flex>
                        </Flex>
                    ))}
                </chakra.div>
            )}
        </Card>
    );
};

/** The voting rules in plain words, one row each (the "See governance rules" list of the DAO page). */
export const RulesRows = ({dao, params}: {dao: Pick<Dao, 'type' | 'config'>; params: Part<DaoParams>}) => {
    const coins = useCoinFormat();
    const rules = describeRules(dao.type, dao.config, params.ok ? params.value : null, coins.format);
    return <Dl wide rows={rules.rows.map((row) => ({key: row.id, label: row.label, value: row.value, testId: `rule-${row.id}`}))} />;
};

/** The voting rules as a card. */
export const RulesPanel = ({dao, params}: {dao: Dao; params: Part<DaoParams>}) => (
    <Panel id="rules" title="Voting rules" testId="rules-panel">
        <RulesRows dao={dao} params={params} />
    </Panel>
);
