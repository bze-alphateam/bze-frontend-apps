'use client';

import {Flex, Grid} from '@chakra-ui/react';
import {HgCard, Shimmer} from '@bze/bze-ui-kit';
import {cardsGrid, SectionHeader} from '@/components/ui/staking/parts';

const ShimmerDisc = () => <Shimmer boxSize="36px" borderRadius="full" flex="none" />;
const ShimmerBar = ({w, h, radius}: {w: string; h: string; radius?: string}) => (
    <Shimmer w={w} h={h} borderRadius={radius} flex="none" />
);

/** The validator cards while the staking data loads: the section title at once, shimmer cards below. */
export function ValidatorsLoading() {
    return (
        <Flex as="section" direction="column" gap="16px" data-testid="validators-loading">
            <SectionHeader title="All Validators" />
            <Grid {...cardsGrid} aria-hidden>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <HgCard key={i} px="20px" py="18px" display="flex" flexDirection="column" gap="14px" data-testid="validator-card-loading">
                        <Flex align="center" justify="space-between" gap="10px">
                            <Flex align="center" gap="12px" flex="1">
                                <ShimmerDisc />
                                <Flex direction="column" gap="6px" flex="1">
                                    <ShimmerBar w="25%" h="10px" />
                                    <ShimmerBar w="60%" h="12px" />
                                </Flex>
                            </Flex>
                            <ShimmerBar w="72px" h="36px" radius="10px" />
                        </Flex>
                        <ShimmerBar w="100%" h="10px" />
                        <ShimmerBar w="70%" h="10px" />
                    </HgCard>
                ))}
            </Grid>
        </Flex>
    );
}
