"use client"

import React from 'react'
import { Box, Button, Card, Circle, Code, Grid, HStack, IconButton, Link, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuArrowUpRight, LuCheck, LuCopy } from 'react-icons/lu'
import {
    FeeCoin,
    getChainExplorerURL,
    getDexApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useCreationFees,
    useToast,
} from '@bze/bze-ui-kit'
import { type ReturnTo, withReturn } from '@/components/guided/return-to'
import { useNavigation } from '@/hooks/useNavigation'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { PLAYBOOKS_PATH, createdReturnHref } from '@/lib/playbooks'
import { workspaceHref } from '@/lib/workspace'

interface LaunchNextStepsProps {
    denom: string;
    txHash: string;
    /** The create form's values, shown until the asset list has the new token. */
    name: string;
    symbol: string;
    /** Initial supply in display units, as typed. */
    supply: string;
    /** Clears the create form for another token. */
    reset: () => void;
    /** Where /token/new was opened from (a playbook): the main button goes back there. */
    returnTo?: ReturnTo;
}

interface NextStep {
    key: string;
    title: string;
    why: string;
    hint?: string;
    action: { label: string; href: string };
    /** undefined while the setup is still being read. */
    done?: boolean;
}

function initials(name: string, symbol: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    const fromName = words.slice(0, 2).map(w => w[0]).join('')
    return (fromName || symbol.slice(0, 2) || '?').toUpperCase()
}

/** "Pool creation fee: 1,000 BZE"; nothing until the fee and its asset are known. */
function useFeeHint(label: string, fee?: FeeCoin): string | undefined {
    const { asset } = useAsset(fee?.denom ?? '')
    if (!fee || !asset) return undefined
    return `${label}: ${prettyAmount(uAmountToBigNumberAmount(fee.amount, asset.decimals))} ${asset.ticker}`
}

function StepCard({ number, step, onGo }: { number: number; step: NextStep; onGo: (href: string) => void }) {
    const isDone = step.done === true

    return (
        <Card.Root
            variant="outline"
            p={isDone ? 3 : 4}
            bg={isDone ? 'bg.subtle' : 'bg.panel'}
            data-testid={`launch-step-${step.key}`}
            data-state={step.done === undefined ? 'loading' : isDone ? 'done' : 'todo'}
        >
            <HStack gap={3} align="start" justify="space-between" flexWrap="wrap">
                <HStack gap={3} align="start" flex="1" minW="56">
                    {step.done === undefined ? (
                        <Skeleton boxSize="7" borderRadius="full" flexShrink={0} />
                    ) : (
                        <Circle
                            size="7"
                            flexShrink={0}
                            fontSize="sm"
                            fontWeight="bold"
                            bg={isDone ? 'green.500/15' : 'yellow.500/15'}
                            color={isDone ? 'green.600' : 'yellow.fg'}
                        >
                            {isDone ? <LuCheck size={14} aria-label="Done" /> : number}
                        </Circle>
                    )}
                    <VStack align="start" gap={1} minW={0}>
                        <Text fontWeight="semibold">{step.title}</Text>
                        {!isDone && (
                            <>
                                <Text fontSize="sm" color="fg.muted">{step.why}</Text>
                                {step.hint && <Text fontSize="xs" color="fg.muted" fontWeight="medium">{step.hint}</Text>}
                            </>
                        )}
                    </VStack>
                </HStack>
                {!isDone && (
                    <Button size="sm" colorPalette="yellow" variant="outline" onClick={() => onGo(step.action.href)}>
                        {step.action.label}
                    </Button>
                )}
            </HStack>
        </Card.Root>
    )
}

/**
 * Shown by /token/new after the token is created (BFE-162): what to do next, each step read
 * from the chain by useTokenSetup, so done steps tick off. Locking the supply is the last step.
 */
export function LaunchNextSteps({ denom, txHash, name, symbol, supply, reset, returnTo }: LaunchNextStepsProps) {
    const { navigate } = useNavigation()
    const { toast } = useToast()
    const { asset } = useAsset(denom)
    const setup = useTokenSetup(denom)
    const { fees } = useCreationFees()

    const tokenName = asset?.name || name.trim()
    const ticker = asset?.ticker || symbol
    const overview = workspaceHref(denom)
    const back = { href: overview, label: ticker }
    // A playbook gets the new token and its first step done; other return paths stay as they are.
    const mainHref = !returnTo
        ? overview
        : returnTo.href.startsWith(`${PLAYBOOKS_PATH}?`) ? createdReturnHref(returnTo.href, denom) : returnTo.href
    const isReading = !asset || setup.isLoading
    const doneOf = (key: string) => {
        if (isReading) return undefined
        return setup.items.find(item => item.key === key)?.state === 'done'
    }
    const registry = setup.items.find(item => item.key === 'registry')

    const poolFeeHint = useFeeHint('Pool creation fee', fees.createMarketFee)
    const rewardsFeeHint = useFeeHint('Holder rewards fee', fees.createDenomRewardFee)

    const steps: NextStep[] = [
        {
            key: 'look',
            title: 'Give it a look',
            why: `Pick colours and a font. ${ticker}'s page on Communities uses them. Only the admin can set them.`,
            hint: 'About 2 min',
            action: { label: 'Set brand kit', href: workspaceHref(denom, 'profile') },
            done: doneOf('brandKit'),
        },
        {
            key: 'pool',
            title: 'Let people buy it',
            why: `Create a ${ticker}/BZE pool with some of your ${ticker} and some BZE. What you put in sets the starting price. Want limit orders too? Add an order-book market after.`,
            hint: poolFeeHint,
            action: { label: 'Create pool', href: withReturn(`/pool/new?base=${encodeURIComponent(denom)}`, back) },
            done: doneOf('pool'),
        },
        {
            key: 'rewards',
            title: 'Reward the people who hold it',
            why: `Turn on holder rewards so anyone who stakes ${ticker} shares daily prizes. You fund the prizes, in ${ticker} or any token you hold.`,
            hint: rewardsFeeHint,
            action: { label: 'Set up rewards', href: workspaceHref(denom, 'rewards') },
            done: doneOf('holderRewards'),
        },
        ...(registry ? [{
            key: 'registry',
            title: 'Get its logo in every wallet',
            why: registry.detail,
            action: { label: registry.action?.label ?? 'Open the guide', href: registry.action?.href ?? registry.href },
            done: doneOf('registry'),
        }] : []),
        {
            key: 'lock',
            title: 'Last: lock the supply (optional)',
            why: `When everything above is done, lock ${ticker} so buyers see Fixed supply. It can never be undone.`,
            action: { label: 'Review and lock', href: `${workspaceHref(denom, 'control')}&lock=1` },
            done: isReading ? undefined : false,
        },
    ]

    const dexUrl = `${getDexApp().href}/assets/details?denom=${encodeURIComponent(denom)}`
    const txUrl = `${getChainExplorerURL()}/tx/${txHash}`

    const copyDenom = async () => {
        await navigator.clipboard.writeText(denom)
        toast.success('Copied', 'Token ID copied to clipboard.')
    }

    return (
        <VStack align="stretch" gap={6}>
            <VStack align="start" gap={2}>
                <HStack gap={2} color="green.600" fontSize="sm" fontWeight="medium">
                    <LuCheck size={16} />
                    <Text data-testid="launch-minted">{`Step 1 done · ${prettyAmount(supply)} ${ticker} minted to you`}</Text>
                </HStack>
                <Text as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" letterSpacing="tight" wordBreak="break-word">
                    {`${tokenName} is live`}
                </Text>
                <Text color="fg.muted" maxW="2xl">
                    {`Right now only you hold ${ticker} and nobody can buy it. These steps change that. Do them now or later: they stay on ${ticker}'s page until they are done.`}
                </Text>
            </VStack>

            <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' }} gap={6} alignItems="start">
                <VStack as="ol" align="stretch" gap={3} aria-label="Next steps" listStyleType="none" m={0} p={0}>
                    {steps.map((step, i) => (
                        <Box as="li" key={step.key}>
                            <StepCard number={i + 2} step={step} onGo={navigate} />
                        </Box>
                    ))}
                </VStack>

                <VStack align="stretch" gap={4}>
                    <Box as="section" aria-label="Your token" p={4} borderRadius="xl" borderWidth="1px" borderColor="border" bg="bg.panel">
                        <VStack align="stretch" gap={3}>
                            <HStack gap={3} minW={0}>
                                <Circle size="10" bg="yellow.500/20" color="yellow.fg" fontWeight="bold" fontSize="sm" flexShrink={0}>
                                    {initials(tokenName, ticker)}
                                </Circle>
                                <VStack align="start" gap={0} minW={0}>
                                    <Text fontWeight="semibold" wordBreak="break-word">{tokenName}</Text>
                                    <Text fontSize="xs" color="fg.muted">{`${ticker} · Mintable`}</Text>
                                </VStack>
                            </HStack>
                            <VStack align="stretch" gap={1}>
                                <Text fontSize="xs" color="fg.muted" fontWeight="medium">Token ID (denom)</Text>
                                <HStack gap={2}>
                                    <Code fontSize="xs" p={2} borderRadius="md" wordBreak="break-all" flex="1">{denom}</Code>
                                    <IconButton aria-label="Copy token ID" size="sm" variant="ghost" colorPalette="yellow" onClick={copyDenom}>
                                        <LuCopy />
                                    </IconButton>
                                </HStack>
                            </VStack>
                            <VStack align="start" gap={1}>
                                <Link href={dexUrl} target="_blank" rel="noopener noreferrer" fontSize="sm" color="yellow.fg">
                                    View on the DEX <LuArrowUpRight />
                                </Link>
                                <Link href={txUrl} target="_blank" rel="noopener noreferrer" fontSize="sm" color="yellow.fg">
                                    View transaction <LuArrowUpRight />
                                </Link>
                            </VStack>
                            <Text fontSize="xs" color="fg.muted" data-testid="launch-logo-note">
                                {"Why a logo isn't here: logos come from the Cosmos Chain Registry, not from the Factory. "}
                                {registry && (
                                    <Link
                                        href={registry.href}
                                        color="yellow.fg"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            navigate(registry.href)
                                        }}
                                    >
                                        How to add one
                                    </Link>
                                )}
                            </Text>
                        </VStack>
                    </Box>

                    <VStack align="stretch" gap={2}>
                        <Button size="lg" colorPalette="yellow" onClick={() => navigate(mainHref)}>
                            {returnTo ? `Back to ${returnTo.label}` : `Go to ${ticker}'s page`}
                        </Button>
                        <Button variant="ghost" colorPalette="yellow" onClick={reset}>
                            Create another token
                        </Button>
                    </VStack>
                </VStack>
            </Grid>
        </VStack>
    )
}
