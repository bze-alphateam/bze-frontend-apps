'use client'

import {
  Box,
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"
import { useEffect } from "react"

// Explicit annotation (rather than letting TS infer) so the generated .d.ts
// references Chakra's `createToaster` instead of a deep `@zag-js/toast` path,
// which isn't portable under pnpm's nested node_modules (TS2742).
export const toaster: ReturnType<typeof createToaster> = createToaster({
  placement: "top-end",
  pauseOnPageIdle: true,
})

/**
 * A page's own look for the toast surface (any CSS value). The status edge and the icon disc keep
 * the shared status colours, so success, failure and warning stay recognisable on every page.
 */
export interface ToasterTheme {
  bg: string
  fg: string
  muted: string
  /** Close button colour. */
  faint: string
  border: string
  /** Hover fill of the action and close buttons. */
  hover: string
  /** Border of the action button. */
  line: string
  radius?: string
  shadow?: string
  font?: string
}

const THEME_VARS: Record<keyof ToasterTheme, string> = {
  bg: "--hg-toast-bg",
  fg: "--hg-toast-fg",
  muted: "--hg-toast-muted",
  faint: "--hg-toast-faint",
  border: "--hg-toast-border",
  hover: "--hg-toast-hover",
  line: "--hg-toast-line",
  radius: "--hg-toast-radius",
  shadow: "--hg-toast-shadow",
  font: "--hg-toast-font",
}

/** The mounted themes, oldest first; the newest one is on the document root. */
const activeThemes: ToasterTheme[] = []

/** Puts `theme` on the document root, or clears it; optional parts it omits stay on the defaults. */
function applyTheme(theme: ToasterTheme | undefined) {
  const root = document.documentElement.style
  for (const key of Object.keys(THEME_VARS) as (keyof ToasterTheme)[]) {
    const value = theme?.[key]
    if (value === undefined) root.removeProperty(THEME_VARS[key])
    else root.setProperty(THEME_VARS[key], value)
  }
}

/**
 * Themes every toast with `theme` while the calling component is mounted. The toaster renders in a
 * portal under `document.body`, so the variables go on the document root; without them the toast
 * recipe falls back to the Hive Glow tokens. When several components theme the toasts, the most
 * recently mounted one wins and an unmount hands back to the one before it. Pass a stable
 * (memoised) object.
 */
export function useToasterTheme(theme: ToasterTheme | undefined) {
  useEffect(() => {
    if (!theme) return
    activeThemes.push(theme)
    applyTheme(theme)

    return () => {
      activeThemes.splice(activeThemes.lastIndexOf(theme), 1)
      applyTheme(activeThemes[activeThemes.length - 1])
    }
  }, [theme])
}

// The shared status colour of each toast type; a pending transaction reads as amber.
const TONES: Record<string, string> = {
  loading: "warning",
  warning: "warning",
  success: "success",
  error: "danger",
  info: "info",
}

/**
 * The toast frame of CompOverlays: card surface, the status in the edge (theme recipe) and
 * a 28 px tinted disc around the icon. Same in every app; a page can theme the surface with
 * `useToasterTheme`.
 */
export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => {
          const tone = TONES[toast.type ?? "info"] ?? "info"
          return (
            <Toast.Root width={{ md: "360px" }}>
              <Box
                as="span"
                flex="none"
                boxSize="28px"
                borderRadius="full"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                bg={`hg.${tone}/14`}
                color={`hg.${tone}`}
                data-testid="toast-indicator"
                data-tone={tone}
              >
                {toast.type === "loading" ? (
                  <Spinner size="xs" color={`hg.${tone}`} />
                ) : (
                  <Toast.Indicator boxSize="16px" color="inherit" />
                )}
              </Box>
              <Stack gap="2px" flex="1" maxWidth="100%">
                {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
                {toast.description && (
                  <Toast.Description>{toast.description}</Toast.Description>
                )}
              </Stack>
              {toast.action && (
                <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
              )}
              {toast.closable && <Toast.CloseTrigger />}
            </Toast.Root>
          )
        }}
      </ChakraToaster>
    </Portal>
  )
}
