"use client"

import React, { useMemo, useState } from 'react'
import {
    Badge,
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
import { LuChevronDown } from 'react-icons/lu'
import {
    Asset,
    ASSET_TYPE_FACTORY,
    ASSET_TYPE_IBC,
    ASSET_TYPE_LP,
    TokenLogo,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    useBalances,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'

const TYPE_BADGE_PALETTE: Record<string, string> = {
    [ASSET_TYPE_FACTORY]: 'green',
    [ASSET_TYPE_IBC]: 'purple',
    [ASSET_TYPE_LP]: 'teal',
}

const UNFILTERED_LIMIT = 10
const SEARCH_LIMIT = 20

interface AssetPickerProps {
    /** Selected denom (controlled). Pass a query-param denom to preselect. */
    value?: string;
    onSelect: (asset: Asset) => void;
    /** Shown above the current selection, e.g. "Base asset" / "Token to stake". */
    label: string;
    /** Include LP denoms (e.g. staking denom in reward forms). Default false. */
    includeLP?: boolean;
    /** Denoms to hide, e.g. the already-picked other side of a pair. */
    excludeDenoms?: string[];
    /** Show the connected user's own factory denoms first. Default true. */
    ownFirst?: boolean;
}

export function AssetPicker({
    value,
    onSelect,
    label,
    includeLP = false,
    excludeDenoms,
    ownFirst = true,
}: AssetPickerProps) {
    const { assets, assetsLpExcluded, isLoading } = useAssets()
    const { getBalanceByDenom } = useBalances()
    const { address } = useChain(getChainName())

    const [searchTerm, setSearchTerm] = useState('')
    const [isOpen, setIsOpen] = useState(false)

    // Factory denoms embed their creator: factory/{creator}/{subdenom}.
    const isOwn = useMemo(() => {
        const prefix = address ? `factory/${address}/` : undefined
        return (asset: Asset) => Boolean(prefix && asset.denom.startsWith(prefix))
    }, [address])

    const selectableAssets = useMemo(() => {
        const source = includeLP ? assets : assetsLpExcluded
        const excluded = new Set(excludeDenoms ?? [])
        const filtered = (source ?? []).filter(a => a.supply > BigInt(0) && !excluded.has(a.denom))

        // Stable ordering: user's own factory denoms first, then verified assets.
        const rank = (a: Asset) => (ownFirst && isOwn(a) ? 0 : a.verified ? 1 : 2)
        return filtered
            .map((asset, index) => ({ asset, index }))
            .sort((a, b) => rank(a.asset) - rank(b.asset) || a.index - b.index)
            .map(({ asset }) => asset)
    }, [assets, assetsLpExcluded, includeLP, excludeDenoms, ownFirst, isOwn])

    const filteredAssets = useMemo(() => {
        if (!searchTerm) {
            return selectableAssets.slice(0, UNFILTERED_LIMIT)
        }
        const term = searchTerm.toLowerCase()
        return selectableAssets
            .filter(a =>
                a.ticker.toLowerCase().includes(term) ||
                a.name.toLowerCase().includes(term) ||
                a.denom.toLowerCase().includes(term)
            )
            .slice(0, SEARCH_LIMIT)
    }, [searchTerm, selectableAssets])

    const collection = useMemo(() => {
        return createListCollection({
            items: filteredAssets.map(a => ({ label: a.ticker, value: a.denom })),
        })
    }, [filteredAssets])

    const selectedAsset = useMemo(
        () => (value ? selectableAssets.find(a => a.denom === value) : undefined),
        [value, selectableAssets]
    )

    const balanceLine = (asset: Asset) => {
        const balance = getBalanceByDenom(asset.denom)
        return `Balance: ${prettyAmount(uAmountToBigNumberAmount(balance.amount, asset.decimals))}`
    }

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
            value={selectedAsset ? [selectedAsset.denom] : []}
            open={isOpen}
            onOpenChange={(details) => {
                setIsOpen(details.open)
                if (!details.open) {
                    setSearchTerm('')
                }
            }}
            onValueChange={(details) => {
                const picked = selectableAssets.find(a => a.denom === details.value[0])
                if (picked) {
                    onSelect(picked)
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
                            {selectedAsset ? (
                                <HStack gap="3">
                                    <TokenLogo
                                        src={selectedAsset.logo}
                                        symbol={selectedAsset.ticker}
                                        size="8"
                                        circular={true}
                                    />
                                    <VStack align="start" gap="1">
                                        <HStack gap="2">
                                            <Text fontWeight="bold" fontSize="lg">
                                                {selectedAsset.ticker}
                                            </Text>
                                            <Text fontSize="md" color="fg.muted">
                                                {selectedAsset.name}
                                            </Text>
                                            <Badge
                                                colorPalette={TYPE_BADGE_PALETTE[selectedAsset.type] ?? 'gray'}
                                                size="sm"
                                                variant="surface"
                                            >
                                                {selectedAsset.type}
                                            </Badge>
                                        </HStack>
                                        <Text fontSize="sm" color="fg.muted">
                                            {balanceLine(selectedAsset)}
                                        </Text>
                                    </VStack>
                                </HStack>
                            ) : (
                                <Text fontSize="lg" color="fg.muted">
                                    Select asset
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
                            placeholder="Search by name or ticker..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            size="sm"
                            autoFocus
                        />
                    </Box>
                    <Box maxH="300px" overflowY="auto">
                        {filteredAssets.length > 0 ? (
                            filteredAssets.map((assetOption) => (
                                <Select.Item
                                    key={assetOption.denom}
                                    item={assetOption.denom}
                                    cursor="pointer"
                                    _hover={{ bg: "bg.panel" }}
                                >
                                    <Select.ItemText>
                                        <HStack gap="3" py="2">
                                            <TokenLogo
                                                src={assetOption.logo}
                                                symbol={assetOption.ticker}
                                                size="8"
                                                circular={true}
                                            />
                                            <VStack align="start" gap="0" flex="1">
                                                <HStack gap={2} w="full">
                                                    <Text fontWeight="medium" fontSize="md">
                                                        {assetOption.ticker}
                                                    </Text>
                                                    <Text fontSize="sm" color="fg.muted">
                                                        {assetOption.name}
                                                    </Text>
                                                    <Badge
                                                        colorPalette={TYPE_BADGE_PALETTE[assetOption.type] ?? 'gray'}
                                                        size="sm"
                                                        variant="surface"
                                                    >
                                                        {assetOption.type}
                                                    </Badge>
                                                    {isOwn(assetOption) && (
                                                        <Badge colorPalette="yellow" size="sm" variant="surface">
                                                            Yours
                                                        </Badge>
                                                    )}
                                                </HStack>
                                                <Text fontSize="sm" color="fg.muted">
                                                    {balanceLine(assetOption)}
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
                                    No assets found
                                </Text>
                            </Box>
                        )}
                    </Box>
                    {!searchTerm && selectableAssets.length > UNFILTERED_LIMIT && (
                        <Box p="2" borderTopWidth="1px" textAlign="center">
                            <Text fontSize="xs" color="fg.muted">
                                Showing first {UNFILTERED_LIMIT} assets. Search to find more.
                            </Text>
                        </Box>
                    )}
                </Select.Content>
            </Select.Positioner>
        </Select.Root>
    )
}
