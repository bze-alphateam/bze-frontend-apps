"use client"

import React, { useMemo, useState } from 'react'
import {
    Badge,
    Box,
    HStack,
    Input,
    Select,
    Text,
    VStack,
    createListCollection,
} from '@chakra-ui/react'
import { LuChevronDown } from 'react-icons/lu'
import {
    Asset,
    Shimmer,
    TokenLogo,
    getChainName,
    hgVariant,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    useBalances,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'

/** The asset type ("Factory", "IBC", "LP") as a neutral pill. */
const TypeBadge = ({ type }: { type: string }) => (
    <Badge variant={hgVariant('neutral')} size="sm" borderRadius="hg.pill">{type}</Badge>
)

/** The user's own tokens, in the app tint. */
const YoursBadge = () => (
    <Badge size="sm" borderRadius="hg.pill" bg="app.subtle" color="hg.link" borderWidth="1px" borderColor="app.border">Yours</Badge>
)

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
    /** Hide governance-halted denoms (markets / pools the chain refuses). Default false. */
    excludeHalted?: boolean;
    /** With a wallet connected, list only the tokens it holds (and the selected one). Default false. */
    heldOnly?: boolean;
}

export function AssetPicker({
    value,
    onSelect,
    label,
    includeLP = false,
    excludeDenoms,
    ownFirst = true,
    excludeHalted = false,
    heldOnly = false,
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
        // Without a wallet the balances are unknown, so nothing is hidden.
        const held = (a: Asset) => !heldOnly || !address || a.denom === value || getBalanceByDenom(a.denom).amount.gt(0)
        const filtered = (source ?? []).filter(a => a.supply > BigInt(0) && !excluded.has(a.denom) && !(excludeHalted && a.halted) && held(a))

        // Stable ordering: user's own factory denoms first, then verified assets.
        const rank = (a: Asset) => (ownFirst && isOwn(a) ? 0 : a.verified ? 1 : 2)
        return filtered
            .map((asset, index) => ({ asset, index }))
            .sort((a, b) => rank(a.asset) - rank(b.asset) || a.index - b.index)
            .map(({ asset }) => asset)
    }, [assets, assetsLpExcluded, includeLP, excludeDenoms, ownFirst, isOwn, excludeHalted, heldOnly, address, value, getBalanceByDenom])

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
            <VStack align="stretch" gap="8px" w="full" aria-busy="true">
                <Shimmer h="13px" w="96px" />
                <Shimmer h="46px" borderRadius="12px" />
            </VStack>
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
            <VStack align="stretch" gap="8px" w="full">
                <Select.Label fontSize="13px" fontWeight="400" color="hg.text.muted">
                    {label}
                </Select.Label>
                <Select.Trigger asChild>
                    <Box
                        as="button"
                        textAlign="start"
                        w="full"
                        minH="46px"
                        px="14px"
                        py={selectedAsset ? '10px' : '0'}
                        borderRadius="12px"
                        bg="hg.inset"
                        borderWidth="1px"
                        borderColor="hg.hairline"
                        cursor="pointer"
                        transition="border-color 0.15s"
                        _hover={{ borderColor: 'app.border' }}
                        _expanded={{ borderColor: 'app.focusRing', boxShadow: '0 0 0 3px {colors.app.subtle}' }}
                        focusVisibleRing="outside"
                    >
                        <HStack justify="space-between" w="full" minH="44px" gap="12px">
                            {selectedAsset ? (
                                <HStack gap="12px" minW="0">
                                    <TokenLogo
                                        src={selectedAsset.logo}
                                        symbol={selectedAsset.ticker}
                                        size="8"
                                        circular={true}
                                    />
                                    <VStack align="start" gap="2px" minW="0">
                                        <HStack gap="8px" flexWrap="wrap">
                                            <Text fontWeight="700" fontSize="16px">
                                                {selectedAsset.ticker}
                                            </Text>
                                            <Text fontSize="14px" color="hg.text.muted" truncate>
                                                {selectedAsset.name}
                                            </Text>
                                            <TypeBadge type={selectedAsset.type} />
                                        </HStack>
                                        <Text fontSize="13px" color="hg.text.faint">
                                            {balanceLine(selectedAsset)}
                                        </Text>
                                    </VStack>
                                </HStack>
                            ) : (
                                <Text fontSize="15px" color="hg.text.faint">
                                    Select asset
                                </Text>
                            )}
                            <Box color="hg.text.faint" flexShrink={0}><LuChevronDown size={16} /></Box>
                        </HStack>
                    </Box>
                </Select.Trigger>
            </VStack>
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
                                    borderRadius="10px"
                                    _hover={{ bg: 'hg.hoverFill' }}
                                    _highlighted={{ bg: 'app.subtle' }}
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
                                                    <Text fontWeight="600" fontSize="15px">
                                                        {assetOption.ticker}
                                                    </Text>
                                                    <Text fontSize="13px" color="hg.text.muted">
                                                        {assetOption.name}
                                                    </Text>
                                                    <TypeBadge type={assetOption.type} />
                                                    {isOwn(assetOption) && <YoursBadge />}
                                                </HStack>
                                                <Text fontSize="12px" color="hg.text.faint">
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
                                <Text fontSize="14px" color="hg.text.muted">
                                    No assets found
                                </Text>
                            </Box>
                        )}
                    </Box>
                    {!searchTerm && selectableAssets.length > UNFILTERED_LIMIT && (
                        <Box p="2" borderTopWidth="1px" borderColor="hg.divider" textAlign="center">
                            <Text fontSize="12px" color="hg.text.faint">
                                Showing first {UNFILTERED_LIMIT} assets. Search to find more.
                            </Text>
                        </Box>
                    )}
                </Select.Content>
            </Select.Positioner>
        </Select.Root>
    )
}
