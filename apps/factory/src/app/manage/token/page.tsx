"use client"

import React, { Suspense, useMemo, useState } from 'react'
import {
    Badge,
    Box,
    Button,
    Card,
    Container,
    Field,
    Grid,
    HStack,
    IconButton,
    Input,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuArrowLeft, LuCopy, LuFlame, LuLock, LuPlus, LuSearchX, LuTriangleAlert } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    Asset,
    TokenLogo,
    amountToUAmount,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useBalance,
    useToast,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { AdminActions } from '@/components/manage/admin-card'
import { MetadataCard } from '@/components/manage/metadata-card'
import { InfoBox } from '@/components/ui/info-box'
import { validateAmount } from '@/components/token-wizard/validation'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { useTokenSupply } from '@/hooks/useTokenSupply'

const { mint, burn } = bze.tokenfactory.MessageComposer.withTypeUrl

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <Card.Root variant="outline" p="4" flex="1" minW="40">
            <VStack align="start" gap="1">
                <Text fontSize="xs" color="fg.muted">
                    {label}
                </Text>
                <Box fontSize="sm" fontWeight="semibold" wordBreak="break-all">
                    {value}
                </Box>
            </VStack>
        </Card.Root>
    )
}

/**
 * Mint and burn share the same card shape: amount input, live new-total-supply
 * preview, one tx. Burn is additionally capped by the admin's own balance —
 * the tokenfactory can only burn coins the admin holds.
 */
function SupplyActionCard({
    asset,
    currentSupply,
    mode,
    onDone,
}: {
    asset: Asset;
    /** Current total supply in display units. */
    currentSupply: BigNumber;
    mode: 'mint' | 'burn';
    onDone: () => void;
}) {
    const isMint = mode === 'mint'
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { balance } = useBalance(asset.denom)

    const [amount, setAmount] = useState('')
    const [touched, setTouched] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const balanceDisplay = uAmountToBigNumberAmount(balance.amount, asset.decimals)

    const error = useMemo(() => {
        const base = validateAmount(amount, asset.decimals)
        if (base) return base
        if (!isMint && balance.amount.lt(amountToUAmount(amount, asset.decimals))) {
            return 'You can only burn tokens you hold — the amount exceeds your balance.'
        }
        return ''
    }, [amount, asset.decimals, isMint, balance])

    const newSupply = useMemo(() => {
        if (error || !amount.trim()) return undefined
        return isMint ? currentSupply.plus(amount) : currentSupply.minus(amount)
    }, [error, amount, isMint, currentSupply])

    const submit = async () => {
        if (!address || error) return

        const coins = `${amountToUAmount(amount, asset.decimals)}${asset.denom}`
        const msg = isMint
            ? mint({ creator: address, coins })
            : burn({ creator: address, coins })

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: () => {
                    setAmount('')
                    setTouched(false)
                    onDone()
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card.Root
            variant="outline"
            p="5"
            bgGradient="to-br"
            gradientFrom="yellow.500/8"
            gradientTo="yellow.600/8"
            borderColor="yellow.500/20"
        >
            <VStack align="stretch" gap={4}>
                <HStack gap={2}>
                    <Box p={2} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                        {isMint ? <LuPlus size={18} /> : <LuFlame size={18} />}
                    </Box>
                    <Text fontWeight="semibold">{isMint ? 'Mint more' : 'Burn tokens'}</Text>
                </HStack>

                <Field.Root invalid={touched && error !== ''}>
                    <Field.Label>Amount</Field.Label>
                    <Input
                        placeholder="e.g. 1000"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />
                    <Field.HelperText>
                        {newSupply
                            ? `New total supply: ${prettyAmount(newSupply)} ${asset.ticker}`
                            : isMint
                                ? 'Minted to your address and added to the total supply.'
                                : `Burned from your balance (${prettyAmount(balanceDisplay)} ${asset.ticker}).`}
                    </Field.HelperText>
                    <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>

                <Button
                    colorPalette={isMint ? 'yellow' : 'red'}
                    variant={isMint ? 'solid' : 'outline'}
                    onClick={submit}
                    disabled={error !== '' || !amount.trim()}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    {isMint ? 'Mint' : 'Burn'}
                </Button>

                <InfoBox>
                    {isMint
                        ? 'Minting increases the total supply — holders are diluted. The new tokens land in your wallet.'
                        : 'Burning permanently destroys tokens from YOUR balance and lowers the total supply. It cannot touch anyone else’s tokens.'}
                </InfoBox>
            </VStack>
        </Card.Root>
    )
}

function TokenManageContent() {
    const { denomParam, navigate } = useNavigationWithParams()
    const denom = denomParam ?? ''
    const { tokens, isLoading, refreshAdmins } = useMyTokens()
    const { address } = useChain(getChainName())
    const { supply, isLoading: isSupplyLoading, refresh } = useTokenSupply(denom)
    const { metadata, isLoading: isMetadataLoading, refresh: refreshMetadata } = useTokenMetadata(denom)
    const { balance } = useBalance(denom)
    const { toast } = useToast()

    const token = tokens.find(t => t.asset.denom === denom)

    if (isLoading) {
        return (
            <VStack align="stretch" gap={4}>
                <Skeleton height="10" width="64" />
                <Skeleton height="24" />
                <Skeleton height="48" />
            </VStack>
        )
    }

    if (!token) {
        return (
            <Card.Root variant="outline" p="10">
                <VStack gap={4}>
                    <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                        <LuSearchX size={28} />
                    </Box>
                    <VStack gap={1}>
                        <Text fontWeight="semibold">Token not found</Text>
                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                            This token doesn&apos;t belong to your connected address — only the creator
                            can manage a token here. Check the wallet you&apos;re connected with.
                        </Text>
                    </VStack>
                    <Button colorPalette="yellow" variant="outline" onClick={() => navigate('/manage')}>
                        <LuArrowLeft />
                        Back to My Tokens
                    </Button>
                </VStack>
            </Card.Root>
        )
    }

    const asset = token.asset
    const isRenounced = token.admin === ''
    const isAdmin = Boolean(address) && token.admin === address

    // Live supply (refreshed after every mint/burn), asset snapshot as fallback.
    const supplyDisplay = uAmountToBigNumberAmount(supply ?? asset.supply, asset.decimals)

    const copyDenom = async () => {
        await navigator.clipboard.writeText(asset.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    return (
        <VStack align="stretch" gap={6}>
            <Box>
                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={() => navigate('/manage')}>
                    <LuArrowLeft />
                    My Tokens
                </Button>
            </Box>

            <HStack gap="3" flexWrap="wrap">
                <TokenLogo src={asset.logo} symbol={asset.ticker} size="12" circular={true} />
                <VStack align="start" gap="0.5">
                    <HStack gap="2">
                        <Text fontSize="xl" fontWeight="bold">
                            {asset.name}
                        </Text>
                        <Text color="fg.muted">{asset.ticker}</Text>
                        {isRenounced ? (
                            <Badge colorPalette="green" variant="surface" size="sm">
                                <LuLock size={12} /> Fixed supply
                            </Badge>
                        ) : (
                            <Badge colorPalette="orange" variant="surface" size="sm">
                                <LuTriangleAlert size={12} /> Mintable
                            </Badge>
                        )}
                    </HStack>
                    <HStack gap="1">
                        <Text fontSize="xs" color="fg.muted" fontFamily="mono" wordBreak="break-all">
                            {asset.denom}
                        </Text>
                        <IconButton aria-label="Copy denom" size="2xs" variant="ghost" colorPalette="yellow" onClick={copyDenom}>
                            <LuCopy />
                        </IconButton>
                    </HStack>
                </VStack>
            </HStack>

            <HStack gap={3} flexWrap="wrap" align="stretch">
                <StatBox
                    label="Total supply"
                    value={
                        isSupplyLoading
                            ? <Skeleton height="4" width="24" />
                            : `${prettyAmount(supplyDisplay)} ${asset.ticker}`
                    }
                />
                <StatBox
                    label="Your balance"
                    value={`${prettyAmount(uAmountToBigNumberAmount(balance.amount, asset.decimals))} ${asset.ticker}`}
                />
                <StatBox
                    label="Admin"
                    value={isRenounced ? 'Nobody — renounced' : isAdmin ? 'You' : token.admin}
                />
            </HStack>

            {isAdmin ? (
                <>
                    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                        <SupplyActionCard asset={asset} currentSupply={supplyDisplay} mode="mint" onDone={refresh} />
                        <SupplyActionCard asset={asset} currentSupply={supplyDisplay} mode="burn" onDone={refresh} />
                    </Grid>
                    <MetadataCard
                        asset={asset}
                        metadata={metadata}
                        isLoading={isMetadataLoading}
                        onSaved={refreshMetadata}
                    />
                    <AdminActions asset={asset} onChanged={refreshAdmins} />
                </>
            ) : isRenounced ? (
                <InfoBox title="Supply provably fixed">
                    The admin of this token was renounced — nobody, including you, can mint more
                    tokens or change its metadata. That&apos;s the guarantee holders rely on.
                </InfoBox>
            ) : (
                <InfoBox title="You are not the admin">
                    You created this token, but its admin is now {token.admin}. Only the current
                    admin can mint, burn, or update it.
                </InfoBox>
            )}
        </VStack>
    )
}

export default function ManageTokenPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="4xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="64" />}>
                    <TokenManageContent />
                </Suspense>
            </Container>
        </Box>
    )
}
