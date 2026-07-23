/**
 * useAlertFeed
 *
 * Tries to open an SSE stream at /api/sse/alerts.
 * If EventSource is unavailable or the connection errors out within
 * the first few seconds, it falls back to 30-second polling of
 * GET /api/alerts.  Either way the caller gets the same data shape.
 *
 * Usage:
 *   const { counts, latestAlert } = useAlertFeed(token);
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { alertsApi } from '../services/api';
import type { Alert, AlertCounts } from '../types';

interface AlertFeedState {
  counts: AlertCounts | null;
  latestAlert: Alert | null;
  connected: boolean;
  mode: 'sse' | 'polling' | 'idle';
}

const POLL_INTERVAL_MS = 30_000;
const SSE_TIMEOUT_MS   = 5_000;  // fall back if no 'connected' event within 5 s

export function useAlertFeed(token: string | null): AlertFeedState {
  const [state, setState] = useState<AlertFeedState>({
    counts: null, latestAlert: null, connected: false, mode: 'idle',
  });

  const esRef       = useRef<EventSource | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Polling ─────────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return; // already polling
    setState(s => ({ ...s, mode: 'polling', connected: true }));

    const poll = async () => {
      try {
        const data = await alertsApi.getAlerts({ limit: 1, status: 'open' });
        setState(s => ({
          ...s,
          counts:      data.counts,
          latestAlert: data.alerts[0] ?? s.latestAlert,
        }));
      } catch { /* silently ignore — server may be unreachable momentarily */ }
    };

    poll(); // immediate first poll
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── SSE ──────────────────────────────────────────────────────────────────
  const startSse = useCallback(() => {
    if (!token || typeof EventSource === 'undefined') {
      startPolling();
      return;
    }

    // Build SSE URL — in prod the API is on a different origin, use VITE_API_URL
    const base = (import.meta as any).env?.VITE_API_URL ?? '';
    const url  = `${base}/api/sse/alerts`;

    // We can't pass headers to EventSource, so we put the token in the URL
    // via a short-lived query param.  The backend should accept ?token= as
    // an alternative to the Authorization header for SSE only.
    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    // Safety net: if no 'connected' event within SSE_TIMEOUT_MS, fall back
    fallbackRef.current = setTimeout(() => {
      if (state.mode !== 'sse') {
        es.close();
        startPolling();
      }
    }, SSE_TIMEOUT_MS);

    es.addEventListener('connected', () => {
      if (fallbackRef.current) { clearTimeout(fallbackRef.current); fallbackRef.current = null; }
      setState(s => ({ ...s, mode: 'sse', connected: true }));
    });

    es.addEventListener('alert', (e: MessageEvent) => {
      try {
        const alert: Alert = JSON.parse(e.data);
        setState(s => ({
          ...s,
          latestAlert: alert,
          counts: s.counts
            ? { ...s.counts, open: s.counts.open + (alert.status === 'open' ? 1 : 0), total: s.counts.total + 1 }
            : null,
        }));
      } catch { /* ignore malformed event */ }
    });

    es.addEventListener('alert:ack', (e: MessageEvent) => {
      try {
        const { id } = JSON.parse(e.data);
        setState(s => {
          if (!s.latestAlert || s.latestAlert.id !== id) return s;
          return {
            ...s,
            counts: s.counts ? { ...s.counts, open: Math.max(0, s.counts.open - 1), acknowledged: s.counts.acknowledged + 1 } : null,
            latestAlert: { ...s.latestAlert, status: 'acknowledged' as const },
          };
        });
      } catch { /* ignore */ }
    });

    es.addEventListener('alert:resolve', (e: MessageEvent) => {
      try {
        const { id } = JSON.parse(e.data);
        setState(s => {
          if (!s.latestAlert || s.latestAlert.id !== id) return s;
          return {
            ...s,
            counts: s.counts ? { ...s.counts, open: Math.max(0, s.counts.open - 1), resolved: s.counts.resolved + 1 } : null,
            latestAlert: { ...s.latestAlert, status: 'resolved' as const },
          };
        });
      } catch { /* ignore */ }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setState(s => ({ ...s, connected: false, mode: 'polling' }));
      startPolling(); // seamless fallback
    };
  }, [token, startPolling, state.mode]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    startSse();

    return () => {
      esRef.current?.close();
      stopPolling();
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return state;
}
