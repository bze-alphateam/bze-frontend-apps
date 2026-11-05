/**
 * Whether the BeePocket wallet can be connected. Until it launches, BeePocket stays in the
 * wallet picker greyed out with a "Coming soon" label (see `splitComingSoonWallets`).
 * Only `NEXT_PUBLIC_BEEPOCKET_ENABLED=true` turns it on, so a build without the variable
 * keeps it off.
 */
export const isBeePocketEnabled = (): boolean => process.env.NEXT_PUBLIC_BEEPOCKET_ENABLED === 'true';
