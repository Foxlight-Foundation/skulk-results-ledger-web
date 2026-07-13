import styled from 'styled-components';

import { useWindow } from '../data/useWindow';
import { WINDOW_OPTIONS } from '../data/window';
import type { TimeWindow } from '../data/window';

const Group = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Eyebrow = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  letter-spacing: 0.3px;
  /* text2 rather than the dim text3: this is an interactive control, and text3
   * washed out against the starfield on the deployed site. */
  color: ${({ theme }) => theme.colors.text2};
`;

const Segments = styled.div`
  display: inline-flex;
  border: 1px solid ${({ theme }) => theme.colors.border2};
  border-radius: ${({ theme }) => theme.radii.pill};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.moonWash};
`;

const Segment = styled.button<{ $active: boolean }>`
  appearance: none;
  cursor: pointer;
  border: none;
  background: ${({ $active, theme }) => ($active ? theme.colors.cyanWash : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.cyan : theme.colors.text2)};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.eyebrow};
  letter-spacing: 0.3px;
  padding: 4px 11px;
  transition: background 0.12s ease, color 0.12s ease;

  & + & {
    border-left: 1px solid ${({ theme }) => theme.colors.border2};
  }

  &:hover {
    color: ${({ theme }) => theme.colors.text1};
  }
`;

/**
 * Segmented time-window selector (7d / 14d / 30d / 90d / All). Scopes the
 * headline medians and run lists to the selected period so a stale run cannot
 * drag the "current" number. Reads/writes the shared selection via useWindow.
 */
export function TimeWindowControl({ label = 'Period' }: { label?: string }) {
  const { window, setWindow } = useWindow();
  return (
    <Group role="group" aria-label="Time window">
      <Eyebrow>{label}</Eyebrow>
      <Segments>
        {WINDOW_OPTIONS.map((opt) => {
          const active = opt.value === window;
          return (
            <Segment
              key={opt.label}
              type="button"
              $active={active}
              aria-pressed={active}
              onClick={() => setWindow(opt.value as TimeWindow)}
            >
              {opt.label}
            </Segment>
          );
        })}
      </Segments>
    </Group>
  );
}
