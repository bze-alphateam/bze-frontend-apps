'use client';

import NextLink from 'next/link'
import {type ComponentProps, forwardRef} from 'react'
import {AppHeader, AppHeaderNavItem, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";
import {PendingTx, usePendingTx} from "@/contexts/pending-tx";

const navItems = [
    { label: 'Create', href: '/' },
    { label: 'Tokens', href: '/tokens' },
    { label: 'Rewards', href: '/rewards' },
]

// Every other page lights up the item it belongs to: wizards and Choose screens are Create, the
// token page and the registry guide are Tokens, every reward page is Rewards.
const navSubitems: { [key: string]: string } = {
    '/create/market': '/',
    '/create/rewards': '/',
    '/create/grow': '/',
    '/token/new': '/',
    '/market/new': '/',
    '/pool/new': '/',
    '/reward/new': '/',
    '/denom-reward/new': '/',
    '/airdrop': '/',
    '/raffle/new': '/',
    '/tokens/token': '/tokens',
    '/official': '/tokens',
    '/brand-kit': '/tokens',
    '/reward/extend': '/rewards',
    '/denom-reward/schedule': '/rewards',
}

/**
 * Nav links without prefetch. The Tokens and Rewards items point at pages that read their view from
 * the query; prefetching the bare path of the page being shown stopped its own `router.replace`
 * of the query (the /rewards filters) from landing (BFE-260 e2e).
 */
const NavLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(function NavLink(props, ref) {
    return <NextLink ref={ref} prefetch={false} {...props} />
})

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
            linkAs={NavLink}
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
