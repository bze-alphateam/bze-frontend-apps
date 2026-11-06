"use client"

import type { IconButtonProps, SpanProps } from "@chakra-ui/react"
import { ClientOnly, IconButton, Skeleton, Span } from "@chakra-ui/react"
import { ThemeProvider, useTheme } from "next-themes"
import type { ThemeProviderProps } from "next-themes"
import * as React from "react"
import { LuMoon, LuSun } from "react-icons/lu"

export type ColorModeProviderProps = ThemeProviderProps

export function ColorModeProvider(props: ColorModeProviderProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange {...props} />
  )
}

export type ColorMode = "light" | "dark"

export interface UseColorModeReturn {
  /** `undefined` on the server and while the page hydrates: the saved mode is only known in the browser. */
  colorMode: ColorMode | undefined
  setColorMode: (colorMode: ColorMode) => void
  toggleColorMode: () => void
}

const subscribeNever = () => () => {}

/** `false` on the server and during hydration, `true` once the browser has taken over. */
const useHydrated = () => React.useSyncExternalStore(subscribeNever, () => true, () => false)

export function useColorMode(): UseColorModeReturn {
  const { resolvedTheme, setTheme, forcedTheme } = useTheme()
  // next-themes reads the saved mode from localStorage on the browser's first render, which the
  // server cannot see; anything rendered from it would differ from the server HTML, and React
  // keeps the server's attributes on a mismatch. So the mode is reported only after hydration.
  const hydrated = useHydrated()
  const colorMode = hydrated ? forcedTheme || resolvedTheme : undefined
  const toggleColorMode = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }
  return {
    colorMode: colorMode as ColorMode | undefined,
    setColorMode: setTheme,
    toggleColorMode,
  }
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode()
  return colorMode === "dark" ? dark : light
}

export function ColorModeIcon() {
  const { colorMode } = useColorMode()
  return colorMode === "dark" ? <LuMoon /> : <LuSun />
}

type ColorModeButtonProps = Omit<IconButtonProps, "aria-label">

export const ColorModeButton = React.forwardRef<
  HTMLButtonElement,
  ColorModeButtonProps
>(function ColorModeButton(props, ref) {
  const { toggleColorMode } = useColorMode()
  return (
    <ClientOnly fallback={<Skeleton boxSize="8" />}>
      <IconButton
        onClick={toggleColorMode}
        variant="ghost"
        aria-label="Toggle color mode"
        size="sm"
        ref={ref}
        {...props}
        css={{
          _icon: {
            width: "5",
            height: "5",
          },
        }}
      >
        <ColorModeIcon />
      </IconButton>
    </ClientOnly>
  )
})

export const LightMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function LightMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme light"
        colorPalette="gray"
        colorScheme="light"
        ref={ref}
        {...props}
      />
    )
  },
)

export const DarkMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function DarkMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme dark"
        colorPalette="gray"
        colorScheme="dark"
        ref={ref}
        {...props}
      />
    )
  },
)
