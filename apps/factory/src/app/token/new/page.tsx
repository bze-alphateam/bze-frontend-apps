"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { Button, chakra, Field, Grid, HStack, Input, Text, Textarea, VStack } from '@chakra-ui/react'
import {
    GradientText,
    type TxSpec,
    getChainName,
    prettyAmount,
    toBigNumber,
    truncateAddress,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCreationFees,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import {
    AnswerChip,
    AnswerChips,
    FormPage,
    GuidedForm,
    Optional,
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
import { MAX_DESCRIPTION_LENGTH } from '@/components/token-wizard/validation'
import { useFeePayment } from '@/hooks/useFeePayment'
import { type WizardTxDone, useWizardTx, useWizardTxBroadcast } from '@/hooks/useWizardTx'
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
import { notEnoughText } from '@/lib/format'
import { ADMIN_POWERS } from '@/lib/permissions'

const CREATE_KINDS: TxSpec = ['create-denom', 'mint', 'set-denom-metadata']
const CREATE_AND_HAND_OVER_KINDS: TxSpec = ['create-denom', 'mint', 'set-denom-metadata', 'change-admin']

const STEP_KEYS = [...TOKEN_FORM_KEYS, 'review'] as const

const SUPPLY_PRESETS = ['100000', '1000000', '21000000']


type Touched = Partial<Record<'name' | 'symbol' | 'description' | 'initialSupply' | 'adminAddress', boolean>>

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

    // Once broadcast, the chain changes under the form: keep the answers until Done.
    const broadcast = useWizardTxBroadcast()
    const steps = useGuidedSteps(STEP_KEYS, {
        details: answered.includes('details') && isDetailsValid,
        supply: answered.includes('supply') && isSupplyValid,
        permissions: answered.includes('permissions') && isPermissionsValid,
        review: false,
    }, { frozen: broadcast })

    useEffect(() => {
        saveTokenDraft({ form, answered })
    }, [form, answered])

    const fee = fees.createDenomFee
    const txKind = form.adminChoice === 'other' ? CREATE_AND_HAND_OVER_KINDS : CREATE_KINDS
    const { canPayFee, isLoading: isBalanceLoading } = useFeePayment(fee, txKind)
    const { asset: feeAsset } = useAsset(fee?.denom ?? '')
    const { balance: feeBalance } = useBalance(fee?.denom ?? '')

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

    const feeTicker = feeAsset?.ticker ?? fee?.denom ?? ''
    const feeBalanceText = prettyAmount(uAmountToBigNumberAmount(feeBalance.amount, feeAsset?.decimals ?? 6))
    const payRows = [{ label: 'Creation fee', coin: fee }]

    const aside = (
        <PayPanel
            rows={payRows}
            moduleFee={fee}
            txKind={txKind}
            isLoading={isFeeLoading}
            feeUnknown={!fee}
        />
    )

    return (
        <GuidedForm
            crumb="Token"
            title={<>Create a <GradientText>token</GradientText></>}
            subtitle="Name it, set the supply and the admin."
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
                        </Field.Root>
                    </Grid>
                    <Field.Root invalid={errorFor('description') !== ''}>
                        <Field.Label>Description <Optional /></Field.Label>
                        <Textarea
                            rows={3}
                            placeholder="Describe your token…"
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
                            text={ADMIN_POWERS}
                            onSelect={() => chooseAdmin('mine')}
                        />
                        <AdminOption
                            selected={handsOver}
                            title="Another address"
                            text="A team or multisig wallet"
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
                </VStack>
            </Question>

            {panelProps ? (
                <TxPanel {...panelProps} />
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={payRows}
                    moduleFee={fee}
                    txKind={txKind}
                    isLoading={isFeeLoading}
                    feeUnknown={!fee}
                    gets={[
                        { label: 'New token', value: `${form.name.trim()} · ${ticker}` },
                        { label: 'Minted to you', value: `${supplyText} ${ticker}` },
                    ]}
                    extra={[{
                        label: 'Admin',
                        value: handsOver
                            ? <chakra.span fontFamily="mono" overflowWrap="anywhere">{otherAdmin}</chakra.span>
                            : 'You',
                    }]}
                    submitLabel="Create token"
                    onSubmit={create}
                    disabled={!address || !isComplete}
                    onBack={steps.back}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet.</SubmitNote>
                    ) : !isBalanceLoading && !canPayFee && (
                        <SubmitNote tone="error">{notEnoughText(feeTicker, feeBalanceText)}</SubmitNote>
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
