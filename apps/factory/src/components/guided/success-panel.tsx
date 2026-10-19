"use client"

import React from 'react'
import { Box, Button, chakra, Code, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import { LuArrowUpRight, LuCircleCheck, LuCopy } from 'react-icons/lu'
import { AppLink, Shimmer, hgVariant, useToast, type AppKey } from '@bze/bze-ui-kit'
import { useNavigation } from '@/hooks/useNavigation'
import { softButton } from '@/components/ui/soft-button'
import { FormFrame } from './guided-form'
import { completedReturnHref, useReturnTo } from './return-to'

export interface SuccessLink {
    label: string;
    href: string;
    /** Another app or site, opened in a new tab (only read on `primary`; `links` always are). */
    external?: boolean;
    /** The BZE app a link opens: shown as that app's AppLink, labelled with the app's name (only read on `links`). */
    app?: AppKey;
}

export interface SuccessNext {
    label: string;
    href: string;
    icon?: React.ReactNode;
    /** E.g. while a value it needs is still loading. */
    disabled?: boolean;
}

interface SuccessPanelProps {
    title: React.ReactNode;
    text?: React.ReactNode;
    /** A value worth keeping (a denom, an id), with a Copy button. No value yet: a skeleton. */
    code?: { label?: string; value?: string };
    /** External pages, opened in a new tab; a BZE app's page carries its `app`. */
    links?: SuccessLink[];
    /** Suggested next steps inside the app. */
    next?: SuccessNext[];
    /** The main way out. Default: back to the return path, else back to the Factory home. */
    primary?: SuccessLink;
    /** "Do another" with a caller-supplied label and reset. */
    again?: { label: string; onClick: () => void };
    /** Under the panel, e.g. a report download. */
    after?: React.ReactNode;
}

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

/**
 * Replaces a guided form once its transaction is signed. Reads search params (return
 * path), so render it inside a <Suspense> boundary.
 */
export function SuccessPanel({ title, text, code, links = [], next = [], primary, again, after }: SuccessPanelProps) {
    const { navigate } = useNavigation()
    const { toast } = useToast()
    const returnTo = useReturnTo()

    const chosen = primary
        ?? (returnTo ? { label: `Back to ${returnTo.label}`, href: returnTo.href } : { label: 'Back to the Factory', href: '/' })
    // Going back to where the form was opened from, after it succeeded.
    const main = returnTo && chosen.href === returnTo.href ? { ...chosen, href: completedReturnHref(chosen.href) } : chosen

    const copy = async () => {
        if (!code?.value) return
        await navigator.clipboard.writeText(code.value)
        toast.success('Copied', `${code.label ?? 'Value'} copied to clipboard.`)
    }

    return (
        <FormFrame narrow>
            <VStack align="stretch" gap="16px">
                <VStack
                    as="section"
                    aria-label="Done"
                    align="stretch"
                    gap="24px"
                    p={{ base: '20px', md: '32px' }}
                    borderRadius="hg.xl"
                    borderWidth="1px"
                    borderColor="hg.success/30"
                    bg="hg.card"
                >
                    <VStack gap="12px" align="center" textAlign="center">
                        <Box color="hg.success" aria-hidden><LuCircleCheck size={52} strokeWidth={1.6} /></Box>
                        <chakra.h1 m="0" fontSize="26px" fontWeight="800" letterSpacing="-0.02em">{title}</chakra.h1>
                        {text && <Text fontSize="14px" lineHeight="1.6" color="fg.muted" maxW="560px">{text}</Text>}
                    </VStack>

                    {code && (
                        <VStack align="stretch" gap="4px">
                            {code.label && <Text fontSize="12px" color="hg.text.faint">{code.label}</Text>}
                            {code.value ? (
                                <HStack gap="8px" px="10px" py="8px" borderRadius="10px" bg="hg.inset">
                                    <Code flex="1" minW={0} bg="transparent" fontSize="12px" color="hg.text.secondary" wordBreak="break-all" whiteSpace="normal">
                                        {code.value}
                                    </Code>
                                    <IconButton aria-label={`Copy ${code.label ?? 'value'}`} size="xs" variant="ghost" color="hg.link" onClick={copy}>
                                        <LuCopy />
                                    </IconButton>
                                </HStack>
                            ) : (
                                <Shimmer h="36px" borderRadius="10px" data-testid="code-loading" />
                            )}
                        </VStack>
                    )}

                    {links.length > 0 && (
                        <HStack gap="10px" justify="center" wrap="wrap">
                            {links.map(l => l.app ? (
                                <AppLink key={l.href} app={l.app} href={l.href}>{l.label}</AppLink>
                            ) : (
                                <Button key={l.href} variant={hgVariant('secondary')} onClick={() => openExternal(l.href)}>
                                    {l.label} <LuArrowUpRight />
                                </Button>
                            ))}
                        </HStack>
                    )}

                    {(next.length > 0 || again) && (
                        <VStack align="stretch" gap="12px">
                            <Text fontSize="14px" color="fg.muted" fontWeight="500" textAlign="center">
                                What&apos;s next?
                            </Text>
                            <HStack gap="10px" justify="center" wrap="wrap">
                                {next.map(n => (
                                    <Button key={n.href} {...softButton} size="sm" disabled={n.disabled} onClick={() => navigate(n.href)}>
                                        {n.icon}
                                        {n.label}
                                    </Button>
                                ))}
                                {again && (
                                    <Button variant="ghost" size="sm" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={again.onClick}>
                                        {again.label}
                                    </Button>
                                )}
                            </HStack>
                        </VStack>
                    )}

                    <Button variant={hgVariant('primary')} size="xl" onClick={() => (main.external ? openExternal(main.href) : navigate(main.href))}>
                        {main.label}
                    </Button>
                </VStack>
                {after}
            </VStack>
        </FormFrame>
    )
}
