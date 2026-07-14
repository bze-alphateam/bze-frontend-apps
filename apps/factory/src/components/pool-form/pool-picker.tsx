"use client"

import React, { useMemo, useState } from 'react'
import {
    Box,
    Card,
    HStack,
    Input,
    Select,
    Skeleton,
    Text,
    VStack,
    createListCollection,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuChevronDown } from 'react-icons/lu'
import { TokenLogo, useAssets, useLiquidityPools } from '@bze/bze-ui-kit'
import type { Asset } from '@bze/bze-ui-kit'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'

const UNFILTERED_LIMIT = 10
const SEARCH_LIMIT = 20

interface PoolOption {
    pool: LiquidityPoolSDKType;
    baseAsset?: Asset;
    quoteAsset?: Asset;
    pairLabel: string;
    feeLabel: string;
}

interface PoolPickerProps {
    /** Selected pool id (controlled). Pass a query-param id to preselect. */
    value?: string;
    onSelect: (pool: LiquidityPoolSDKType) => void;
    /** Shown above the current selection, e.g. "Pool". */
    label: string;
}

function PairLogos({ option }: { option: PoolOption }) {
    return (
        <HStack gap={0}>
            <TokenLogo
                src={option.baseAsset?.logo}
                symbol={option.baseAsset?.ticker ?? '?'}
                size="8"
                circular={true}
            />
            <Box ml="-3">
                <TokenLogo
                    src={option.quoteAsset?.logo}
                    symbol={option.quoteAsset?.ticker ?? '?'}
                    size="8"
                    circular={true}
                />
            </Box>
        </HStack>
    )
}

export function PoolPicker({ value, onSelect, label }: PoolPickerProps) {
    const { pools, isLoading } = useLiquidityPools()
    const { getAsset } = useAssets()

    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)

    const options = useMemo((): PoolOption[] => {
        return pools.map(pool => {
            const baseAsset = getAsset(pool.base)
            const quoteAsset = getAsset(pool.quote)
            return {
                pool,
                baseAsset,
                quoteAsset,
                pairLabel: `${baseAsset?.ticker ?? pool.base}/${quoteAsset?.ticker ?? pool.quote}`,
                // The chain stores the fee as a decimal (e.g. "0.002" = 0.2%).
                feeLabel: `${new BigNumber(pool.fee).multipliedBy(100).toString()}% swap fee`,
            }
        })
    }, [pools, getAsset])

    const filteredOptions = useMemo(() => {
        if (!searchTerm) {
            return options.slice(0, UNFILTERED_LIMIT)
        }
        const term = searchTerm.toLowerCase()
        return options
            .filter(o =>
                o.pairLabel.toLowerCase().includes(term) ||
                o.pool.base.toLowerCase().includes(term) ||
                o.pool.quote.toLowerCase().includes(term) ||
                o.pool.id.toLowerCase().includes(term)
            )
            .slice(0, SEARCH_LIMIT)
    }, [searchTerm, options])

    const collection = useMemo(() => {
        return createListCollection({
            items: filteredOptions.map(o => ({ label: o.pairLabel, value: o.pool.id })),
        })
    }, [filteredOptions])

    const selectedOption = useMemo(
        () => (value ? options.find(o => o.pool.id === value) : undefined),
        [value, options]
    )

    if (isLoading) {
        return (
            <Card.Root variant="outline" p="4">
                <VStack align="start" gap="3" w="full">
                    <Skeleton height="4" width="24" />
                    <Skeleton height="8" width="full" />
                </VStack>
            </Card.Root>
        )
    }

    return (
        <Select.Root
            collection={collection}
            value={selectedOption ? [selectedOption.pool.id] : []}
            open={isOpen}
            onOpenChange={(details) => {
                setIsOpen(details.open)
                if (!details.open) {
                    setSearchTerm('')
                }
            }}
            onValueChange={(details) => {
                const picked = options.find(o => o.pool.id === details.value[0])
                if (picked) {
                    onSelect(picked.pool)
                    setIsOpen(false)
                    setSearchTerm('')
                }
            }}
        >
            <Select.Trigger asChild>
                <Card.Root
                    variant="outline"
                    p="4"
                    cursor="pointer"
                    bgGradient="to-br"
                    gradientFrom="yellow.500/8"
                    gradientTo="yellow.600/8"
                    borderColor="yellow.500/20"
                    _hover={{
                        gradientFrom: "yellow.500/12",
                        gradientTo: "yellow.600/12",
                        borderColor: "yellow.500/30",
                    }}
                    transition="all 0.2s"
                >
                    <VStack align="start" gap="3" w="full">
                        <Text fontSize="sm" color="fg.muted">
                            {label}
                        </Text>
                        <HStack justify="space-between" w="full">
                            {selectedOption ? (
                                <HStack gap="3">
                                    <PairLogos option={selectedOption} />
                                    <VStack align="start" gap="1">
                                        <Text fontWeight="bold" fontSize="lg">
                                            {selectedOption.pairLabel}
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted">
                                            {selectedOption.feeLabel}
                                        </Text>
                                    </VStack>
                                </HStack>
                            ) : (
                                <Text fontSize="lg" color="fg.muted">
                                    Select pool
                                </Text>
                            )}
                            <LuChevronDown />
                        </HStack>
                    </VStack>
                </Card.Root>
            </Select.Trigger>
            <Select.Positioner>
                <Select.Content maxH="400px" overflowY="auto" background="bg.muted">
                    <Box p="3" borderBottomWidth="1px">
                        <Input
                            placeholder="Search by pair or denom..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            size="sm"
                            autoFocus
                        />
                    </Box>
                    <Box maxH="300px" overflowY="auto">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <Select.Item
                                    key={option.pool.id}
                                    item={option.pool.id}
                                    cursor="pointer"
                                    _hover={{ bg: "bg.panel" }}
                                >
                                    <Select.ItemText>
                                        <HStack gap="3" py="2">
                                            <PairLogos option={option} />
                                            <VStack align="start" gap="0" flex="1">
                                                <Text fontWeight="medium" fontSize="md">
                                                    {option.pairLabel}
                                                </Text>
                                                <Text fontSize="sm" color="fg.muted">
                                                    {option.feeLabel}
                                                </Text>
                                            </VStack>
                                        </HStack>
                                    </Select.ItemText>
                                    <Select.ItemIndicator />
                                </Select.Item>
                            ))
                        ) : (
                            <Box p="4" textAlign="center">
                                <Text fontSize="sm" color="fg.muted">
                                    No pools found
                                </Text>
                            </Box>
                        )}
                    </Box>
                    {!searchTerm && options.length > UNFILTERED_LIMIT && (
                        <Box p="2" borderTopWidth="1px" textAlign="center">
                            <Text fontSize="xs" color="fg.muted">
                                Showing first {UNFILTERED_LIMIT} pools. Search to find more.
                            </Text>
                        </Box>
                    )}
                </Select.Content>
            </Select.Positioner>
        </Select.Root>
    )
}
