"use client"

import React, { useState } from 'react'
import NextLink from 'next/link'
import { Box, Button, chakra, HStack, Input, InputGroup, Link, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw, LuSearch } from 'react-icons/lu'
import {
    Shimmer,
    TokenLogo,
    getChainName,
    useAssets,
    useAssetsContext,
    type Asset,
    type DenomReward,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { TipNote, WarningNote } from '@/components/guided/notes'
import { FilterChip } from '@/components/ui/filter-chip'
import { useAllDenomRewards } from '@/hooks/useAllDenomRewards'
import { useMyTokens } from '@/hooks/useMyTokens'
import { airdropFormHref, scheduleFormHref } from '@/lib/denom-reward'
import {
    PICKER_PAGE_SIZE,
    type PickerChip,
    type PickerRow,
    type StakedTokenPickerMode,
    pickerAdminLine,
    pickerGroups,
    showMoreLabel,
    toPickerRow,
    tokenKind,
} from '@/lib/staked-token-picker'

/** The right side of a row: green when people stake, grey when nothing to say, amber when it needs care. */
export interface TokenState {
    text: string;
    tone: 'good' | 'muted' | 'warn';
}

const TONE_COLOR: Record<TokenState['tone'], string> = {
    good: 'hg.success.text',
    muted: 'hg.text.faint',
    warn: 'hg.warning.text',
}

export interface StakedTokenPickerProps {
    /**
     * `makeStakable` lists every token and marks those that already have a compounded reward;
     * `hasCompounded` lists only those that have one.
     */
    mode: StakedTokenPickerMode;
    /** Hide governance-halted tokens. */
    excludeHalted?: boolean;
    /** List LP shares too (a "Pool shares" chip). Default true. */
    includeLP?: boolean;
    /** The picked denom ('' for none). */
    value: string;
    onChange: (asset: Asset) => void;
    /** The row's state, from its compounded reward (undefined when it has none). */
    stateOf: (asset: Asset, dr?: DenomReward) => TokenState | undefined;
}

const CHIPS: { value: PickerChip; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Created by you' },
    { value: 'lp', label: 'Pool shares' },
]

function GroupTitle({ children }: { children: React.ReactNode }) {
    return (
        <Text as="h3" fontSize="12px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">
            {children}
        </Text>
    )
}

function TokenOption({ row, line, state, selected, onPick }: {
    row: PickerRow;
    line: string;
    state?: TokenState;
    selected: boolean;
    onPick: () => void;
}) {
    const { asset } = row
    return (
        <chakra.button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${asset.name} · ${asset.ticker}`}
            display="flex"
            alignItems="center"
            gap="12px"
            w="full"
            minW={0}
            px="12px"
            py="10px"
            textAlign="start"
            borderRadius="12px"
            borderWidth="1px"
            borderColor={selected ? 'app.border' : 'transparent'}
            bg={selected ? 'app.subtle' : 'transparent'}
            cursor="pointer"
            _hover={{ bg: selected ? 'app.subtle' : 'hg.inset' }}
            focusVisibleRing="outside"
            onClick={onPick}
            data-testid="picker-row"
        >
            <TokenLogo src={asset.logo} symbol={asset.ticker} size="8" circular={true} />
            <VStack align="start" gap="2px" minW={0} flex="1">
                <Text fontSize="14px" fontWeight="600" truncate maxW="full">{`${asset.name} · ${asset.ticker}`}</Text>
                {line && <Text fontSize="12px" color="hg.text.secondary" truncate maxW="full">{line}</Text>}
            </VStack>
            {state && (
                <Text fontSize="12px" fontWeight="600" color={TONE_COLOR[state.tone]} textAlign="end" flexShrink={0} maxW="45%" data-testid="picker-state">
                    {state.text}
                </Text>
            )}
        </chakra.button>
    )
}

/**
 * Which token's stakers (canvas D4): a wizard step, not a dialog. Your factory tokens first, with
 * their admin line, then every token: compounded rewards by staked USD value, then the rest A–Z.
 * Which tokens have a compounded reward, and what they stake, comes from the chain's list.
 */
export function StakedTokenPicker({ mode, excludeHalted = false, includeLP = true, value, onChange, stateOf }: StakedTokenPickerProps) {
    const { assets, isLoading: isAssetsLoading, nativeAsset } = useAssets()
    const { usdPricesMap } = useAssetsContext()
    const { address } = useChain(getChainName())
    const { tokens: myTokens } = useMyTokens()
    const denomRewards = useAllDenomRewards()
    const [q, setQ] = useState('')
    const [chip, setChip] = useState<PickerChip>('all')
    const [shown, setShown] = useState(PICKER_PAGE_SIZE)

    const drs = new Map((denomRewards.list ?? []).map(dr => [dr.staking_denom, dr]))
    const rowOf = (asset: Asset) => toPickerRow(asset, drs.get(asset.denom), usdPricesMap.get(asset.denom))
    const admins = new Map(myTokens.map(t => [t.asset.denom, t.admin]))
    const filter = { mode, q, includeLP, excludeHalted }
    const groups = pickerGroups(
        address ? myTokens.map(t => rowOf(t.asset)) : [],
        assets.filter(a => a.supply > BigInt(0)).map(rowOf),
        chip,
        filter,
    )
    const chips = CHIPS.filter(c => (c.value !== 'mine' || address) && (c.value !== 'lp' || includeLP))

    const picked = value ? drs.get(value) : undefined
    const pickedAsset = value ? assets.find(a => a.denom === value) : undefined
    const isLoading = isAssetsLoading || denomRewards.isLoading

    const search = (next: string) => {
        setQ(next)
        setShown(PICKER_PAGE_SIZE)
    }
    const pickChip = (next: PickerChip) => {
        setChip(next)
        setShown(PICKER_PAGE_SIZE)
    }

    const stateFor = (row: PickerRow) =>
        mode === 'makeStakable' && row.dr ? { text: 'Already stakable', tone: 'muted' as const } : stateOf(row.asset, row.dr)

    const option = (row: PickerRow, line: string) => (
        <TokenOption
            key={row.asset.denom}
            row={row}
            line={line}
            state={denomRewards.list ? stateFor(row) : undefined}
            selected={row.asset.denom === value}
            onPick={() => onChange(row.asset)}
        />
    )

    const nothing = groups.mine.length === 0 && groups.all.length === 0

    return (
        <VStack align="stretch" gap="14px" data-testid="staked-token-picker">
            <InputGroup startElement={<LuSearch size={18} aria-hidden />}>
                <Input
                    aria-label="Search tokens"
                    placeholder="Search by ticker, name or denom"
                    value={q}
                    onChange={(e) => search(e.target.value)}
                />
            </InputGroup>
            {chips.length > 1 && (
                <HStack gap="6px" wrap="wrap" role="group" aria-label="Show">
                    {chips.map(c => (
                        <FilterChip key={c.value} pressed={chip === c.value} onClick={() => pickChip(c.value)}>{c.label}</FilterChip>
                    ))}
                </HStack>
            )}

            {denomRewards.hasError && (
                <WarningNote
                    action={(
                        <Button size="xs" variant="ghost" color="hg.link" fontWeight="600" onClick={denomRewards.retry}>
                            <LuRefreshCw /> Retry
                        </Button>
                    )}
                >
                    {"Couldn't load which tokens are stakable. The node may be down."}
                </WarningNote>
            )}

            {isLoading ? (
                <VStack align="stretch" gap="8px" aria-busy="true" data-testid="picker-loading">
                    <Shimmer h="52px" borderRadius="12px" />
                    <Shimmer h="52px" borderRadius="12px" />
                    <Shimmer h="52px" borderRadius="12px" />
                </VStack>
            ) : nothing ? (
                <Text fontSize="14px" color="fg.muted" data-testid="picker-empty">
                    {q.trim() !== ''
                        ? `No token matches '${q.trim()}'.`
                        : mode === 'hasCompounded' ? 'No token is stakable yet.' : 'No token to show.'}
                </Text>
            ) : (
                <VStack align="stretch" gap="18px" role="radiogroup" aria-label="Token">
                    {groups.mine.length > 0 && (
                        <VStack as="section" aria-label="Created by you" align="stretch" gap="4px">
                            <GroupTitle>Created by you</GroupTitle>
                            {groups.mine.map(row => option(row, pickerAdminLine(admins.get(row.asset.denom), address, mode) || tokenKind(row.asset, nativeAsset?.denom)))}
                        </VStack>
                    )}
                    {groups.all.length > 0 && (
                        <VStack as="section" aria-label="All tokens" align="stretch" gap="4px">
                            <GroupTitle>All tokens</GroupTitle>
                            {groups.all.slice(0, shown).map(row => option(row, tokenKind(row.asset, nativeAsset?.denom)))}
                            {groups.all.length > shown && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    mt="6px"
                                    borderColor="hg.lineStrong"
                                    color="fg"
                                    borderRadius="hg.md"
                                    onClick={() => setShown(n => n + PICKER_PAGE_SIZE)}
                                >
                                    {showMoreLabel(groups.all.length)}
                                </Button>
                            )}
                        </VStack>
                    )}
                </VStack>
            )}

            {mode === 'makeStakable' && picked && (
                <TipNote
                    action={(
                        <HStack gap="16px" wrap="wrap" fontSize="14px" fontWeight="600">
                            <Link asChild color="hg.link"><NextLink href={scheduleFormHref(value)}>Add a daily prize</NextLink></Link>
                            <Link asChild color="hg.link"><NextLink href={airdropFormHref(value)}>Airdrop to stakers</NextLink></Link>
                        </HStack>
                    )}
                >
                    <Box as="span" data-testid="already-stakable">
                        {`${pickedAsset?.ticker ?? 'This token'} is already stakable. Add a prize to it instead.`}
                    </Box>
                </TipNote>
            )}
        </VStack>
    )
}
