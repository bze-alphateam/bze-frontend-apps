"use client"

import NextLink from 'next/link'
import { Box, HStack, IconButton, Link, Text } from '@chakra-ui/react'
import { LuHistory, LuX } from 'react-icons/lu'
import type { WizardHint } from '@/lib/last-wizard'

/**
 * One slim line above the home's hero pointing back to the last wizard with progress. It sits
 * on top of the page and leaves every other section as it is.
 */
export function ContinueHint({ hint, onDismiss }: { hint: WizardHint; onDismiss: () => void }) {
    return (
        <HStack
            as="aside"
            aria-label="Continue where you left off"
            data-testid="continue-hint"
            alignSelf="center"
            maxW="full"
            gap="8px"
            pl="14px"
            pr="6px"
            py="4px"
            borderRadius="hg.pill"
            borderWidth="1px"
            borderColor="hg.hairline"
            bg="hg.inset"
            fontSize="14px"
        >
            <Box as="span" aria-hidden flex="none" color="hg.link"><LuHistory size={14} /></Box>
            <Text minW={0} truncate color="fg.muted">
                <Link asChild color="hg.link" fontWeight="600" _hover={{ color: 'hg.link.hover' }}>
                    <NextLink href={hint.href}>{hint.label}</NextLink>
                </Link>
                {` — step ${hint.step} of ${hint.total}`}
            </Text>
            <IconButton aria-label="Dismiss" size="2xs" variant="ghost" color="fg.muted" borderRadius="hg.pill" onClick={onDismiss}>
                <LuX />
            </IconButton>
        </HStack>
    )
}
