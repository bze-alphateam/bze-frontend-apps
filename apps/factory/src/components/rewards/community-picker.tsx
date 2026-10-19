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
        <VStack align="stretch" gap="12px">
            <Input
                aria-label="Search communities"
                placeholder="Search by ticker or name"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
            />
            <VStack role="radiogroup" aria-label="Communities" align="stretch" gap="8px" maxH="320px" overflowY="auto">
                {shown.length === 0 && (
                    <Text fontSize="14px" color="fg.muted">No token with stakers matches “{term.trim()}”.</Text>
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
                            px="14px"
                            py="12px"
                            borderRadius="hg.md"
                            borderWidth="1px"
                            borderColor={selected ? 'app.border' : 'hg.hairline'}
                            bg={selected ? 'app.subtle' : 'hg.inset'}
                            _hover={{ borderColor: 'app.border' }}
                            focusVisibleRing="outside"
                            cursor="pointer"
                            minW={0}
                        >
                            <HStack gap="12px" minW={0}>
                                <TokenLogo src={o.logo} symbol={o.ticker} size="8" circular={true} />
                                <VStack align="start" gap="0" flex="1" minW={0}>
                                    <HStack gap="8px" minW={0}>
                                        <Text fontWeight="600" truncate>{o.ticker}</Text>
                                        {o.isMine && <Badge size="sm" borderRadius="hg.pill" bg="app.subtle" color="hg.link" borderWidth="1px" borderColor="app.border">Yours</Badge>}
                                    </HStack>
                                    {o.name && <Text fontSize="12px" color="hg.text.faint" truncate maxW="full">{o.name}</Text>}
                                </VStack>
                                <Text fontSize="12px" color="hg.text.faint" textAlign="end" maxW="45%" truncate>
                                    {`${prettyAmount(o.stakedDisplay)} ${o.ticker} staked`}
                                </Text>
                                {selected && <Box color="hg.link" flexShrink={0}><LuCheck size={16} /></Box>}
                            </HStack>
                        </Box>
                    )
                })}
            </VStack>
        </VStack>
    )
}
