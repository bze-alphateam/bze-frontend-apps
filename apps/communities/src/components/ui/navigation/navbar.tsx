'use client';

import NextLink from 'next/link'
import {AppHeader, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";

const navItems = [
    { label: 'Tokens', href: '/' },
]

export const TopNavBar = () => {
    const {currentPathName} = useNavigation()
    const walletLabel = useWalletButtonLabel()

    return (
        <AppHeader
            app="communities"
            appName="BeeZee Communities"
            linkAs={NextLink}
            items={navItems.map((item) => ({...item, active: currentPathName === item.href}))}
            walletLabel={walletLabel}
            walletContent={<WalletSidebarContent skipWalletModal />}
            settings={<SettingsToggle />}
        />
    )
}
