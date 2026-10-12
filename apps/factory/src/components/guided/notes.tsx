"use client"

import React from 'react'
import { Box, HStack, Text } from '@chakra-ui/react'
import { LuInfo, LuTriangleAlert } from 'react-icons/lu'

interface NoteProps {
    /** Bold lead word(s), e.g. "Heads up:". */
    lead: string;
    children: React.ReactNode;
}

function Note({ lead, children, palette, icon }: NoteProps & { palette: 'red' | 'blue'; icon: React.ReactNode }) {
    return (
        <Box
            p={3}
            borderRadius="lg"
            bg={`${palette}.500/10`}
            borderWidth="1px"
            borderColor={`${palette}.500/25`}
        >
            <HStack align="start" gap={2.5}>
                <Box color={`${palette}.500`} mt={0.5} flexShrink={0}>{icon}</Box>
                <Text fontSize="sm">
                    <Text as="span" fontWeight="semibold">{lead}</Text>{' '}
                    <Text as="span" color="fg.muted">{children}</Text>
                </Text>
            </HStack>
        </Box>
    )
}

/** Red-tinted note: what can go wrong or can't be undone. */
export function WarningNote(props: NoteProps) {
    return <Note {...props} palette="red" icon={<LuTriangleAlert size={16} />} />
}

/** Blue-tinted note: a helpful hint. */
export function TipNote(props: NoteProps) {
    return <Note {...props} palette="blue" icon={<LuInfo size={16} />} />
}
