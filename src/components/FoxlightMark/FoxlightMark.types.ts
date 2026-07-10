/**
 * Props for the `FoxlightMark` SVG component - the primary Foxlight brand icon.
 *
 * Extends native `<svg>` element props so consumers can pass `aria-*`,
 * `className`, event handlers, etc., without re-declaring them.
 */
import type { SVGProps } from 'react';

export interface FoxlightMarkProps extends SVGProps<SVGSVGElement> {
  /**
   * Width in pixels. Defaults to `height` if provided, otherwise `26`.
   * Overrides the `width` from `SVGProps`.
   */
  width?: number | undefined;
  /**
   * Height in pixels. Defaults to `width` if provided, otherwise `26`.
   * Overrides the `height` from `SVGProps`.
   */
  height?: number | undefined;
  /**
   * Main body color - the fox silhouette fill. Defaults to Foxfire Gold
   * (`#FF9500`).
   */
  color?: string | undefined;
  /**
   * Detail color - the inner highlight paths that create the eye and
   * leaf-vein cutouts. Should match the background to maintain the
   * punched-out effect. Defaults to moonlight white (`#f0ede8`).
   */
  detailColor?: string | undefined;
}
