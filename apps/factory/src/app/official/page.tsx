"use client"

import React, { Suspense, useEffect, useState } from 'react'
import { Box, Button, Card, Code, Container, Field, Grid, GridItem, HStack, Image, Input, Link, List, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuArrowUpRight, LuChevronRight, LuCircleCheck, LuCopy, LuRefreshCw, LuTriangleAlert } from 'react-icons/lu'
import { useAsset, useToast } from '@bze/bze-ui-kit'
import { Question, useGuidedSteps } from '@/components/guided'
import { LogoStep } from '@/components/official/logo-step'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useRegistryListing } from '@/hooks/useRegistryListing'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import {
    AFTER_MERGE_COPY,
    type OfficialProgress,
    type OfficialStep,
    REGISTRY_REPO_URL,
    isHttpsUrl,
    isRegistryPrUrl,
    loadOfficialProgress,
    registryChainName,
    registryEntryJson,
    saveOfficialProgress,
    suggestLogoFileName,
} from '@/lib/registry-entry'
import { workspaceHref } from '@/lib/workspace'

const STEP_KEYS = ['logo', 'links', 'entry', 'submit', 'review'] as const

const TELEGRAM_URL = 'https://t.me/BZEdgeOfficial'
const DISCORD_URL = 'https://discord.gg/wb68JV3QhZ'

function StatusBanner({ status, ticker, logo, onRetry }: {
    status: ReturnType<typeof useRegistryListing>['status'];
    ticker: string;
    logo?: string;
    onRetry: () => void;
}) {
    const palette = status === 'listed' ? 'green' : status === 'error' ? 'red' : status === 'off' ? 'gray' : 'blue'
    return (
        <Box
            as="section"
            aria-label="Registry status"
            data-status={status}
            p={4}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={`${palette}.500/30`}
            bg={`${palette}.500/8`}
        >
            {status === 'loading' && <Skeleton height="5" width="72" />}
            {status === 'listed' && (
                <HStack gap={3}>
                    {logo ? <Image src={logo} alt={`${ticker} logo`} boxSize="8" borderRadius="full" /> : <Box color="green.600"><LuCircleCheck size={20} /></Box>}
                    <Text fontWeight="semibold">{`Listed. ${ticker} is in the registry.`}</Text>
                </HStack>
            )}
            {status === 'not-listed' && (
                <Text fontSize="sm">{`Not in the registry yet. We check the registry for ${ticker}, and this turns green when it's listed.`}</Text>
            )}
            {status === 'error' && (
                <HStack justify="space-between" gap={3} flexWrap="wrap">
                    <Text fontSize="sm">Couldn&apos;t reach the registry right now.</Text>
                    <Button size="xs" variant="outline" colorPalette="red" onClick={onRetry}><LuRefreshCw /> Retry</Button>
                </HStack>
            )}
            {status === 'off' && (
                <Text fontSize="sm">The registry lists mainnet tokens only. You can read the guide here, but there is nothing to submit for a testnet token.</Text>
            )}
        </Box>
    )
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card.Root as="section" aria-label={title} variant="outline" p={4}>
            <VStack align="stretch" gap={2}>
                <Text fontSize="sm" fontWeight="semibold">{title}</Text>
                {children}
            </VStack>
        </Card.Root>
    )
}

function OfficialContent() {
    const { denomParam, navigate } = useNavigationWithParams()
    const denom = denomParam ?? ''
    const { toast } = useToast()
    const { asset } = useAsset(denom)
    const { metadata, isLoading: isMetadataLoading } = useTokenMetadata(denom)
    const { tokens } = useMyTokens()
    const listing = useRegistryListing(denom)

    // Client-only page (search params under Suspense): the saved progress seeds the first render.
    const [progress, setProgress] = useState<OfficialProgress>(() => loadOfficialProgress(denom))
    useEffect(() => {
        if (denom) saveOfficialProgress(denom, progress)
    }, [denom, progress])

    const [website, setWebsite] = useState(progress.socials?.website ?? '')
    const [x, setX] = useState(progress.socials?.x ?? '')
    const [prUrl, setPrUrl] = useState(progress.prUrl ?? '')

    const isDone = (step: OfficialStep) => progress.done.includes(step)
    const steps = useGuidedSteps(STEP_KEYS, {
        logo: isDone('logo'),
        links: isDone('links'),
        entry: isDone('entry'),
        submit: isDone('submit') && Boolean(progress.prUrl),
        review: listing.status === 'listed',
    })
    const doneCount = STEP_KEYS.filter(k => steps.state[k] === 'done').length

    const finish = (step: OfficialStep, patch: Partial<OfficialProgress> = {}) => {
        setProgress(prev => ({ ...prev, ...patch, done: prev.done.includes(step) ? prev.done : [...prev.done, step] }))
        steps.close()
    }

    const name = asset?.name || metadata?.name || denom
    const ticker = asset?.ticker || metadata?.symbol || 'your token'
    const isMine = tokens.some(t => t.asset.denom === denom)
    const format = progress.format ?? 'svg'
    const fileName = progress.fileName ?? suggestLogoFileName(metadata?.display ?? ticker, format)
    const entryJson = metadata ? registryEntryJson(metadata, { format, fileName, socials: progress.socials }) : ''

    const websiteError = website.trim() !== '' && !isHttpsUrl(website)
    const xError = x.trim() !== '' && !isHttpsUrl(x)
    const prError = prUrl.trim() !== '' && !isRegistryPrUrl(prUrl)

    const copyEntry = async () => {
        await navigator.clipboard.writeText(entryJson)
        toast.success('Copied', 'Your registry entry is on the clipboard.')
    }

    if (!denom.startsWith('factory/')) {
        return (
            <Card.Root variant="outline" p={8}>
                <VStack gap={3}>
                    <Text fontWeight="semibold">Open this guide from your token&apos;s page</Text>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">It works for tokens made in the Factory: the link needs the token ID.</Text>
                    <Button colorPalette="yellow" variant="outline" onClick={() => navigate('/manage')}>Your tokens</Button>
                </VStack>
            </Card.Root>
        )
    }

    const crumb = (label: string, href: string) => isMine
        ? <Link href={href} color="yellow.fg" onClick={(e) => { e.preventDefault(); navigate(href) }}>{label}</Link>
        : <Text as="span">{label}</Text>

    return (
        <VStack align="stretch" gap={6}>
            <HStack as="nav" aria-label="Breadcrumb" gap={1} fontSize="sm" color="fg.muted" flexWrap="wrap">
                {crumb(name, workspaceHref(denom))}
                <LuChevronRight size={14} />
                {crumb('Profile', workspaceHref(denom, 'profile'))}
                <LuChevronRight size={14} />
                <Text as="span" color="fg">Make it official</Text>
            </HStack>

            <VStack align="start" gap={2}>
                <Text as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" letterSpacing="tight" wordBreak="break-word">
                    {`Get ${ticker}'s logo into every wallet`}
                </Text>
                <Text color="fg.muted">
                    {`Wallets, explorers and DEXes across Cosmos read token names and logos from one public list: the Cosmos Chain Registry on GitHub. Adding ${ticker} is free. You send a request with your logo, and the registry's maintainers review it.`}
                </Text>
            </VStack>

            <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' }} gap={6} alignItems="start">
                <GridItem minW={0}>
                    <VStack align="stretch" gap={3}>
                        <StatusBanner status={listing.status} ticker={ticker} logo={listing.logo} onRetry={listing.retry} />
                        <Text fontSize="sm" color="fg.muted" data-testid="official-progress">{`Your progress: ${doneCount} of 5 steps`}</Text>

                        <Question number={1} title="Prepare your logo" state={steps.state.logo} summary={fileName} onChange={() => steps.open('logo')}>
                            <LogoStep
                                display={metadata?.display ?? ticker}
                                initial={{ format: progress.format, fileName: progress.fileName }}
                                onReady={(ready) => finish('logo', ready)}
                            />
                        </Question>

                        <Question
                            number={2}
                            title="Add your links (optional)"
                            state={steps.state.links}
                            summary={[progress.socials?.website && 'Website', progress.socials?.x && 'X'].filter(Boolean).join(', ') || 'Skipped'}
                            onChange={() => steps.open('links')}
                        >
                            <VStack align="stretch" gap={4}>
                                <Field.Root invalid={websiteError}>
                                    <Field.Label>Website</Field.Label>
                                    <Input placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
                                    <Field.ErrorText>Use a full https:// link.</Field.ErrorText>
                                </Field.Root>
                                <Field.Root invalid={xError}>
                                    <Field.Label>X (Twitter)</Field.Label>
                                    <Input placeholder="https://x.com/…" value={x} onChange={(e) => setX(e.target.value)} />
                                    <Field.ErrorText>Use a full https:// link.</Field.ErrorText>
                                </Field.Root>
                                <HStack gap={2}>
                                    <Button
                                        colorPalette="yellow"
                                        size="sm"
                                        disabled={websiteError || xError || (website.trim() === '' && x.trim() === '')}
                                        onClick={() => finish('links', { socials: { website: website.trim() || undefined, x: x.trim() || undefined } })}
                                    >
                                        Save links
                                    </Button>
                                    <Button variant="ghost" colorPalette="yellow" size="sm" onClick={() => finish('links', { socials: undefined })}>
                                        Skip
                                    </Button>
                                </HStack>
                            </VStack>
                        </Question>

                        <Question number={3} title="Copy your registry entry" state={steps.state.entry} summary="Copied" onChange={() => steps.open('entry')}>
                            <VStack align="stretch" gap={3}>
                                <Text fontSize="sm" color="fg.muted">{`We wrote it for you from ${ticker}'s on-chain details. You won't need to edit it.`}</Text>
                                {metadata && !metadata.description.trim() && (
                                    <HStack gap={2} align="start" p={3} borderRadius="lg" bg="orange.500/10" data-testid="official-no-description">
                                        <Box color="orange.500" mt={0.5}><LuTriangleAlert size={16} /></Box>
                                        <Text fontSize="sm">
                                            {"Add a description first, it's shown in wallets. "}
                                            <Link
                                                href={workspaceHref(denom, 'profile')}
                                                color="yellow.fg"
                                                onClick={(e) => { e.preventDefault(); navigate(workspaceHref(denom, 'profile')) }}
                                            >
                                                Open Profile
                                            </Link>
                                        </Text>
                                    </HStack>
                                )}
                                {isMetadataLoading ? <Skeleton height="40" /> : metadata ? (
                                    <Code
                                        as="pre"
                                        data-testid="official-entry"
                                        display="block"
                                        whiteSpace="pre"
                                        overflowX="auto"
                                        maxW="full"
                                        p={3}
                                        fontSize="xs"
                                        borderRadius="md"
                                    >
                                        {entryJson}
                                    </Code>
                                ) : (
                                    <Text fontSize="sm" color="fg.error">{`Couldn't read ${ticker}'s on-chain details. Reload the page to try again.`}</Text>
                                )}
                                <HStack gap={2}>
                                    <Button size="sm" colorPalette="yellow" variant="outline" disabled={!metadata} onClick={copyEntry}>
                                        <LuCopy /> Copy
                                    </Button>
                                    <Button size="sm" colorPalette="yellow" disabled={!metadata} onClick={() => finish('entry')}>
                                        Next step
                                    </Button>
                                </HStack>
                            </VStack>
                        </Question>

                        <Question
                            number={4}
                            title="Send it to the registry"
                            state={steps.state.submit}
                            summary={progress.prUrl ? `Your request #${progress.prUrl.split('/').pop()}` : ''}
                            onChange={() => steps.open('submit')}
                        >
                            <VStack align="stretch" gap={3}>
                                <Text fontSize="sm" color="fg.muted">You need a free GitHub account. Everything happens in the browser, no coding.</Text>
                                <List.Root as="ol" fontSize="sm" ps={5} gap={2}>
                                    <List.Item>Open the registry on GitHub and click <b>Fork</b>. That makes your own copy.</List.Item>
                                    <List.Item>
                                        {'In your copy, open the '}<Code fontSize="xs">{`${registryChainName()}/images`}</Code>
                                        {' folder, choose '}<b>Add file → Upload files</b>{' and upload '}<Code fontSize="xs">{fileName}</Code>.
                                    </List.Item>
                                    <List.Item>
                                        {'Open '}<Code fontSize="xs">{`${registryChainName()}/assetlist.json`}</Code>
                                        {', click the pencil, and paste your entry as the last item of '}<Code fontSize="xs">&quot;assets&quot;</Code>
                                        {'. Put a comma after the item before it.'}
                                    </List.Item>
                                    <List.Item>
                                        {'Click '}<b>Commit changes</b>{', then '}<b>Contribute → Open pull request</b>
                                        {'. Title it '}<Code fontSize="xs">{`Add ${ticker} to ${registryChainName()}`}</Code>.
                                    </List.Item>
                                </List.Root>
                                <Button asChild alignSelf="start" size="sm" variant="outline" colorPalette="yellow">
                                    <a href={REGISTRY_REPO_URL} target="_blank" rel="noopener noreferrer">
                                        Open the registry on GitHub <LuArrowUpRight />
                                    </a>
                                </Button>
                                <Field.Root invalid={prError}>
                                    <Field.Label>Paste your pull request link so we can follow it for you</Field.Label>
                                    <Input placeholder="https://github.com/cosmos/chain-registry/pull/…" value={prUrl} onChange={(e) => setPrUrl(e.target.value)} />
                                    <Field.ErrorText>A link like https://github.com/cosmos/chain-registry/pull/1234</Field.ErrorText>
                                </Field.Root>
                                <Button
                                    alignSelf="start"
                                    size="sm"
                                    colorPalette="yellow"
                                    disabled={!isRegistryPrUrl(prUrl)}
                                    onClick={() => finish('submit', { prUrl: prUrl.trim() })}
                                >
                                    Save the link
                                </Button>
                            </VStack>
                        </Question>

                        <Question number={5} title="Wait for the review" state={steps.state.review} summary={`${ticker} is listed`}>
                            <VStack align="stretch" gap={2}>
                                {progress.prUrl && (
                                    <Link href={progress.prUrl} target="_blank" rel="noopener noreferrer" fontSize="sm" color="yellow.fg">
                                        Your request <LuArrowUpRight />
                                    </Link>
                                )}
                                <Text fontSize="sm" color="fg.muted">The maintainers review requests as they come in. It can take from a few days to a few weeks.</Text>
                                <Text fontSize="sm" color="fg.muted" data-testid="official-after-merge">{AFTER_MERGE_COPY}</Text>
                            </VStack>
                        </Question>
                    </VStack>
                </GridItem>

                <GridItem minW={0}>
                    <VStack align="stretch" gap={4}>
                        <SideCard title="Why it matters">
                            <Text fontSize="sm" color="fg.muted">
                                {`Without an entry, most wallets show ${ticker} as a long factory/… code with no logo. That looks like a scam, even when it isn't.`}
                            </Text>
                        </SideCard>
                        <SideCard title="Common reasons a request is sent back">
                            <List.Root fontSize="sm" color="fg.muted" ps={5} gap={1}>
                                <List.Item>The logo isn&apos;t square, or is over 250 KB.</List.Item>
                                <List.Item>A JPG renamed to .png.</List.Item>
                                <List.Item>An upper-case file name.</List.Item>
                                <List.Item>A missing comma in the list.</List.Item>
                            </List.Root>
                        </SideCard>
                        <SideCard title="Stuck? Ask in the BeeZee community">
                            <HStack gap={4}>
                                <Link href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" fontSize="sm" color="yellow.fg">Telegram <LuArrowUpRight /></Link>
                                <Link href={DISCORD_URL} target="_blank" rel="noopener noreferrer" fontSize="sm" color="yellow.fg">Discord <LuArrowUpRight /></Link>
                            </HStack>
                        </SideCard>
                    </VStack>
                </GridItem>
            </Grid>
        </VStack>
    )
}

export default function OfficialPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="5xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <OfficialContent />
                </Suspense>
            </Container>
        </Box>
    )
}
