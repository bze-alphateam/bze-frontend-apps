'use client';

import NextLink from 'next/link'
import {AppHeader, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";

// DAOs is the one item: creating a DAO happens in the Factory.
const navItems = [
    { label: 'DAOs', href: '/' },
]

// The DAOs item stays active on the pages below it (a DAO, a proposal).
const isItemActive = (href: string, pathname: string | null) => {
    if (!pathname) return false
    if (href === '/') return pathname === '/' || pathname.startsWith('/dao/') || pathname.startsWith('/proposal/')
    return pathname === href || pathname.startsWith(`${href}/`)
}

export const TopNavBar = () => {
    const {currentPathName} = useNavigation()
    const walletLabel = useWalletButtonLabel()

    return (
        <AppHeader
            app="dao"
            appName="BeeZee DAO"
            linkAs={NextLink}
            items={navItems.map((item) => ({...item, active: isItemActive(item.href, currentPathName)}))}
            walletLabel={walletLabel}
            walletContent={<WalletSidebarContent />}
            settings={<SettingsToggle />}
        />
    )
}
