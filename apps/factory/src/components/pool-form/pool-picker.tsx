"use client"

import React, { useMemo, useState } from 'react'
import {
    Box,
    HStack,
    Input,
    Select,
    Text,
    VStack,
    createListCollection,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuChevronDown } from 'react-icons/lu'
import { Shimmer, TokenLogo, useAssets, useLiquidityPools } from '@bze/bze-ui-kit'
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
    /** Hide pools holding a governance-halted denom (the chain refuses new liquidity). Default false. */
    excludeHalted?: boolean;
}

function PairLogos({ option }: { option: PoolOption }) {
    return (
        <HStack gap="0">
            <TokenLogo
                src={option.baseAsset?.logo}
                symbol={option.baseAsset?.ticker ?? '?'}
                size="6"
                circular={true}
            />
            <Box ml="-6px">
                <TokenLogo
                    src={option.quoteAsset?.logo}
                    symbol={option.quoteAsset?.ticker ?? '?'}
                    size="6"
                    circular={true}
                />
            </Box>
        </HStack>
    )
}

export function PoolPicker({ value, onSelect, label, excludeHalted = false }: PoolPickerProps) {
    const { pools, isLoading } = useLiquidityPools()
    const { getAsset } = useAssets()

    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)

    const options = useMemo((): PoolOption[] => {
        return pools.flatMap(pool => {
            const baseAsset = getAsset(pool.base)
            const quoteAsset = getAsset(pool.quote)
            if (excludeHalted && (baseAsset?.halted || quoteAsset?.halted)) return []
            return [{
                pool,
                baseAsset,
                quoteAsset,
                pairLabel: `${baseAsset?.ticker ?? pool.base}/${quoteAsset?.ticker ?? pool.quote}`,
                // The chain stores the fee as a decimal (e.g. "0.002" = 0.2%).
                feeLabel: `${new BigNumber(pool.fee).multipliedBy(100).toString()}% swap fee`,
            }]
        })
    }, [pools, getAsset, excludeHalted])

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
            <VStack align="stretch" gap="8px" w="full" aria-busy="true">
                <Shimmer h="13px" w="96px" />
                <Shimmer h="62px" borderRadius="14px" />
            </VStack>
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
                <Box
                    as="button"
                    textAlign="start"
                    w="full"
                    px="14px"
                    py="12px"
                    borderRadius="14px"
                    bg="hg.inset"
                    borderWidth="1px"
                    borderColor="hg.hairline"
                    cursor="pointer"
                    transition="border-color 0.15s"
                    _hover={{ borderColor: 'app.border' }}
                    _expanded={{ borderColor: 'app.focusRing', boxShadow: '0 0 0 3px {colors.app.subtle}' }}
                    focusVisibleRing="outside"
                >
                    <HStack justify="space-between" w="full" gap="12px">
                        <VStack align="start" gap="4px" minW={0}>
                            <Text fontSize="12px" color="hg.text.faint">
                                {label}
                            </Text>
                            {selectedOption ? (
                                <HStack gap="10px" minW={0}>
                                    <PairLogos option={selectedOption} />
                                    <Text fontWeight="700" fontSize="16px">
                                        {selectedOption.pairLabel}
                                    </Text>
                                    <Text fontSize="12px" color="hg.text.faint">
                                        {selectedOption.feeLabel}
                                    </Text>
                                </HStack>
                            ) : (
                                <Text fontSize="16px" color="hg.text.faint">
                                    Select pool
                                </Text>
                            )}
                        </VStack>
                        <Box color="hg.text.faint" flexShrink={0}><LuChevronDown size={16} /></Box>
                    </HStack>
                </Box>
            </Select.Trigger>
            <Select.Positioner>
                <Select.Content
                    maxH="400px"
                    overflowY="auto"
                    bg="hg.card"
                    borderWidth="1px"
                    borderColor="hg.hairline"
                    borderRadius="14px"
                    boxShadow="hg.popover"
                >
                    <Box p="3" borderBottomWidth="1px" borderColor="hg.divider">
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
                                    borderRadius="10px"
                                    _hover={{ bg: 'hg.hoverFill' }}
                                    _highlighted={{ bg: 'app.subtle' }}
                                >
                                    <Select.ItemText>
                                        <HStack gap="3" py="2">
                                            <PairLogos option={option} />
                                            <VStack align="start" gap="0" flex="1">
                                                <Text fontWeight="600" fontSize="15px">
                                                    {option.pairLabel}
                                                </Text>
                                                <Text fontSize="12px" color="hg.text.faint">
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
                                <Text fontSize="14px" color="hg.text.muted">
                                    No pools found
                                </Text>
                            </Box>
                        )}
                    </Box>
                    {!searchTerm && options.length > UNFILTERED_LIMIT && (
                        <Box p="2" borderTopWidth="1px" borderColor="hg.divider" textAlign="center">
                            <Text fontSize="12px" color="hg.text.faint">
                                Showing first {UNFILTERED_LIMIT} pools. Search to find more.
                            </Text>
                        </Box>
                    )}
                </Select.Content>
            </Select.Positioner>
        </Select.Root>
    )
}
