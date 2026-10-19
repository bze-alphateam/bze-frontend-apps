/** The soft app button (secondary app actions): app tint, app edge, plain text. */
export const softButton = {
    variant: 'outline' as const,
    size: 'md' as const,
    color: 'fg',
    borderColor: 'app.border',
    bg: 'app.subtle',
    borderRadius: '10px',
    fontWeight: '600',
    _hover: { bg: 'app.muted' },
    _disabled: { opacity: 0.5 },
}
