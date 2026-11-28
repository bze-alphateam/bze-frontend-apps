'use client';

import {chakra, Flex} from '@chakra-ui/react';
import {sizeLine} from '@/lib/propose/composer-text';

/**
 * The size bar (boards F1 and B1): the packed messages against the DAO's byte limit and, given the counts,
 * the actions against the most a proposal may run: "3,620 of 20,000 bytes · 2 of 16 actions".
 */
export const SizeMeter = ({size, max, count, maxActions}: {size: number; max: number; count?: number; maxActions?: number}) => {
    const counted = count !== undefined && maxActions !== undefined;
    const line = sizeLine(size, max, count ?? 0, maxActions ?? 1);
    const text = counted || line.over ? line.text : `${size.toLocaleString('en-US')} of ${max.toLocaleString('en-US')} bytes`;
    return (
        <Flex direction="column" gap="6px" minW="0" data-testid="size-meter" data-over={line.over ? '' : undefined}>
            <chakra.div h="8px" borderRadius="999px" bg="hg.inset" overflow="hidden" role="meter" aria-label="Size of the actions" aria-valuemin={0} aria-valuemax={max} aria-valuenow={size}>
                <chakra.span display="block" h="100%" w={`${line.over ? 100 : line.percent}%`} bgImage="app" />
            </chakra.div>
            <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="size-text">
                {text}
            </chakra.span>
        </Flex>
    );
};
