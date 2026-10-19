/** The button variants the Hive Glow system adds next to Chakra's own. */
export type HiveGlowButtonVariant = 'primary' | 'secondary' | 'danger';
/** The status tones the Hive Glow system adds to badges and tags. */
export type HiveGlowToneVariant = 'info' | 'warning' | 'danger' | 'success' | 'neutral';

/**
 * A Hive Glow recipe variant, typed for any Chakra `variant` prop: `<Button variant={hgVariant('primary')}>`.
 *
 * The repo runs no Chakra typegen, so Chakra's generated prop types only know its own variant
 * names; this is the one cast that lets the added ones through, limited to names the system defines.
 */
export const hgVariant = (variant: HiveGlowButtonVariant | HiveGlowToneVariant) => variant as never;
