/** Determines whether the service worker should be registered in the current runtime. */
export function shouldRegisterSW(env: {
  prod: boolean;
  e2eSw: boolean;
}): boolean {
  return env.prod || env.e2eSw;
}

/** Registers the prompt-based Workbox service worker in production or when `VITE_E2E_SW=1`. */
export function registerAtlasSW(
  onNeedRefresh: (update: () => Promise<void>) => void,
): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  const enabled = shouldRegisterSW({
    prod: import.meta.env.PROD,
    e2eSw: import.meta.env.VITE_E2E_SW === '1',
  });
  if (!enabled) {
    return;
  }

  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh() {
          onNeedRefresh(() => updateSW(true));
        },
      });
    })
    .catch(() => {
      // Non-fatal if SW registration fails in private browsing or unsupported origins.
    });
}
