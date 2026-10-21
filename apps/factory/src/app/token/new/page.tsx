"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { Button, chakra, Circle, Field, Grid, HStack, Input, Text, Textarea, VStack } from '@chakra-ui/react'
import { GradientText, type TxSpec, getChainName, prettyAmount, toBigNumber, truncateAddress, useCreationFees } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import {
    AnswerChip,
    AnswerChips,
    FormPage,
    GuidedForm,
    Hint,
    Optional,
    OutcomePanel,
    PayPanel,
    Question,
    ReviewStep,
    SubmitNote,
    TxPanel,
    useGuidedSteps,
} from '@/components/guided'
import { createTokenMsgs, createdDenom } from '@/components/token-wizard/create-token-msgs'
import { TokenDone, type TokenDoneInput } from '@/components/token-wizard/token-done'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { MAX_DESCRIPTION_LENGTH, TOKEN_DECIMALS } from '@/components/token-wizard/validation'
import { useFeePayment } from '@/hooks/useFeePayment'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import {
    type AdminChoice,
    EMPTY_TOKEN_FORM,
    TOKEN_FORM_KEYS,
    type TokenForm,
    type TokenFormStep,
    clearTokenDraft,
    isEmptyTokenForm,
    loadTokenDraft,
    saveTokenDraft,
} from '@/lib/token-draft'

const CREATE_KINDS: TxSpec = ['create-denom', 'mint', 'set-denom-metadata']
const CREATE_AND_HAND_OVER_KINDS: TxSpec = ['create-denom', 'mint', 'set-denom-metadata', 'change-admin']

const STEP_KEYS = [...TOKEN_FORM_KEYS, 'review'] as const

const SUPPLY_PRESETS = ['100000', '1000000', '21000000']

const ADMIN_POWERS = 'can mint more and edit details'

type Touched = Partial<Record<'name' | 'symbol' | 'description' | 'initialSupply' | 'adminAddress', boolean>>

function initial(name: string, symbol: string): string {
    return (name.trim()[0] ?? symbol[0] ?? '?').toUpperCase()
}

/** The token as it will look, for "What will happen". */
function TokenPreview({ name, ticker }: { name: string; ticker: string }) {
    return (
        <HStack gap="12px" minW={0} mb="10px">
            <Circle
                size="40px"
                bg="app.subtle"
                boxShadow="0 0 0 2px {colors.app.border}"
                color="hg.link"
                fontWeight="800"
                fontSize="15px"
                flexShrink={0}
                aria-hidden
            >
                {initial(name, ticker)}
            </Circle>
            <VStack align="start" gap="0" minW={0}>
                <Text fontWeight="700" wordBreak="break-word" data-testid="preview-name">{name.trim() || 'Your token'}</Text>
                <Text fontSize="12px" color="hg.text.faint" data-testid="preview-ticker">{ticker}</Text>
            </VStack>
        </HStack>
    )
}

/** One of the two Permissions choices, as a radio card. */
function AdminOption({ selected, title, text, onSelect }: { selected: boolean; title: string; text: string; onSelect: () => void }) {
    return (
        <chakra.button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            display="flex"
            alignItems="start"
            gap="12px"
            w="full"
            p="14px"
            textAlign="left"
            borderRadius="hg.md"
            borderWidth="1px"
            borderColor={selected ? 'app.solid/60' : 'hg.hairline'}
            bg={selected ? 'app.subtle' : 'hg.inset'}
            cursor="pointer"
            focusVisibleRing="outside"
        >
            <chakra.span
                aria-hidden
                mt="2px"
                boxSize="18px"
                flexShrink={0}
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="full"
                borderWidth="2px"
                borderColor={selected ? 'app.solid' : 'hg.hairline'}
            >
                {selected && <chakra.span boxSize="8px" borderRadius="full" bg="app.solid" />}
            </chakra.span>
            <VStack as="span" align="start" gap="2px" minW={0}>
                <chakra.span fontSize="15px" fontWeight="700">{title}</chakra.span>
                <chakra.span fontSize="14px" lineHeight="1.5" color="fg.muted">{text}</chakra.span>
            </VStack>
        </chakra.button>
    )
}

function TokenNewContent() {
    const { address } = useChain(getChainName())
    const { fees, isLoading: isFeeLoading } = useCreationFees()

    // The page renders on the client only (search params under a Suspense boundary),
    // so the browser draft can seed the first render: the finished steps come back collapsed
    // and the first unfinished one opens.
    const [draft] = useState(loadTokenDraft)
    const [form, setForm] = useState<TokenForm>(draft?.form ?? EMPTY_TOKEN_FORM)
    const [answered, setAnswered] = useState<TokenFormStep[]>(draft?.answered ?? [])
    const [touched, setTouched] = useState<Touched>({})
    const [done, setDone] = useState<{ input: TokenDoneInput; hash: string } | undefined>(undefined)

    const validation = useTokenWizardValidation(form)
    const { errors, isDetailsValid, isSupplyValid, isPermissionsValid } = validation

    const steps = useGuidedSteps(STEP_KEYS, {
        details: answered.includes('details') && isDetailsValid,
        supply: answered.includes('supply') && isSupplyValid,
        permissions: answered.includes('permissions') && isPermissionsValid,
        review: false,
    })

    useEffect(() => {
        saveTokenDraft({ form, answered })
    }, [form, answered])

    const fee = fees.createDenomFee
    const txKind = form.adminChoice === 'other' ? CREATE_AND_HAND_OVER_KINDS : CREATE_KINDS
    const { canPayFee, isLoading: isBalanceLoading } = useFeePayment(fee, txKind)

    const buildMsgs = useCallback(() => (address ? createTokenMsgs(form, address) : undefined), [address, form])
    const onDone = useCallback(({ input, hash }: WizardTxDone<TokenDoneInput>) => {
        clearTokenDraft()
        setForm(EMPTY_TOKEN_FORM)
        setAnswered([])
        if (input) setDone({ input, hash })
    }, [])
    const { submit, panelProps } = useWizardTx<TokenDoneInput>(buildMsgs, { title: `Create token ${form.symbol}`, onDone })

    // The token exists once the tx is confirmed: a draft left behind would only create it twice.
    const confirmed = panelProps?.status === 'confirmed'
    useEffect(() => {
        if (confirmed) clearTokenDraft()
    }, [confirmed])

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

    if (done) return <TokenDone input={done.input} hash={done.hash} />

    const ticker = form.symbol || 'TICKER'
    const denomPreview = form.symbol ? createdDenom(address ?? '<you>', form.symbol) : `factory/${address ?? '<you>'}/u<ticker>`
    const supplyText = isSupplyValid ? prettyAmount(toBigNumber(form.initialSupply)) : ''
    const otherAdmin = form.adminAddress.trim()
    const handsOver = form.adminChoice === 'other'

    const isComplete = TOKEN_FORM_KEYS.every(k => steps.state[k] === 'done') && validation.isValid

    const create = () => {
        if (!address) return
        submit({
            denom: createdDenom(address, form.symbol),
            ticker: form.symbol,
            name: form.name.trim(),
            supply: form.initialSupply,
            admin: handsOver ? otherAdmin : address,
        })
    }

    const chooseAdmin = (adminChoice: AdminChoice) => update({ adminChoice })

    const aside = (
        <>
            <OutcomePanel>
                <TokenPreview name={form.name} ticker={ticker} />
                <Text data-testid="outcome">
                    You receive {supplyText ? `${supplyText} ${ticker}` : ticker}.{' '}
                    {handsOver
                        ? 'The address you choose gets permission to mint more and update its details.'
                        : 'Your wallet keeps permission to mint more and update its details.'}
                </Text>
            </OutcomePanel>

            <PayPanel
                rows={[{ label: 'Token creation fee', coin: fee }]}
                moduleFee={fee}
                txKind={txKind}
                isLoading={isFeeLoading}
                feeUnknown={!fee}
            />

            <Hint>Click a finished step to change it. Scrolling only scrolls.</Hint>
        </>
    )

    return (
        <GuidedForm
            crumb="Token"
            title={<>Create a <GradientText>token</GradientText></>}
            subtitle="Name it, choose how many to start with and who can change it later. Everything is shown before you sign."
            techTag="tokenfactory · create denom"
            status={!isEmptyTokenForm(form) && <Text as="span">Draft saved in this browser</Text>}
            aside={aside}
        >
            <Question
                title="Details"
                question="What is it called?"
                {...steps.step('details')}
                summary={`${form.name.trim()} · ${form.symbol}`}
                action={{ label: 'Continue', onClick: () => answer('details'), disabled: !isDetailsValid }}
            >
                <VStack align="stretch" gap="16px">
                    <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px" alignItems="start">
                        <Field.Root invalid={errorFor('name') !== ''}>
                            <Field.Label>Name</Field.Label>
                            <Input
                                placeholder="e.g. Honey"
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
                            <Field.HelperText>The ticker is permanent.</Field.HelperText>
                        </Field.Root>
                    </Grid>
                    <Hint mono>{denomPreview}</Hint>
                    <Field.Root invalid={errorFor('description') !== ''}>
                        <Field.Label>Description <Optional /></Field.Label>
                        <Textarea
                            rows={3}
                            placeholder="What is it for? Shown in wallets."
                            value={form.description}
                            onChange={(e) => update({ description: e.target.value })}
                            onBlur={() => touch('description')}
                        />
                        <Field.HelperText alignSelf="flex-end" fontFamily="mono" fontSize="12px">{form.description.length} / {MAX_DESCRIPTION_LENGTH}</Field.HelperText>
                        <Field.ErrorText>{errorFor('description')}</Field.ErrorText>
                    </Field.Root>
                </VStack>
            </Question>

            <Question
                title="Supply"
                question="How many to start with?"
                {...steps.step('supply')}
                summary={`${supplyText} ${ticker} to your wallet`}
                onBack={steps.back}
                action={{ label: 'Continue', onClick: () => answer('supply'), disabled: !isSupplyValid }}
            >
                <VStack align="stretch" gap="16px">
                    <AnswerChips>
                        {SUPPLY_PRESETS.map(value => (
                            <AnswerChip
                                key={value}
                                selected={form.initialSupply === value}
                                onClick={() => update({ initialSupply: value })}
                            >
                                {prettyAmount(toBigNumber(value))}
                            </AnswerChip>
                        ))}
                    </AnswerChips>
                    <Field.Root invalid={errorFor('initialSupply') !== ''}>
                        <Field.Label>Initial supply</Field.Label>
                        <Input
                            placeholder="e.g. 1000000"
                            inputMode="decimal"
                            value={form.initialSupply}
                            onChange={(e) => update({ initialSupply: e.target.value })}
                            onBlur={() => touch('initialSupply')}
                        />
                        <Field.ErrorText>{errorFor('initialSupply')}</Field.ErrorText>
                    </Field.Root>
                    <Hint>Minted to your wallet. {TOKEN_DECIMALS} decimals.</Hint>
                </VStack>
            </Question>

            <Question
                title="Permissions"
                question="Who can change it later?"
                {...steps.step('permissions')}
                summary={handsOver ? `Admin: ${truncateAddress(otherAdmin)}` : 'Admin: your wallet'}
                onBack={steps.back}
                action={{ label: 'Review token', onClick: () => answer('permissions'), disabled: !isPermissionsValid }}
            >
                <VStack align="stretch" gap="16px">
                    <Grid role="radiogroup" aria-label="Admin" templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="12px">
                        <AdminOption
                            selected={!handsOver}
                            title="My wallet"
                            text="Mint more and edit details. Best while the project is young."
                            onSelect={() => chooseAdmin('mine')}
                        />
                        <AdminOption
                            selected={handsOver}
                            title="Another address"
                            text="A team or multisig wallet becomes the admin from the start."
                            onSelect={() => chooseAdmin('other')}
                        />
                    </Grid>
                    {handsOver && (
                        <Field.Root invalid={errorFor('adminAddress') !== ''}>
                            <Field.Label>Admin address</Field.Label>
                            <Input
                                placeholder="bze1…"
                                fontFamily="mono"
                                value={form.adminAddress}
                                onChange={(e) => update({ adminAddress: e.target.value })}
                                onBlur={() => touch('adminAddress')}
                            />
                            <Field.ErrorText>{errorFor('adminAddress')}</Field.ErrorText>
                        </Field.Root>
                    )}
                    <Hint>You can transfer or renounce admin later on the token&apos;s page, under Permissions.</Hint>
                </VStack>
            </Question>

            {panelProps ? (
                <TxPanel {...panelProps} />
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={[{ label: 'Creation fee', coin: fee }]}
                    moduleFee={fee}
                    txKind={txKind}
                    isLoading={isFeeLoading}
                    feeUnknown={!fee}
                    gets={[{ label: 'In your wallet', value: `${supplyText} ${ticker}` }]}
                    extra={[{
                        label: 'Admin',
                        value: handsOver
                            ? <><chakra.span fontFamily="mono" overflowWrap="anywhere">{otherAdmin}</chakra.span> · {ADMIN_POWERS}</>
                            : `your wallet · ${ADMIN_POWERS}`,
                    }]}
                    permanent={['The ticker in its address']}
                    submitLabel="Create token"
                    onSubmit={create}
                    disabled={!address || !isComplete}
                    onBack={steps.back}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet to create this token.</SubmitNote>
                    ) : !isBalanceLoading && !canPayFee && (
                        <SubmitNote tone="error">Not enough balance to cover the creation fee.</SubmitNote>
                    )}
                </ReviewStep>
            )}

            {!isEmptyTokenForm(form) && (
                <HStack justify="center">
                    <Button variant="ghost" size="xs" h="28px" px="8px" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={startOver}>
                        Start over
                    </Button>
                </HStack>
            )}
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
