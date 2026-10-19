"use client"

import React, { useEffect, useId, useRef, useState } from 'react'
import { Box, HStack, Input, InputGroup, Kbd, Text, VStack } from '@chakra-ui/react'
import { LuCornerDownLeft, LuSearch } from 'react-icons/lu'
import { type Asset, TokenLogo } from '@bze/bze-ui-kit'
import { searchGoals } from '@/lib/goal-search'
import { GOALS, SEARCH_TOOLS, type Goal } from '@/lib/goals'

const CATALOGUE = [...GOALS, ...SEARCH_TOOLS]
const HINT_SYNONYMS = 5

interface GoalSearchProps {
    /** The user's own tokens, found by ticker or name. */
    tokens: Asset[];
    onGoal: (goal: Goal) => void;
    onToken: (denom: string) => void;
    /** Offered when nothing matches: the All tools chips. */
    tools: React.ReactNode;
}

type Option = { kind: 'goal'; goal: Goal } | { kind: 'token'; asset: Asset }

/** True when the key press lands in something the user types into, so `/` is theirs. */
function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * The home search in everyday words (BFE-168): a combobox whose panel lists the matching goals
 * and the user's tokens. `/` focuses it from anywhere on the page, ↑/↓ move, Enter opens, Esc
 * closes the panel and a second Esc clears the box.
 */
export function GoalSearch({ tokens, onGoal, onToken, tools }: GoalSearchProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const listboxId = useId()
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(0)

    const result = searchGoals(query, CATALOGUE, tokens)
    const options: Option[] = [
        ...result.goals.map(goal => ({ kind: 'goal' as const, goal })),
        ...result.tokens.map(asset => ({ kind: 'token' as const, asset })),
    ]
    const expanded = open && query.trim() !== ''
    const activeIndex = Math.min(active, Math.max(options.length - 1, 0))
    const optionId = (i: number) => `${listboxId}-option-${i}`
    const top = result.goals[0]
    const hint = top?.synonyms.filter(s => s !== query.trim().toLowerCase()).slice(0, HINT_SYNONYMS)

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
            e.preventDefault()
            inputRef.current?.focus()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [])

    const choose = (option: Option | undefined) => {
        if (!option) return
        setOpen(false)
        if (option.kind === 'goal') onGoal(option.goal)
        else onToken(option.asset.denom)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowUp': {
                e.preventDefault()
                if (!expanded) {
                    setOpen(true)
                    return
                }
                if (options.length === 0) return
                const step = e.key === 'ArrowDown' ? 1 : -1
                setActive((activeIndex + step + options.length) % options.length)
                return
            }
            case 'Enter':
                if (!expanded) return
                e.preventDefault()
                choose(options[activeIndex])
                return
            case 'Escape':
                e.preventDefault()
                if (expanded) setOpen(false)
                else setQuery('')
                return
        }
    }

    const row = (option: Option, i: number) => {
        const selected = i === activeIndex
        return (
            <HStack
                key={option.kind === 'goal' ? option.goal.id : option.asset.denom}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                gap={3}
                px="12px"
                py="10px"
                borderRadius="10px"
                cursor="pointer"
                bg={selected ? 'app.subtle' : undefined}
                onMouseEnter={() => setActive(i)}
                // Keep the focus in the box, so the panel doesn't close before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
            >
                {option.kind === 'goal' ? (
                    <VStack align="start" gap="2px" flex="1" minW={0}>
                        <Text fontSize="14px" fontWeight="700">{option.goal.title}</Text>
                        <Text fontSize="12px" color="fg.muted" truncate maxW="full">{option.goal.description}</Text>
                        <Text fontSize="11px" color="hg.text.faint" fontFamily="mono">{option.goal.techTag}</Text>
                    </VStack>
                ) : (
                    <HStack gap="10px" flex="1" minW={0}>
                        <TokenLogo src={option.asset.logo} symbol={option.asset.ticker} size="6" circular={true} />
                        <Text fontSize="14px" fontWeight="700" truncate>{`Open ${option.asset.ticker}`}</Text>
                    </HStack>
                )}
                {selected && <Box color="fg.muted" flexShrink={0} aria-hidden><LuCornerDownLeft size={14} /></Box>}
            </HStack>
        )
    }

    return (
        <Box position="relative" maxW="620px" w="full">
            <InputGroup
                w="full"
                startElement={<Box color="hg.text.faint"><LuSearch size={18} /></Box>}
                startElementProps={{ ps: '18px' }}
                endElement={(
                    <Kbd size="sm" bg="hg.inset" borderWidth="1px" borderColor="hg.lineStrong" color="hg.text.secondary" fontFamily="mono" boxShadow="none">/</Kbd>
                )}
            >
                <Input
                    ref={inputRef}
                    role="combobox"
                    aria-label="What do you want to do?"
                    aria-autocomplete="list"
                    aria-expanded={expanded}
                    aria-controls={listboxId}
                    aria-activedescendant={expanded && options.length > 0 ? optionId(activeIndex) : undefined}
                    placeholder={'Try "airdrop", "make it stakable", "add a logo"…'}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setActive(0)
                        setOpen(true)
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                    onKeyDown={onKeyDown}
                    h="56px"
                    ps="46px"
                    fontSize="16px"
                    bg="hg.card"
                    borderRadius="16px"
                    borderColor="app.border"
                    boxShadow="hg.featured"
                    _placeholder={{ color: 'hg.text.faint' }}
                    _focusVisible={{ borderColor: 'app.focusRing', boxShadow: '0 0 0 3px {colors.app.subtle}', outline: 'none' }}
                />
            </InputGroup>

            {expanded && (
                <Box
                    position="absolute"
                    top="100%"
                    insetX={0}
                    mt="8px"
                    zIndex="dropdown"
                    bg="hg.card"
                    borderWidth="1px"
                    borderColor="hg.lineStrong"
                    borderRadius="16px"
                    boxShadow="hg.popover"
                    p="8px"
                    textAlign="start"
                    data-testid="goal-search-panel"
                >
                    <Box id={listboxId} role="listbox" aria-label="Search results">
                        {result.goals.length > 0 && (
                            <VStack align="stretch" gap={0} role="group" aria-label="Goals">
                                <Text px="12px" py="6px" fontSize="12px" fontWeight="600" color="hg.text.faint">Goals</Text>
                                {result.goals.map((goal, i) => row({ kind: 'goal', goal }, i))}
                            </VStack>
                        )}
                        {result.tokens.length > 0 && (
                            <VStack align="stretch" gap={0} role="group" aria-label="Your tokens" mt={result.goals.length > 0 ? 2 : 0}>
                                <Text px="12px" py="6px" fontSize="12px" fontWeight="600" color="hg.text.faint">Your tokens</Text>
                                {result.tokens.map((asset, i) => row({ kind: 'token', asset }, result.goals.length + i))}
                            </VStack>
                        )}
                    </Box>

                    {options.length === 0 ? (
                        <VStack align="stretch" gap="14px" p="10px">
                            <Text fontSize="14px" color="fg.muted">
                                {`Nothing matches "${query.trim()}". Try other words, or browse all tools below.`}
                            </Text>
                            {/* The chips navigate away; keep the focus so the panel stays until the click lands. */}
                            <Box onMouseDown={(e) => e.preventDefault()}>{tools}</Box>
                        </VStack>
                    ) : hint && hint.length > 0 && (
                        <Text px="12px" pt="10px" pb="4px" fontSize="12px" color="hg.text.faint" borderTopWidth="1px" borderColor="hg.divider" mt="8px">
                            {`Also finds: ${hint.join(', ')}…`}
                        </Text>
                    )}
                </Box>
            )}
        </Box>
    )
}
