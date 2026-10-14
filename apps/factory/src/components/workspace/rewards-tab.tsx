"use client"

import React from 'react'
import { DenomRewardCard } from '@/components/manage/denom-reward-card'
import type { WorkspaceTabProps } from './types'

/** Not an admin action: anyone may create and fund a token's denom reward. */
export function RewardsTab({ asset }: WorkspaceTabProps) {
    return <DenomRewardCard asset={asset} />
}
