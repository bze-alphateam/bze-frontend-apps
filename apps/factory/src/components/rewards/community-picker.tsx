"use client"

import React, { useMemo, useState } from 'react'
import { Badge, Box, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { LuCheck } from 'react-icons/lu'
import { TokenLogo, prettyAmount } from '@bze/bze-ui-kit'
import { CommunityOption, searchCommunities } from '@/lib/reach'

const LIMIT = 30

interface CommunityPickerProps {
    options: ReadonlyArray<CommunityOption>;
    value: string;
    onSelect: (denom: string) => void;
}

/** Pick the community to reach: the tokens with stakers, searchable, most staked first. */
export function CommunityPicker({ options, value, onSelect }: CommunityPickerProps) {
    const [term, setTerm] = useState('')
    const shown = useMemo(() => searchCommunities(options, term).slice(0, LIMIT), [options, term])

    return (
        <VStack align="stretch" gap={3}>
            <Input
                aria-label="Search communities"
                placeholder="Search by ticker or name"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
            />
            <VStack role="radiogroup" aria-label="Communities" align="stretch" gap={2} maxH="80" overflowY="auto">
                {shown.length === 0 && (
                    <Text fontSize="sm" color="fg.muted">No token with stakers matches “{term.trim()}”.</Text>
                )}
                {shown.map(o => {
                    const selected = o.denom === value
                    return (
                        <Box
                            key={o.denom}
                            as="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={o.ticker}
                            data-testid="community-option"
                            onClick={() => onSelect(o.denom)}
                            textAlign="start"
                            p={3}
                            borderRadius="lg"
                            borderWidth="1px"
                            borderColor={selected ? 'yellow.500' : 'border.muted'}
                            bg={selected ? 'yellow.500/10' : 'bg.panel'}
                            _hover={{ borderColor: 'yellow.500/60' }}
                            cursor="pointer"
                            minW={0}
                        >
                            <HStack gap={3} minW={0}>
                                <TokenLogo src={o.logo} symbol={o.ticker} size="8" circular={true} />
                                <VStack align="start" gap={0} flex="1" minW={0}>
                                    <HStack gap={2} minW={0}>
                                        <Text fontWeight="semibold" truncate>{o.ticker}</Text>
                                        {o.isMine && <Badge size="sm" colorPalette="yellow" variant="surface">Yours</Badge>}
                                    </HStack>
                                    {o.name && <Text fontSize="xs" color="fg.muted" truncate maxW="full">{o.name}</Text>}
                                </VStack>
                                <Text fontSize="xs" color="fg.muted" textAlign="end" maxW="45%" truncate>
                                    {`${prettyAmount(o.stakedDisplay)} ${o.ticker} staked`}
                                </Text>
                                {selected && <Box color="yellow.600" flexShrink={0}><LuCheck size={16} /></Box>}
                            </HStack>
                        </Box>
                    )
                })}
            </VStack>
        </VStack>
    )
}
