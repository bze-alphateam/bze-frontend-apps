'use client';

import NextLink from 'next/link';
import {chakra, Flex} from '@chakra-ui/react';
import {FeaturedCard, getDaoParams} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {useDaoContext} from '@/hooks/useDaoContext';
import {formatCoin} from '@/lib/format';

/** What a DAO is on BeeZee, what creating one costs, and the way to Create. */
export const Explainer = () => {
    const {assetsMap} = useDaoContext();
    const params = useAsync('params', getDaoParams);
    const fee = params.data?.dao_creation_fee;
    const asset = fee ? assetsMap.get(fee.denom) : undefined;

    return (
        <FeaturedCard>
            <Flex direction="column" gap="10px" p="22px" data-testid="dao-explainer">
                <chakra.h2 m="0" fontSize="20px" fontWeight="700">What is a DAO on BeeZee?</chakra.h2>
                <chakra.p m="0" color="fg.muted" lineHeight="1.6" maxW="720px">
                    A DAO is an account with its own treasury that its members decide for. Members propose and vote on actions,
                    and a passed proposal runs on its own. A static-list DAO is decided by a fixed set of members; a stake DAO by
                    everyone who stakes in the reward programs it names.
                </chakra.p>
                <Flex gap="16px" align="center" wrap="wrap">
                    <chakra.span fontSize="14px" color="fg.muted" data-testid="dao-creation-fee">
                        {fee ? `Creating a DAO costs ${formatCoin(fee, asset ? {decimals: asset.decimals, ticker: asset.ticker} : undefined)}.` : 'Creating a DAO costs a one-time fee.'}
                    </chakra.span>
                    <chakra.a asChild color="hg.link" fontWeight="600" fontSize="14px">
                        <NextLink href="/create">Create a DAO</NextLink>
                    </chakra.a>
                </Flex>
            </Flex>
        </FeaturedCard>
    );
};
