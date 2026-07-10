/**
 * Props for the `ShootingStars` component.
 */
export interface ShootingStarsProps {
  /** Minimum interval between shooting stars in ms. Defaults to 2500. */
  minIntervalMs?: number;
  /** Maximum interval between shooting stars in ms. Defaults to 9000. */
  maxIntervalMs?: number;
  /** Initial delay before the first star appears. Defaults to 1800. */
  initialDelayMs?: number;
  /**
   * Fill the nearest positioned ancestor instead of the viewport. Default
   * is `false` - the layer is fixed to the full viewport.
   */
  absolute?: boolean;
  /** Class name passthrough for layout tweaks. */
  className?: string;
}
