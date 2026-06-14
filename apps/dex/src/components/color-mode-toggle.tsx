"use client"

import {Button} from "@chakra-ui/react"
import { useTheme } from "next-themes"
import { LuMoon, LuSun } from "react-icons/lu"

export function ColorModeToggle() {
    const { theme, setTheme } = useTheme()
    const toggleColorMode = () => {
        setTheme(theme === "light" ? "dark" : "light")
    }

    return (
        <Button size={{ base: 'sm', md: 'md' }} onClick={toggleColorMode}>
            {theme === "light" ? <LuMoon /> : <LuSun />}
        </Button>
    )
}