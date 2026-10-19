'use client';

import {Box, Button} from '@chakra-ui/react';
import {LuWallet} from 'react-icons/lu';
import {hgVariant, Sidebar, WalletSidebarContent} from '@bze/bze-ui-kit';

/** Opens the wallet sidebar. `phoneLabel` replaces the label below `md`. */
export function ConnectWallet({phoneLabel = 'Connect Wallet'}: {phoneLabel?: string}) {
    return (
        <Sidebar
            ariaLabel="Connect Wallet"
            trigger={
                <Button variant={hgVariant('primary')} size={{base: 'lg', md: 'md'}} w="full">
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
