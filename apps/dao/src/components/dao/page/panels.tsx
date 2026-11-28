'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoCoin, DaoParams} from '@bze/bze-ui-kit';
import {Notice} from '@bze/bze-ui-kit';
import {describeRules} from '@/lib/dao-rules';
import type {Part} from '@/lib/dao-view-loader';
import {Panel, Row} from './panel';
import {useCoinFormat} from './use-coin-format';

/** The DAO account's balances. */
export const TreasuryPanel = ({treasury}: {treasury: Part<DaoCoin[]>}) => {
    const coins = useCoinFormat();
    return (
        <Panel id="treasury" title="Treasury" testId="treasury-panel">
            {!treasury.ok && <Notice status="warning">The treasury balances could not be read from the chain right now.</Notice>}
            {treasury.ok && treasury.value.length === 0 && <chakra.p m="0" color="fg.muted" data-testid="treasury-empty">The treasury is empty.</chakra.p>}
            {treasury.ok && treasury.value.length > 0 && (
                <Flex direction="column" gap="8px">
                    {treasury.value.map((coin) => (
                        <Flex key={coin.denom} justify="space-between" gap="12px" data-testid="treasury-row">
                            <span>{coins.format(coin)}</span>
                            <chakra.span color="fg.muted">{coins.usd(coin)}</chakra.span>
                        </Flex>
                    ))}
                </Flex>
            )}
        </Panel>
    );
};

/** The voting rules in plain words, one row each (the rules card here, the "See governance rules" list of the DAO page). */
export const RulesRows = ({dao, params}: {dao: Pick<Dao, 'type' | 'config'>; params: Part<DaoParams>}) => {
    const coins = useCoinFormat();
    const rules = describeRules(dao.type, dao.config, params.ok ? params.value : null, coins.format);
    return (
        <Flex direction="column" gap="10px">
            {rules.rows.map((row) => <Row key={row.id} label={row.label} testId={`rule-${row.id}`}>{row.value}</Row>)}
        </Flex>
    );
};

/** The voting rules as a card (the admin console's nomination panel shows it). */
export const RulesPanel = ({dao, params}: {dao: Dao; params: Part<DaoParams>}) => (
    <Panel id="rules" title="Voting rules" testId="rules-panel">
        <RulesRows dao={dao} params={params} />
    </Panel>
);
