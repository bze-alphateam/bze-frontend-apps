'use client';

import NextLink from 'next/link'
import {AppHeader, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";

const navItems = [
    { label: 'Swap', href: '/' },
    { label: 'Exchange', href: '/exchange' },
    { label: 'Staking', href: '/staking' },
    { label: 'Pools', href: '/pools' },
    { label: 'Assets', href: '/assets' },
]

const navSubitems: { [key: string]: string } = {
    "/exchange/market": "/exchange",
    "/pools/details": "/pools",
}

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
                active: currentPathName === item.href || item.href === navSubitems[currentPathName],
            }))}
            walletLabel={walletLabel}
            walletContent={<WalletSidebarContent />}
            settings={<SettingsToggle />}
        />
    )
}
