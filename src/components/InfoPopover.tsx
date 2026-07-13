import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styled from 'styled-components';

/**
 * A small "i" trigger that reveals a floating explanatory panel. Opens on hover
 * or keyboard focus (desktop) and toggles pinned on click/tap (touch), so the
 * same control works with a pointer and a finger. Dismisses on Escape, on an
 * outside click, or when focus leaves. Purely presentational: the caller passes
 * the panel content as children.
 */

const Wrap = styled.span`
  position: relative;
  display: inline-flex;
  vertical-align: middle;
`;

const Trigger = styled.button`
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.colors.border2};
  background: transparent;
  color: ${({ theme }) => theme.colors.text3};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: 11px;
  line-height: 1;
  transition: color 0.12s ease, border-color 0.12s ease;

  &:hover,
  &:focus-visible {
    color: ${({ theme }) => theme.colors.cyan};
    border-color: ${({ theme }) => theme.colors.cyan};
    outline: none;
  }
`;

const Panel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  /* Anchor to the icon's left and extend rightward (bottom-start), so an icon
   * near the left of a card does not push the panel off-screen. */
  left: 0;
  z-index: 40;
  width: max-content;
  max-width: min(300px, calc(100vw - 32px));
  background: ${({ theme }) => theme.colors.dusk};
  border: 1px solid ${({ theme }) => theme.colors.border2};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: 12px 14px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  color: ${({ theme }) => theme.colors.text2};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  text-align: left;
  white-space: normal;
`;

/** Props for {@link InfoPopover}. */
export interface InfoPopoverProps {
  /** Accessible label for the trigger, e.g. "About chat-tests". */
  label: string;
  /** Panel content. */
  children: ReactNode;
}

/** Info "i" trigger plus a dismissible floating panel of explanatory content. */
export function InfoPopover({ label, children }: InfoPopoverProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const open = hovered || pinned;

  // The panel is left-anchored to the icon, so on a right-column card or a
  // narrow/touch viewport it can extend past the right edge and clip its own
  // text. Once shown, measure it and nudge it left by exactly the overflow so
  // it stays on screen. max-width already caps it below the viewport width, so
  // a single leftward shift cannot push the left edge off-screen. Re-measured
  // on open and on resize (orientation change on mobile).
  useLayoutEffect(() => {
    if (!open) {
      setShiftX(0);
      return;
    }
    const measure = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const margin = 8;
      // Neutralize any current shift before measuring the natural position.
      panel.style.transform = '';
      const rect = panel.getBoundingClientRect();
      const overflowRight = rect.right - (window.innerWidth - margin);
      setShiftX(overflowRight > 0 ? -Math.ceil(overflowRight) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  useEffect(() => {
    if (!pinned) return;
    // While pinned open, dismiss on Escape or a click outside the control.
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPinned(false);
    }
    function onDown(event: MouseEvent) {
      const node = event.target as Node | null;
      if (wrapRef.current && node && !wrapRef.current.contains(node)) setPinned(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [pinned]);

  return (
    <Wrap
      ref={wrapRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Trigger
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        i
      </Trigger>
      {open && (
        <Panel
          id={panelId}
          ref={panelRef}
          role="note"
          style={shiftX ? { transform: `translateX(${shiftX}px)` } : undefined}
        >
          {children}
        </Panel>
      )}
    </Wrap>
  );
}
