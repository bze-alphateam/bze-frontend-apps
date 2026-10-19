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

// Explicit annotation (rather than letting TS infer) so the generated .d.ts
// references Chakra's `createToaster` instead of a deep `@zag-js/toast` path,
// which isn't portable under pnpm's nested node_modules (TS2742).
export const toaster: ReturnType<typeof createToaster> = createToaster({
  placement: "top-end",
  pauseOnPageIdle: true,
})

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
 * a 28 px tinted disc around the icon. Same in every app.
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
