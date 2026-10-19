"use client"

import React from 'react'
import { Box, Button, chakra, Circle, Code, Flex, Grid, HStack, IconButton, Link, Text, VStack } from '@chakra-ui/react'
import { LuCheck, LuCopy } from 'react-icons/lu'
import {
    AppLink,
    FeeCoin,
    GradientText,
    HeroGlow,
    PageContainer,
    Shimmer,
    hgVariant,
    getExplorerTxURL,
    getDexApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useCreationFees,
    useToast,
} from '@bze/bze-ui-kit'
import { type ReturnTo, withReturn } from '@/components/guided/return-to'
import { FormFrame } from '@/components/guided/guided-form'
import { softButton } from '@/components/ui/soft-button'
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
    const state = step.done === undefined ? 'loading' : isDone ? 'done' : 'todo'

    if (isDone) {
        return (
            <Flex
                align="center"
                gap="12px"
                px="18px"
                py="12px"
                borderRadius="hg.lg"
                bg="hg.inset"
                borderWidth="1px"
                borderColor="hg.divider"
                data-testid={`launch-step-${step.key}`}
                data-state={state}
            >
                <Circle size="28px" flexShrink={0} bg="hg.success/16" borderWidth="1px" borderColor="hg.success/45" color="hg.success.text">
                    <LuCheck size={13} strokeWidth={3} aria-label="Done" />
                </Circle>
                <Text fontSize="14px" fontWeight="700">{step.title}</Text>
            </Flex>
        )
    }

    return (
        <Box
            p="18px"
            borderRadius="hg.lg"
            bg="hg.card"
            borderWidth="1px"
            borderColor="hg.hairline"
            data-testid={`launch-step-${step.key}`}
            data-state={state}
        >
            <Flex gap="14px" align="start" justify="space-between" wrap="wrap">
                <Flex gap="12px" align="start" flex="1 1 300px" minW={0}>
                    {step.done === undefined ? (
                        <Shimmer boxSize="28px" borderRadius="full" flexShrink={0} />
                    ) : (
                        <Circle size="28px" flexShrink={0} bgImage="app" color="hg.buttonText" fontSize="13px" fontWeight="800">
                            {number}
                        </Circle>
                    )}
                    <VStack align="start" gap="4px" minW={0}>
                        <Text fontSize="16px" fontWeight="700">{step.title}</Text>
                        <Text fontSize="14px" lineHeight="1.55" color="fg.muted">{step.why}</Text>
                        {step.hint && <Text fontSize="12px" fontWeight="600" color="hg.text.secondary">{step.hint}</Text>}
                    </VStack>
                </Flex>
                <Button {...softButton} size="sm" onClick={() => onGo(step.action.href)}>
                    {step.action.label}
                </Button>
            </Flex>
        </Box>
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
    const marketHref = withReturn(`/market/new?base=${encodeURIComponent(denom)}`, back)
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
            why: `Pick colours and a font. ${ticker}'s page on Communities uses them. Only whoever controls the token can set them.`,
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
    const txUrl = getExplorerTxURL(txHash)

    const copyDenom = async () => {
        await navigator.clipboard.writeText(denom)
        toast.success('Copied', 'Token ID copied to clipboard.')
    }

    return (
        <>
            <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
                <HeroGlow strength="inner" />
                <PageContainer position="relative" pt={{ base: '24px', md: '36px' }} pb={{ base: '22px', md: '32px' }}>
                    <VStack align="start" gap="10px">
                        <HStack gap="8px" color="hg.success.text" fontSize="14px" fontWeight="600">
                            <LuCheck size={16} aria-hidden />
                            <Text data-testid="launch-minted">{`Step 1 done · ${prettyAmount(supply)} ${ticker} minted to you`}</Text>
                        </HStack>
                        <chakra.h1 m="0" textStyle="pageTitle" fontSize={{ base: '26px', md: '36px' }} wordBreak="break-word">
                            {`${tokenName} is `}<GradientText>live</GradientText>
                        </chakra.h1>
                        <Text fontSize={{ base: '14px', md: '16px' }} lineHeight="1.6" color="fg.muted" maxW="680px">
                            {`Right now only you hold ${ticker} and nobody can buy it. These steps change that. Do them now or later: they stay on ${ticker}'s page until they are done.`}
                        </Text>
                    </VStack>
                </PageContainer>
            </Box>

            <FormFrame>
                <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }} gap="24px" alignItems="start">
                    <VStack as="ol" align="stretch" gap="12px" aria-label="Next steps" listStyleType="none" m={0} p={0}>
                        {steps.map((step, i) => (
                            <Box as="li" key={step.key}>
                                <StepCard number={i + 2} step={step} onGo={navigate} />
                            </Box>
                        ))}
                    </VStack>

                    <VStack align="stretch" gap="14px">
                        <VStack
                            as="section"
                            aria-label="Your token"
                            align="stretch"
                            gap="12px"
                            p="18px"
                            borderRadius="hg.lg"
                            borderWidth="1px"
                            borderColor="hg.hairline"
                            bg="hg.card"
                        >
                            <HStack gap="12px" minW={0}>
                                <Circle
                                    size="40px"
                                    bg="app.subtle"
                                    boxShadow="0 0 0 2px {colors.app.border}"
                                    color="hg.link"
                                    fontWeight="800"
                                    fontSize="13px"
                                    flexShrink={0}
                                >
                                    {initials(tokenName, ticker)}
                                </Circle>
                                <VStack align="start" gap="2px" minW={0}>
                                    <Text fontWeight="700" wordBreak="break-word">{tokenName}</Text>
                                    <Text fontSize="12px" color="hg.text.faint">{`${ticker} · Mintable`}</Text>
                                </VStack>
                            </HStack>
                            <VStack align="stretch" gap="4px">
                                <Text fontSize="12px" color="hg.text.faint" fontWeight="600">Token ID (denom)</Text>
                                <HStack gap="8px" px="10px" py="8px" borderRadius="10px" bg="hg.inset">
                                    <Code fontSize="12px" bg="transparent" color="hg.text.secondary" wordBreak="break-all" flex="1">{denom}</Code>
                                    <IconButton aria-label="Copy token ID" size="xs" variant="ghost" color="hg.link" onClick={copyDenom}>
                                        <LuCopy />
                                    </IconButton>
                                </HStack>
                            </VStack>
                            <HStack gap="4px" wrap="wrap" ms="-6px" fontSize="14px">
                                <AppLink app="dex" href={dexUrl}>DEX</AppLink>
                                <AppLink app="explorer" href={txUrl}>Explorer</AppLink>
                            </HStack>
                            <Text fontSize="12px" lineHeight="1.45" color="hg.text.faint" data-testid="launch-logo-note">
                                {"Why a logo isn't here: logos come from the Cosmos Chain Registry, not from the Factory. "}
                                {registry && (
                                    <Link
                                        href={registry.href}
                                        color="hg.link"
                                        _hover={{ color: 'hg.link.hover' }}
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

                        <VStack align="stretch" gap="10px">
                            <Button variant={hgVariant('primary')} size="xl" onClick={() => navigate(mainHref)}>
                                {returnTo ? `Back to ${returnTo.label}` : `Go to ${ticker}'s page`}
                            </Button>
                            <Button {...softButton} size="lg" onClick={() => navigate(marketHref)}>
                                Allow limit orders too
                            </Button>
                            <HStack gap="8px" justify="center" flexWrap="wrap">
                                <Button variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={reset}>
                                    Create another token
                                </Button>
                                <Button variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={() => navigate('/')}>
                                    Back to the Factory
                                </Button>
                            </HStack>
                        </VStack>
                    </VStack>
                </Grid>
            </FormFrame>
        </>
    )
}
