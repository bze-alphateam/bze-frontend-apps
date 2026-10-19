'use client';

import NextLink from 'next/link'
import {AppHeader, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";

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

export const TopNavBar = () => {
    const {currentPathName} = useNavigation()
    const walletLabel = useWalletButtonLabel()

    return (
        <AppHeader
            app="factory"
            appName="BeeZee Factory"
            linkAs={NextLink}
            items={navItems.map((item) => ({
                ...item,
                active: currentPathName === item.href || item.href === navSubitems[currentPathName],
            }))}
            walletLabel={walletLabel}
            walletContent={<WalletSidebarContent accentColor="yellow" skipWalletModal />}
            settings={<SettingsToggle accentColor="yellow" />}
        />
    )
}
