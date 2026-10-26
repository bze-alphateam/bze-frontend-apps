"use client"

import React from 'react'
import { Notice } from '@bze/bze-ui-kit'

interface InfoBoxProps {
    title?: string;
    children: React.ReactNode;
}

// Info-box pattern from the spec's Fee UX principles: short inline explanations for
// non-obvious concepts (escrow, admin renounce, canonical pair ordering, LP tokens).
export function InfoBox({ title, children }: InfoBoxProps) {
    return <Notice status="info" title={title}>{children}</Notice>
}
