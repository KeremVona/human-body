# Phase 4B Fast First View & Offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Show a skeleton silhouette in under 3 s on Fast 4G, using a ≤ 600 KB merged preview mesh.
- Make repeat visits load from a service-worker cache.
- Make the atlas installable, and usable offline after an explicit download, with a safe, prompt-based update flow.

**Architecture:**
- **Pipeline:** a new stage builds `skeletal-preview.<hash>.glb` from the raw skeletal export (join, simplify, Meshopt). It's recorded as the manifest's optional `preview`.
- **App:** preloads the preview first and draws it with a non-pickable `PreviewModel` until the full skeletal bundle is ready, then fades it out.
- **Caching:** `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`) precaches the shell. Model files are runtime-cached cache-first and content stale-while-revalidate.
- **Settings:** an action downloads everything for offline use, with progress.

**Tech Stack:** Existing, plus `vite-plugin-pwa` (dev dependency; its Workbox dependencies come with it).

**Spec:** `docs/superpowers/specs/2026-11-25-phase-4-design.md` §3 and §5 ("P4 §"). **Depends on:** Plan 4A merged. **Code baseline:** `main` after 4A.

## Global Constraints

- **Preview geometry:**
  - At most **600,000 bytes**. One mesh with no MeshId: node name `skeletal-preview`.
  - Never registered, never pickable (`raycast` is a no-op), and drawn with the bone base look (`TISSUE_LOOKS.bone`).
  - Its transform matches the full bundles' world space exactly: the same origin, rotation and scale settings.
- **Preview lifecycle** (`previewState`): `loading` → `shown` → `fading` → `gone`.
  - It fades over 300 ms once `assets.bundles.skeletal === 'ready'`. Under reduced motion it's removed instantly.
  - A preview that fails to load is skipped silently (`gone`), and the app behaves as in Phase 3.
- **Before the full skeleton is ready:**
  - Picking, hover and the context menu are inert.
  - The chip `t('loading.details')` shows: `Loading details…` in English, `Ayrıntılar yükleniyor…` in Turkish.
- **Performance marks:** `performance.mark('atlas:first-view')` on the preview's first rendered frame (or on the skeletal frame when there's no preview); `performance.mark('atlas:interactive-skeleton')` when skeletal becomes ready.
- **Budgets (P4 §3):** first view < 3,000 ms and interactive skeleton < 6,500 ms on Fast 4G cold; repeat visit < 1,500 ms interactive.
- **Service worker:**
  - Registered only in production builds, unless `E2E_SW=1`.
  - Scope = `import.meta.env.BASE_URL`. `registerType: 'prompt'`, and **no automatic `skipWaiting`**.
  - Cache names: `atlas-models` (cache-first, `**/models/*.glb`, at most 40 entries, LRU) and `atlas-content` (stale-while-revalidate, `**/content/**`).
- **Copy (i18n keys, `en` and `tr`):**
  - `pwa.updateAvailable` `A new version is available.`, `pwa.reload` `Reload`
  - `offline.download` `Download for offline use (≈ {size} MB)`, `offline.progress` `Downloading… {percent}%`, `offline.ready` `Available offline`, `offline.quota` `Not enough storage on this device.`, `offline.failed` `Download failed. Try again.`
- **Size display:** `{size}` = the sum of all bundle bytes, the preview bytes and the content bytes, divided by 1,000,000 and rounded to the nearest whole MB.

## Review Focus

1. **A preview whose world transform doesn't match the full skeleton** gives a visible "jump" at the swap. → Task 1, `preview bounds equal skeletal bounds`, plus the Task 3 e2e overlay check.
2. **A visitor who clicks during the preview phase.** There must be no crash, no selection of the preview, and no stuck hover. → Task 3, the e2e `clicks are inert before details load`.
3. **A new deploy while an old tab is open.** The update toast appears, the old tab keeps working until `Reload`, and `Reload` switches to the new version. → Task 5 e2e.
4. **Storage quota exceeded during the offline download.** The quota message appears, partial progress doesn't break normal online use, and retrying works. → Task 6, `quota errors are reported`.
5. **Offline after the download:** a reload with the network off loads the shell, content and every bundle. → Task 6 e2e.

---

## Task 0: Gate

- [ ] **Step 1:** Confirm Plan 4A is merged (`src/scene/batching/` exists) and `npm run ci && npm run test:e2e` pass.

### Task 1: Pipeline preview stage

**Files:**
- Create: `pipeline/src/preview.ts`
- Modify: `pipeline/src/config.ts` (adds `preview: { from: string; ratio: number; error: number; maxBytes: number }`, defaults `{ from: 'skeletal', ratio: 0.12, error: 0.01, maxBytes: 600000 }`), `pipeline/src/outputs.ts` (writes and keeps the preview file, and records it in the manifest), `pipeline/src/verify.ts` (budget and bounds checks), `pipeline/cli.ts` (`build` runs the preview stage after optimisation), `src/data/schema.ts` (`ManifestSchema.preview` optional), `pipeline/config.json`
- Generated, committed: `public/models/skeletal-preview.<hash>.glb`, `public/models/manifest.json`
- Test: `pipeline/src/preview.test.ts`, extend `outputs.test.ts`, `verify.test.ts`, `src/data/schema.test.ts`

**Interfaces:**
- Produces:
  - `buildPreview(rawGlb: Uint8Array, opts: { ratio: number; error: number }): Promise<{ glb: Uint8Array; bounds: Bounds; triangles: number }>`
    - Uses glTF-Transform: `flatten()`, `join()`, then `weld()` and `simplify({ simplifier: MeshoptSimplifier, ratio, error })`, then strips the normals and recomputes them with `normals()` (smaller files), then `quantize()` and Meshopt compression.
    - The single resulting node is renamed `skeletal-preview`.
    - It's built from the **raw** export (already oriented and centred by `export.py`), so its world space matches.
  - `ManifestSchema.preview?: { file: /^skeletal-preview\.[0-9a-f]{8}\.glb$/; bytes: int; sha256; bounds: { min: Vec3; max: Vec3 } }`
  - `writeOutputs(...)` accepts `preview?: { glb; bounds }` and keeps its file during the stale-file cleanup.
  - `verifyManifest` adds two errors:
    - `preview is <n> bytes, over its <max>-byte budget`
    - `preview bounds differ from skeletal bounds by <d> m`, when any component differs by more than 0.01.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `joins into one named mesh` | a 3-box fixture GLB (the `makeGlb` helper from `optimize.test.ts`) → one node named `skeletal-preview`, one mesh, `EXT_meshopt_compression` used |
| `preview bounds equal skeletal bounds` | the preview bounds equal the union of the input boxes within 1e-3 |
| `simplifies` | a dense sphere fixture (10k triangles) at ratio 0.1 → triangles ≤ 1,500 |
| `outputs keep the preview file` | `writeOutputs` with a preview → the directory has `skeletal-preview.<hash>.glb` and the manifest `preview.file` matches; a stale `skeletal-preview.deadbeef.glb` is removed |
| `verify budgets and bounds` | 700,000-byte preview → the budget error; bounds offset by 0.05 → the bounds error |
| `schema allows a missing preview` | the Phase 3 manifest without `preview` still parses |

- [ ] **Step 2: Run** `npx vitest run pipeline/src src/data/schema.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the stage. Run `npm run assets:build`.
  - Expected: it passes, the preview is ≤ 600,000 bytes, and the other bundles' hashes are **unchanged**: `git diff --stat public/models` shows only the preview file and `manifest.json`.
  - If the preview is over budget, lower `ratio`, but never below a recognisable skeleton. Check that by opening the GLB in a glTF viewer.
- [ ] **Step 4: Run** `npm run ci`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(pipeline): merged skeletal preview bundle"`

### Task 2: Preloading in order

**Files:**
- Modify: `vite.config.ts` (`preloadAssetsPlugin` adds `<link rel="preload" as="fetch" crossorigin fetchpriority="high">` for the preview and `<meta name="atlas-preview" content="<url>">`), `src/main.tsx` (preloads the preview first, then the skeletal bundle once the preview settles, whether it succeeded or failed)
- Test: extend the vite plugin test if one exists; otherwise create `src/main.preload.test.ts` for the ordering helper

**Interfaces:**
- Produces: `startPreloads(doc: Document, preload: (url: string) => Promise<unknown>): Promise<void>`, in `src/scene/preloadOrder.ts`. It reads both meta tags, awaits the preview (ignoring rejection), then starts skeletal. With no preview meta, it starts skeletal right away.

- [ ] **Step 1: Write the failing tests.**
  - With both metas: preload calls go `[preview, skeletal]`, and skeletal starts only after the preview promise settles.
  - If the preview rejects, skeletal still starts.
  - With no preview meta: only skeletal.
- [ ] **Step 2: Run** them. Expected: FAIL. **Implement.** Run them again. Expected: PASS.
- [ ] **Step 3: Check the built HTML.** `npm run build` → `dist/index.html` contains the preview preload with `fetchpriority="high"` and both metas.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "feat(boot): preload skeletal preview before full skeleton"`

### Task 3: PreviewModel, inert interaction and timing marks

**Files:**
- Create: `src/scene/PreviewModel.tsx`, `src/scene/previewState.ts`, `src/features/onboarding/LoadingDetailsChip.tsx`
- Modify: `src/scene/AtlasCanvas.tsx` (mounts the preview outside `<Picking>`), `src/scene/Picking.tsx` (does nothing until skeletal is ready), `src/features/dissection/DissectionMenu.tsx` and `useShortcuts` (selection commands inert until ready), `src/i18n/messages/en.ts` and `tr.ts`, `src/app/testHooks.ts` (adds `previewState()`), `src/App.tsx`
- Test: `src/scene/previewState.test.ts`, `src/features/onboarding/LoadingDetailsChip.test.tsx`

**Interfaces:**
- Produces:
  - `previewState`: an external store with `get(): 'loading' | 'shown' | 'fading' | 'gone'`, plus `set` and `subscribe`.
  - `nextPreviewState(current, event: 'loaded' | 'failed' | 'skeletal-ready' | 'fade-done', reducedMotion: boolean)`, a pure transition function:
    - `loading` + `loaded` → `shown`
    - `loading` + `failed` → `gone`
    - `shown` + `skeletal-ready` → `fading`, or `gone` under reduced motion
    - `loading` + `skeletal-ready` → `gone`
    - `fading` + `fade-done` → `gone`
    - anything else leaves the state unchanged
  - `<PreviewModel url={string} />`:
    - `useGltf(url)`. Its own `MeshPhysicalMaterial` from `TISSUE_LOOKS.bone`, made transparent only while fading.
    - `raycast = () => {}`.
    - On its first `useFrame` after `shown`: `performance.mark('atlas:first-view')`.
    - Fading animates opacity from 1 to 0 over 300 ms with `invalidate`.
    - It unmounts at `gone` and disposes its geometry and material.
  - `<LoadingDetailsChip />`: shown while `boot === 'ready' && bundles.skeletal !== 'ready'`. It's `role="status"` with the i18n copy.
  - When skeletal becomes ready, `App` calls `performance.mark('atlas:interactive-skeleton')`, once.

- [ ] **Step 1: Write the failing tests.**
  - A transition table covering every event above, plus the reduced-motion branch.
  - The chip shows `Loading details…` in `en` while skeletal is `loading`, and hides once it's `ready`.
- [ ] **Step 2: Run** `npx vitest run src/scene/previewState.test.ts src/features/onboarding`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Write the e2e tests,** in a new `e2e/first-view.spec.ts`:

| Test | Steps → expectation |
|---|---|
| `preview shows first, then swaps` | throttle with `page.route` on the skeletal GLB, delaying it 3 s → `previewState()` becomes `shown` while the skeletal bundle is still loading → after release, `gone`, and `atlas:first-view` precedes `atlas:interactive-skeleton` in `performance.getEntriesByType('mark')` |
| `clicks are inert before details load` | while delayed, click the canvas centre → `selection.selectedIds` is `[]` and there are no page errors; the chip `Loading details…` is visible |
| `no jump at swap` | Low quality: screenshot just before the release and just after the fade → the silhouette's bounding box (from non-background pixels, via `page.evaluate` on a canvas readback) differs by ≤ 4 px |
| `missing preview is harmless` | `page.route` the preview to 404 → the app behaves as in Phase 3; `previewState()` is `gone` |

- [ ] **Step 5: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(boot): preview model, inert-until-ready interaction, timing marks"`

### Task 4: PWA plugin, manifest and icons

**Files:**
- Modify: `vite.config.ts` (`VitePWA` config), `package.json` (dev dependency `vite-plugin-pwa`, and `icons` = `tsx scripts/make-icons.ts`), `index.html` (`theme-color`, `apple-touch-icon`)
- Create: `scripts/make-icons.ts` (renders `public/icons/icon.svg` to PNGs with Playwright's Chromium, which is already a dev dependency), `public/icons/icon.svg`, `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `src/pwa/register.ts`
- Test: `src/pwa/register.test.ts`

**Interfaces:**
- Produces:
  - **`VitePWA` options:**
    - `registerType: 'prompt'`, `injectRegister: null`, `devOptions: { enabled: false }`
    - `manifest`: `name` and `short_name` = `APP_NAME`; `start_url` and `scope` = the base path; `display: 'standalone'`; `background_color: '#14171c'`; `theme_color: '#14171c'`; the icons above, with `purpose: 'maskable'` on the maskable one
    - `workbox.globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}']`
    - `additionalManifestEntries`: `content/taxonomy.json`, `content/en/index.json`, `models/manifest.json` and the preview GLB, read from `public/models/manifest.json` at config time, with revisions from file hashes
    - `runtimeCaching`:
      - `{ urlPattern: /\/models\/.+\.glb$/, handler: 'CacheFirst', options: { cacheName: 'atlas-models', expiration: { maxEntries: 40 } } }`
      - `{ urlPattern: /\/content\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'atlas-content' } }`
    - `navigateFallback: 'index.html'`
  - **`shouldRegisterSW(env: { prod: boolean; e2eSw: boolean }): boolean`**: `prod || e2eSw`. `E2E_SW` is exposed at build time as `import.meta.env.VITE_E2E_SW`.
  - **`registerAtlasSW(onNeedRefresh: (update: () => Promise<void>) => void): void`**: wraps `registerSW` from `virtual:pwa-register`, lazily imported.

- [ ] **Step 1: Write the failing test.** `shouldRegisterSW` covers all four combinations.
- [ ] **Step 2: Run** it. Expected: FAIL. **Implement.** Run it again. Expected: PASS.
- [ ] **Step 3: Run** `npm run icons && npm run build`. Expected: `dist/sw.js` and `dist/manifest.webmanifest` exist, and the webmanifest's `scope` and `start_url` equal the base path (check with `ATLAS_BASE_PATH=/human-body/ npm run build`).
- [ ] **Step 4: Run** `npm run test:e2e`. Expected: PASS, with no service worker registered in e2e.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(pwa): installable manifest, icons and workbox caching"`

### Task 5: Update prompt

**Files:**
- Create: `src/pwa/UpdateToast.tsx`
- Modify: `src/App.tsx` (calls `registerAtlasSW` once after boot when `shouldRegisterSW`), the i18n catalogues
- Test: `src/pwa/UpdateToast.test.tsx`

**Interfaces:**
- Produces: `<UpdateToast />`. It holds the `update` function passed to `onNeedRefresh`. It renders `role="status"` with `pwa.updateAvailable` and a `pwa.reload` button that calls `update()` (which posts `SKIP_WAITING` and reloads). It can be dismissed, and doesn't come back for that waiting worker.

- [ ] **Step 1: Write the failing tests.**
  - Before `onNeedRefresh`, nothing renders.
  - After it, the text and `Reload` appear.
  - Clicking `Reload` calls `update` once.
  - The dismiss button hides it.
- [ ] **Step 2: Run** them. Expected: FAIL. **Implement.** Run them again. Expected: PASS.
- [ ] **Step 3: Write `e2e/pwa-update.spec.ts`.** A Playwright project `chromium-sw` runs `E2E_SW=1 npm run build` and `vite preview`.
  - Load the page and wait for `navigator.serviceWorker.controller`.
  - Rebuild with a changed `VITE_BUILD_ID` env var (embedded in `index.html`), and serve it on the same port.
  - Trigger `registration.update()` from the page → the toast `A new version is available.` appears.
  - Click `Reload` → after the reload, `document.querySelector('meta[name="atlas-build"]').content` equals the new build id.
- [ ] **Step 4: Run** `npm run test:e2e -- --project=chromium-sw`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(pwa): prompt-based update toast"`

### Task 6: Offline download

**Files:**
- Create: `src/pwa/offline.ts`, `src/pwa/OfflineDownload.tsx`
- Modify: `src/features/settings/SettingsMenu.tsx` (mounts `OfflineDownload` when a service worker controls the page), the i18n catalogues
- Test: `src/pwa/offline.test.ts`, `src/pwa/OfflineDownload.test.tsx`

**Interfaces:**
- Produces:
  - `offlineUrls(a: { base: string; manifest: Manifest; taxonomy: Taxonomy; locale: Locale; hasMotions: boolean }): string[]`
    - All bundle files and the preview.
    - `content/taxonomy.json`.
    - `content/en/index.json` and `content/en/structures/<system>.json` for every taxonomy system that has structures.
    - The same pair under `content/<locale>/` when the locale isn't `en`.
    - `content/motions.json` when `hasMotions`.
  - `offlineSizeMB(manifest: Manifest, contentBytesEstimate: number): number`
  - `downloadForOffline(a: { urls: string[]; cacheFor: (url: string) => Promise<Cache>; fetch: typeof fetch; onProgress: (done: number, total: number) => void }): Promise<'ready' | 'quota' | 'failed'>`
    - Downloads sequentially. `.glb` URLs go to `atlas-models` and everything else to `atlas-content`.
    - A `QuotaExceededError` (by `name`) gives `'quota'`. Any other error gives `'failed'`.
    - Already-cached entries are skipped (`cache.match`).
  - `markOfflineReady(generatedAt: string)` and `isOfflineReady(generatedAt: string): boolean`, using `localStorage['atlas.offline.v1']` with try/catch.
  - `<OfflineDownload />`:
    - A button with `offline.download`. During a download it shows `offline.progress`, with a `progressbar` role, `aria-valuenow` = percent.
    - Afterwards it shows `offline.ready`, `offline.quota` or `offline.failed`, with the button re-enabled on failure.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `lists every needed URL` | fixture manifest (2 bundles plus the preview), taxonomy (3 systems with structures), locale `tr`, motions → 2 + 1 GLBs, taxonomy, 2 en index/structure sets, 2 tr sets, motions; all prefixed with `base` |
| `progress and success` | 4 URLs, fake caches → `onProgress` called with `(1,4)…(4,4)`; result `'ready'` |
| `skips cached` | 2 URLs already in the cache → `fetch` called 2 times for 4 URLs |
| `quota errors are reported` | the third `cache.put` throws `DOMException('x', 'QuotaExceededError')` → `'quota'`; the first two remain cached |
| `other failures` | `fetch` rejects → `'failed'` |
| `ready flag survives throwing storage` | `setItem` throws → no throw; `isOfflineReady` returns false |
| component flow | click download → progressbar → `Available offline`; quota → `Not enough storage on this device.`; the button is enabled again |

- [ ] **Step 2: Run** `npx vitest run src/pwa`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Write `e2e/offline.spec.ts`** (`chromium-sw` project).
  - Load, open Settings, click `Download for offline use (≈ … MB)`, and wait for `Available offline`.
  - `context.setOffline(true)` → reload → the skeleton is interactive, enabling `Muscular` loads it from the cache, and the Inspector shows content for `femur--l`.
- [ ] **Step 5: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(pwa): offline download with progress and quota handling"`

### Task 7: Measurement and docs

**Files:**
- Create: `docs/phase-4b-performance.md`
- Modify: `README.md` (installing, offline use, and how to unregister the service worker manually if a build ever breaks: DevTools → Application → Service workers → Unregister, plus Clear site data), `docs/architecture.md` (the boot sequence with the preview, the caching strategy and the update flow), `src/features/about/AboutDialog.tsx` (an offline note, through i18n)

- [ ] **Step 1: Measure** on the production build, Fast 4G, cold cache, 5 runs each, reporting the median: `atlas:first-view` and `atlas:interactive-skeleton`. Then a repeat visit with a warm SW cache: `atlas:interactive-skeleton`.
- [ ] **Step 2: Measure on real devices.** Repeat the cold Fast 4G and warm runs on the owner's phone (remote debugging, or ask the owner to read the `?debug` overlay, which now shows both marks). If that's not possible, label the results **"emulated, not verified"** and report the gate as unverified.
- [ ] **Step 3: Compare with P4 §3.** If a budget fails, write "Needs optimisation" and stop for the owner.
- [ ] **Step 4: Run** `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "docs: phase 4B first-view and offline measurements"`
