'use client';

import type {ReactNode} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {LuCode, LuCrown, LuNetwork, LuPencil, LuSlidersHorizontal, LuUndo2, LuUserCheck, LuUsers, LuVote, LuWallet} from 'react-icons/lu';
import type {DaoCoin} from '@bze/bze-ui-kit';
import {AddressLine} from '@/components/dao/page/panel';
import {PlainText} from '@/components/ui/plain-text';
import {shortAddress} from '@/lib/format';
import type {MsgAction} from '@/lib/proposal-describe';
import {Caption, Card} from './ui';

/** What is known of a DAO a message names by its number. */
export interface DaoRef {
    name?: string;
    address?: string;
}

interface Ctx {
    formatCoin: (coin: DaoCoin) => string;
    nameOf: (address: string) => string | undefined;
    daoOf: (daoId: string) => DaoRef | undefined;
    /** The DAO's members now, for "Members after"; null for a stake DAO or when unknown. */
    memberCount: number | null;
}

/** A DAO by name, else its account, else its number: a voter can always tell which one it is. */
const daoLabel = (daoId: string, {daoOf, nameOf}: Ctx): string => {
    const ref = daoOf(daoId);
    if (ref?.name) return ref.name;
    if (ref?.address) return nameOf(ref.address) ?? shortAddress(ref.address);
    return `DAO ${daoId}`;
};

const ICONS: Record<MsgAction['type'], ReactNode> = {
    send: <LuWallet size={18} />,
    update_config: <LuSlidersHorizontal size={18} />,
    update_metadata: <LuPencil size={18} />,
    update_members: <LuUsers size={18} />,
    update_electorate: <LuVote size={18} />,
    nominate_admin: <LuCrown size={18} />,
    withdraw_nomination: <LuUndo2 size={18} />,
    accept_admin: <LuUserCheck size={18} />,
    admin_execute: <LuNetwork size={18} />,
    other: <LuCode size={18} />,
};

/** The card's bold title, as the board words it. */
function titleOf(action: MsgAction, ctx: Ctx): string {
    switch (action.type) {
        case 'send':
            if (action.fromDao) return 'Pay from the treasury';
            return action.subDao ? `Pay from the treasury of ${daoLabel(action.subDao, ctx)}` : 'Send funds from another account';
        case 'update_config': return 'Change the voting rules';
        case 'update_metadata': return 'Rename the DAO or change its description';
        case 'update_members': return 'Change the members';
        case 'update_electorate': return 'Change who votes';
        case 'nominate_admin':
            return action.toVoters ? `Hand ${action.daoId ? daoLabel(action.daoId, ctx) : 'the DAO'} to its own voters` : `Nominate a new admin${action.daoId ? ` for ${daoLabel(action.daoId, ctx)}` : ''}`;
        case 'withdraw_nomination': return `Withdraw the pending admin nomination${action.daoId ? ` of ${daoLabel(action.daoId, ctx)}` : ''}`;
        case 'accept_admin': return `Accept the admin nomination${action.daoId ? ` of ${daoLabel(action.daoId, ctx)}` : ''}`;
        case 'admin_execute': return `Run ${action.actions.length === 1 ? 'an action' : `${action.actions.length} actions`} as the SubDAO ${daoLabel(action.daoId, ctx)}`;
        case 'other': return action.title;
    }
}

const Addresses = ({list, ctx}: {list: string[]; ctx: Ctx}) => (
    <Flex direction="column" gap="2px">{list.map((a) => <AddressLine key={a} address={a} name={ctx.nameOf(a)} />)}</Flex>
);

/** What the action does, under its title. */
function Body({action, ctx}: {action: MsgAction; ctx: Ctx}) {
    switch (action.type) {
        case 'send':
            return (
                <Flex as="span" direction="column" gap="2px">
                    <chakra.span display="inline-flex" alignItems="center" gap="6px" flexWrap="wrap">
                        <strong>{action.amount.map(ctx.formatCoin).join(', ') || 'nothing'}</strong>
                        <span>to</span>
                        <AddressLine address={action.to} name={ctx.nameOf(action.to)} />
                    </chakra.span>
                    {!action.fromDao && !action.subDao && action.from && <span>{"Paid from an account other than the DAO's own: the proposal cannot spend it."}</span>}
                </Flex>
            );
        case 'update_config':
            return (
                <Flex as="span" direction="column" gap="2px">
                    {action.unchanged && <span>It sets the same rules the DAO had when the proposal was submitted.</span>}
                    <chakra.ul m="0" ps="18px" display="flex" flexDirection="column" gap="2px">
                        {action.changes.map((c) => (
                            <chakra.li key={c.field} data-testid="config-change">
                                <chakra.span fontWeight="600" color="fg">{c.label}</chakra.span>
                                {c.before !== null ? `: ${c.before} → ` : ': '}
                                <span>{c.after}</span>
                            </chakra.li>
                        ))}
                    </chakra.ul>
                </Flex>
            );
        case 'update_metadata':
            return (
                <Flex direction="column" gap="2px">
                    <span>Name: <strong>{action.name}</strong></span>
                    {action.description && <PlainText text={action.description} color="hg.text.secondary" />}
                </Flex>
            );
        case 'update_members': {
            const after = ctx.memberCount === null ? null : ctx.memberCount + action.add.length - action.remove.length;
            return (
                <Flex as="span" direction="column" gap="4px">
                    {action.add.length > 0 && <><span>{`Add ${action.add.length === 1 ? 'this account' : `${action.add.length} accounts`}:`}</span><Addresses list={action.add} ctx={ctx} /></>}
                    {action.remove.length > 0 && <><span>{`Remove ${action.remove.length === 1 ? 'this account' : `${action.remove.length} accounts`}:`}</span><Addresses list={action.remove} ctx={ctx} /></>}
                    <span>
                        {after !== null && `Members after: ${after}. `}
                        {action.add.length > 0 && "They can vote on proposals submitted after the block they're added in."}
                    </span>
                </Flex>
            );
        }
        case 'update_electorate':
            return (
                <span>
                    {action.srIds.length === 0 && !action.drDenom
                        ? 'No sources: nobody would be able to vote.'
                        : [...action.srIds.map((id) => `Staking reward ${Number(id) || id}`), ...(action.drDenom ? [`Denom Reward of ${action.drDenom}`] : [])].join(', ')}
                </span>
            );
        case 'nominate_admin':
            return action.toVoters
                ? <span>The admin steps down and no outside account controls it.</span>
                : <Flex as="span" direction="column" gap="2px"><span>They have to accept before they become the admin.</span><AddressLine address={action.nominee} name={ctx.nameOf(action.nominee)} /></Flex>;
        case 'withdraw_nomination':
            return <span>The nominee can no longer accept.</span>;
        case 'accept_admin':
            return (
                <Flex as="span" direction="column" gap="2px">
                    <span>The nominee becomes its admin.</span>
                    {action.nominee && <AddressLine address={action.nominee} name={ctx.nameOf(action.nominee)} />}
                </Flex>
            );
        case 'admin_execute':
            return (
                <Flex direction="column" gap="10px" ps="12px" borderStartWidth="2px" borderColor="hg.lineStrong">
                    {action.actions.map((inner, i) => (
                        <Flex key={i} direction="column" gap="2px">
                            <chakra.strong color="fg">{titleOf(inner, ctx)}</chakra.strong>
                            <Body action={inner} ctx={ctx} />
                        </Flex>
                    ))}
                </Flex>
            );
        case 'other':
            return (
                <Flex direction="column" gap="6px" minW="0">
                    <chakra.code fontSize="12px" overflowWrap="anywhere">{action.typeUrl}</chakra.code>
                    <chakra.pre m="0" p="10px" fontSize="12px" fontFamily="mono" bg="hg.card" borderRadius="8px" overflowX="auto" data-testid="action-raw">{action.json}</chakra.pre>
                </Flex>
            );
    }
}

interface Props extends Ctx {
    actions: MsgAction[];
    /** The proposal's messages as the chain holds them, shown as one JSON list under the cards. */
    raw: readonly unknown[];
}

/** E2 "What it does if it passes": one numbered card per message, in order, then every message as raw JSON. */
export const WhatItDoes = ({actions, raw, ...ctx}: Props) => (
    <Card id="actions" title="What it does if it passes" aside={actions.length > 0 ? <Caption>Run as the DAO, in this order, in the settle transaction</Caption> : undefined} testId="actions-panel" gap="12px">
        {actions.length === 0 && <chakra.p m="0" fontSize="14px" color="hg.text.secondary" data-testid="text-only">{"This is a text-only proposal: it asks for no action. Passing it only records the DAO's decision."}</chakra.p>}
        {actions.map((action, i) => (
            <Flex key={i} gap="14px" p="16px" borderRadius="14px" bg="hg.inset" borderWidth="1px" borderColor="hg.accent/22" data-testid="action">
                <chakra.span fontSize="12px" fontWeight="700" color="hg.text.faint" w="14px" pt="10px" flex="none">{i + 1}</chakra.span>
                <chakra.span boxSize="36px" flex="none" borderRadius="10px" bgImage="app" color="white" display="inline-flex" alignItems="center" justifyContent="center" aria-hidden>
                    {ICONS[action.type]}
                </chakra.span>
                <Flex direction="column" gap="4px" fontSize="14px" lineHeight="1.55" minW="0" flex="1" color="hg.text.secondary">
                    <chakra.strong fontSize="15px" color="fg" data-testid="action-title">{titleOf(action, ctx)}</chakra.strong>
                    <Body action={action} ctx={ctx} />
                </Flex>
            </Flex>
        ))}
        {raw.length > 0 && (
            <details data-testid="raw-messages">
                <chakra.summary cursor="pointer" fontSize="13px" fontWeight="600" color="hg.link">Raw messages (JSON)</chakra.summary>
                <chakra.pre m="0" mt="10px" p="14px" borderRadius="12px" bg="hg.inset" fontFamily="mono" fontSize="12px" fontWeight="500" color="hg.text.secondary" whiteSpace="pre-wrap" overflowWrap="anywhere" data-testid="raw-messages-json">
                    {JSON.stringify(raw, null, 2)}
                </chakra.pre>
            </details>
        )}
    </Card>
);
