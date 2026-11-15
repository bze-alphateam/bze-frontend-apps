'use client';

import {useMemo} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {getWalletChainsNames, HgCard, PageContainer} from '@bze/bze-ui-kit';
import {WithdrawAddressPanel} from '@/components/atomone-withdraw/withdraw-address-panel';
import {ATOMONE_CHAIN_NAME} from '@/lib/atomone-withdraw';

/**
 * Unlisted helper: set the AtomOne staking-rewards withdraw address
 * (MsgSetWithdrawAddress) from a browser wallet, for users without the CLI.
 */
export default function AtomOneWithdrawAddressPage() {
    // The wallet provider only knows AtomOne when it's a registered chain (mainnet builds).
    const isAvailable = useMemo(() => getWalletChainsNames().some(c => c.chainName === ATOMONE_CHAIN_NAME), []);

    return (
        <PageContainer as="main" pt={{base: '24px', md: '32px'}} pb={{base: '48px', md: '64px'}}>
            <Flex direction="column" gap="16px" maxW="640px" mx="auto">
                <chakra.h1 fontSize="24px" fontWeight="700">AtomOne rewards withdraw address</chakra.h1>
                <chakra.p color="fg.muted" fontSize="14px">
                    Choose the address your AtomOne staking rewards are paid to. The transaction is signed on the AtomOne chain (atomone-1) with your wallet and its fee is paid in PHOTON.
                </chakra.p>
                {isAvailable ? (
                    <WithdrawAddressPanel />
                ) : (
                    <HgCard p="18px"><chakra.span>AtomOne is not available on this network.</chakra.span></HgCard>
                )}
            </Flex>
        </PageContainer>
    );
}
