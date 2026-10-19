"use client"

import React from 'react'
import { Box, HStack, Text } from '@chakra-ui/react'
import { LuInfo, LuTriangleAlert } from 'react-icons/lu'

interface NoteProps {
    /** Bold lead word(s), e.g. "Heads up:". */
    lead: string;
    children: React.ReactNode;
}

function Note({ lead, children, look, icon }: NoteProps & { look: 'warning' | 'tip'; icon: React.ReactNode }) {
    const warning = look === 'warning'
    return (
        <Box
            px="14px"
            py="12px"
            borderRadius="12px"
            bg={warning ? 'hg.warning/8' : 'hg.inset'}
            borderWidth="1px"
            borderColor={warning ? 'hg.warning/28' : 'hg.hairline'}
            data-testid={`note-${look}`}
        >
            <HStack align="start" gap="10px">
                <Box color={warning ? 'hg.warning' : 'hg.link'} mt="2px" flexShrink={0} aria-hidden>{icon}</Box>
                <Text fontSize="13px" lineHeight="1.5" color="fg">
                    <Text as="span" fontWeight="700">{lead}</Text>{' '}
                    <Text as="span">{children}</Text>
                </Text>
            </HStack>
        </Box>
    )
}

/** Amber note: what can go wrong or can't be undone. */
export function WarningNote(props: NoteProps) {
    return <Note {...props} look="warning" icon={<LuTriangleAlert size={16} />} />
}

/** Quiet note on the inset: a helpful hint. */
export function TipNote(props: NoteProps) {
    return <Note {...props} look="tip" icon={<LuInfo size={16} />} />
}
