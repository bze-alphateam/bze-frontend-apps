'use client';

import NextLink from 'next/link'
import {AppHeader, type AppHeaderBadge, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";
import {useOpenProposalsSummary} from "@/hooks/useOpenProposalsSummary";
import {badgeCount, badgeLabel, GOVERNANCE_HREF} from "@/lib/governance/summary";

const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Governance', href: GOVERNANCE_HREF },
]

const navSubitems: { [key: string]: string } = {}

// An item is active on its own path and, except for the root, on every path below it
// (Governance stays active on /governance/<id>).
const isItemActive = (href: string, pathname: string | null) => {
    if (!pathname) return false
    if (pathname === href || href === navSubitems[pathname]) return true
    return href !== '/' && pathname.startsWith(`${href}/`)
}

// The open proposals that need the wallet's vote (all open ones without a wallet); nothing
// at 0 or while the summary is missing. In the phone menu a caption says what the number means.
const useGovernanceBadge = (): AppHeaderBadge | undefined => {
    const {summary} = useOpenProposalsSummary()
    const count = badgeCount(summary)
    if (!summary || count === 0) return undefined

    return {
        count,
        label: badgeLabel(summary, count),
        caption: summary.connected ? (count === 1 ? 'needs your vote' : 'need your vote') : 'open',
    }
}

export const TopNavBar = () => {
    const {currentPathName} = useNavigation()
    const walletLabel = useWalletButtonLabel()
    const governanceBadge = useGovernanceBadge()

    return (
        <AppHeader
            app="staking"
            appName="BeeZee Staking"
            linkAs={NextLink}
            items={navItems.map((item) => ({
                ...item,
                active: isItemActive(item.href, currentPathName),
                badge: item.href === GOVERNANCE_HREF ? governanceBadge : undefined,
            }))}
            walletLabel={walletLabel}
            walletContent={<WalletSidebarContent accentColor="purple" skipWalletModal />}
            settings={<SettingsToggle accentColor="purple" />}
        />
    )
}
