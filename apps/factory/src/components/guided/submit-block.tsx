"use client"

import React from 'react'
import { Button, Text, VStack } from '@chakra-ui/react'
import { hgVariant } from '@bze/bze-ui-kit'

interface SubmitBlockProps {
    label: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    loadingText?: string;
    /** The lines under the button (SubmitNote). */
    children?: React.ReactNode;
}

/** The form's action at the foot of the panel column: the full-width primary button and its notes. */
export function SubmitBlock({ label, onClick, disabled, loading, loadingText = 'Waiting for signature...', children }: SubmitBlockProps) {
    return (
        <VStack align="stretch" gap="10px">
            <Button
                variant={hgVariant('primary')}
                size="xl"
                w="full"
                onClick={onClick}
                disabled={disabled}
                loading={loading}
                loadingText={loadingText}
            >
                {label}
            </Button>
            {children}
        </VStack>
    )
}

/** A centred line under the action: muted, or red for "can't pay" and similar. */
export function SubmitNote({ tone = 'muted', children }: { tone?: 'muted' | 'error'; children: React.ReactNode }) {
    return (
        <Text fontSize="14px" lineHeight="1.5" textAlign="center" color={tone === 'error' ? 'hg.danger.text' : 'fg.muted'}>
            {children}
        </Text>
    )
}
