'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {DaoCoin} from '@bze/bze-ui-kit';
import {AddressLine, Panel} from '@/components/dao/page/panel';
import {PlainText} from '@/components/ui/plain-text';
import {shortAddress} from '@/lib/format';
import type {ConfigChange, MsgAction} from '@/lib/proposal-describe';

interface Props {
    actions: MsgAction[];
    formatCoin: (coin: DaoCoin) => string;
    nameOf: (address: string) => string | undefined;
    /** The account every message is signed by, when the page knows it (the composer does). */
    signer?: string;
    /** The account of a DAO an admin execute runs actions as (the composer knows its SubDAOs). */
    signerOf?: (daoId: string) => string | undefined;
    /** What is known of a DAO a message names by id (the DAO itself, a SubDAO): its name, else its account; without either its number is shown. */
    daoOf?: (daoId: string) => DaoRef | undefined;
    /** The proposal's messages as the chain holds them: shown as one raw JSON list, in order, under the actions. */
    raw?: readonly unknown[];
    /** The wording around the actions; the defaults are a proposal's. The admin console words them for what it signs. */
    wording?: Partial<PanelWording>;
    /** Every action shown open (what is about to be signed is read, not folded away). */
    expanded?: boolean;
}

/** A DAO as a preview names it. */
export interface DaoRef {
    name?: string;
    address?: string;
}

export interface PanelWording {
    title: string;
    /** The sentence under the title when there are actions; null for none. */
    runs: string | null;
    /** What the signer line starts with, before the account. */
    signedBy: string;
    empty: string;
}

const PROPOSAL_WORDING: PanelWording = {
    title: 'Actions if it passes',
    runs: 'They run as the DAO, all or nothing, once the proposal passes.',
    signedBy: 'Every message is signed by the DAO account',
    empty: "This is a text-only proposal: it asks for no action. Passing it only records the DAO's decision.",
};

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

/**
 * A DAO a message names by its number, in words: its name, else its account (named or short), else, when
 * nothing about it is known here, its number, so a voter can still tell which DAO it is.
 */
const daoLabel = (daoId: string, {daoOf, signerOf, nameOf}: Pick<Props, 'daoOf' | 'signerOf' | 'nameOf'>): string => {
    const ref = daoOf?.(daoId);
    if (ref?.name) return ref.name;
    const address = ref?.address ?? signerOf?.(daoId);
    if (address) return nameOf(address) ?? shortAddress(address);
    return `DAO ${daoId}`;
};

export const Described = ({action, formatCoin, nameOf, signerOf, daoOf}: {action: MsgAction} & Omit<Props, 'actions' | 'signer' | 'raw'>) => {
    const dao = (daoId: string) => daoLabel(daoId, {daoOf, signerOf, nameOf});
    switch (action.type) {
        case 'send':
            return (
                <Flex direction="column" gap="4px">
                    <Fact testId="action-title">{`Send ${action.amount.map(formatCoin).join(', ') || 'nothing'}${action.fromDao ? ' from the DAO' : action.subDao ? ` from the SubDAO ${dao(action.subDao)}` : ''}`}</Fact>
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
                ? <Fact testId="action-title">{`Hand ${action.daoId ? dao(action.daoId) : 'the DAO'} to its own voters: the admin steps down and no outside account controls it.`}</Fact>
                : <Flex direction="column" gap="4px"><Fact testId="action-title">{`Nominate a new admin${action.daoId ? ` for ${dao(action.daoId)}` : ''} (they have to accept)`}</Fact><AddressLine address={action.nominee} name={nameOf(action.nominee)} /></Flex>;
        case 'withdraw_nomination':
            return <Fact testId="action-title">{`Withdraw the pending admin nomination${action.daoId ? ` of ${dao(action.daoId)}` : ''}`}</Fact>;
        case 'accept_admin':
            return (
                <Flex direction="column" gap="4px">
                    <Fact testId="action-title">{`Accept the admin nomination${action.daoId ? ` of ${dao(action.daoId)}` : ''}: the nominee becomes its admin`}</Fact>
                    {action.nominee && <AddressLine address={action.nominee} name={nameOf(action.nominee)} />}
                </Flex>
            );
        case 'admin_execute':
            return (
                <Flex direction="column" gap="8px">
                    <Fact testId="action-title">{`Run ${action.actions.length === 1 ? 'an action' : `${action.actions.length} actions`} as the SubDAO ${dao(action.daoId)}`}</Fact>
                    <Flex direction="column" gap="8px" ps="12px" borderStartWidth="2px" borderColor="app.border">
                        {signerOf && (
                            <Flex gap="6px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="run-as">
                                <span>Signed by</span>
                                {signerOf(action.daoId)
                                    ? <AddressLine address={signerOf(action.daoId) as string} name={nameOf(signerOf(action.daoId) as string)} />
                                    : <span>{`${dao(action.daoId)} (its account is not known here)`}</span>}
                            </Flex>
                        )}
                        {action.actions.map((inner, i) => <Described key={i} action={inner} formatCoin={formatCoin} nameOf={nameOf} signerOf={signerOf} daoOf={daoOf} />)}
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

/** What the proposal does if it passes, one collapsed item per message (and, with `raw`, every message as JSON). A proposal without messages says so. */
export const ActionsPanel = ({actions, formatCoin, nameOf, signer, signerOf, daoOf, raw, wording, expanded = false}: Props) => {
    const words = {...PROPOSAL_WORDING, ...wording};
    return (
        <Panel id="actions" title={words.title} testId="actions-panel">
            {actions.length === 0 && <chakra.p m="0" color="fg.muted" data-testid="text-only">{words.empty}</chakra.p>}
            {actions.length > 0 && words.runs && <chakra.p m="0" fontSize="13px" color="fg.muted">{words.runs}</chakra.p>}
            {actions.length > 0 && signer && (
                <Flex gap="6px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="signed-by">
                    <span>{words.signedBy}</span><AddressLine address={signer} name={nameOf(signer)} />{signerOf && <span>(the actions an admin runs for a SubDAO are signed by that DAO)</span>}
                </Flex>
            )}
            <Flex direction="column" gap="8px">
                {actions.map((action, i) => (
                    <chakra.details key={i} open={expanded || undefined} borderWidth="1px" borderColor="app.border" borderRadius="12px" px="14px" py="10px" data-testid="action">
                        <chakra.summary cursor="pointer" fontWeight="600" fontSize="14px">
                            {`${i + 1}. ${summaryOf(action)}`}
                        </chakra.summary>
                        <chakra.div mt="10px"><Described action={action} formatCoin={formatCoin} nameOf={nameOf} signerOf={signerOf} daoOf={daoOf} /></chakra.div>
                    </chakra.details>
                ))}
            </Flex>
            {raw && raw.length > 0 && (
                <chakra.details borderWidth="1px" borderColor="app.border" borderRadius="12px" px="14px" py="10px" data-testid="raw-messages">
                    <chakra.summary cursor="pointer" fontWeight="600" fontSize="14px">Raw messages (JSON)</chakra.summary>
                    <chakra.pre m="0" mt="10px" p="10px" fontSize="12px" bg="hg.inset" borderRadius="8px" overflowX="auto" data-testid="raw-messages-json">{JSON.stringify(raw, null, 2)}</chakra.pre>
                </chakra.details>
            )}
        </Panel>
    );
};

const SUMMARY: Record<MsgAction['type'], string> = {
    send: 'Send funds',
    update_config: 'Change the voting rules',
    update_metadata: 'Change the name or description',
    update_members: 'Change the members',
    update_electorate: 'Change who votes',
    nominate_admin: 'Nominate an admin',
    withdraw_nomination: 'Withdraw the admin nomination',
    accept_admin: 'Accept the admin nomination',
    admin_execute: 'Run actions as a SubDAO',
    other: 'Other action',
};

const summaryOf = (action: MsgAction): string => (action.type === 'other' ? action.title : action.type === 'nominate_admin' && action.toVoters ? 'Hand the DAO to its voters' : SUMMARY[action.type]);
