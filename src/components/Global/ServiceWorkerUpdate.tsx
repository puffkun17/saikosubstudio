'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const SW_URL = '/sw.js';
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the offline service worker (production builds only) and shows a light,
 * non-blocking notice when a new version is waiting. Never reloads on its own:
 * the page only reloads after the user clicks “刷新”, and the existing
 * beforeunload guard (useSessionLeaveWarning) still protects in-progress work.
 */
export const ServiceWorkerUpdate: React.FC = () => {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return;

    let registration: ServiceWorkerRegistration | null = null;
    let interval: number | undefined;
    let cancelled = false;

    const offerUpdate = (worker: ServiceWorker | null) => {
      // Only an *update* (an existing controller) deserves a notice; the first install is silent.
      if (!cancelled && worker && navigator.serviceWorker.controller) {
        setWaiting(worker);
        setDismissed(false);
      }
    };

    const trackInstalling = (reg: ServiceWorkerRegistration) => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') offerUpdate(reg.waiting ?? worker);
      });
    };

    const onControllerChange = () => {
      if (reloadRequested.current) window.location.reload();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => undefined);
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' });
        if (cancelled) return;
        registration = reg;
        if (reg.waiting) offerUpdate(reg.waiting);
        if (reg.installing) trackInstalling(reg);
        reg.addEventListener('updatefound', () => trackInstalling(reg));
        interval = window.setInterval(() => reg.update().catch(() => undefined), UPDATE_CHECK_INTERVAL_MS);
      } catch {
        // Offline support is progressive enhancement; ignore registration failures.
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', onVisible);
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('load', register);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    reloadRequested.current = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);

  if (!waiting || dismissed) return null;

  return (
    <div className="sw-update-notice" role="status" aria-live="polite" data-testid="sw-update-notice">
      <div className="ui-toast pointer-events-auto flex items-center gap-2.5 border px-3.5 py-2.5 text-sm">
        <span className="min-w-0 flex-1 font-medium leading-5">有新版本，刷新即可更新</span>
        <button
          type="button"
          onClick={applyUpdate}
          className="v4-focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-[var(--v5-accent-strong)] transition-colors hover:bg-[var(--v5-accent-soft)]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          刷新
        </button>
        <button
          type="button"
          aria-label="稍后再说"
          onClick={() => setDismissed(true)}
          className="v4-focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-md text-current/45 transition-colors hover:bg-black/[0.04] hover:text-current"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
