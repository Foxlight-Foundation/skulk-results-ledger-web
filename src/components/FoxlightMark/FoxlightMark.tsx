/**
 * FoxlightMark: the primary Foxlight brand icon.
 *
 * A scalable inline SVG with two controllable color layers: the main fox
 * silhouette (`color`) and the inner highlight cutouts (`detailColor`).
 * The background rectangle from the source file is intentionally omitted
 * so the mark composes cleanly onto any surface.
 *
 * Decorative by default (`aria-hidden="true"`). Pass an `aria-label` when
 * used as a standalone meaningful element.
 *
 * @example
 * <FoxlightMark />
 * <FoxlightMark height={64} color="#FF9500" detailColor="#1a1a1a" />
 */
import type { FoxlightMarkProps } from './FoxlightMark.types';

export const FoxlightMark: React.FC<FoxlightMarkProps> = ({
  width: widthProp,
  height: heightProp,
  color = '#FF9500',
  detailColor = '#f0ede8',
  ...rest
}) => {
  const w = widthProp ?? heightProp ?? 26;
  const h = heightProp ?? widthProp ?? 26;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {/* Main fox silhouette */}
      <path
        fill={color}
        d="M478.8,18.25l2.67.51c27.58,25.48,59.62,178.38,71.62,217.23,2.44,7.91,12.6,19.61,20.11,9.87,56.84-73.75,123.17-142.01,202.99-191.25.58-.26,1.16-.52,1.74-.78,6.02,55.62-6.35,129.07-22.77,182.3-8.38,27.16-21.29,61.65-26,89.06,13.94,23.77,33.7,41.52,47.91,67.02,14.5,26.02,13.96,66.73,35.79,83.83,42.73,33.46,96.69,54.83,145.59,77.54,4.51,2.09,11.45,5.89,13.9,10.06,1.28,8.55-.58,15.05-4.68,22.88-15.59,31.9-59.97,78.71-96.12,87.09-61.66,14.3-130.99-7.83-194.15,15.48-65.52,24.18-74.67,77.47-54.29,137.99,8.11,24.08,20.14,44.7,28.94,67.83-27.51-11.58-35.83-19.72-60.48-37.15,3.64,35.77,7.68,55.96,19.15,90.71,7.29,20.16,16.04,39,24.82,58.54-111.54-36.21-227.54-88.35-288.77-194.99-13.68-23.82-23.26-49.59-33.23-75.12-23.27,38.58-30.55,71-35.16,114.81-40.74-36.35-71.37-103.99-78.85-157.45-3.05-21.79-3.13-44.35-3.03-66.34-46.9-7.31-84.48-.5-129.5,9.98,28.19-42.26,54.07-75.79,90.96-111.04,21.59-20.63,45.21-40.21,65.11-62.26-32.26-.26-50.23,3.52-81.69,9.3,35.37-45.46,84.95-67.63,117.9-109.46,11.13-14.13,26.9-72.75,35.44-95.42,29.04-77.12,118.33-204.35,184.09-250.75Z"
      />
      {/* Inner leaf / vein highlight */}
      <path
        fill={detailColor}
        d="M461.75,115.37c6.06,7.55,13.01,34.87,15.28,44.75,9.49,41.28,18.39,83.19,11.83,125.56-18.35,16.35-63.79,41.97-86.94,58.2l-15.45,11.33c-23.26-77.91,20.58-184.14,75.28-239.85Z"
      />
      {/* Eye highlight */}
      <path
        fill={detailColor}
        d="M635.22,435.3c14.09-2.66,28.53,2.45,37.81,13.38,9.28,10.94,11.97,26.01,7.05,39.48-4.92,13.47-16.7,23.26-30.84,25.63-21.56,3.62-42.01-10.8-45.85-32.32-3.84-21.52,10.37-42.12,31.85-46.18Z"
      />
    </svg>
  );
};
