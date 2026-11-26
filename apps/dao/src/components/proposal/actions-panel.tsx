'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {DaoCoin} from '@bze/bze-ui-kit';
import {AddressLine, Panel} from '@/components/dao/page/panel';
import {PlainText} from '@/components/ui/plain-text';
import type {ConfigChange, MsgAction} from '@/lib/proposal-describe';

interface Props {
    actions: MsgAction[];
    formatCoin: (coin: DaoCoin) => string;
    nameOf: (address: string) => string | undefined;
}

const Fact = ({children, testId}: {children: React.ReactNode; testId?: string}) => (
    <chakra.p m="0" fontSize="14px" overflowWrap="anywhere" data-testid={testId}>{children}</chakra.p>
);

const Addresses = ({list, nameOf}: {list: string[]; nameOf: Props['nameOf']}) => (
    <Flex direction="column" gap="2px">{list.map((a) => <AddressLine key={a} address={a} name={nameOf(a)} />)}</Flex>
);

const ChangeLine = ({change}: {change: ConfigChange}) => (
    <chakra.li fontSize="14px" data-testid="config-change">
        <chakra.span fontWeight="600">{change.label}</chakra.span>
        {change.before !== null && <chakra.span color="fg.muted">{`: ${change.before} → `}</chakra.span>}
        {change.before === null && ': '}
        <chakra.span>{change.after}</chakra.span>
    </chakra.li>
);

const Described = ({action, formatCoin, nameOf}: {action: MsgAction} & Omit<Props, 'actions'>) => {
    switch (action.type) {
        case 'send':
            return (
                <Flex direction="column" gap="4px">
                    <Fact testId="action-title">{`Send ${action.amount.map(formatCoin).join(', ') || 'nothing'}${action.fromDao ? ' from the DAO' : action.subDao ? ` from the sub-DAO (DAO ${action.subDao})` : ''}`}</Fact>
                    <Flex gap="6px" align="center" wrap="wrap" fontSize="13px" color="fg.muted"><span>to</span><AddressLine address={action.to} name={nameOf(action.to)} /></Flex>
                    {!action.fromDao && !action.subDao && action.from && <Fact>{'Paid from an account other than the DAO\'s own: the proposal cannot spend it.'}</Fact>}
                </Flex>
            );
        case 'update_config':
            return (
                <Flex direction="column" gap="4px">
                    <Fact testId="action-title">Change the voting rules</Fact>
                    {action.unchanged && <Fact>It sets the same rules the DAO had when the proposal was submitted.</Fact>}
                    <chakra.ul m="0" ps="18px" display="flex" flexDirection="column" gap="2px">{action.changes.map((c) => <ChangeLine key={c.field} change={c} />)}</chakra.ul>
                </Flex>
            );
        case 'update_metadata':
            return (
                <Flex direction="column" gap="4px">
                    <Fact testId="action-title">Rename the DAO or change its description</Fact>
                    <Fact>{`Name: ${action.name}`}</Fact>
                    {action.description && <PlainText text={action.description} color="fg.muted" />}
                </Flex>
            );
        case 'update_members':
            return (
                <Flex direction="column" gap="6px">
                    <Fact testId="action-title">Change the members</Fact>
                    {action.add.length > 0 && <><Fact>{`Add ${action.add.length}`}</Fact><Addresses list={action.add} nameOf={nameOf} /></>}
                    {action.remove.length > 0 && <><Fact>{`Remove ${action.remove.length}`}</Fact><Addresses list={action.remove} nameOf={nameOf} /></>}
                </Flex>
            );
        case 'update_electorate':
            return (
                <Flex direction="column" gap="4px">
                    <Fact testId="action-title">Change who votes (the staking sources)</Fact>
                    <Fact>
                        {action.srIds.length === 0 && !action.drDenom
                            ? 'No sources: nobody would be able to vote.'
                            : [...action.srIds.map((id) => `Staking reward ${Number(id) || id}`), ...(action.drDenom ? [`Denom Reward of ${action.drDenom}`] : [])].join(', ')}
                    </Fact>
                </Flex>
            );
        case 'nominate_admin':
            return action.toVoters
                ? <Fact testId="action-title">Hand the DAO to its own voters: the admin steps down and no outside account controls it.</Fact>
                : <Flex direction="column" gap="4px"><Fact testId="action-title">Nominate a new admin (they have to accept)</Fact><AddressLine address={action.nominee} name={nameOf(action.nominee)} /></Flex>;
        case 'withdraw_nomination':
            return <Fact testId="action-title">Withdraw the pending admin nomination</Fact>;
        case 'accept_admin':
            return <Flex direction="column" gap="4px"><Fact testId="action-title">Accept the admin nomination</Fact>{action.nominee && <AddressLine address={action.nominee} name={nameOf(action.nominee)} />}</Flex>;
        case 'admin_execute':
            return (
                <Flex direction="column" gap="8px">
                    <Fact testId="action-title">{`Run ${action.actions.length === 1 ? 'an action' : `${action.actions.length} actions`} as the DAO it administers (DAO ${action.daoId})`}</Fact>
                    <Flex direction="column" gap="8px" ps="12px" borderStartWidth="2px" borderColor="app.border">
                        {action.actions.map((inner, i) => <Described key={i} action={inner} formatCoin={formatCoin} nameOf={nameOf} />)}
                    </Flex>
                </Flex>
            );
        case 'other':
            return (
                <Flex direction="column" gap="6px">
                    <Fact testId="action-title">{action.title}</Fact>
                    <chakra.code fontSize="12px" color="fg.muted" overflowWrap="anywhere">{action.typeUrl}</chakra.code>
                    <chakra.pre m="0" p="10px" fontSize="12px" bg="hg.inset" borderRadius="8px" overflowX="auto" data-testid="action-raw">{action.json}</chakra.pre>
                </Flex>
            );
    }
};

/** What the proposal does if it passes, one collapsed item per message. A proposal without messages says so. */
export const ActionsPanel = ({actions, formatCoin, nameOf}: Props) => (
    <Panel id="actions" title="Actions if it passes" testId="actions-panel">
        {actions.length === 0 && <chakra.p m="0" color="fg.muted" data-testid="text-only">This is a text-only proposal: it asks for no action. Passing it only records the DAO&apos;s decision.</chakra.p>}
        {actions.length > 0 && <chakra.p m="0" fontSize="13px" color="fg.muted">They run as the DAO, all or nothing, once the proposal passes.</chakra.p>}
        <Flex direction="column" gap="8px">
            {actions.map((action, i) => (
                <chakra.details key={i} borderWidth="1px" borderColor="app.border" borderRadius="12px" px="14px" py="10px" data-testid="action">
                    <chakra.summary cursor="pointer" fontWeight="600" fontSize="14px">
                        {`${i + 1}. ${summaryOf(action)}`}
                    </chakra.summary>
                    <chakra.div mt="10px"><Described action={action} formatCoin={formatCoin} nameOf={nameOf} /></chakra.div>
                </chakra.details>
            ))}
        </Flex>
    </Panel>
);

const SUMMARY: Record<MsgAction['type'], string> = {
    send: 'Send funds',
    update_config: 'Change the voting rules',
    update_metadata: 'Change the name or description',
    update_members: 'Change the members',
    update_electorate: 'Change who votes',
    nominate_admin: 'Nominate an admin',
    withdraw_nomination: 'Withdraw the admin nomination',
    accept_admin: 'Accept the admin nomination',
    admin_execute: 'Run actions as a sub-DAO',
    other: 'Other action',
};

const summaryOf = (action: MsgAction): string => (action.type === 'other' ? action.title : action.type === 'nominate_admin' && action.toVoters ? 'Hand the DAO to its voters' : SUMMARY[action.type]);
