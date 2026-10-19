'use client'

import { IconButton } from "@chakra-ui/react"
import { LuSettings } from "react-icons/lu"
import { Sidebar } from "./sidebar/sidebar"
import { SettingsSidebarContent } from "./sidebar/settings-sidebar"
import { hgVariant } from "../theme/variants"

interface SettingsToggleProps {
    accentColor?: string
}

/** The header's settings button (the ghost square of the Header board) and its drawer. */
export function SettingsToggle({ accentColor }: SettingsToggleProps) {
    return (
        <Sidebar
            ariaLabel="Settings"
            trigger={
                <IconButton aria-label="Settings" variant={hgVariant('secondary')} size="md" color="hg.text.secondary">
                    <LuSettings />
                </IconButton>
            }
        >
            <SettingsSidebarContent accentColor={accentColor} />
        </Sidebar>
    )
}
