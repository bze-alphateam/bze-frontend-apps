"use client"

import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { Box, Button, Circle, Container, Field, HStack, Input, Skeleton, Text, Textarea, VStack } from '@chakra-ui/react'
import { type TxSpec, getChainName, prettyAmount, toBigNumber, useCreationFees } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { GuidedForm, PayPanel, Question, TipNote, useGuidedSteps, useReturnTo } from '@/components/guided'
import { LaunchNextSteps } from '@/components/launch/launch-next-steps'
import { useCreateTokenTx } from '@/components/token-wizard/useCreateTokenTx'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { MAX_DESCRIPTION_LENGTH, TOKEN_DECIMALS } from '@/components/token-wizard/validation'
import { useFeePayment } from '@/hooks/useFeePayment'
import {
    EMPTY_TOKEN_FORM,
    TOKEN_FORM_KEYS,
    type TokenForm,
    type TokenFormStep,
    clearTokenDraft,
    isEmptyTokenForm,
    loadTokenDraft,
    saveTokenDraft,
} from '@/lib/token-draft'

const TX_KIND: TxSpec = ['create-denom', 'mint', 'set-denom-metadata']

const SUPPLY_PRESETS = [
    { label: '100,000', value: '100000' },
    { label: '1 million', value: '1000000' },
    { label: '100 million', value: '100000000' },
    { label: '1 billion', value: '1000000000' },
]

const SUMMARY_LENGTH = 80

type Touched = Partial<Record<'name' | 'symbol' | 'description' | 'initialSupply', boolean>>

function initials(name: string, symbol: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    const fromName = words.slice(0, 2).map(w => w[0]).join('')
    return (fromName || symbol.slice(0, 2) || '?').toUpperCase()
}

function TokenPreview({ form, ticker, supplyText, tokenId }: {
    form: TokenForm;
    ticker: string;
    supplyText: string;
    tokenId: string;
}) {
    return (
        <Box as="section" aria-label="Preview" p={4} borderRadius="xl" borderWidth="1px" borderColor="border" bg="bg.panel">
            <VStack align="stretch" gap={3}>
                <Text fontSize="sm" fontWeight="semibold">Preview</Text>
                <HStack gap={3} minW={0}>
                    <Circle size="10" bg="yellow.500/20" color="yellow.fg" fontWeight="bold" fontSize="sm" flexShrink={0}>
                        {initials(form.name, form.symbol)}
                    </Circle>
                    <VStack align="start" gap={0} minW={0}>
                        <Text fontWeight="semibold" wordBreak="break-word" data-testid="preview-name">
                            {form.name.trim() || 'Your token'}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">{ticker} · Mintable</Text>
                    </VStack>
                </HStack>
                {form.description.trim() && (
                    <Text fontSize="sm" color="fg.muted" wordBreak="break-word" lineClamp={4}>
                        {form.description.trim()}
                    </Text>
                )}
                <HStack justify="space-between" gap={3}>
                    <Text fontSize="sm" color="fg.muted">In your wallet</Text>
                    <Text fontSize="sm" fontWeight="semibold" textAlign="right" data-testid="preview-supply">
                        {supplyText} {ticker}
                    </Text>
                </HStack>
                <Text fontSize="xs" color="fg.muted" fontFamily="mono" wordBreak="break-all">{tokenId}</Text>
            </VStack>
        </Box>
    )
}

function TokenNewContent() {
    const { address } = useChain(getChainName())
    const { fees, isLoading: isFeeLoading } = useCreationFees()
    const returnTo = useReturnTo()

    // The page renders on the client only (search params under a Suspense boundary),
    // so the browser draft can seed the first render.
    const [draft] = useState(loadTokenDraft)
    const [form, setForm] = useState<TokenForm>(draft?.form ?? EMPTY_TOKEN_FORM)
    const [answered, setAnswered] = useState<TokenFormStep[]>(draft?.answered ?? [])
    const [touched, setTouched] = useState<Touched>({})
    const [created, setCreated] = useState<{ denom: string; txHash: string } | undefined>(undefined)

    const validation = useTokenWizardValidation(form)
    const { errors, subdenom, isIdentityValid, isDescriptionValid, isSupplyValid } = validation

    const steps = useGuidedSteps(TOKEN_FORM_KEYS, {
        identity: answered.includes('identity') && isIdentityValid,
        description: answered.includes('description') && isDescriptionValid,
        supply: answered.includes('supply') && isSupplyValid,
    })

    useEffect(() => {
        saveTokenDraft({ form, answered })
    }, [form, answered])

    const fee = fees.createDenomFee
    const { canPayFee, isLoading: isBalanceLoading } = useFeePayment(fee, TX_KIND)

    const onCreated = useCallback((denom: string, txHash: string) => {
        clearTokenDraft()
        setCreated({ denom, txHash })
    }, [])
    const { submit, isSubmitting } = useCreateTokenTx(form, onCreated)

    const update = (patch: Partial<TokenForm>) => setForm(prev => ({ ...prev, ...patch }))
    const touch = (field: keyof Touched) => setTouched(prev => ({ ...prev, [field]: true }))
    const errorFor = (field: keyof Touched) => (touched[field] ? errors[field] : '')

    const answer = (key: TokenFormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const startOver = () => {
        clearTokenDraft()
        setForm(EMPTY_TOKEN_FORM)
        setAnswered([])
        setTouched({})
        steps.close()
    }

    const ticker = form.symbol || 'TICKER'
    const tokenId = `factory/${address ?? '<your address>'}/${subdenom || '<subdenom>'}`
    const supplyText = isSupplyValid ? prettyAmount(toBigNumber(form.initialSupply)) : '0'
    const description = form.description.trim()

    const isComplete = TOKEN_FORM_KEYS.every(k => steps.state[k] === 'done') && validation.isValid
    const canConfirm = isComplete && Boolean(address) && Boolean(fee) && !isBalanceLoading && canPayFee

    if (created) {
        return (
            <LaunchNextSteps
                name={form.name}
                symbol={form.symbol}
                supply={form.initialSupply}
                denom={created.denom}
                txHash={created.txHash}
                returnTo={returnTo}
                reset={() => {
                    setCreated(undefined)
                    startOver()
                }}
            />
        )
    }

    const aside = (
        <>
            <TokenPreview form={form} ticker={ticker} supplyText={supplyText} tokenId={tokenId} />

            <PayPanel
                rows={[{ label: 'Token creation fee', coin: fee }]}
                moduleFee={fee}
                txKind={TX_KIND}
                isLoading={isFeeLoading}
                feeUnknown={!fee}
            />

            <VStack align="stretch" gap={2}>
                <Button
                    size="lg"
                    colorPalette="yellow"
                    onClick={submit}
                    disabled={!canConfirm}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    Create {form.symbol || 'token'}
                </Button>
                {!address ? (
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Connect your wallet to create this token.
                    </Text>
                ) : isComplete && !isBalanceLoading && !canPayFee && (
                    <Text fontSize="sm" color="fg.error" textAlign="center">
                        Not enough balance to cover the creation fee.
                    </Text>
                )}
            </VStack>
        </>
    )

    return (
        <GuidedForm
            title="Create my token"
            subtitle="Name it, pick a ticker and choose how many to create. Everything is shown before you sign."
            techTag="tokenfactory · create denom"
            status={!isEmptyTokenForm(form) && (
                <HStack gap={2}>
                    <Text>Draft saved in this browser</Text>
                    <Button variant="plain" size="xs" colorPalette="yellow" px={0} onClick={startOver}>
                        Start over
                    </Button>
                </HStack>
            )}
            aside={aside}
        >
            <Question
                number={1}
                title="Name and ticker"
                state={steps.state.identity}
                summary={`${form.name.trim()} (${form.symbol})`}
                onChange={() => steps.open('identity')}
            >
                <VStack align="stretch" gap={4}>
                    <Field.Root invalid={errorFor('name') !== ''}>
                        <Field.Label>Token name</Field.Label>
                        <Input
                            placeholder="e.g. Honey Coin"
                            value={form.name}
                            onChange={(e) => update({ name: e.target.value })}
                            onBlur={() => touch('name')}
                        />
                        <Field.ErrorText>{errorFor('name')}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root invalid={errorFor('symbol') !== ''}>
                        <Field.Label>Ticker</Field.Label>
                        <Input
                            placeholder="e.g. HONEY"
                            value={form.symbol}
                            onChange={(e) => update({ symbol: e.target.value.toUpperCase() })}
                            onBlur={() => touch('symbol')}
                        />
                        <Field.ErrorText>{errorFor('symbol')}</Field.ErrorText>
                    </Field.Root>
                    <Text fontSize="xs" color="fg.muted" fontFamily="mono" wordBreak="break-all">
                        Token ID: {tokenId}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                        {TOKEN_DECIMALS} decimals: 1 {ticker} = 1,000,000 base units
                    </Text>
                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!isIdentityValid} onClick={() => answer('identity')}>
                        Continue
                    </Button>
                </VStack>
            </Question>

            <Question
                number={2}
                title="Describe it"
                state={steps.state.description}
                summary={description
                    ? description.length > SUMMARY_LENGTH ? `${description.slice(0, SUMMARY_LENGTH)}…` : description
                    : 'No description'}
                onChange={() => steps.open('description')}
            >
                <VStack align="stretch" gap={4}>
                    <Field.Root invalid={errorFor('description') !== ''}>
                        <Field.Label>Description <Text as="span" color="fg.muted" fontWeight="normal">(optional)</Text></Field.Label>
                        <Textarea
                            rows={4}
                            placeholder="What is it for? Shown in wallets."
                            value={form.description}
                            onChange={(e) => update({ description: e.target.value })}
                            onBlur={() => touch('description')}
                        />
                        <Field.HelperText>{form.description.length} / {MAX_DESCRIPTION_LENGTH}</Field.HelperText>
                        <Field.ErrorText>{errorFor('description')}</Field.ErrorText>
                    </Field.Root>
                    <HStack gap={2}>
                        <Button colorPalette="yellow" size="sm" disabled={!isDescriptionValid} onClick={() => answer('description')}>
                            Continue
                        </Button>
                        <Button
                            variant="ghost"
                            colorPalette="yellow"
                            size="sm"
                            onClick={() => {
                                update({ description: '' })
                                answer('description')
                            }}
                        >
                            Skip
                        </Button>
                    </HStack>
                </VStack>
            </Question>

            <Question
                number={3}
                title={`How many ${form.symbol || 'tokens'} to create?`}
                state={steps.state.supply}
                summary={`${supplyText} ${ticker} to your wallet`}
                onChange={() => steps.open('supply')}
            >
                <VStack align="stretch" gap={4}>
                    <Text fontSize="sm" color="fg.muted">
                        All of it goes to your wallet when the token is created. You decide later how much to sell, pool or give away.
                    </Text>
                    <Field.Root invalid={errorFor('initialSupply') !== ''}>
                        <Field.Label>Amount</Field.Label>
                        <Input
                            placeholder="e.g. 1000000"
                            inputMode="decimal"
                            value={form.initialSupply}
                            onChange={(e) => update({ initialSupply: e.target.value })}
                            onBlur={() => touch('initialSupply')}
                        />
                        <Field.ErrorText>{errorFor('initialSupply')}</Field.ErrorText>
                    </Field.Root>
                    <HStack gap={2} flexWrap="wrap">
                        {SUPPLY_PRESETS.map(p => (
                            <Button
                                key={p.value}
                                size="xs"
                                variant={form.initialSupply === p.value ? 'solid' : 'outline'}
                                colorPalette="yellow"
                                borderRadius="full"
                                onClick={() => update({ initialSupply: p.value })}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </HStack>
                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!isSupplyValid} onClick={() => answer('supply')}>
                        Continue
                    </Button>
                </VStack>
            </Question>

            <TipNote lead={`You keep control of ${form.symbol || 'your token'}:`}>
                you can mint more, edit the description and set the brand kit. When your setup is done, you can lock
                the supply forever from the token&apos;s page. Buyers will see Mintable until then.
            </TipNote>
        </GuidedForm>
    )
}

export default function TokenNewPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="5xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <TokenNewContent />
                </Suspense>
            </Container>
        </Box>
    )
}
