"use client"

import React, { useState } from 'react'
import { Badge, Box, Button, chakra, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import { LuChevronDown } from 'react-icons/lu'
import {
    BRANDING_TEMPLATES,
    BRANDING_TEMPLATE_MOODS,
    BrandingColors,
    BrandingTemplate,
    BrandingTemplateMood,
    HgCard,
    brandingFont,
    hgVariant,
} from '@bze/bze-ui-kit'
import { templateSummary } from '@/lib/brand-kit'

type MoodFilter = BrandingTemplateMood | 'all'

const MOOD_FILTERS: { mood: MoodFilter; label: string }[] = [{ mood: 'all', label: 'All' }, ...BRANDING_TEMPLATE_MOODS]

/** One half of a tile: "Aa" in the template's font on its background, with primary and secondary dots. */
function TileHalf({ colors, family }: { colors: BrandingColors; family: string | undefined }) {
    return (
        <HStack flex="1" justify="space-between" px="10px" py="12px" bg={colors.background} color={colors.text} fontFamily={family}>
            <Text as="span" fontSize="18px" fontWeight="700" lineHeight="1">Aa</Text>
            <HStack as="span" gap="4px" aria-hidden>
                <Box as="span" w="10px" h="10px" borderRadius="full" bg={colors.primary} />
                <Box as="span" w="10px" h="10px" borderRadius="full" bg={colors.secondary} />
            </HStack>
        </HStack>
    )
}

function TemplateTile({ template, badge, onApply }: { template: BrandingTemplate; badge: string | undefined; onApply: () => void }) {
    const font = brandingFont(template.branding.font)
    const isSelected = badge !== undefined

    return (
        <chakra.button
            type="button"
            aria-pressed={isSelected}
            aria-label={`Apply the ${template.name} template`}
            onClick={onApply}
            display="flex"
            flexDirection="column"
            textAlign="left"
            bg="hg.inset"
            borderRadius="12px"
            borderWidth={isSelected ? '2px' : '1px'}
            borderColor={isSelected ? 'hg.link' : 'hg.hairline'}
            overflow="hidden"
            cursor="pointer"
            _hover={{ bg: 'hg.hoverFill' }}
            focusVisibleRing="outside"
            data-testid={`brand-kit-template-${template.id}`}
        >
            <HStack gap="0" w="full">
                <TileHalf colors={template.branding.light} family={font?.family} />
                <TileHalf colors={template.branding.dark} family={font?.family} />
            </HStack>
            <HStack justify="space-between" gap="6px" px="10px" py="8px" w="full">
                <VStack align="start" gap="0" minW={0}>
                    <Text as="span" fontSize="13px" fontWeight="700" color="fg">{template.name}</Text>
                    <Text as="span" fontSize="12px" color="fg.muted">{font?.label}</Text>
                </VStack>
                {badge && <Badge variant={hgVariant('success')} size="sm">{badge}</Badge>}
            </HStack>
        </chakra.button>
    )
}

/**
 * "Start from a template": a box that folds away. Open, it lists every template, filtered by
 * mood; a click applies the template's eight colours and its font. Its header keeps saying which
 * template the kit is based on, also when folded.
 */
export function TemplatePicker({
    defaultOpen,
    applied,
    changedCount,
    onApply,
}: {
    defaultOpen: boolean;
    /** The template the kit is based on, if any. */
    applied: BrandingTemplate | undefined;
    /** Fields changed since `applied` was applied (font included). */
    changedCount: number;
    onApply: (template: BrandingTemplate) => void;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const [mood, setMood] = useState<MoodFilter>('all')
    const templates = mood === 'all' ? BRANDING_TEMPLATES : BRANDING_TEMPLATES.filter(t => t.mood === mood)

    return (
        <HgCard as="section" aria-label="Templates" p="0" overflow="hidden" data-testid="brand-kit-templates">
            <chakra.button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(open => !open)}
                display="flex"
                w="full"
                justifyContent="space-between"
                alignItems="center"
                gap="12px"
                px={{ base: '16px', md: '20px' }}
                py="16px"
                textAlign="left"
                bg="transparent"
                cursor="pointer"
                _hover={{ bg: 'hg.inset' }}
                focusVisibleRing="inside"
            >
                <VStack align="start" gap="2px" minW={0}>
                    <Text as="span" fontSize="16px" fontWeight="700">Start from a template</Text>
                    <Text as="span" fontSize="13px" color="fg.muted" data-testid="brand-kit-template-summary">
                        {templateSummary(applied, changedCount)}
                    </Text>
                </VStack>
                <HStack as="span" gap="6px" flexShrink={0} fontSize="14px" fontWeight="600" color="hg.link">
                    {isOpen ? 'Hide' : 'Show'}
                    <Box as="span" transform={isOpen ? 'rotate(180deg)' : undefined} transition="transform 0.15s"><LuChevronDown /></Box>
                </HStack>
            </chakra.button>

            {isOpen && (
                <VStack align="stretch" gap="14px" px={{ base: '16px', md: '20px' }} pb="20px">
                    <HStack role="group" aria-label="Filter templates by mood" gap="8px" flexWrap="wrap">
                        {MOOD_FILTERS.map(f => (
                            <Button
                                key={f.mood}
                                size="xs"
                                h="30px"
                                px="12px"
                                borderRadius="full"
                                aria-pressed={mood === f.mood}
                                variant={mood === f.mood ? hgVariant('primary') : 'outline'}
                                onClick={() => setMood(f.mood)}
                            >
                                {f.label}
                            </Button>
                        ))}
                    </HStack>
                    <Grid templateColumns="repeat(auto-fill, minmax(168px, 1fr))" gap="10px">
                        {templates.map(t => (
                            <TemplateTile
                                key={t.id}
                                template={t}
                                badge={applied?.id === t.id ? (changedCount > 0 ? 'edited' : 'applied') : undefined}
                                onApply={() => onApply(t)}
                            />
                        ))}
                    </Grid>
                </VStack>
            )}
        </HgCard>
    )
}
