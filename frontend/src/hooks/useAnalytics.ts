/**
 * useAnalytics — GA4 integration.
 * Only loads if VITE_GA_MEASUREMENT_ID env var is defined.
 * Fires page_view on every route change.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MEASUREMENT_ID = (import.meta as any).env?.VITE_GA_MEASUREMENT_ID as string | undefined;
let gaLoaded = false;

function loadGA(id: string) {
  if (gaLoaded || !id) return;
  gaLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function (...args: unknown[]) { window.dataLayer!.push(args); };
  window.gtag('js', new Date());
  window.gtag('config', id, { send_page_view: false });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!MEASUREMENT_ID || !window.gtag) return;
  window.gtag('event', name, params);
}

export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    if (!MEASUREMENT_ID) return;
    loadGA(MEASUREMENT_ID);
  }, []);

  useEffect(() => {
    if (!MEASUREMENT_ID || !window.gtag) return;
    window.gtag('event', 'page_view', { page_path: location.pathname + location.search });
  }, [location]);
}
