# Application Architecture

For deeper design rationale and data contracts, see the [Design Specification](superpowers/specs/2026-11-21-anatomy-atlas-design.md).

## Layer Overview

```text
┌─────────────────────────── React DOM (Tailwind + Radix) ───────────────────────────┐
│  TopBar · SearchBox · SettingsMenu · AboutDialog · LeftPanel (Sys/Browse/Pins/Mot) │
│  Inspector · Toolbar · HoverLabel · ExitChips · FirstRunHint · DissectionMenu      │
│  QuizBanner · QuizSummary · SharePopover · ShareNotice · PinLayer · PinEditor      │
│  SectionPopover · ToursDialog · TourBar · SelectionAnnouncer · DebugStats          │
└───────────────▲───────────────────────────────────────────────▲────────────────────┘
                │ useAppSelector / useAppDispatch               │ CameraApi (context)
┌───────────────┴───────────── Redux Toolkit store ─────────────┴────────────────────┐
│  assets · content · systems · dissection(+past) · selection · quiz · ui · share    │
│  pins · section · motion · tour                                                    │
└───────────────▲────────────────────────────────────────────────────────────────────┘
                │ store.subscribe (imperative)                ▲ dispatch on pointer events
┌────────────────────────────── R3F Scene ────────────────────┴──────────────────────┐
│  <Canvas frameloop="demand"> · Lights · CameraRig · Picking · BatchLayer           │
│  BundleModel×N · PinProbe · SectionController · MotionPlayer · SceneStateApplier   │
│  MeshRegistry · BatchRegistry · MaterialLibrary ((system × tissue/color × state))  │
└───────────────▲────────────────────────────────────────────────────────────────────┘
                │ fetch (static assets + content)
┌───────────────┴──────────── Static files ──────────────────────────────────────────┐
│  models/manifest.json · models/*.glb · content/motions.json · content/<loc>/*.json │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **UI shell (`src/features/`, `src/ui/`):** Presentational components and Radix primitives (`Dialog`, `Switch`, `Slider`, `Tabs`, `Popover`, `RadioGroup`, `DropdownMenu`) read slice state via memoized selectors and call `CameraApi` directly for imperative camera transitions (`focusMeshes`, `goToPreset`, `resetView`, `setPose`, `lookAtPoint`). Lazy-loaded overlays (`SharePopover`, `ShareNotice`, `PinLayer`, `PinEditor`, `PinsPanel`, `MotionPanel`, `SectionPopover`, `ToursDialog`, `TourBar`) keep startup chunks small until used.
- **Store (`src/app/store.ts`):** Coordinates application state and side-effect thunks (`assets/bootstrap`, bundle downloads, lazy structure content fetches, share link restore, pin placement, motion demo loading).
- **3D Scene (`src/scene/`):** React Three Fiber hosts `<Canvas frameloop="demand">`, lighting (`Lights.tsx`), `CameraRig.tsx` (`camera-controls`), pointer picking (`Picking.tsx`), `BundleModel.tsx`, `SceneStateApplier.tsx`, `SectionController.tsx` (mutates one shared `THREE.Plane` across `MaterialLibrary` with `DoubleSide` back-face unlit caps, skips clipped ray hits by setting `raycaster.firstHitOnly = false`, and suppresses selection outlines while sectioning), lazy `PinProbe.tsx` (projects local pin positions into `pinScreens` and throttles occlusion raycasts), and lazy `MotionPlayer.tsx` (`src/scene/motionTransforms.ts` snapshots and restores mesh transforms cleanly, advances phase via `motionPhase.ts`, rotates/scales moving meshes in place, and updates agonist pulse intensity without Redux-per-frame dispatches).

## Key Performance Rule: Meshes Are Not React Components

Individual anatomical meshes (`1,406` meshes across the six asset bundles) are **never** mounted as React components subscribed to Redux:

1. **Register once (`BundleModel`, `MeshRegistry`, & `BatchRegistry`):** When a glTF bundle resolves via `GLTFLoader` + `MeshoptDecoder`, `BundleModel` traverses its scene graph once, registers each `THREE.Mesh` inside `MeshRegistry` (`Map<MeshId, Mesh>`), and (unless `?batching=off`) calls `buildBatches` (`src/scene/batching/buildBatches.ts`) to group normalized geometries by appearance key into `THREE.BatchedMesh` handles with `three-mesh-bvh` `computeBatchedBoundsTree`. Individual mesh BVHs are built lazily only when promoted or needed for pin occlusion (`PinProbe`), and all batches are disposed and removed from `BatchRegistry` on bundle unload/retry.
2. **Resolve → Diff → Plan → Apply (`SceneStateApplier.tsx`):**
   - **Resolve:** `SceneStateApplier` subscribes imperatively to `store.subscribe(...)`, `MeshRegistry`, and `BatchRegistry` (scheduled via microtask coalescing) and computes `selectResolvedMeshStates(state, meshIds)`, combining `systems` enabled flags/opacities, `dissection` sets (`hidden`, `isolated`, `faded`), `motion` ghost/active agonist overrides, `selection.selectedIds`, and `selection.hoveredId`.
   - **Diff & Materials:** `applyMeshStates` (`src/scene/applyMeshStates.ts`) tracks `userData.atlasVisible` and `userData.pickable` and swaps shared `MeshPhysicalMaterial`s from `MaterialLibrary` (`src/scene/materials.ts`).
   - **Batch Plan & Promotion (`src/scene/batching/`):**
     - **Appearance key:** `${bundleId}|${system}|${tissue}|${color ?? ''}` (or `${bundleId}|fallback` when unindexed).
     - **State rule (`planBatches.ts`):** For each batch's visible members, counts `ghost` states against `base` states (`ghost` if `ghosts > bases`, `base` on ties or base majority, `hidden` if zero visible members).
     - **Exclusive promotion (`applyBatchPlan.ts`):** A visible mesh whose material state differs from its batch's state (`hovered`, `selected`, `active`, minority `base`/`ghost`) or that is moving in `MotionPlayer` (`selectMotionMoving`) is **promoted** (`mesh.visible = true`, batch instance hidden); all other visible members render inside the batch (`mesh.visible = false`, batch instance visible), keeping `mesh.userData.atlasVisible`, `mesh.userData.pickable`, and `batch.userData.pickable` (`Uint8Array`) synchronized for `meshIdOfHit` / `PinProbe`. Unchanged frames skip `BatchedMesh.setVisibleAt` calls.
     - **Kill switch (`flag.ts`):** `?batching=off` disables batch creation and promotion, falling back directly to individual mesh visibility (`Phase 3` path).

## Redux Slices

Configured in `src/app/store.ts` with `listenerMiddleware` (`src/app/listeners.ts`):

| Slice | File | Responsibility |
| --- | --- | --- |
| `assets` | `src/features/assets/assetsSlice.ts` | Boot lifecycle (`idle/loading/ready/error`), `manifest.json`, per-bundle download state, active load queue (`requested`). |
| `content` | `src/features/content/contentSlice.ts` | Holds `content/taxonomy.json`, localized `index.json` + `enIndex`, lazily fetched `structures/<system>.json`, and per-ID fallback tracking (`src/features/content/localize.ts`). |
| `systems` | `src/features/systems/systemsSlice.ts` | Per-system `{ enabled, opacity }` state (`skeletal` enabled on launch; `integumentary` defaults to `0.35` translucent opacity via `DEFAULT_OPACITY`, others `1`). |
| `dissection` | `src/features/dissection/dissectionSlice.ts` | `{ hidden, isolated, faded, fadeOpacity }` (stored as sorted `MeshId[]`) plus bounded `past[]` undo snapshots (up to 50 steps) with consecutive identical action coalescing. |
| `selection` | `src/features/selection/selectionSlice.ts` | `selectedIds` (single mesh or left/right mirror target) and `hoveredId` (dispatched only when the hovered mesh ID changes). |
| `quiz` | `src/features/quiz/quizSlice.ts` | 10-question Find & Click study quiz (`questions`, `current`, `score`, `status`) and best-score persistence (`atlas.quiz.v1`). |
| `ui` | `src/features/settings/uiSlice.ts` | Graphics quality preference (`auto`, `high`, `low`) and active UI locale (`en` / `tr`, synced with `atlas.locale` and `src/i18n/t.ts`). |
| `share` | `src/features/share/shareSlice.ts` | Non-blocking view-link status banners (`skipped`, `newer-version`, `malformed`). |
| `pins` | `src/features/pins/pinsSlice.ts` | Personal and shared `#v1.` 3D pins (`items`, 200 own-pin cap, single-step Delete Undo, active `editingId` target) and `localStorage` persistence (`atlas.pins.v1`). |
| `section` | `src/features/section/sectionSlice.ts` | Single live cross-section plane (`enabled`, `axis`, `t` quantized to `0.005`, `flip`). |
| `motion` | `src/features/motion/motionSlice.ts` | Illustrative motion demo catalog (`content/motions.json`), active demo, playback/speed/scrub phase, and ghost/agonist overrides. |
| `tour` | `src/features/tours/tourSlice.ts` | Lazily loaded guided tour catalog (`content/tours.json` + `content/<locale>/tours.json`), active tour/step index, pre-tour `savedView` restore snapshot, and `#tour/` notice state. |

## Bundles vs. Biological Systems

Storage bundles are shaped for download budgets and progressive streaming, whereas UI toggles follow biological organization:

- **6 asset bundles (`public/models/manifest.json`):** `skeletal` (`263` meshes), `muscular` (`459` meshes), `organs` (`73` meshes), `cardiovascular` (`216` meshes), `lymphatic` (`153` meshes), and `skin` (`242` meshes).
- **9 populated biological systems (`content/taxonomy.json`):** `skeletal`, `muscular`, `cardiovascular`, `lymphatic`, `integumentary` (default opacity `0.35`), plus four visceral/neural systems (`nervous`, `respiratory`, `digestive`, `urinary`) alongside shared lymphatic organs grouped cleanly via system toggles.

## Progressive Loading Sequence & Offline Caching

1. **HTML Preloads (`index.html` + `src/main.tsx` + `src/scene/preloadOrder.ts`):** `<link rel="preload" fetchpriority="high">` prioritizes `models/skeletal-preview.<hash>.glb` (`490 KB`) alongside `models/manifest.json`, `content/taxonomy.json`, and `content/en/index.json`. `startPreloads()` awaits the preview GLB fetch before queuing the full `skeletal` bundle (`4.7 MB`) so the silhouette lands first even on mobile networks.
2. **Preview Silhouette → Interactive Skeleton (`PreviewModel.tsx` + `LoadingDetailsChip.tsx`):** `<PreviewModel>` renders outside `<Picking>` using bone styling and marks `atlas:first-view`, while picking, context menu, and selection shortcuts remain inert with `<LoadingDetailsChip>` visible (`"Loading anatomy details…"`) until `assets.bundles.skeletal === 'ready'`, after which `PreviewModel` fades out over `300 ms` (or hides immediately under `prefers-reduced-motion`) and `App.tsx` marks `atlas:interactive-skeleton`.
3. **Core Boot (`assets/bootstrap`):** Loads `manifest.json`, `taxonomy.json`, and `en/index.json` (plus localized `content/<locale>/index.json` when non-English) in parallel, then transitions `assets.boot` to `'ready'`.
4. **Queued Background Bundles (`BundleScheduler.tsx`):** Once booted, `BundleScheduler` advances `BUNDLE_LOAD_ORDER` (`muscular`, `organs`, `cardiovascular`, `lymphatic`, `skin`) one bundle at a time (`requested`), or prioritizes a bundle immediately if the user toggles its system early.
5. **On-Demand Content Details (`src/app/listeners.ts`):** Per-system prose files (`content/en/structures/<system>.json` and active locale overlay `content/<locale>/structures/<system>.json`) fetch lazily when a bundle becomes ready or a structure from that system is selected, and reload active entries automatically on `localeSet`.
6. **PWA Service Worker (`vite-plugin-pwa` + `src/pwa/`):** Registered only in production (`import.meta.env.PROD`) or when `E2E_SW=1` via `registerAtlasSW()`. Precaches the Vite shell cleanly, caches `models/*.{glb,json}` (`CacheFirst`) and `content/*.json` (`StaleWhileRevalidate`) with `ignoreVary: true`, holds SW updates behind `<UpdateToast />` (`registerType: 'prompt'`), and offers opt-in full asset download in `Settings → Offline access` (`<OfflineDownload />`) with storage quota protection.

## Test Strategy

- **Asset pipeline (`Vitest`, node project):** Unit tests under `pipeline/src/*.test.ts` cover name curation (`nameMap`), Blender selection rules (`resolvePlan`), Meshopt optimization (`optimize`), manifest serialization, and verification probes (`verify`).
- **Application & UI (`Vitest`, jsdom project):** Unit tests verify schema parsing (`src/data/schema.test.ts`), featured content rules (`src/data/checkContent.test.ts`), selectors, state resolution (`resolveMeshState`, `applyMeshStates`), keyboard shortcuts, Inspector/Toolbar/SystemsPanel/`AboutDialog` accessibility, and suspense glTF caching.
- **Content & Asset Integrity Gates (`npm run check:content`, `npm run assets:verify`):** Enforce plain-text limits, featured completeness (`125` featured entries), verified citations, GLB dimensions, and body orientation probes.
- **Browser End-to-End (`Playwright`, `npm run test:e2e`, `npm run test:e2e:sw`, & `npm run test:e2e:base`):** Tests real WebGL picking, preview-before-skeletal progressive view (`e2e/first-view.spec.ts`), orbit/pan gestures, dissection undo/isolate/fade flows, guided tour playback and deep links (`e2e/tours.spec.ts`), mobile bottom-sheet layout (`Pixel 7`), long-name wrapping (`e2e/layout.spec.ts`), prompt-based Service Worker updates and offline caching (`e2e/pwa-update.spec.ts`, `e2e/offline.spec.ts`), and production sub-path builds (`ATLAS_BASE_PATH=/atlas-check/`).
