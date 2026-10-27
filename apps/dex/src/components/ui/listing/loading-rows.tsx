'use client'

import {Flex} from "@chakra-ui/react";
import {Shimmer} from "@bze/bze-ui-kit";

/** Skeleton rows a pair listing (markets, pools) shows until its first data arrives. */
export const LoadingRows = () => (
    <Flex direction="column" px="22px" py="12px" aria-busy="true" data-testid="list-loading">
        {[140, 110, 125].map((w, i) => (
            <Flex key={i} justify="space-between" align="center" py="10px" borderTopWidth={i > 0 ? '1px' : 0} borderColor="hg.divider">
                <Flex gap="12px" align="center">
                    <Shimmer w="52px" h="32px" borderRadius="full"/>
                    <Shimmer w={`${w}px`} h="12px"/>
                </Flex>
                <Shimmer w="90px" h="36px" borderRadius="10px"/>
            </Flex>
        ))}
    </Flex>
)
