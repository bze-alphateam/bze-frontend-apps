"use client"

import React from 'react'
import { chakra, Text, VStack } from '@chakra-ui/react'
import { LuCoins, LuList, LuUsers } from 'react-icons/lu'
import { GradientText } from '@bze/bze-ui-kit'
import { GuidedForm, Question, type StepProps } from '@/components/guided'
import type { AirdropTarget } from '@/lib/airdrop'

// The frame every Airdrop coins flow shares: one title, one first step ("Who gets it?"). Each
// target has its own flow component with its own steps after that one.

const TARGETS: { value: AirdropTarget; label: string; line: string; icon: React.ReactNode }[] = [
    {
        value: 'list',
        label: 'A list of wallets',
        line: 'Contest winners, early supporters, a snapshot. Paste or upload addresses.',
        icon: <LuList size={20} aria-hidden />,
    },
    {
        value: 'stakers',
        label: 'Stakers of a token',
        line: 'Split an amount between everyone staking a token in a reward. Yours or any other.',
        icon: <LuUsers size={20} aria-hidden />,
    },
    {
        value: 'lp',
        label: 'Liquidity providers',
        line: "Split an amount between everyone staking a pool's shares in a reward.",
        icon: <LuCoins size={20} aria-hidden />,
    },
]

export const targetLabel = (target: AirdropTarget) => TARGETS.find(t => t.value === target)?.label ?? ''

interface TargetQuestionProps extends Partial<StepProps> {
    value?: AirdropTarget;
    /** Picking the target already answered keeps its flow; another one switches flows. */
    onPick: (target: AirdropTarget) => void;
}

/** Step 1 of every flow: who gets the coins. */
export function TargetQuestion({ value, onPick, number = 1, total, state = 'active', direction, onEdit }: TargetQuestionProps) {
    return (
        <Question
            number={number}
            total={total}
            state={state}
            direction={direction}
            onEdit={onEdit}
            title="Who"
            question="Who gets the coins?"
            summary={value ? targetLabel(value) : ''}
        >
            <VStack align="stretch" gap="8px" role="radiogroup" aria-label="Who gets the coins">
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
                            <VStack align="start" gap="2px" minW={0}>
                                <Text fontSize="15px" fontWeight="700">{t.label}</Text>
                                <Text fontSize="13px" color="fg.muted">{t.line}</Text>
                            </VStack>
                        </chakra.button>
                    )
                })}
            </VStack>
        </Question>
    )
}

interface AirdropFormProps {
    techTag?: React.ReactNode;
    status?: React.ReactNode;
    aside?: React.ReactNode;
    children: React.ReactNode;
}

/** "Airdrop coins": the page title and breadcrumb of every flow. */
export function AirdropForm({ techTag, status, aside, children }: AirdropFormProps) {
    return (
        <GuidedForm
            crumb="Airdrop"
            title={<>Airdrop <GradientText>coins</GradientText></>}
            subtitle="Send coins to a list of wallets, or split them between everyone staking a token or a pool's shares."
            techTag={techTag}
            status={status}
            aside={aside}
        >
            {children}
        </GuidedForm>
    )
}
