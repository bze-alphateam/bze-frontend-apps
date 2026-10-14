"use client"

import React, { useRef, useState } from 'react'
import { Button, IconButton } from '@chakra-ui/react'
import { LuInfo } from 'react-icons/lu'
import { RewardGuideModal, type RewardGuideModalProps } from './reward-guide-modal'

export interface RewardInfoButtonProps extends Pick<RewardGuideModalProps, 'onPick' | 'denom'> {
    /** Shows "Which one?" next to the icon. */
    withLabel?: boolean;
}

/** ⓘ next to the word "reward" that opens "Which reward fits?". */
export function RewardInfoButton({ withLabel = false, ...modalProps }: RewardInfoButtonProps) {
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)

    return (
        // React events bubble through the portal to this tree's parents: keep clicks inside the
        // button and the dialog away from a clickable card around it.
        <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
            {withLabel ? (
                <Button ref={buttonRef} variant="ghost" size="xs" colorPalette="yellow" aria-label="Which reward fits?" onClick={() => setOpen(true)}>
                    <LuInfo /> Which one?
                </Button>
            ) : (
                <IconButton ref={buttonRef} variant="ghost" size="xs" colorPalette="yellow" aria-label="Which reward fits?" onClick={() => setOpen(true)}>
                    <LuInfo />
                </IconButton>
            )}
            <RewardGuideModal
                {...modalProps}
                open={open}
                onClose={() => setOpen(false)}
                finalFocusEl={() => buttonRef.current}
            />
        </span>
    )
}
