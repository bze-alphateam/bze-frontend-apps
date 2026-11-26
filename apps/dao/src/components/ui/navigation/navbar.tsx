'use client';

import NextLink from 'next/link'
import {AppHeader, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";

const navItems = [
    { label: 'DAOs', href: '/' },
    { label: 'Create', href: '/create' },
]

// The DAOs item stays active on the pages below it (a DAO, a proposal); every other item on its own path.
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
