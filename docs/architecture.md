# Application Architecture

For deeper design rationale and data contracts, see the [Design Specification](superpowers/specs/2026-11-21-anatomy-atlas-design.md).

## Layer Overview

```text
┌─────────────────────────── React DOM (Tailwind + Radix) ───────────────────────────┐
│  TopBar · SearchBox · SettingsMenu · AboutDialog · LeftPanel (Sys/Browse/Pins/Mot) │
│  Inspector · Toolbar · HoverLabel · ExitChips · FirstRunHint · DissectionMenu      │
│  QuizBanner · QuizSummary · SharePopover · ShareNotice · PinLayer · PinEditor      │
│  SectionPopover · SelectionAnnouncer · DebugStats                                  │
└───────────────▲───────────────────────────────────────────────▲────────────────────┘
                │ useAppSelector / useAppDispatch               │ CameraApi (context)
┌───────────────┴───────────── Redux Toolkit store ─────────────┴────────────────────┐
│  assets · content · systems · dissection(+past) · selection · quiz · ui · share    │
│  pins · section · motion                                                           │
└───────────────▲────────────────────────────────────────────────────────────────────┘
                │ store.subscribe (imperative)                ▲ dispatch on pointer events
┌───────────────┴────────────── R3F Scene ────────────────────┴──────────────────────┐
│  <Canvas frameloop="demand"> · Lights · CameraRig · <Bvh> · BundleModel×N          │
│  Picking · PinProbe · SectionController · MotionPlayer · SceneStateApplier         │
│  MeshRegistry · MaterialLibrary ((system × tissue-or-color × variant) + clip/cap)  │
└───────────────▲────────────────────────────────────────────────────────────────────┘
                │ fetch (static assets + content)
┌───────────────┴──────────── Static files ──────────────────────────────────────────┐
│  models/manifest.json · models/*.glb · content/motions.json · content/<loc>/*.json │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **UI shell (`src/features/`, `src/ui/`):** Presentational components and Radix primitives (`Dialog`, `Switch`, `Slider`, `Tabs`, `Popover`, `RadioGroup`, `DropdownMenu`) read slice state via memoized selectors and call `CameraApi` directly for imperative camera transitions (`focusMeshes`, `goToPreset`, `resetView`, `setPose`, `lookAtPoint`). Lazy-loaded overlays (`SharePopover`, `ShareNotice`, `PinLayer`, `PinEditor`, `PinsPanel`, `MotionPanel`, `SectionPopover`) keep startup chunks small until used.
- **Store (`src/app/store.ts`):** Coordinates application state and side-effect thunks (`assets/bootstrap`, bundle downloads, lazy structure content fetches, share link restore, pin placement, motion demo loading).
- **3D Scene (`src/scene/`):** React Three Fiber hosts `<Canvas frameloop="demand">`, lighting (`Lights.tsx`), `CameraRig.tsx` (`camera-controls`), pointer picking (`Picking.tsx`), `BundleModel.tsx`, `SceneStateApplier.tsx`, `SectionController.tsx` (mutates one shared `THREE.Plane` across `MaterialLibrary` with `DoubleSide` back-face unlit caps, skips clipped ray hits by setting `raycaster.firstHitOnly = false`, and suppresses selection outlines while sectioning), lazy `PinProbe.tsx` (projects local pin positions into `pinScreens` and throttles occlusion raycasts), and lazy `MotionPlayer.tsx` (`src/scene/motionTransforms.ts` snapshots and restores mesh transforms cleanly, advances phase via `motionPhase.ts`, rotates/scales moving meshes in place, and updates agonist pulse intensity without Redux-per-frame dispatches).

## Key Performance Rule: Meshes Are Not React Components

Individual anatomical meshes (`1,406` meshes across the six asset bundles) are **never** mounted as React components subscribed to Redux:

1. **Register once (`BundleModel` + `MeshRegistry`):** When a glTF bundle resolves via `GLTFLoader` + `MeshoptDecoder`, `BundleModel` traverses its scene graph once, builds a `CENTER`-strategy BVH (`three-mesh-bvh`) per mesh, registers each `THREE.Mesh` inside `MeshRegistry` (`Map<MeshId, Mesh>`), and notifies `SceneStateApplier`.
2. **Resolve → Diff → Apply (`SceneStateApplier.tsx`):**
   - **Resolve:** `SceneStateApplier` subscribes imperatively to `store.subscribe(...)` (scheduled via microtask coalescing) and computes `selectResolvedMeshStates(state, meshIds)`, combining `systems` enabled flags/opacities, `dissection` sets (`hidden`, `isolated`, `faded`), `motion` ghost/active agonist overrides, `selection.selectedIds`, and `selection.hoveredId`.
   - **Diff:** `applyMeshStates` (`src/scene/applyMeshStates.ts`) compares each mesh's next `MeshState` (`visible`, `variant`, `opacity`, `renderOrder`) against `prevStatesRef.current`. Only changed meshes are touched.
   - **Apply:** For each changed mesh, `MaterialLibrary` (`src/scene/materials.ts`) supplies a shared `MeshPhysicalMaterial` keyed by `(system × tissue-or-custom-color × variant)` (`base`, `hovered`, `selected`, `active`, `ghost`). After updating `visible`, `material`, and `renderOrder`, `SceneStateApplier` calls `invalidate()` so `<Canvas frameloop="demand">` renders only when state or camera changes.

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

## Bundles vs. Biological Systems

Storage bundles are shaped for download budgets and progressive streaming, whereas UI toggles follow biological organization:

- **6 asset bundles (`public/models/manifest.json`):** `skeletal` (`263` meshes), `muscular` (`459` meshes), `organs` (`73` meshes), `cardiovascular` (`216` meshes), `lymphatic` (`153` meshes), and `skin` (`242` meshes).
- **9 populated biological systems (`content/taxonomy.json`):** `skeletal`, `muscular`, `cardiovascular`, `lymphatic`, `integumentary` (default opacity `0.35`), plus four visceral/neural systems (`nervous`, `respiratory`, `digestive`, `urinary`) alongside shared lymphatic organs grouped cleanly via system toggles.

## Progressive Loading Sequence

1. **HTML Preloads (`index.html` + `src/main.tsx`):** `<link rel="preload">` starts fetching `models/manifest.json`, `content/taxonomy.json`, and `en/index.json` while `main.tsx` reads the `<meta name="atlas-skeletal">` tag injected at build time by `vite.config.ts` so `preloadGltf` (`src/scene/gltfCache.ts`) starts downloading the `skeletal` GLB bytes before `AtlasCanvas` finishes lazy-mounting.
2. **Core Boot (`assets/bootstrap`):** Loads `manifest.json`, `taxonomy.json`, and `en/index.json` (plus localized `content/<locale>/index.json` when non-English) in parallel, then transitions `assets.boot` to `'ready'`.
3. **Skeletal First:** Only the `skeletal` bundle is enabled at startup (`skeletal` renders immediately once parsed; `AtlasCanvas`, `Inspector`, and `DissectionMenu` load in separate code-split chunks).
4. **Queued Background Bundles (`BundleScheduler.tsx`):** Once booted, `BundleScheduler` advances `BUNDLE_LOAD_ORDER` (`muscular`, `organs`, `cardiovascular`, `lymphatic`, `skin`) one bundle at a time (`requested`), or prioritizes a bundle immediately if the user toggles its system early.
5. **On-Demand Content Details (`src/app/listeners.ts`):** Per-system prose files (`content/en/structures/<system>.json` and active locale overlay `content/<locale>/structures/<system>.json`) fetch lazily when a bundle becomes ready or a structure from that system is selected, and reload active entries automatically on `localeSet`.

## Test Strategy

- **Asset pipeline (`Vitest`, node project):** Unit tests under `pipeline/src/*.test.ts` cover name curation (`nameMap`), Blender selection rules (`resolvePlan`), Meshopt optimization (`optimize`), manifest serialization, and verification probes (`verify`).
- **Application & UI (`Vitest`, jsdom project):** Unit tests verify schema parsing (`src/data/schema.test.ts`), featured content rules (`src/data/checkContent.test.ts`), selectors, state resolution (`resolveMeshState`, `applyMeshStates`), keyboard shortcuts, Inspector/Toolbar/SystemsPanel/`AboutDialog` accessibility, and suspense glTF caching.
- **Content & Asset Integrity Gates (`npm run check:content`, `npm run assets:verify`):** Enforce plain-text limits, featured completeness (`125` featured entries), verified citations, GLB dimensions, and body orientation probes.
- **Browser End-to-End (`Playwright`, `npm run test:e2e` & `npm run test:e2e:base`):** Tests real WebGL picking, orbit/pan gestures, dissection undo/isolate/fade flows, mobile bottom-sheet layout (`Pixel 7`), long-name wrapping (`e2e/layout.spec.ts`), and production sub-path builds (`ATLAS_BASE_PATH=/atlas-check/`).
