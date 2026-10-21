"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { Button, chakra, Circle, Field, Grid, HStack, IconButton, Input, Text, Textarea, VStack } from '@chakra-ui/react'
import { LuCopy } from 'react-icons/lu'
import { GradientText, type TxSpec, getChainName, prettyAmount, toBigNumber, useCreationFees, useToast } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import {
    AnswerChip,
    AnswerChips,
    ContinueRow,
    FormPage,
    GuidedForm,
    Hint,
    Optional,
    PayPanel,
    Question,
    SubmitBlock,
    SubmitNote,
    TipNote,
    useGuidedSteps,
    useReturnTo,
} from '@/components/guided'
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
    const { toast } = useToast()
    // The address and the subdenom are both in: the ID is the one the chain will create.
    const tokenIdKnown = !tokenId.includes('<')
    const copyTokenId = async () => {
        await navigator.clipboard.writeText(tokenId)
        toast.success('Copied', 'Token ID copied to clipboard.')
    }

    return (
        <VStack
            as="section"
            aria-label="Preview"
            align="stretch"
            gap="12px"
            p="18px"
            borderRadius="hg.lg"
            borderWidth="1px"
            borderColor="hg.hairline"
            bg="hg.card"
        >
            <chakra.h3 m="0" fontSize="14px" fontWeight="700">Preview</chakra.h3>
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
                    {initials(form.name, form.symbol)}
                </Circle>
                <VStack align="start" gap="2px" minW={0}>
                    <Text fontWeight="700" wordBreak="break-word" data-testid="preview-name">
                        {form.name.trim() || 'Your token'}
                    </Text>
                    <Text fontSize="12px" color="hg.text.faint">{ticker} · Mintable</Text>
                </VStack>
            </HStack>
            {form.description.trim() && (
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted" wordBreak="break-word" lineClamp={4}>
                    {form.description.trim()}
                </Text>
            )}
            <VStack align="stretch" gap="10px">
                <HStack justify="space-between" gap="12px">
                    <Text fontSize="14px" color="fg.muted">In your wallet</Text>
                    <Text fontSize="14px" fontWeight="600" textAlign="right" data-testid="preview-supply">
                        {supplyText} {ticker}
                    </Text>
                </HStack>
                <HStack justify="space-between" gap="12px">
                    <Text fontSize="14px" color="fg.muted">Decimals</Text>
                    <Text fontSize="14px" fontWeight="600" data-testid="preview-decimals">{TOKEN_DECIMALS}</Text>
                </HStack>
            </VStack>
            <HStack gap="4px" align="center">
                <Text flex="1" minW={0} fontSize="12px" color="hg.text.faint" fontFamily="mono" wordBreak="break-all">{tokenId}</Text>
                {tokenIdKnown && (
                    <IconButton aria-label="Copy token ID" size="2xs" variant="ghost" color="hg.link" onClick={() => void copyTokenId()}>
                        <LuCopy />
                    </IconButton>
                )}
            </HStack>
        </VStack>
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

            <SubmitBlock label={`Create ${form.symbol || 'token'}`} onClick={submit} disabled={!canConfirm} loading={isSubmitting}>
                {!address ? (
                    <SubmitNote>Connect your wallet to create this token.</SubmitNote>
                ) : isComplete && !isBalanceLoading && !canPayFee && (
                    <SubmitNote tone="error">Not enough balance to cover the creation fee.</SubmitNote>
                )}
            </SubmitBlock>
        </>
    )

    return (
        <GuidedForm
            crumb="Token"
            title={<>Create my <GradientText>token</GradientText></>}
            subtitle="Name it, pick a ticker and choose how many to create. Everything is shown before you sign."
            techTag="tokenfactory · create denom"
            status={!isEmptyTokenForm(form) && (
                <>
                    <Text as="span">Draft saved in this browser</Text>
                    <Button variant="ghost" size="xs" h="28px" px="8px" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={startOver}>
                        Start over
                    </Button>
                </>
            )}
            aside={aside}
        >
            <Question
                title="Name and ticker"
                {...steps.step('identity')}
                summary={`${form.name.trim()} (${form.symbol})`}
            >
                <VStack align="stretch" gap="16px">
                    <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px" alignItems="start">
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
                    </Grid>
                    <VStack align="stretch" gap="4px">
                        <Hint mono>Token ID: {tokenId}</Hint>
                        <Hint>{TOKEN_DECIMALS} decimals: 1 {ticker} = 1,000,000 base units</Hint>
                    </VStack>
                    <ContinueRow disabled={!isIdentityValid} onContinue={() => answer('identity')} />
                </VStack>
            </Question>

            <Question
                title="Describe it"
                {...steps.step('description')}
                summary={description
                    ? description.length > SUMMARY_LENGTH ? `${description.slice(0, SUMMARY_LENGTH)}…` : description
                    : 'No description'}
            >
                <VStack align="stretch" gap="16px">
                    <Field.Root invalid={errorFor('description') !== ''}>
                        <Field.Label>Description <Optional /></Field.Label>
                        <Textarea
                            rows={4}
                            placeholder="What is it for? Shown in wallets."
                            value={form.description}
                            onChange={(e) => update({ description: e.target.value })}
                            onBlur={() => touch('description')}
                        />
                        <Field.HelperText alignSelf="flex-end" fontFamily="mono" fontSize="12px">{form.description.length} / {MAX_DESCRIPTION_LENGTH}</Field.HelperText>
                        <Field.ErrorText>{errorFor('description')}</Field.ErrorText>
                    </Field.Root>
                    <ContinueRow
                        disabled={!isDescriptionValid}
                        onContinue={() => answer('description')}
                        onSkip={() => {
                            update({ description: '' })
                            answer('description')
                        }}
                    />
                </VStack>
            </Question>

            <Question
                title={`How many ${form.symbol || 'tokens'} to create?`}
                {...steps.step('supply')}
                summary={`${supplyText} ${ticker} to your wallet`}
            >
                <VStack align="stretch" gap="16px">
                    <Hint>
                        All of it goes to your wallet when the token is created. You decide later how much to sell, pool or give away.
                    </Hint>
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
                    <AnswerChips>
                        {SUPPLY_PRESETS.map(p => (
                            <AnswerChip
                                key={p.value}
                                selected={form.initialSupply === p.value}
                                onClick={() => update({ initialSupply: p.value })}
                            >
                                {p.label}
                            </AnswerChip>
                        ))}
                    </AnswerChips>
                    <ContinueRow disabled={!isSupplyValid} onContinue={() => answer('supply')} />
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
        <FormPage>
            <TokenNewContent />
        </FormPage>
    )
}
