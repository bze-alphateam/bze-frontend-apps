'use client';

import {useState} from 'react';
import {Box, Button, Grid, HStack, Link, Stack, Text} from '@chakra-ui/react';
import {LuChevronDown, LuChevronUp, LuCoins, LuFileText, LuRefreshCw, LuSlidersHorizontal, LuCable, LuNewspaper, LuPuzzle} from 'react-icons/lu';
import {AppLink, getExplorerAccountURL, getExplorerProposalURL, truncateAddress, type GovProposal} from '@bze/bze-ui-kit';
import {describeProposal, humanise, type Action, type Entry} from '@/lib/governance/describe';
import {coinsText, isOpen, type DenomResolver} from '@/lib/governance/details';

// One box per proposal message, in plain words (the describers are BZE
// Scan's), plus the messages as JSON behind "Show technical details".

const LABELS: Record<Action['type'], string> = {
    upgrade: 'Software upgrade',
    cancel_upgrade: 'Cancel software upgrade',
    spend: 'Community pool spend',
    params: 'Parameter change',
    publisher: 'CoinTrunk publisher',
    domain: 'CoinTrunk domain',
    ibc_client: 'Cross-chain repair',
    text: 'Text proposal',
    other: 'Other',
};

const ICONS: Record<Action['type'], React.ComponentType<{size?: number}>> = {
    upgrade: LuRefreshCw,
    cancel_upgrade: LuRefreshCw,
    spend: LuCoins,
    params: LuSlidersHorizontal,
    publisher: LuNewspaper,
    domain: LuNewspaper,
    ibc_client: LuCable,
    text: LuFileText,
    other: LuPuzzle,
};

const Strong = ({children}: {children: React.ReactNode}) => <Text as="strong" color="fg">{children}</Text>;

const Mono = ({children}: {children: React.ReactNode}) => (
    <Text as="span" fontFamily="mono" color="fg" wordBreak="break-all">{children}</Text>
);

function Address({address}: {address: string}) {
    return (
        <Link href={getExplorerAccountURL(address)} target="_blank" rel="noopener noreferrer" fontFamily="mono" color="purple.fg" title={address}>
            {truncateAddress(address)}
        </Link>
    );
}

/** A raw value: a legacy param's JSON-encoded string decoded, text as is, anything else as JSON. */
function valueText(value: unknown): string {
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return typeof parsed === 'string' ? parsed : typeof parsed === 'object' && parsed !== null ? JSON.stringify(parsed) : String(parsed);
        } catch {
            return value;
        }
    }
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

function EntryTable({entries}: {entries: Entry[]}) {
    return (
        <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'minmax(0, 220px) minmax(0, 1fr)'}} columnGap="4" rowGap={{base: '0.5', md: '1.5'}} fontSize="sm">
            {entries.map((e) => (
                <Box key={e.key} display="contents">
                    <Text color="fg.muted" mt={{base: '1.5', md: '0'}}>{humanise(e.key)}</Text>
                    <Text fontFamily="mono" fontSize="xs" color="fg" wordBreak="break-all" alignSelf="center">{valueText(e.value)}</Text>
                </Box>
            ))}
        </Grid>
    );
}

function ActionText({action, proposal, resolve}: {action: Action; proposal: GovProposal; resolve?: DenomResolver}) {
    switch (action.type) {
        case 'upgrade':
            return (
                <>
                    <Text fontSize="sm" color="fg.muted">
                        {'Upgrades the BeeZee software to '}<Strong>{action.name}</Strong>
                        {action.height != null && <>{' at block '}<Strong>{action.height.toLocaleString('en-US')}</Strong></>}
                        {'. Validators switch to the new version at that block; your stake and balances stay as they are.'}
                    </Text>
                    {isOpen(proposal) && (
                        <Box fontSize="13px">
                            <AppLink app="explorer" href={getExplorerProposalURL(proposal.id)}>Upgrade countdown on Explorer</AppLink>
                        </Box>
                    )}
                </>
            );
        case 'cancel_upgrade':
            return <Text fontSize="sm" color="fg.muted">Cancels the software upgrade planned by an earlier proposal.</Text>;
        case 'spend':
            return (
                <Text fontSize="sm" color="fg.muted">
                    {'Sends '}<Strong>{coinsText(action.amount, resolve)}</Strong>{' from the community pool to '}
                    {action.recipient ? <Address address={action.recipient} /> : 'an unknown account'}
                    {'.'}
                </Text>
            );
        case 'params':
            return (
                <>
                    <Text fontSize="sm" color="fg.muted">
                        {`${action.whole ? 'Sets all' : 'Changes'} ${action.entries.length} ${action.module} ${action.entries.length === 1 ? 'parameter' : 'parameters'}${action.whole ? ', to these values:' : ':'}`}
                    </Text>
                    <EntryTable entries={action.entries} />
                </>
            );
        case 'publisher':
            return (
                <Text fontSize="sm" color="fg.muted">
                    {`${action.add ? 'Adds' : 'Removes'} `}<Strong>{action.name ?? 'a publisher'}</Strong>
                    {action.address && <>{' ('}<Address address={action.address} />{')'}</>}
                    {action.add ? ' as a CoinTrunk publisher.' : ' from the CoinTrunk publishers.'}
                </Text>
            );
        case 'domain':
            return (
                <Text fontSize="sm" color="fg.muted">
                    {`${action.add ? 'Adds' : 'Removes'} `}<Strong>{action.domain ?? 'a domain'}</Strong>
                    {action.add ? ' to the domains CoinTrunk articles can link to.' : ' from the domains CoinTrunk articles can link to.'}
                </Text>
            );
        case 'ibc_client':
            return (
                <Text fontSize="sm" color="fg.muted">
                    {'Repairs the connection to chain client '}<Mono>{action.subject ?? '?'}</Mono>
                    {action.substitute && <>{', taking over the state of client '}<Mono>{action.substitute}</Mono></>}
                    {'. Transfers over it work again once the proposal passes.'}
                </Text>
            );
        case 'text':
            return (
                <Text fontSize="sm" color="fg.muted">
                    Changes nothing on chain. A text proposal asks the community for a decision; its description says what.
                </Text>
            );
        case 'other':
            return action.entries.length > 0
                ? <EntryTable entries={action.entries} />
                : <Text fontSize="sm" color="fg.muted">No details.</Text>;
    }
}

function ActionBox({action, proposal, resolve}: {action: Action; proposal: GovProposal; resolve?: DenomResolver}) {
    const Icon = ICONS[action.type];
    return (
        <HStack
            align="flex-start"
            gap="3.5"
            bg="purple.500/5"
            borderWidth="1px"
            borderColor="purple.500/25"
            borderRadius="lg"
            px="4"
            py="3.5"
            data-testid="action"
            data-action={action.type}
        >
            <Box hideBelow="md" w="9" h="9" borderRadius="lg" bg="purple.subtle" color="purple.fg" display="flex" alignItems="center" justifyContent="center" flex="none">
                <Icon size={18} />
            </Box>
            <Stack gap="1" minW="0" flex="1">
                <Text fontSize="sm" fontWeight="bold">{action.type === 'other' ? action.title : LABELS[action.type]}</Text>
                <ActionText action={action} proposal={proposal} resolve={resolve} />
            </Stack>
        </HStack>
    );
}

export function WhatItDoes({proposal, resolve}: {proposal: GovProposal; resolve?: DenomResolver}) {
    const [showRaw, setShowRaw] = useState(false);
    const actions = describeProposal(proposal);
    const hasMessages = (proposal.messages ?? []).length > 0;

    return (
        <Stack as="section" aria-labelledby="what-h" bg="bg.panel" borderWidth="1px" borderRadius="lg" px={{base: '4', md: '6'}} py={{base: '4', md: '5'}} gap="3.5">
            <Text as="h2" id="what-h" fontSize="md" fontWeight="bold">What it does if it passes</Text>
            {actions.map((action, i) => <ActionBox key={i} action={action} proposal={proposal} resolve={resolve} />)}
            {hasMessages && (
                <>
                    <Button
                        variant="plain"
                        size="xs"
                        alignSelf="flex-start"
                        px="0"
                        color="fg.muted"
                        fontWeight="semibold"
                        aria-expanded={showRaw}
                        onClick={() => setShowRaw((v) => !v)}
                    >
                        {showRaw ? 'Hide technical details' : 'Show technical details'}
                        {showRaw ? <LuChevronUp /> : <LuChevronDown />}
                    </Button>
                    {showRaw && (
                        <Box as="pre" data-testid="raw-messages" m="0" px="4" py="3.5" borderRadius="lg" bg="bg.muted" fontFamily="mono" fontSize="xs" lineHeight="1.6" overflowX="auto" whiteSpace="pre">
                            {JSON.stringify(proposal.messages, null, 2)}
                        </Box>
                    )}
                </>
            )}
        </Stack>
    );
}
