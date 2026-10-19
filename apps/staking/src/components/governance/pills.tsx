'use client';

import {chakra} from '@chakra-ui/react';
import {StatusPill} from '@bze/bze-ui-kit';
import type {ReactNode} from 'react';
import type {StatusTone} from '@/lib/governance/proposal';

/** A pill in the app colour: "Voting". */
export const AppPill = ({children}: {children: ReactNode}) => (
    <chakra.span
        display="inline-flex"
        alignItems="center"
        fontSize="12px"
        fontWeight="600"
        px="9px"
        py="3px"
        borderRadius="hg.pill"
        whiteSpace="nowrap"
        color="hg.link"
        bg="app.subtle"
        borderWidth="1px"
        borderColor="app.border"
        data-testid="status-pill"
        data-tone="app"
    >
        {children}
    </chakra.span>
);

/** A proposal's status: Voting in the app colour, Passed green, Rejected and Failed red. */
export const ProposalStatusPill = ({tone, children}: {tone: StatusTone; children: ReactNode}) => (
    tone === 'app' ? <AppPill>{children}</AppPill> : <StatusPill tone={tone}>{children}</StatusPill>
);
