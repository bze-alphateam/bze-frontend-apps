"use client"

import React from 'react'
import { AdminActions } from '@/components/manage/admin-card'
import { AdminUnknownNotice, NotAdminNotice, RenouncedNotice } from './admin-notices'
import type { WorkspaceTabProps } from './types'

/** Today's admin actions (danger zone) for the admin, the state notice for everyone else. */
export function ControlTab({ asset, admin, adminState, refreshAdmins }: WorkspaceTabProps) {
    switch (adminState) {
        case 'admin':
            return <AdminActions asset={asset} onChanged={refreshAdmins} />
        case 'unknown':
            return <AdminUnknownNotice onRetry={() => void refreshAdmins()} />
        case 'renounced':
            return <RenouncedNotice />
        default:
            return <NotAdminNotice admin={admin} />
    }
}
