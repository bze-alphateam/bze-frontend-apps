'use client';

import NextLink from 'next/link'
import {AppHeader, AppHeaderNavItem, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";
import {PendingTx, usePendingTx} from "@/contexts/pending-tx";

const navItems = [
    { label: 'Create', href: '/' },
    { label: 'Manage', href: '/manage' },
]

// Every other page lights up the item it belongs to.
const navSubitems: { [key: string]: string } = {
    '/token/new': '/',
    '/market/new': '/',
    '/pool/new': '/',
    '/pool/add': '/',
    '/reward/new': '/',
    '/multisend': '/',
    '/reach': '/',
    '/playbooks': '/',
    '/raffle/new': '/',
    '/manage/token': '/manage',
    '/rewards': '/manage',
    '/denom-reward/schedule': '/manage',
    '/denom-reward/airdrop': '/manage',
    '/denom-reward/token': '/manage',
    '/official': '/manage',
}

/** The nav item a wizard page belongs to. */
const ownerOf = (href: string) => {
    const path = href.split('?')[0]
    return navItems.some(item => item.href === path) ? path : navSubitems[path]
}

/**
 * The nav items with the "in progress" badge on the item that owns each wizard whose
 * transaction is between broadcast and result; the item then leads back to that wizard.
 */
export function withPendingBadges(items: AppHeaderNavItem[], pending: readonly PendingTx[]): AppHeaderNavItem[] {
    return items.map((item) => {
        const mine = pending.filter(tx => tx.status === 'pending' && ownerOf(tx.href) === item.href)
        if (mine.length === 0) return item
        const count = mine.length
        return {
            ...item,
            href: mine[mine.length - 1].href,
            badge: {
                count,
                label: count === 1 ? '1 transaction in progress' : `${count} transactions in progress`,
                caption: 'in progress',
            },
        }
    })
}

export const TopNavBar = () => {
    const {currentPathName} = useNavigation()
    const walletLabel = useWalletButtonLabel()
    const {entries} = usePendingTx()

    return (
        <AppHeader
            app="factory"
            appName="BeeZee Factory"
            linkAs={NextLink}
            items={withPendingBadges(navItems.map((item) => ({
                ...item,
                active: currentPathName === item.href || item.href === navSubitems[currentPathName],
            })), entries)}
            walletLabel={walletLabel}
            walletContent={<WalletSidebarContent skipWalletModal />}
            settings={<SettingsToggle />}
        />
    )
}
