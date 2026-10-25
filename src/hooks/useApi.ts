import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getDashboard, getHealth } from '../api/client';
import type { DashboardResponse } from '../api/types';

export type HealthState =
  | { status: 'checking'; slow: boolean }
  | { status: 'online'; latencyMs: number; checkedAt: Date }
  | { status: 'offline'; message: string; checkedAt: Date };

const SLOW_THRESHOLD_MS = 4_000;

export function useHealth() {
  const [state, setState] = useState<HealthState>({ status: 'checking', slow: false });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // Ignore (rather than abort) superseded requests; the client dedupes in-flight fetches.
    let stale = false;
    setState({ status: 'checking', slow: false });
    const slowTimer = setTimeout(() => setState({ status: 'checking', slow: true }), SLOW_THRESHOLD_MS);
    const started = performance.now();

    getHealth()
      .then((res) => {
        if (stale) return;
        if (res.status !== 'ok') throw new ApiError(`Backend reported status “${res.status}”.`, 'http');
        setState({ status: 'online', latencyMs: Math.round(performance.now() - started), checkedAt: new Date() });
      })
      .catch((err: unknown) => {
        if (stale) return;
        setState({ status: 'offline', message: err instanceof Error ? err.message : 'Unknown error', checkedAt: new Date() });
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      stale = true;
      clearTimeout(slowTimer);
    };
  }, [nonce]);

  const recheck = useCallback(() => setNonce((n) => n + 1), []);
  return { state, recheck };
}

export type DashboardState =
  | { status: 'loading'; slow: boolean; previous: DashboardResponse | null }
  | { status: 'success'; data: DashboardResponse; fetchedAt: Date }
  | { status: 'error'; error: string; previous: DashboardResponse | null };

export function useDashboard(month: string) {
  const [state, setState] = useState<DashboardState>({ status: 'loading', slow: false, previous: null });
  const [nonce, setNonce] = useState(0);
  const lastData = useRef<DashboardResponse | null>(null);

  useEffect(() => {
    let stale = false;
    setState({ status: 'loading', slow: false, previous: lastData.current });
    const slowTimer = setTimeout(
      () => setState({ status: 'loading', slow: true, previous: lastData.current }),
      SLOW_THRESHOLD_MS,
    );

    getDashboard(month)
      .then((data) => {
        if (stale) return;
        lastData.current = data;
        setState({ status: 'success', data, fetchedAt: new Date() });
      })
      .catch((err: unknown) => {
        if (stale) return;
        setState({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error', previous: lastData.current });
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      stale = true;
      clearTimeout(slowTimer);
    };
  }, [month, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}
