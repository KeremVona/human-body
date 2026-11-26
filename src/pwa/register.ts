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
          onNeedRefresh(async () => {
            const controllerChanged = new Promise<void>((resolve) => {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => resolve(),
                { once: true },
              );
            });
            await updateSW(true);
            // Workbox only auto-reloads when an SW was already controlling at register();
            // explicitly wait for the waiting SW to claim before reloading on any visit.
            await Promise.race([
              controllerChanged,
              new Promise<void>((resolve) => setTimeout(resolve, 1500)),
            ]);
            window.location.reload();
          });
        },
      });
    })
    .catch(() => {
      // Non-fatal if SW registration fails in private browsing or unsupported origins.
    });
}
