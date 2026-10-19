'use client';

import NextLink from 'next/link'
import {useState} from 'react';
import {AppHeader, SettingsToggle, WalletSidebarContent, useWalletButtonLabel} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";
import {SearchCoinModal} from '@/components/search-coin-modal';

const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Raffles', href: '/raffles' },
]

export const TopNavBar = () => {
    const {currentPathName} = useNavigation()
    const walletLabel = useWalletButtonLabel()
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)

    return (
        <>
            <AppHeader
                app="burner"
                appName="BeeZee Burner"
                linkAs={NextLink}
                items={[
                    ...navItems.map((item) => ({...item, active: currentPathName === item.href})),
                    { label: 'Search Coin', onClick: () => setIsSearchModalOpen(true) },
                ]}
                walletLabel={walletLabel}
                walletContent={<WalletSidebarContent accentColor="orange" />}
                settings={<SettingsToggle accentColor="orange" />}
            />

            <SearchCoinModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
            />
        </>
    )
}
