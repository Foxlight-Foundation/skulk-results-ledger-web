/**
 * Props for the `StarField` component.
 */
export interface StarFieldProps {
  /** Number of small twinkling stars. Defaults to 160. */
  density?: number;
  /** Number of bright "cross" stars (slightly glowing). Defaults to 7. */
  brightCount?: number;
  /**
   * Deterministic seed. Tests and stories can pass a fixed number to get a
   * stable layout; production mounts leave it undefined for fresh
   * randomness on every mount.
   */
  seed?: number;
  /**
   * Fills the nearest positioned ancestor instead of the viewport. Default
   * is `false` - the star field is fixed to the full viewport so it
   * persists across route changes.
   */
  absolute?: boolean;
  /** Class name passthrough for layout tweaks. */
  className?: string;
}
