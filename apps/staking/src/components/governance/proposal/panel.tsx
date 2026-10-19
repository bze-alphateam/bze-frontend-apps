'use client';

import {chakra, Flex} from '@chakra-ui/react';
import {HgCard, type HgCardProps} from '@bze/bze-ui-kit';
import type {ReactNode} from 'react';

interface PanelProps extends Omit<HgCardProps, 'title'> {
    /** The heading's id, for the section's `aria-labelledby`. */
    headingId: string;
    title: ReactNode;
    /** Right of the title (the Live dot). */
    aside?: ReactNode;
}

/** A proposal page panel: the neutral card with a 17 px heading. */
export const Panel = ({headingId, title, aside, children, ...props}: PanelProps) => (
    <HgCard as="section" aria-labelledby={headingId} p={{base: '16px', md: '20px'}} display="flex" flexDirection="column" gap="14px" {...props}>
        <Flex justify="space-between" align="baseline" gap="8px">
            <chakra.h2 id={headingId} m="0" fontSize="17px" fontWeight="700">{title}</chakra.h2>
            {aside}
        </Flex>
        {children}
    </HgCard>
);
