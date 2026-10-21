"use client"

import React, { Suspense, useEffect, useState } from 'react'
import { Box, Button, Code, Field, Flex, HStack, Image, Input, Link, List, Text, VStack } from '@chakra-ui/react'
import { LuArrowUpRight, LuChevronRight, LuCircleCheck, LuCopy, LuInfo, LuRefreshCw } from 'react-icons/lu'
import { Eyebrow, GradientText, HeroGlow, HgCard, Notice, PageContainer, PageHero, PageState, Shimmer, hgVariant, useAsset, useToast } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
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
    // Listed is green, a failed lookup red; waiting and testnet sit on the plain card.
    const look = status === 'listed'
        ? { bg: 'hg.success/6', borderColor: 'hg.success/30' }
        : status === 'error'
            ? { bg: 'hg.danger/6', borderColor: 'hg.danger/30' }
            : { bg: 'hg.card', borderColor: 'hg.lineStrong' }
    return (
        <Box
            as="section"
            aria-label="Registry status"
            data-status={status}
            px="16px"
            py="14px"
            borderRadius="14px"
            borderWidth="1px"
            fontSize="14px"
            lineHeight="1.5"
            {...look}
        >
            {status === 'loading' && <Shimmer h="20px" w="288px" />}
            {status === 'listed' && (
                <HStack gap="10px">
                    {logo ? <Image src={logo} alt={`${ticker} logo`} boxSize="32px" borderRadius="full" /> : <Box color="hg.success" aria-hidden><LuCircleCheck size={18} /></Box>}
                    <Text fontWeight="700">{`Listed. ${ticker} is in the registry.`}</Text>
                </HStack>
            )}
            {status === 'not-listed' && (
                <HStack gap="10px" align="start">
                    <Box color="hg.link" mt="3px" flexShrink={0} aria-hidden><LuInfo size={16} /></Box>
                    <Text>{`Not in the registry yet. We check the registry for ${ticker}, and this turns green when it's listed.`}</Text>
                </HStack>
            )}
            {status === 'error' && (
                <HStack justify="space-between" gap="10px" flexWrap="wrap">
                    <Text>Couldn&apos;t reach the registry right now.</Text>
                    <Button size="xs" h="28px" variant={hgVariant('danger')} borderRadius="8px" fontSize="12px" onClick={onRetry}><LuRefreshCw /> Retry</Button>
                </HStack>
            )}
            {status === 'off' && (
                <Text color="fg.muted">The registry lists mainnet tokens only. You can read the guide here, but there is nothing to submit for a testnet token.</Text>
            )}
        </Box>
    )
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <HgCard as="section" aria-label={title} p="18px">
            <VStack align="stretch" gap="8px">
                <Text as="strong" fontSize="14px" fontWeight="700">{title}</Text>
                {children}
            </VStack>
        </HgCard>
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
            <PageContainer pt="32px" pb="64px">
                <HgCard p="16px">
                    <PageState
                        kind="not-found"
                        title="Open this guide from your token's page"
                        description="It works for tokens made in the Factory: the link needs the token ID."
                        action={<Button {...softButton} size="lg" onClick={() => navigate('/tokens')}>Your tokens</Button>}
                    />
                </HgCard>
            </PageContainer>
        )
    }

    const crumb = (label: string, href: string) => isMine
        ? <Link href={href} color="fg.muted" _hover={{ color: 'fg' }} onClick={(e) => { e.preventDefault(); navigate(href) }}>{label}</Link>
        : <Text as="span">{label}</Text>

    return (
        <>
            <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
                <HeroGlow strength="inner" />
                <PageContainer position="relative" pt={{ base: '24px', md: '28px' }} pb={{ base: '28px', md: '36px' }}>
                    <VStack align="stretch" gap="14px">
                        <HStack as="nav" aria-label="Breadcrumb" gap="6px" fontSize="14px" color="fg.muted" flexWrap="wrap">
                            {crumb(name, workspaceHref(denom))}
                            <LuChevronRight size={14} aria-hidden />
                            {crumb('Profile', workspaceHref(denom, 'profile'))}
                            <LuChevronRight size={14} aria-hidden />
                            <Text as="span" color="fg">Make it official</Text>
                        </HStack>
                        <PageHero
                            eyebrow={<Eyebrow app="factory" iconSize={24}>Make it official</Eyebrow>}
                            title={<Box as="span" wordBreak="break-word">{`Get ${ticker}'s logo into `}<GradientText>every wallet</GradientText></Box>}
                            subtitle={`Wallets, explorers and DEXes across Cosmos read token names and logos from one public list: the Cosmos Chain Registry on GitHub. Adding ${ticker} is free. You send a request with your logo, and the registry's maintainers review it.`}
                        />
                    </VStack>
                </PageContainer>
            </Box>

            <PageContainer as="main" pt="28px" pb="64px">
                <Flex wrap="wrap" gap="24px" align="flex-start">
                    <Box flex="999 1 640px" minW={0}>
                        <VStack align="stretch" gap="14px">
                            <StatusBanner status={listing.status} ticker={ticker} logo={listing.logo} onRetry={listing.retry} />
                            <Text fontSize="14px" color="fg.muted" data-testid="official-progress">{`Your progress: ${doneCount} of 5 steps`}</Text>

                            <Question title="Prepare your logo" {...steps.step('logo')} summary={fileName}>
                                <LogoStep
                                    display={metadata?.display ?? ticker}
                                    initial={{ format: progress.format, fileName: progress.fileName }}
                                    onReady={(ready) => finish('logo', ready)}
                                />
                            </Question>

                            <Question
                                title="Add your links (optional)"
                                {...steps.step('links')}
                                summary={[progress.socials?.website && 'Website', progress.socials?.x && 'X'].filter(Boolean).join(', ') || 'Skipped'}
                            >
                                <VStack align="stretch" gap="16px">
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
                                    <HStack gap="8px">
                                        <Button
                                            variant={hgVariant('primary')}
                                            size="md"
                                            disabled={websiteError || xError || (website.trim() === '' && x.trim() === '')}
                                            onClick={() => finish('links', { socials: { website: website.trim() || undefined, x: x.trim() || undefined } })}
                                        >
                                            Save links
                                        </Button>
                                        <Button variant="ghost" color="hg.link" fontWeight="600" size="md" onClick={() => finish('links', { socials: undefined })}>
                                            Skip
                                        </Button>
                                    </HStack>
                                </VStack>
                            </Question>

                            <Question title="Copy your registry entry" {...steps.step('entry')} summary="Copied">
                                <VStack align="stretch" gap="12px">
                                    <Text fontSize="14px" color="fg.muted">{`We wrote it for you from ${ticker}'s on-chain details. You won't need to edit it.`}</Text>
                                    {metadata && !metadata.description.trim() && (
                                        <Box data-testid="official-no-description">
                                            <Notice status="warning">
                                                {"Add a description first, it's shown in wallets. "}
                                                <Link
                                                    href={workspaceHref(denom, 'profile')}
                                                    color="hg.link"
                                                    fontWeight="600"
                                                    onClick={(e) => { e.preventDefault(); navigate(workspaceHref(denom, 'profile')) }}
                                                >
                                                    Open Profile
                                                </Link>
                                            </Notice>
                                        </Box>
                                    )}
                                    {isMetadataLoading ? <Shimmer h="160px" borderRadius="12px" /> : metadata ? (
                                        <Code
                                            as="pre"
                                            data-testid="official-entry"
                                            display="block"
                                            whiteSpace="pre"
                                            overflowX="auto"
                                            maxW="full"
                                            p="14px"
                                            fontSize="12px"
                                            borderRadius="12px"
                                            bg="hg.inset"
                                            color="fg"
                                            borderWidth="1px"
                                            borderColor="hg.hairline"
                                        >
                                            {entryJson}
                                        </Code>
                                    ) : (
                                        <Text fontSize="14px" color="fg.error">{`Couldn't read ${ticker}'s on-chain details. Reload the page to try again.`}</Text>
                                    )}
                                    <HStack gap="8px">
                                        <Button {...softButton} disabled={!metadata} onClick={copyEntry}>
                                            <LuCopy /> Copy
                                        </Button>
                                        <Button variant={hgVariant('primary')} size="md" disabled={!metadata} onClick={() => finish('entry')}>
                                            Next step
                                        </Button>
                                    </HStack>
                                </VStack>
                            </Question>

                            <Question
                                title="Send it to the registry"
                                {...steps.step('submit')}
                                summary={progress.prUrl ? `Your request #${progress.prUrl.split('/').pop()}` : ''}
                            >
                                <VStack align="stretch" gap="12px">
                                    <Text fontSize="14px" color="fg.muted">You need a free GitHub account. Everything happens in the browser, no coding.</Text>
                                    <List.Root as="ol" fontSize="14px" lineHeight="1.5" ps="20px" gap="8px">
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
                                    <Button asChild alignSelf="start" {...softButton}>
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
                                        variant={hgVariant('primary')}
                                        size="md"
                                        disabled={!isRegistryPrUrl(prUrl)}
                                        onClick={() => finish('submit', { prUrl: prUrl.trim() })}
                                    >
                                        Save the link
                                    </Button>
                                </VStack>
                            </Question>

                            <Question title="Wait for the review" {...steps.step('review')} onEdit={undefined} summary={`${ticker} is listed`}>
                                <VStack align="stretch" gap="8px">
                                    {progress.prUrl && (
                                        <Link href={progress.prUrl} target="_blank" rel="noopener noreferrer" fontSize="14px" fontWeight="600" color="hg.link">
                                            Your request <LuArrowUpRight />
                                        </Link>
                                    )}
                                    <Text fontSize="14px" color="fg.muted">The maintainers review requests as they come in. It can take from a few days to a few weeks.</Text>
                                    <Text fontSize="14px" color="fg.muted" data-testid="official-after-merge">{AFTER_MERGE_COPY}</Text>
                                </VStack>
                            </Question>
                        </VStack>
                    </Box>

                    <Box as="aside" flex="1 1 300px" maxW={{ base: 'none', lg: '360px' }} minW={0}>
                        <VStack align="stretch" gap="14px">
                            <SideCard title="Why it matters">
                                <Text fontSize="14px" lineHeight="1.55" color="fg.muted">
                                    {`Without an entry, most wallets show ${ticker} as a long factory/… code with no logo. That looks like a scam, even when it isn't.`}
                                </Text>
                            </SideCard>
                            <SideCard title="Common reasons a request is sent back">
                                <List.Root fontSize="14px" lineHeight="1.5" color="fg.muted" ps="18px" gap="4px">
                                    <List.Item>The logo isn&apos;t square, or is over 250 KB.</List.Item>
                                    <List.Item>A JPG renamed to .png.</List.Item>
                                    <List.Item>An upper-case file name.</List.Item>
                                    <List.Item>A missing comma in the list.</List.Item>
                                </List.Root>
                            </SideCard>
                            <SideCard title="Stuck? Ask in the BeeZee community">
                                <HStack gap="16px">
                                    <Link href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" fontSize="14px" fontWeight="600" color="hg.link">Telegram <LuArrowUpRight /></Link>
                                    <Link href={DISCORD_URL} target="_blank" rel="noopener noreferrer" fontSize="14px" fontWeight="600" color="hg.link">Discord <LuArrowUpRight /></Link>
                                </HStack>
                            </SideCard>
                        </VStack>
                    </Box>
                </Flex>
            </PageContainer>
        </>
    )
}

export default function OfficialPage() {
    return (
        <Box minH="100vh">
            <Suspense fallback={<PageContainer pt="28px"><Shimmer h="384px" borderRadius="16px" /></PageContainer>}>
                <OfficialContent />
            </Suspense>
        </Box>
    )
}
