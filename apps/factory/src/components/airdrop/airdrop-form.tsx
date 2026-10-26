"use client"

import React from 'react'
import { chakra, Text, VStack } from '@chakra-ui/react'
import { LuCoins, LuList, LuUsers } from 'react-icons/lu'
import { GradientText } from '@bze/bze-ui-kit'
import { GuidedForm, Question, type StepProps } from '@/components/guided'
import type { AirdropTarget } from '@/lib/airdrop'

// The frame every Airdrop flow shares: one title, one first step ("Who gets it?"). Each
// target has its own flow component with its own steps after that one.

const TARGETS: { value: AirdropTarget; label: string; icon: React.ReactNode }[] = [
    {
        value: 'list',
        label: 'A list of wallets',
        icon: <LuList size={20} aria-hidden />,
    },
    {
        value: 'stakers',
        label: 'Stakers of a token',
        icon: <LuUsers size={20} aria-hidden />,
    },
    {
        value: 'lp',
        label: 'Liquidity providers',
        icon: <LuCoins size={20} aria-hidden />,
    },
]

export const targetLabel = (target: AirdropTarget) => TARGETS.find(t => t.value === target)?.label ?? ''

interface TargetQuestionProps extends Partial<StepProps> {
    value?: AirdropTarget;
    /** Picking the target already answered keeps its flow; another one switches flows. */
    onPick: (target: AirdropTarget) => void;
}

/** Step 1 of every flow: who gets the tokens. */
export function TargetQuestion({ value, onPick, number = 1, total, state = 'active', direction, onEdit }: TargetQuestionProps) {
    return (
        <Question
            number={number}
            total={total}
            state={state}
            direction={direction}
            onEdit={onEdit}
            title="Who"
            question="Who gets the tokens?"
            summary={value ? targetLabel(value) : ''}
        >
            <VStack align="stretch" gap="8px" role="radiogroup" aria-label="Who gets the tokens">
                {TARGETS.map(t => {
                    const selected = t.value === value
                    return (
                        <chakra.button
                            key={t.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            display="flex"
                            alignItems="center"
                            gap="14px"
                            w="full"
                            px="16px"
                            py="14px"
                            textAlign="start"
                            borderRadius="14px"
                            borderWidth="1px"
                            borderColor={selected ? 'app.border' : 'hg.divider'}
                            bg={selected ? 'app.subtle' : 'hg.inset'}
                            cursor="pointer"
                            _hover={{ borderColor: 'app.border' }}
                            focusVisibleRing="outside"
                            onClick={() => onPick(t.value)}
                            data-testid="airdrop-target"
                        >
                            <chakra.span flex="none" color="app.fg" display="inline-flex">{t.icon}</chakra.span>
                            <Text fontSize="15px" fontWeight="700" minW={0}>{t.label}</Text>
                        </chakra.button>
                    )
                })}
            </VStack>
        </Question>
    )
}

interface AirdropFormProps {
    status?: React.ReactNode;
    aside?: React.ReactNode;
    children: React.ReactNode;
}

/** "Airdrop tokens": the page title and breadcrumb of every flow. */
export function AirdropForm({ status, aside, children }: AirdropFormProps) {
    return (
        <GuidedForm
            crumb="Airdrop"
            title={<>Airdrop <GradientText>tokens</GradientText></>}
            subtitle="Send tokens to wallets or stakers."
            status={status}
            aside={aside}
        >
            {children}
        </GuidedForm>
    )
}
