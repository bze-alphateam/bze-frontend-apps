'use client';

import {Box, Button} from '@chakra-ui/react';
import {LuWallet} from 'react-icons/lu';
import {Sidebar, WalletSidebarContent} from '@bze/bze-ui-kit';

/** Opens the wallet sidebar. `phoneLabel` replaces the label below `md`. */
export function ConnectWallet({phoneLabel = 'Connect Wallet'}: {phoneLabel?: string}) {
    return (
        <Sidebar
            ariaLabel="Connect Wallet"
            trigger={
                <Button colorPalette="purple" size={{base: 'lg', md: 'sm'}} w="full">
                    <LuWallet />
                    <Box as="span" hideBelow="md">Connect Wallet</Box>
                    <Box as="span" hideFrom="md">{phoneLabel}</Box>
                </Button>
            }
        >
            <WalletSidebarContent skipWalletModal />
        </Sidebar>
    );
}
