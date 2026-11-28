'use client';

import type {ReactNode} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {LuInfo} from 'react-icons/lu';

/**
 * The boards' neutral note (inset fill, hairline, an info icon in the muted colour): for facts that are not a
 * warning. Same shape as ui-kit's `Notice`, which only has the coloured tones.
 */
export const NeutralNote = ({title, children, aside, testId}: {title?: ReactNode; children?: ReactNode; aside?: ReactNode; testId?: string}) => (
    <Flex role="note" gap="12px" align="flex-start" px="14px" py="12px" borderRadius="12px" bg="hg.inset" borderWidth="1px" borderColor="hg.hairline" data-testid={testId}>
        <chakra.span flex="none" mt="2px" color="fg.muted" aria-hidden css={{'& svg': {width: '16px', height: '16px'}}}><LuInfo /></chakra.span>
        <Flex direction="column" gap="2px" fontSize="14px" lineHeight="1.5" color="hg.text.secondary" minW="0" flex="1">
            {title && <chakra.strong fontSize="14px" color="fg">{title}</chakra.strong>}
            {children && <span>{children}</span>}
        </Flex>
        {aside && <chakra.span ms="auto" flex="none">{aside}</chakra.span>}
    </Flex>
);
