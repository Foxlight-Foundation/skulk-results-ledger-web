/**
 * Shared time-window selection for the ledger. One provider at the app root
 * holds the selected window so it persists across navigation (switching
 * Explorer <-> Runs keeps the window) and across reloads (localStorage). See
 * window.ts for the re-aggregation logic the pages apply.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { DEFAULT_WINDOW, windowFromParam, windowToParam } from './window';
import type { TimeWindow } from './window';

const STORAGE_KEY = 'skulk-ledger-window';

interface WindowContextValue {
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  /** Frozen "now" for the provider's lifetime, so every re-aggregation in a
   * render pass uses one consistent clock (a point on the window boundary can't
   * flip mid-render). */
  now: number;
}

const WindowContext = createContext<WindowContextValue | null>(null);

function readStored(): TimeWindow {
  if (typeof localStorage === 'undefined') return DEFAULT_WINDOW;
  try {
    return windowFromParam(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_WINDOW;
  }
}

/** Provides the shared window selection. Wrap the app once. */
export function WindowProvider({ children }: { children: ReactNode }) {
  const [window, setWindowState] = useState<TimeWindow>(readStored);
  const [now] = useState(() => Date.now());

  const setWindow = useCallback((w: TimeWindow) => {
    setWindowState(w);
    try {
      localStorage.setItem(STORAGE_KEY, windowToParam(w));
    } catch {
      // Private mode / storage disabled: selection still works for the session.
    }
  }, []);

  const value = useMemo(() => ({ window, setWindow, now }), [window, setWindow, now]);
  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}

/** Read the shared window selection. Must be inside a WindowProvider. */
export function useWindow(): WindowContextValue {
  const ctx = useContext(WindowContext);
  if (ctx == null) throw new Error('useWindow must be used within a WindowProvider');
  return ctx;
}
