/** Fetch hooks over the generated static data (public/data/*). No backend. */

import { useEffect, useState } from 'react';

import type { LedgerIndex, ModelHistory, RunDetail } from './schema';

const BASE = import.meta.env.BASE_URL;

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

function useJson<T>(path: string | null): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    if (path == null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let live = true;
    setState({ data: null, error: null, loading: true });
    fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<T>;
      })
      .then((data) => {
        if (live) setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (live) {
          setState({ data: null, error: err instanceof Error ? err.message : String(err), loading: false });
        }
      });
    return () => {
      live = false;
    };
  }, [path]);

  return state;
}

export function useIndex(): AsyncState<LedgerIndex> {
  return useJson<LedgerIndex>(`${BASE}data/index.json`);
}

export function useModelHistory(slug: string | undefined): AsyncState<ModelHistory> {
  return useJson<ModelHistory>(slug ? `${BASE}data/models/${slug}.json` : null);
}

export function useRunDetail(runId: string | undefined): AsyncState<RunDetail> {
  return useJson<RunDetail>(runId ? `${BASE}data/runs/${runId}.json` : null);
}
