"use client"

import React from 'react'
import { Box, chakra, HStack, Text, VStack } from '@chakra-ui/react'
import { LuCircleAlert, LuTriangleAlert } from 'react-icons/lu'
import { FeeCoin, TxSpec, prettyAmount } from '@bze/bze-ui-kit'
import { useFeePayment } from '@/hooks/useFeePayment'
import { CoinRow, PayRow, TextRow } from './pay-panel'
import { Question } from './question'
import type { StepDirection, StepState } from './use-guided-steps'

/** A plain labelled row of the review: "You get", "Admin", … */
export interface ReviewItem {
    label: string;
    value: React.ReactNode;
    info?: React.ReactNode;
}

interface ReviewStepProps {
    /** From `steps.step('review')`. Review is never "answered": it is the last open step. */
    number: number;
    total?: number;
    state: StepState;
    direction?: StepDirection;
    /** The step's name. Default "Review". */
    title?: string;
    question?: React.ReactNode;
    /**
     * You pay: the module fee and the amounts sent or escrowed, the same rows (and
     * the same `moduleFee` / `txKind` / fee states) the PayPanel gets, so the two never disagree.
     * The network fee row is added from `txKind`.
     */
    leaves: PayRow[];
    moduleFee?: FeeCoin;
    txKind?: TxSpec;
    /** Fees still loading (useCreationFees). */
    isLoading?: boolean;
    /** The fee params query failed: the action stays disabled. */
    feeUnknown?: boolean;
    /** You get. */
    gets: ReviewItem[];
    /** Free rows after "You get" (e.g. "Admin"). */
    extra?: ReviewItem[];
    /** What can't be undone, shown in amber. */
    permanent?: React.ReactNode[];
    /** The final button: "Create token", "Create pool", … */
    submitLabel: React.ReactNode;
    onSubmit: () => void;
    /** The page's own conditions (missing answer, wallet not connected…). */
    disabled?: boolean;
    onBack?: () => void;
    /** Shown instead of the final button when a last check refused it (e.g. nobody stakes any more). */
    blocker?: React.ReactNode;
    /** Lines under the rows, e.g. why the button is disabled. */
    children?: React.ReactNode;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <VStack as="section" aria-label={label} align="stretch" gap="10px" p="14px" borderRadius="hg.md" bg="hg.inset"
            borderWidth="1px" borderColor="hg.divider">
            <chakra.h3 m="0" fontSize="13px" fontWeight="700" color="fg.muted">{label}</chakra.h3>
            {children}
        </VStack>
    )
}

/**
 * The last step of every wizard: what leaves your wallet, what you get, any extra rows and what
 * is permanent, then the final button. The button is disabled while the fee is loading or
 * unknown, when the wallet can't pay it, and under the page's own `disabled` conditions.
 */
export function ReviewStep({
    number, total, state, direction, title = 'Review', question = 'Everything right?',
    leaves, moduleFee, txKind, isLoading, feeUnknown, gets, extra = [], permanent = [],
    submitLabel, onSubmit, disabled, onBack, blocker, children,
}: ReviewStepProps) {
    const payment = useFeePayment(moduleFee, txKind)
    const cantPay = Boolean(moduleFee) && !payment.isLoading && payment.method === 'insufficient'
    const hasGas = Boolean(txKind) && payment.gasFee.amount.gt(0)

    return (
        <Question
            number={number}
            total={total}
            state={state}
            direction={direction}
            title={title}
            question={question}
            onBack={onBack}
            action={blocker ? undefined : { label: submitLabel, onClick: onSubmit, disabled: Boolean(disabled || isLoading || feeUnknown || cantPay) }}
        >
            <VStack align="stretch" gap="12px">
                <Group label="You pay">
                    {feeUnknown ? (
                        <HStack gap="8px" color="fg.muted" align="start">
                            <Box mt="3px" flexShrink={0}><LuCircleAlert size={16} /></Box>
                            <Text fontSize="14px" lineHeight="1.5">
                                Could not load the current fee from the chain. Please refresh and try again.
                            </Text>
                        </HStack>
                    ) : (
                        <>
                            {leaves.map((row, i) => row.coin
                                ? <CoinRow key={`${row.label}-${i}`} row={row as PayRow & { coin: FeeCoin }} />
                                : <TextRow key={`${row.label}-${i}`} label={row.label} value={row.text ?? ''} info={row.info} />
                            )}
                            {hasGas && (
                                <TextRow label="Network fee" value={`≈ ${prettyAmount(payment.gasFee.displayAmount)} ${payment.gasFee.ticker}`} />
                            )}
                        </>
                    )}
                </Group>

                {gets.length > 0 && (
                    <Group label="You get">
                        {gets.map((item, i) => <TextRow key={`${item.label}-${i}`} label={item.label} value={item.value} info={item.info} />)}
                    </Group>
                )}

                {extra.map((item, i) => (
                    <Box key={`${item.label}-${i}`} px="14px"><TextRow label={item.label} value={item.value} info={item.info} /></Box>
                ))}

                {permanent.length > 0 && (
                    <Box as="section" aria-label="Permanent" px="14px">
                        <VStack as="ul" align="stretch" gap="6px" m="0" p="0" listStyleType="none">
                            {permanent.map((line, i) => (
                                <HStack as="li" key={i} gap="8px" align="start" color="hg.warning.text">
                                    <Box mt="3px" flexShrink={0}><LuTriangleAlert size={14} aria-hidden /></Box>
                                    <Text fontSize="14px" lineHeight="1.5">{line}</Text>
                                </HStack>
                            ))}
                        </VStack>
                    </Box>
                )}

                {children}
                {blocker}
            </VStack>
        </Question>
    )
}
