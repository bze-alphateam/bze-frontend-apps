'use client';

import {useCallback, useState} from 'react';
import {Flex} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {getChainName, PageContainer} from '@bze/bze-ui-kit';
import {liveDaoDeps} from '@/lib/dao-chain';
import type {DaoDeps} from '@/lib/dao-loader';
import {InnerHero} from '@/components/ui/layout-hero';
import {AllDaos} from './all-daos';
import {Explainer} from './explainer';
import {MyDaos} from './my-daos';
import {OpenProposals} from './open-proposals';
import {Unsupported} from './unsupported';

/** The home page: the explainer, the open proposals, the wallet's DAOs and every DAO. */
export const Home = ({deps = liveDaoDeps}: {deps?: DaoDeps}) => {
    const {address} = useChain(getChainName());
    const [unsupported, setUnsupported] = useState(false);
    const markUnsupported = useCallback(() => setUnsupported(true), []);

    return (
        <>
            <InnerHero title="DAOs" subtitle="Browse the DAOs on BeeZee, follow what is up for a vote and find the ones you belong to." />
            <PageContainer py={{base: '24px', md: '36px'}}>
                {unsupported ? (
                    <Unsupported />
                ) : (
                    <Flex direction="column" gap="36px">
                        <Explainer />
                        <OpenProposals deps={deps} />
                        {address && <MyDaos deps={deps} address={address} />}
                        <AllDaos deps={deps} onUnsupported={markUnsupported} />
                    </Flex>
                )}
            </PageContainer>
        </>
    );
};
