'use client';

import type {ReactNode} from 'react';
import {Button, chakra, Flex} from '@chakra-ui/react';
import {LuTrash2} from 'react-icons/lu';
import {hgVariant} from '@bze/bze-ui-kit';
import type {ProposalModel} from '@/lib/proposal-model';
import {tallyView} from '@/lib/proposal-tally';
import {stateCard} from '@/lib/proposal-view';
import type {ProposalActions} from './actions-slot';
import {TxPanel} from './tx-panel';
import {Note, Small} from './ui';

/** The amber button of a settle (ActionDialogs "Settle and run", E4 "Settle now"). */
export const SettleButton = ({children, size = 'sm', ...rest}: {children: ReactNode; size?: 'sm' | 'lg'; disabled?: boolean; onClick?: () => void; 'data-testid'?: string; w?: string}) => (
    <Button
        h={size === 'sm' ? '32px' : '44px'}
        px={size === 'sm' ? '12px' : '18px'}
        borderRadius="12px"
        fontSize={size === 'sm' ? '13px' : '15px'}
        fontWeight="600"
        color="#1A1200"
        bgImage="linear-gradient(135deg, var(--chakra-colors-hg-warning-text), var(--chakra-colors-hg-warning))"
        border="0"
        _hover={{filter: 'brightness(1.06)'}}
        _disabled={{opacity: 0.5, cursor: 'not-allowed', filter: 'none'}}
        {...rest}
    >
        {children}
    </Button>
);

interface Props {
    actions: ProposalActions | null;
    model: ProposalModel;
    nowMs: number;
}

/**
 * The top of the main column (E4): what can happen next (settle, settle early, retry, mark expired) as a tinted
 * note with its button, or how a finished proposal ended with the clean-up; and, while no dialog is open, the
 * transaction panel of the last action (it stays while the actions are locked).
 */
export const StateArea = ({actions, model, nowMs}: Props) => {
    const view = tallyView(model.config, model.tally, model.expedited);
    const card = stateCard(model, view, nowMs, model.daoType === 'DAO_TYPE_STATIC_LIST');
    const settle = actions?.view.settle ?? null;
    const cleanup = actions?.view.cleanup ?? null;
    const locked = actions?.flow.locked ?? false;
    const tx = actions && !actions.dialog && actions.flow.state.phase !== 'idle'
        ? <TxPanel state={actions.flow.state} progress={actions.progress} status={model.status} onRecheck={() => void actions.flow.recheck()} />
        : null;
    if (!card && !tx) return null;

    const openSettle = () => actions?.open({kind: 'settle'});
    let action: ReactNode = null;
    if (settle && card && card.kind !== 'finished' && card.kind !== 'archived') {
        const disabled = !settle.enabled || locked;
        action = settle.kind === 'retry'
            ? <Button variant={hgVariant('primary')} h="32px" px="12px" fontSize="13px" disabled={disabled} onClick={openSettle} data-testid="settle-button">Retry</Button>
            : settle.kind === 'expire'
                ? <Button variant={hgVariant('secondary')} h="32px" px="12px" fontSize="13px" disabled={disabled} onClick={openSettle} data-testid="settle-button">Mark expired</Button>
                : <SettleButton disabled={disabled} onClick={openSettle} data-testid="settle-button">Settle now</SettleButton>;
    }
    const blocked = settle && !settle.enabled && settle.reason ? <Small testId="settle-blocked">{settle.reason}</Small> : null;

    return (
        <Flex direction="column" gap="12px" data-testid="state-area">
            {tx}
            {card && (card.kind === 'settle' || card.kind === 'early') && (
                <Flex direction="column" gap="6px" data-testid="settle-banner">
                    <Note tone={card.tone} title={card.title} action={action}>{card.text}</Note>
                    {blocked}
                </Flex>
            )}
            {card && (card.kind === 'retry' || card.kind === 'expire') && (
                <Flex direction="column" gap="6px">
                    <Note tone={card.tone} title={card.title} action={action} testId="status-note">{card.text}</Note>
                    {blocked}
                </Flex>
            )}
            {card && card.kind === 'archived' && <Note tone="neutral" title="Archived" testId="archived-note">{card.text}</Note>}
            {card && card.kind === 'finished' && (
                <chakra.section bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="16px" p="18px" display="flex" flexDirection="column" gap="12px" data-testid="finished-note">
                    <chakra.p m="0" fontSize="13px" lineHeight="1.55" color="hg.text.secondary">{card.text}</chakra.p>
                    {cleanup && (
                        <Flex gap="12px" align="center" wrap="wrap" data-testid="action-cleanup">
                            <Button variant={hgVariant('secondary')} h="32px" px="12px" fontSize="13px" disabled={!cleanup.enabled || locked} onClick={() => actions?.open({kind: 'cleanup'})} data-testid="cleanup-button">
                                <LuTrash2 aria-hidden /> Clean up
                            </Button>
                            <Small>{cleanup.enabled ? 'Frees chain storage. History stays on BZE Scan.' : <span data-testid="cleanup-disabled">{`Clean-up is not available: ${cleanup.reason}`}</span>}</Small>
                        </Flex>
                    )}
                </chakra.section>
            )}
        </Flex>
    );
};
