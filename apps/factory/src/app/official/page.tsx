"use client"

import React, { useEffect, useState } from 'react'
import { Box, Button, chakra, Code, Field, HStack, Input, Link, List, Text, VStack } from '@chakra-ui/react'
import { LuArrowUpRight, LuCopy, LuDownload, LuInfo, LuRefreshCw } from 'react-icons/lu'
import { GradientText, HgCard, Notice, PageContainer, PageState, Shimmer, hgVariant, useAsset, useToast } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
import { FormPage, GuidedForm, Question, useGuidedSteps } from '@/components/guided'
import { LogoStep } from '@/components/official/logo-step'
import { OfficialDone } from '@/components/official/official-done'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useRegistryListing } from '@/hooks/useRegistryListing'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import {
    AFTER_MERGE_COPY,
    ENTRY_FILE_NAME,
    type OfficialProgress,
    type OfficialStep,
    REGISTRY_REPO_URL,
    isHttpsUrl,
    isRegistryPrUrl,
    linksSummary,
    loadOfficialProgress,
    logoSummary,
    prSummary,
    registryChainName,
    registryEntryJson,
    saveOfficialProgress,
    suggestLogoFileName,
} from '@/lib/registry-entry'
import { workspaceHref } from '@/lib/workspace'

const STEP_KEYS = ['logo', 'links', 'entry', 'submit', 'review'] as const

const TELEGRAM_URL = 'https://t.me/BZEdgeOfficial'
const DISCORD_URL = 'https://discord.gg/wb68JV3QhZ'

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
    const listing = useRegistryListing(denom)

    // Client-only page (search params under Suspense): the saved progress seeds the first render,
    // so coming back reopens the first unfinished step.
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

    const ticker = asset?.ticker || metadata?.symbol || 'your token'
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
    const downloadEntry = () => {
        const url = URL.createObjectURL(new Blob([entryJson], { type: 'application/json' }))
        const a = document.createElement('a')
        a.href = url
        a.download = ENTRY_FILE_NAME
        a.click()
        URL.revokeObjectURL(url)
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

    if (listing.status === 'listed') {
        return <OfficialDone denom={denom} ticker={ticker} logo={listing.logo ?? asset?.logo} />
    }

    const entryButtons = (
        <>
            <Button {...softButton} size="sm" disabled={!metadata} onClick={copyEntry}>
                <LuCopy /> Copy
            </Button>
            <Button {...softButton} size="sm" disabled={!metadata} onClick={downloadEntry}>
                <LuDownload /> Download
            </Button>
        </>
    )

    const aside = (
        <SideCard title="Stuck? Ask in the BeeZee community">
            <HStack gap="16px">
                <Link href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" fontSize="14px" fontWeight="600" color="hg.link">Telegram <LuArrowUpRight /></Link>
                <Link href={DISCORD_URL} target="_blank" rel="noopener noreferrer" fontSize="14px" fontWeight="600" color="hg.link">Discord <LuArrowUpRight /></Link>
            </HStack>
        </SideCard>
    )

    return (
        <GuidedForm
            parent={{ href: workspaceHref(denom), label: ticker }}
            crumb="Get your logo in every wallet"
            title={<chakra.span wordBreak="break-word">{`Get ${ticker}'s logo in `}<GradientText>every wallet</GradientText></chakra.span>}
            subtitle={`Submit ${ticker} to the Cosmos Chain Registry. Free, nothing to sign.`}
            aside={aside}
        >
            {listing.status === 'off' && (
                <HgCard p="8px" data-testid="official-testnet">
                    <PageState
                        kind="empty"
                        title="The registry only lists mainnet tokens"
                        description={`You can prepare the files here, and submit them once ${ticker} is on mainnet.`}
                    />
                </HgCard>
            )}
            {listing.status === 'error' && (
                <Box data-testid="official-registry-error">
                    <Notice status="danger">
                        <HStack justify="space-between" gap="10px" flexWrap="wrap">
                            <Text>Couldn&apos;t reach the registry right now.</Text>
                            <Button size="xs" h="28px" variant={hgVariant('danger')} borderRadius="8px" fontSize="12px" onClick={listing.retry}><LuRefreshCw /> Retry</Button>
                        </HStack>
                    </Notice>
                </Box>
            )}
            <Text fontSize="14px" color="fg.muted" data-testid="official-progress">{`Your progress: ${doneCount} of 5 steps`}</Text>

            <Question
                title="Logo"
                question="Prepare your logo"
                {...steps.step('logo')}
                summary={logoSummary({ ...progress, fileName })}
            >
                <LogoStep
                    display={metadata?.display ?? ticker}
                    initial={{ format: progress.format, fileName: progress.fileName }}
                    onReady={(ready) => finish('logo', ready)}
                />
            </Question>

            <Question
                title="Links"
                question="Add your links (optional)"
                {...steps.step('links')}
                summary={linksSummary(progress.socials)}
                onBack={steps.back}
                action={{
                    label: 'Save links',
                    onClick: () => finish('links', { socials: { website: website.trim() || undefined, x: x.trim() || undefined } }),
                    disabled: websiteError || xError || (website.trim() === '' && x.trim() === ''),
                }}
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
                    <Button alignSelf="start" variant="ghost" color="hg.link" fontWeight="600" size="md" onClick={() => finish('links', { socials: undefined })}>
                        Skip
                    </Button>
                </VStack>
            </Question>

            <Question
                title="Entry"
                question="Copy your registry entry"
                {...steps.step('entry')}
                summary={(
                    <HStack as="span" gap="8px" flexWrap="wrap">
                        <span>assetlist.json entry ready</span>
                        {entryButtons}
                    </HStack>
                )}
                onBack={steps.back}
                action={{ label: 'Next step', onClick: () => finish('entry'), disabled: !metadata }}
            >
                <VStack align="stretch" gap="12px">
                    {metadata && !metadata.description.trim() && (
                        <Box data-testid="official-no-description">
                            <Notice status="warning">
                                {"Add a description first, it's shown in wallets. "}
                                <Link
                                    href={workspaceHref(denom, 'details')}
                                    color="hg.link"
                                    fontWeight="600"
                                    onClick={(e) => { e.preventDefault(); navigate(workspaceHref(denom, 'details')) }}
                                >
                                    Open Details and look
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
                    <HStack gap="8px">{entryButtons}</HStack>
                </VStack>
            </Question>

            <Question
                title="Submit"
                question="Send it to the registry"
                {...steps.step('submit')}
                summary={prSummary(progress.prUrl)}
                onBack={steps.back}
                action={{ label: 'Save the link', onClick: () => finish('submit', { prUrl: prUrl.trim() }), disabled: !isRegistryPrUrl(prUrl) }}
            >
                <VStack align="stretch" gap="12px">
                    <Text fontSize="14px" color="fg.muted">Needs a GitHub account.</Text>
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
                </VStack>
            </Question>

            <Question
                title="Review"
                question="Waiting for the registry team (usually a few days)"
                {...steps.step('review')}
                summary={`${ticker} is listed`}
                onBack={steps.back}
            >
                <VStack align="stretch" gap="8px">
                    {listing.status === 'loading' ? (
                        <Shimmer h="20px" w="288px" />
                    ) : listing.status === 'not-listed' && (
                        <HStack gap="10px" align="start" fontSize="14px" data-testid="official-not-listed">
                            <Box color="hg.link" mt="3px" flexShrink={0} aria-hidden><LuInfo size={16} /></Box>
                            <Text>{`Not in the registry yet. We check the registry for ${ticker}, and this page moves on when it's listed.`}</Text>
                        </HStack>
                    )}
                    {progress.prUrl && (
                        <Link href={progress.prUrl} target="_blank" rel="noopener noreferrer" fontSize="14px" fontWeight="600" color="hg.link">
                            Your request <LuArrowUpRight />
                        </Link>
                    )}
                    <Text fontSize="14px" color="fg.muted" data-testid="official-after-merge">{AFTER_MERGE_COPY}</Text>
                </VStack>
            </Question>
        </GuidedForm>
    )
}

export default function OfficialPage() {
    return (
        <FormPage>
            <OfficialContent />
        </FormPage>
    )
}
