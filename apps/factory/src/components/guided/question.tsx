"use client"

import React, { useEffect, useId, useRef, useState } from 'react'
import { Box, Button, chakra, Flex, VStack } from '@chakra-ui/react'
import { Global, css } from '@emotion/react'
import { LuArrowUp, LuCheck } from 'react-icons/lu'
import { hgVariant } from '@bze/bze-ui-kit'
import type { StepDirection, StepState } from './use-guided-steps'
import { usePrefersReducedMotion } from './use-reduced-motion'

export interface StepAction {
    label: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
}

interface QuestionProps {
    number: number;
    /** How many steps the wizard has: the eyebrow reads "Step N of M". */
    total?: number;
    /** The step's name: the eyebrow of the open card and the label of its done row. */
    title: string;
    /** The question the open card asks (its heading). Default: the title. */
    question?: React.ReactNode;
    state: StepState;
    /** Which way the wizard moved to this step (useGuidedSteps): sets the slide. */
    direction?: StepDirection;
    /** The answer as a sentence, shown once the step is done. */
    summary?: React.ReactNode;
    /** Reopens a done step (the Edit button). */
    onEdit?: () => void;
    /** "↑ Back" in the open card's footer; never shown on step 1. */
    onBack?: () => void;
    /** The open card's primary button ("Continue", "Review <thing>"). */
    action?: StepAction;
    /** The inputs, rendered only while the step is open. */
    children?: React.ReactNode;
}

/** The class that starts the slide-in of an open step card (none under reduced motion). */
export const STEP_ENTER_CLASS: Record<StepDirection, string> = {
    forward: 'wizard-step-enter-forward',
    back: 'wizard-step-enter-back',
}

// Forward: the new step comes up from 32 px below; back or edit: down from 32 px above.
const slideStyles = css`
    @keyframes wizard-step-from-below { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: none; } }
    @keyframes wizard-step-from-above { from { opacity: 0; transform: translateY(-32px); } to { opacity: 1; transform: none; } }
    .${STEP_ENTER_CLASS.forward} { animation: wizard-step-from-below 0.34s cubic-bezier(.2,.8,.2,1) both; }
    .${STEP_ENTER_CLASS.back} { animation: wizard-step-from-above 0.34s cubic-bezier(.2,.8,.2,1) both; }
    @media (prefers-reduced-motion: reduce) {
        .${STEP_ENTER_CLASS.forward}, .${STEP_ENTER_CLASS.back} { animation: none; }
    }
`

const DISC = { flex: 'none', boxSize: '28px', borderRadius: 'full', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const

/**
 * One step of a vertical wizard:
 * - done: a full-width row with a check badge, the step's name above the answer, and Edit;
 * - active: the one open card ("Step N of M · Title", the question, the inputs, Back and the
 *   primary button), sliding in from below going forward and from above going back;
 * - todo: a dashed, quiet row that can't be clicked.
 *
 * When a step opens (not on the first render), it is scrolled into view and its heading takes
 * the focus. The step never changes on scroll. Every state renders the same <Box as="section">,
 * so React keeps the section's DOM node (and anything holding it) when a step opens or closes.
 */
export function Question({ number, total, title, question, state, direction = 'forward', summary, onEdit, onBack, action, children }: QuestionProps) {
    const titleId = useId()
    const sectionRef = useRef<HTMLDivElement>(null)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const reducedMotion = usePrefersReducedMotion()

    // Whether this step has opened since the page loaded: the first open step of a fresh page
    // doesn't slide, scroll or steal the focus.
    const [seen, setSeen] = useState(state)
    const [opened, setOpened] = useState(false)
    if (seen !== state) {
        setSeen(state)
        if (state === 'active') setOpened(true)
    }

    const wasActive = useRef(state === 'active')
    useEffect(() => {
        const opening = state === 'active' && !wasActive.current
        wasActive.current = state === 'active'
        if (!opening) return
        sectionRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
        headingRef.current?.focus({ preventScroll: true })
    }, [state, reducedMotion])

    if (state === 'done') {
        return (
            <Box
                as="section"
                ref={sectionRef}
                aria-labelledby={titleId}
                data-state="done"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap="12px"
                w="full"
                px={{ base: '14px', md: '18px' }}
                py="12px"
                borderRadius="hg.lg"
                bg="hg.card"
                borderWidth="1px"
                borderColor="hg.hairline"
            >
                <Flex align="center" gap="12px" minW={0}>
                    <chakra.span {...DISC} aria-hidden bgImage="app" color="hg.buttonText">
                        <LuCheck size={14} strokeWidth={3} />
                    </chakra.span>
                    <VStack align="start" gap="1px" minW={0}>
                        <chakra.span id={titleId} fontSize="12px" color="hg.text.faint">{title}</chakra.span>
                        <chakra.span fontSize="14px" fontWeight="600" color="fg" minW={0} overflowWrap="anywhere">{summary}</chakra.span>
                    </VStack>
                </Flex>
                {onEdit && (
                    <Button
                        variant="ghost"
                        size="sm"
                        flex="none"
                        color="hg.link"
                        _hover={{ bg: 'app.subtle' }}
                        aria-label={`Edit ${title}`}
                        onClick={onEdit}
                    >
                        Edit
                    </Button>
                )}
            </Box>
        )
    }

    if (state === 'todo') {
        return (
            <Box
                as="section"
                ref={sectionRef}
                aria-labelledby={titleId}
                data-state="todo"
                display="flex"
                alignItems="center"
                gap="12px"
                px={{ base: '14px', md: '18px' }}
                py="14px"
                borderRadius="hg.lg"
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="hg.hairline"
            >
                <chakra.span {...DISC} aria-hidden borderWidth="1px" borderColor="hg.hairline" color="hg.text.faint" fontSize="13px" fontWeight="700">
                    {number}
                </chakra.span>
                <chakra.span id={titleId} fontSize="15px" fontWeight="600" color="hg.text.faint">{title}</chakra.span>
            </Box>
        )
    }

    const enterClass = opened && !reducedMotion ? STEP_ENTER_CLASS[direction] : undefined
    const showBack = Boolean(onBack) && number > 1

    return (
        <Box
            as="section"
            ref={sectionRef}
            aria-labelledby={titleId}
            aria-current="step"
            data-state="active"
            data-direction={direction}
            className={enterClass}
            borderRadius="hg.lg"
            borderWidth="1px"
            borderColor="app.solid/60"
            bg="hg.card"
            bgImage="linear-gradient(180deg, {colors.app.subtle} 0%, transparent 160px)"
            boxShadow="hg.featured"
        >
            <Global styles={slideStyles} />
            <VStack align="stretch" gap="16px" p={{ base: '16px', md: '22px' }}>
                <Flex align="center" gap="10px">
                    <chakra.span {...DISC} aria-hidden borderWidth="2px" borderColor="app.solid" color="app.fg" fontSize="13px" fontWeight="800">
                        {number}
                    </chakra.span>
                    <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.04em" textTransform="uppercase" color="app.fg">
                        {total ? `Step ${number} of ${total}` : `Step ${number}`}
                        {question !== undefined && <> · <span id={titleId}>{title}</span></>}
                    </chakra.span>
                </Flex>
                <chakra.h2
                    ref={headingRef}
                    id={question === undefined ? titleId : undefined}
                    tabIndex={-1}
                    m="0"
                    fontSize={{ base: '18px', md: '20px' }}
                    fontWeight="700"
                    outline="none"
                >
                    {question ?? title}
                </chakra.h2>
                {children}
            </VStack>
            {(showBack || action) && (
                <Flex
                    justify="space-between"
                    align="center"
                    gap="12px"
                    px={{ base: '16px', md: '22px' }}
                    py="12px"
                    borderTopWidth="1px"
                    borderColor="hg.divider"
                    bg="hg.card"
                    borderBottomRadius="hg.lg"
                    // Phones: the step's primary button stays at the bottom of the screen.
                    position={{ base: 'sticky', md: 'static' }}
                    bottom="0"
                    zIndex={1}
                >
                    {showBack ? (
                        <Button variant="ghost" size="sm" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={onBack}>
                            <LuArrowUp aria-hidden />
                            Back
                        </Button>
                    ) : <span />}
                    {action && (
                        <Button
                            variant={hgVariant('primary')}
                            size={{ base: 'lg', md: 'md' }}
                            flex={{ base: '1', md: 'none' }}
                            maxW={{ base: '280px', md: 'none' }}
                            disabled={action.disabled}
                            loading={action.loading}
                            onClick={action.onClick}
                        >
                            {action.label}
                        </Button>
                    )}
                </Flex>
            )}
        </Box>
    )
}
