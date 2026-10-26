'use client';

import NextLink from 'next/link'
import {AppHeader, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";
import {isNavItemActive} from "@/lib/nav-active";

const navItems = [
    { label: 'Swap', href: '/' },
    { label: 'Exchange', href: '/exchange' },
    { label: 'Staking', href: '/staking' },
    { label: 'Pools', href: '/pools' },
    { label: 'Assets', href: '/assets' },
]

export const TopNavBar = () => {
    const {currentPathName} = useNavigation()
    const walletLabel = useWalletButtonLabel()

    return (
        <AppHeader
            app="dex"
            appName="BeeZee DEX"
            linkAs={NextLink}
            items={navItems.map((item) => ({
                ...item,
                active: isNavItemActive(item.href, currentPathName),
            }))}
            walletLabel={walletLabel}
            walletContent={<WalletSidebarContent />}
            settings={<SettingsToggle />}
        />
    )
}
