"use client"

import React from 'react'
import { Box, Button, Code, HStack, IconButton, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuArrowUpRight, LuCircleCheck, LuCopy } from 'react-icons/lu'
import { AppLink, useToast, type AppKey } from '@bze/bze-ui-kit'
import { useNavigation } from '@/hooks/useNavigation'
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
}

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

/**
 * Replaces a guided form once its transaction is signed. Reads search params (return
 * path), so render it inside a <Suspense> boundary.
 */
export function SuccessPanel({ title, text, code, links = [], next = [], primary, again }: SuccessPanelProps) {
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
        <Box
            as="section"
            aria-label="Done"
            p={{ base: 5, md: 8 }}
            borderRadius="xl"
            borderWidth="1px"
            borderColor="green.500/30"
            bg="bg.panel"
        >
            <VStack align="stretch" gap={6}>
                <VStack gap={3} align="center" textAlign="center">
                    <Box color="green.500"><LuCircleCheck size={52} /></Box>
                    <Text as="h1" fontSize="2xl" fontWeight="bold" letterSpacing="tight">{title}</Text>
                    {text && <Text fontSize="sm" color="fg.muted">{text}</Text>}
                </VStack>

                {code && (
                    <VStack align="stretch" gap={1}>
                        {code.label && <Text fontSize="xs" color="fg.muted">{code.label}</Text>}
                        {code.value ? (
                            <HStack gap={2} p={2} borderRadius="md" bg="bg.muted">
                                <Code flex="1" minW={0} bg="transparent" fontSize="xs" wordBreak="break-all" whiteSpace="normal">
                                    {code.value}
                                </Code>
                                <IconButton aria-label={`Copy ${code.label ?? 'value'}`} size="xs" variant="ghost" onClick={copy}>
                                    <LuCopy />
                                </IconButton>
                            </HStack>
                        ) : (
                            <Skeleton height="8" data-testid="code-loading" />
                        )}
                    </VStack>
                )}

                {links.length > 0 && (
                    <HStack gap={3} justify="center" wrap="wrap">
                        {links.map(l => l.app ? (
                            <AppLink key={l.href} app={l.app} href={l.href}>{l.label}</AppLink>
                        ) : (
                            <Button key={l.href} variant="outline" colorPalette="yellow" onClick={() => openExternal(l.href)}>
                                {l.label} <LuArrowUpRight />
                            </Button>
                        ))}
                    </HStack>
                )}

                {(next.length > 0 || again) && (
                    <VStack align="stretch" gap={3}>
                        <Text fontSize="sm" color="fg.muted" fontWeight="medium" textAlign="center">
                            What&apos;s next?
                        </Text>
                        <HStack gap={3} justify="center" wrap="wrap">
                            {next.map(n => (
                                <Button key={n.href} variant="outline" colorPalette="yellow" size="sm" disabled={n.disabled} onClick={() => navigate(n.href)}>
                                    {n.icon}
                                    {n.label}
                                </Button>
                            ))}
                            {again && (
                                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={again.onClick}>
                                    {again.label}
                                </Button>
                            )}
                        </HStack>
                    </VStack>
                )}

                <Button colorPalette="yellow" size="lg" onClick={() => (main.external ? openExternal(main.href) : navigate(main.href))}>
                    {main.label}
                </Button>
            </VStack>
        </Box>
    )
}
