'use client';

import NextLink from 'next/link';
import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoCoin, DaoParams} from '@bze/bze-ui-kit';
import {Notice} from '@bze/bze-ui-kit';
import {describeControl, type ControlStep} from '@/lib/dao-control';
import {describeRules} from '@/lib/dao-rules';
import type {DaoView, Part} from '@/lib/dao-view-loader';
import {AddressLine, Panel, Row} from './panel';
import {useCoinFormat} from './use-coin-format';

const Step = ({step, nameOf}: {step: ControlStep; nameOf: (address: string) => string | undefined}) => {
    if (step.kind === 'dao') {
        return step.dao
            ? <chakra.a asChild color="hg.link" fontWeight="600"><NextLink href={`/dao/${step.dao.id}`}>{step.dao.name}</NextLink></chakra.a>
            : <AddressLine address={step.address} />;
    }
    if (step.kind === 'account') return <AddressLine address={step.address} name={nameOf(step.address)} />;
    if (step.kind === 'loop') return <span>{`back to ${step.dao?.name ?? step.address}`}</span>;
    if (step.kind === 'cap') return <span>{`the 16th DAO${step.dao ? `, ${step.dao.name}` : ''}`}</span>;
    return <span>{`voters of ${step.of.dao?.name ?? 'the last DAO'}`}</span>;
};

/** Who is in charge: the voters, an outside admin, or a chain of DAOs. */
export const ControlPanel = ({view, nameOf}: {view: DaoView; nameOf: (address: string) => string | undefined}) => {
    const {dao} = view;
    const controller = view.controller.ok ? view.controller.value : null;
    const state = describeControl(dao, controller, view.knownDaos, view.unresolved);

    return (
        <Panel id="control" title="Who controls this DAO" testId="control-panel">
            <chakra.p m="0" fontWeight="600" data-testid="control-headline">
                {state.kind === 'account' ? <>Admin: <AddressLine address={dao.admin} name={nameOf(dao.admin)} full /></> : state.headline}
            </chakra.p>
            {state.kind === 'dao' && state.steps.length > 0 && (
                <Flex gap="8px" align="center" wrap="wrap" fontSize="14px" data-testid="control-chain">
                    {state.steps.map((step, i) => (
                        <Flex key={i} align="center" gap="8px">
                            {i > 0 && <span aria-hidden>→</span>}
                            <Step step={step} nameOf={nameOf} />
                        </Flex>
                    ))}
                </Flex>
            )}
            {state.warning && <Notice status="warning" title="Outside control">{state.warning}</Notice>}
            {state.note && <Notice status="info">{state.note}</Notice>}
            {state.pending && (
                <Notice status="info" title="Admin handover pending">
                    <span data-testid="control-pending">{state.pending.text}</span>
                    <Flex mt="4px"><AddressLine address={state.pending.nominee} name={nameOf(state.pending.nominee)} /></Flex>
                </Notice>
            )}
            {state.kind === 'self-owned' && (
                <chakra.p m="0" fontSize="13px" color="fg.muted">No one holds a key to this DAO: it acts only through proposals its voters pass.</chakra.p>
            )}
            {!view.controller.ok && dao.admin !== dao.address && (
                <chakra.p m="0" fontSize="13px" color="fg.muted">The full admin chain could not be read right now.</chakra.p>
            )}
        </Panel>
    );
};

/** The DAO account's balances. The module account that escrows proposal deposits is separate and not shown. */
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
            <chakra.p m="0" fontSize="12px" color="hg.text.faint">Deposits of open proposals are held by the DAO module, not in the treasury.</chakra.p>
        </Panel>
    );
};

/** The voting rules in plain words. */
export const RulesPanel = ({dao, params}: {dao: Dao; params: Part<DaoParams>}) => {
    const coins = useCoinFormat();
    const rules = describeRules(dao.type, dao.config, params.ok ? params.value : null, coins.format);

    return (
        <Panel id="rules" title="Voting rules" testId="rules-panel">
            <Flex direction="column" gap="10px">
                {rules.rows.map((row) => <Row key={row.id} label={row.label} testId={`rule-${row.id}`}>{row.value}</Row>)}
            </Flex>
            {rules.freeProposalsWarning && <Notice status="warning" title="Free proposals">{rules.freeProposalsWarning}</Notice>}
        </Panel>
    );
};
