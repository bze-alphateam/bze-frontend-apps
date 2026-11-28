'use client';

import type {MouseEvent, ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoProposal} from '@bze/bze-ui-kit';
import {consoleRole} from '@/lib/admin/access';
import {DAO_FEATURES, type DaoFeatures} from '@/lib/dao-actions';
import {proposalCounter, type ProposalCounter} from '@/lib/dao-shell';
import {daoTabHref, type DaoTab} from '@/lib/dao-tabs';
import type {Part} from '@/lib/dao-view-loader';
import type {DaoExtras} from '@/hooks/useDaoExtras';
import {DaoHeader} from './header';

/** Whether the Admin console tab is shown: only to the DAO's admin and to the account nominated to take over. */
export const showsAdminTab = (dao: Pick<Dao, 'address' | 'admin' | 'pending_admin'>, wallet: string | null, features: Pick<DaoFeatures, 'adminConsole'> = DAO_FEATURES): boolean =>
    features.adminConsole && consoleRole(dao, wallet) !== 'none';

const plainClick = (e: MouseEvent<HTMLAnchorElement>) => e.button === 0 && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const CounterPill = ({counter}: {counter: ProposalCounter}) => (
    <chakra.span
        ml="8px"
        display="inline-flex"
        alignItems="baseline"
        px="8px"
        py="2px"
        borderRadius="999px"
        bg="color-mix(in srgb, var(--chakra-colors-hg-accent) 14%, transparent)"
        borderWidth="1px"
        borderColor="color-mix(in srgb, var(--chakra-colors-hg-accent) 40%, transparent)"
        fontSize="12px"
        fontWeight="700"
        lineHeight="1.4"
        fontVariantNumeric="tabular-nums"
        title={counter.title}
        data-testid="proposals-counter"
    >
        <chakra.span color="hg.link.hover">{String(counter.open)}</chakra.span>
        {counter.total !== null && <chakra.span color="hg.text.faint">{`/${counter.total}`}</chakra.span>}
    </chakra.span>
);

export interface DaoTabsProps {
    dao: Dao;
    active: DaoTab;
    wallet: string | null;
    counter: ProposalCounter | null;
}

/**
 * Overview · Proposals · History, plus the Admin console for its admin and nominee. Each tab is a real link
 * to its URL (`daoTabHref`); on the DAO page a plain click replaces the URL, so switching tabs adds no history
 * entry, while leaving the page (to or from the Admin console) pushes one.
 */
export const DaoTabs = ({dao, active, wallet, counter}: DaoTabsProps) => {
    const router = useRouter();
    const tabs: {tab: DaoTab; label: string; testId: string}[] = [
        {tab: 'overview', label: 'Overview', testId: 'dao-tab-overview'},
        {tab: 'proposals', label: 'Proposals', testId: 'dao-tab-proposals'},
        {tab: 'history', label: 'History', testId: 'dao-tab-history'},
    ];
    if (showsAdminTab(dao, wallet)) tabs.push({tab: 'admin', label: 'Admin console', testId: 'admin-console-link'});

    const go = (e: MouseEvent<HTMLAnchorElement>, tab: DaoTab) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        if (tab === active) return;
        const href = daoTabHref(dao.id, tab);
        if (active === 'admin' || tab === 'admin') router.push(href);
        else router.replace(href, {scroll: false});
    };

    return (
        // The hairline is an inset shadow and the active tab's bar sits inside the tab: nothing pokes out of the
        // scroll box, so overflow-y never turns into a scrollbar (overflow-x: auto alone makes it auto too).
        <chakra.nav
            aria-label="DAO sections"
            display="flex"
            gap="4px"
            overflowX="auto"
            overflowY="hidden"
            maxW="100%"
            boxShadow="inset 0 -1px 0 var(--chakra-colors-hg-divider)"
            css={{scrollbarWidth: 'none', '&::-webkit-scrollbar': {display: 'none'}}}
            data-testid="dao-tabs"
        >
            {tabs.map(({tab, label, testId}) => {
                const current = tab === active;
                return (
                    <chakra.a
                        key={tab}
                        href={daoTabHref(dao.id, tab)}
                        onClick={(e: MouseEvent<HTMLAnchorElement>) => go(e, tab)}
                        aria-current={current ? 'page' : undefined}
                        position="relative"
                        display="inline-flex"
                        alignItems="center"
                        flex="none"
                        whiteSpace="nowrap"
                        p="12px"
                        fontSize="15px"
                        fontWeight={current ? '600' : '500'}
                        color={current ? 'fg' : 'fg.muted'}
                        textDecoration="none"
                        _hover={{color: 'fg'}}
                        data-testid={testId}
                    >
                        {label}
                        {tab === 'proposals' && counter && <CounterPill counter={counter} />}
                        {current && <chakra.span aria-hidden position="absolute" left="12px" right="12px" bottom="0" h="2px" borderRadius="2px" bgImage="app" data-testid="dao-tab-bar" />}
                    </chakra.a>
                );
            })}
        </chakra.nav>
    );
};

export interface DaoShellProps {
    dao: Dao;
    /** The tab this page shows. */
    active: DaoTab;
    /** The connected wallet; null when none is. */
    wallet: string | null;
    /** What BZE Scan adds (`useDaoExtras`). */
    extras: DaoExtras;
    /** The chain's open proposals: the counter's fallback when Scan has no count. */
    openProposals: Part<DaoProposal[]>;
    children: ReactNode;
}

/** The frame of every DAO page (`/dao/<id>` and `/dao/<id>/admin`): the header, the tabs, then the tab's content. */
export const DaoShell = ({dao, active, wallet, extras, openProposals, children}: DaoShellProps) => (
    <Flex direction="column" gap="24px" minW="0" data-testid="dao-shell">
        <DaoHeader dao={dao} extras={extras} />
        <DaoTabs dao={dao} active={active} wallet={wallet} counter={proposalCounter(extras.data, openProposals)} />
        <Flex direction="column" gap="20px" minW="0" data-testid={`dao-tab-${active}-content`}>{children}</Flex>
    </Flex>
);
