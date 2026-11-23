# Phase 1 Viewer & Dissection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Plan 1 skeleton viewer into the Phase 1 app:
- all four bundles, loaded progressively,
- tissue materials and studio lighting,
- hover and click picking,
- camera focus, presets and limits,
- Hide / Isolate / Fade others / Show all / Undo, with a context menu and keyboard shortcuts,
- the Systems panel, and the Inspector as a drawer or bottom sheet,
- deployment to GitHub Pages.

**Architecture:**
- Redux Toolkit holds the serialisable state: assets, content, systems, dissection (with undo history) and selection.
- Meshes are never React components (§8.2). `SceneStateApplier` subscribes to the store, resolves every mesh's state with a pure function, and imperatively applies the *diff* (visibility, material variant, render order, pickability) to meshes in the Plan 1 `MeshRegistry`.
- The camera is imperative behind a `CameraApi` context.

**Tech Stack:** Plan 1's stack, plus `@reduxjs/toolkit`, `react-redux`, Radix UI primitives (`@radix-ui/react-switch`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`).

**Spec:** `docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md`. Section references (§) point there. **Prior plan:** `docs/superpowers/plans/2026-11-21-foundation-asset-spike.md` ("Plan 1"). Its Interfaces blocks define everything listed here under "Consumes (Plan 1)".

**Plan map:**
1. Foundation & asset spike (done before this one).
2. **This plan.**
3. Phase 1 content & launch.
4. Phase 2.

Plan 3 depends on this plan's Inspector and test hooks.

## Global Constraints

Plan 1's Global Constraints all still apply. In addition:

- **Default visibility (§5.3):** only the skeletal system is enabled. Other systems never appear until toggled.
- **Bundle loading (§8.6):**
  - Load order is `skeletal`, `muscular`, `organs`, `cardiovascular`, then any others in manifest order.
  - One bundle loads at a time. Background loading starts after the skeleton is ready.
  - A bundle the user requests jumps to the front of the queue.
- **Fade opacity:** 0.15. **Undo history:** capped at 50. Only dissection actions are undoable (§6.3).
- **Pickability:** a mesh is pickable only if it is visible and its effective opacity is ≥ 0.5 (§6.2).
- **Render order by system (§6.2):** skeletal 0; nervous, respiratory, digestive, urinary and lymphatic 1; cardiovascular 2; muscular 3; integumentary 4.
- **Click vs drag:** a pointer that moves ≤ 5 px between press and release is stationary. A touch held stationary for ≥ 500 ms is a long-press. Two taps within 300 ms and 24 px of each other are a double-tap.
- **Canvas:** `frameloop="demand"` unless `?debug`. `gl={{ alpha: true, antialias: true, toneMapping: AgXToneMapping }}` with sRGB output. The background is the CSS gradient from Plan 1.
- **Responsive layout:** below 768 px wide, the Inspector is a bottom sheet (`data-layout="sheet"`) and panels start collapsed. At 768 px and above, the Inspector is a right drawer (`data-layout="drawer"`).
- **Reduced motion:** when `prefers-reduced-motion: reduce` is set, camera transitions are instant (`enableTransition = false`).
- **Copy is exact** where this plan quotes it: labels, alerts, hints, live-region text.
- **Storage:** every `localStorage` access is wrapped in try/catch, and the app works without it.

## Review Focus

1. **A visitor selects a mesh, then its bundle unloads, errors or is retried.** The selection and Inspector must not crash, and the selection must not point at a missing mesh. → Task 2, `bundleRetry clears selection of meshes from that bundle`.
2. **Right-drag to pan, then release.** No context menu may open on Windows, where `contextmenu` fires on mouse-up. → Task 6, `classifyRelease` right-drag case, plus e2e `right-drag pans without opening the menu`.
3. **A keyboard shortcut is pressed while typing in an input** (search arrives in Phase 2), or with Alt held. It must not trigger hide or undo. → Task 9, `shortcutFor` cases.
4. **A structure file for a system doesn't exist yet** (404 before content is written). The Inspector shows the fallback copy, not an error. → Task 2, `loadStructures treats 404 as empty`.
5. **Undo after Hide with nothing selected, or Undo with an empty history.** No crash, no state change, and the Undo button is disabled. → Task 4 and Task 9 tests.

---

## Task 0: Gate

- [ ] **Step 1:** Read `docs/phase-0-results.md`.
  - If the decision is **Revise**, and the spec's §7.3/§7.4 numbers weren't updated afterwards, stop and report to the owner.
  - If it's **Go**, continue.
  - Also read `pipeline/README.md`, for the naming patterns and the Mirror-modifier finding.

---

### Task 1: Remaining bundles through the pipeline

**Files:**
- Modify: `pipeline/config.json` (add bundles `muscular`, `cardiovascular`, `organs`), `pipeline/name-map.json`
- Generated, committed: `public/models/*.glb`, `public/models/manifest.json`, `content/en/index.json`
- Modify: `docs/phase-0-results.md` (add a "Phase 1 bundles" table)

**Interfaces:**
- Consumes (Plan 1): `npm run assets:namemap`, `npm run assets:build`, `npm run assets:verify`, `npm run check:content`, and the `PipelineConfig` rule format.
- Produces: four bundles with ids `skeletal`, `muscular`, `cardiovascular` and `organs`, with 1,000–1,500 meshes in total (§7.3).

- [ ] **Step 1: Add the three bundles to `pipeline/config.json`.** Use the collection tree recorded in `pipeline/README.md`, and keep to the §7.3 contents:
  - **Muscular:** major named superficial and intermediate muscles, `tissue: "muscle"`, `kind: "muscle"`. Add tendon or ligament rules only if those are separate objects you want to keep.
  - **Cardiovascular:** heart (`kind: "organ"`, `tissue: "organ"`, with its own `color`), plus arteries (`tissue: "artery"`) and veins (`tissue: "vein"`), both `kind: "vessel"`. Use `exclude` patterns to drop small branches until the counts fit.
  - **Organs:** every organ gets its **real system**:
    - brain → nervous
    - lungs, trachea → respiratory
    - liver, gallbladder, stomach, intestines, pancreas → digestive
    - kidneys, bladder → urinary
    - spleen → lymphatic

    Each organ also gets `tissue: "organ"`, `kind: "organ"` and a distinct `color`. The exact hues are the builder's choice (§12).

    **Licensing:** ship kidney meshes only if Plan 1's "Excluded for licensing" survey shows they are BodyParts3D or Z-Anatomy geometry, not the CC-BY-NC "Kidney by lissiecowley" model. The same applies to inner-ear, Brainder and white-matter objects. If they can't ship, leave them out and note it in `pipeline/README.md`.
- [ ] **Step 2: Run** `npm run assets:namemap`, then hand-curate the new entries to English common-name ids, as in Plan 1 Task 6. Re-run. Expected: `0 added`, with no needs-review entries left.
- [ ] **Step 3: Run** `npm run assets:build`.
  - Expected: exit 0. Four hashed GLBs plus `manifest.json` in `public/models/`, and no budget, orientation or content-check problems.
  - If a budget fails: tighten `exclude` rules or the `simplify` settings, then rebuild. Never raise a budget.
- [ ] **Step 4: Run** `npm run ci`. Expected: PASS.
- [ ] **Step 5: Record** the per-bundle bytes, mesh counts and triangles in `docs/phase-0-results.md` under "Phase 1 bundles".
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(assets): muscular, cardiovascular and organs bundles"`

---

### Task 2: Store, boot loading, bundle scheduling

**Files:**
- Create: `src/app/store.ts`, `src/app/hooks.ts`, `src/app/listeners.ts`, `src/features/assets/assetsSlice.ts`, `src/features/assets/scheduler.ts`, `src/features/assets/BundleScheduler.tsx`, `src/features/content/contentSlice.ts`
- Modify: `src/App.tsx` (wrap in `<Provider>`, render bundles from state), `src/main.tsx`, `src/scene/BundleModel.tsx` (no placeholder material; new meshes start `visible = false`), `src/scene/meshRegistry.ts` (adds `subscribe`)
- Test: `src/features/assets/assetsSlice.test.ts`, `scheduler.test.ts`, `src/features/content/contentSlice.test.ts`, `src/scene/meshRegistry.test.ts` (extend)
- Install: `npm i @reduxjs/toolkit react-redux`

**Interfaces:**
- Consumes (Plan 1): `loadManifest`, `bundleUrl`, `Manifest`, `Taxonomy`, `IndexFile`, `StructureFile`, `TaxonomySchema`, `IndexFileSchema`, `StructureFileSchema`, `MeshRegistry`, `BundleModel`, `BundleErrorBoundary`.
- Produces:
  - `makeStore(preloaded?: Partial<RootState>): AppStore`, plus `RootState`, `AppDispatch`, and `useAppDispatch` / `useAppSelector`, which are typed.
  - `MeshRegistry.subscribe(listener: () => void): () => void`. It fires after every `register` and every `unregister` batch.
  - **assets slice:**

    ```
    {
      manifest: Manifest | null;
      boot: 'idle' | 'loading' | 'ready' | 'error';
      bundles: Record<string, BundleStatus>;   // BundleStatus = 'idle' | 'loading' | 'ready' | 'error'
      requested: string[];
    }
    ```

    - Actions: `bundleStarted(id)`, `bundleReady(id)`, `bundleFailed(id)`, `bundlesRequested(ids: string[])`, `bundleRetry({ id: string; meshIds: MeshId[] })`.
    - `bundleRetry` sets the bundle back to `idle`, puts it at the front of `requested`, and calls `useGLTF.clear(url)` through the listener. Its `meshIds` let the selection slice drop those meshes (Task 4).
  - `retryBundle(id: string): AppThunk`. Reads that bundle's `meshIds` from the manifest and dispatches `bundleRetry`. UI code always calls this, never `bundleRetry` directly.
  - **content slice:**

    ```
    {
      taxonomy: Taxonomy | null;
      index: IndexFile | null;
      structures: Record<SystemId, { status: 'loading' | 'ready'; entries: Record<StructureId, StructureFile['entries'][number]> }>;
    }
    ```

  - `bootstrap(): AppThunk`. Fetches the manifest, taxonomy and index in parallel, validates each with its schema, and sets `boot`.
  - `loadStructures(system: SystemId): AppThunk`. Fetches `${BASE_URL}content/en/structures/<system>.json`. **A 404 stores `{ status: 'ready', entries: {} }`.** A file of the wrong system is rejected with a console error and stored as empty.
  - **Content serving:** `vite.config.ts` copies `content/` into the build output under `content/` (with a small `closeBundle` copy plugin, or `vite-plugin-static-copy`). The dev server serves it at the same path.
  - `nextBundleToLoad(bundles: Record<string, BundleStatus>, order: string[], requested: string[]): string | null`
  - `BUNDLE_LOAD_ORDER = ['skeletal', 'muscular', 'organs', 'cardiovascular']`
  - `selectBundlesForSystem(state, system: SystemId): string[]`. Bundle ids that contain at least one mesh whose structure belongs to that system.
  - `selectStructureLookup(state): Map<StructureId, IndexEntry>`. Memoised.
  - `<BundleScheduler />`, a non-visual component.
    - When `nextBundleToLoad` returns an id, dispatch `bundleStarted`.
    - `App` mounts a `<BundleModel>` for every bundle whose status isn't `idle`. Its `onReady` dispatches `bundleReady`, and `BundleErrorBoundary.onError` dispatches `bundleFailed`.
    - Background loads (bundles not in `requested`) wait until `skeletal` is `ready`.

- [ ] **Step 1: Write the failing tests.**

```ts
// scheduler.test.ts
const order = ['skeletal', 'muscular', 'organs', 'cardiovascular'];
it('loads one bundle at a time, in order', () => {
  expect(nextBundleToLoad({ skeletal: 'idle', muscular: 'idle' }, order, [])).toBe('skeletal');
  expect(nextBundleToLoad({ skeletal: 'loading', muscular: 'idle' }, order, [])).toBeNull();
  expect(nextBundleToLoad({ skeletal: 'ready', muscular: 'idle', organs: 'idle' }, order, [])).toBe('muscular');
});
it('puts requested bundles first, skips ready and errored ones, then manifest-only bundles', () => {
  expect(nextBundleToLoad({ skeletal: 'ready', muscular: 'idle', cardiovascular: 'idle' }, order, ['cardiovascular'])).toBe('cardiovascular');
  expect(nextBundleToLoad({ skeletal: 'ready', muscular: 'error', organs: 'ready', cardiovascular: 'ready', skin: 'idle' }, order, [])).toBe('skin');
  expect(nextBundleToLoad({ skeletal: 'ready', muscular: 'ready' }, order, [])).toBeNull();
});
it('holds background loads until skeletal is ready, but not requested ones', () => {
  expect(nextBundleToLoad({ skeletal: 'error', muscular: 'idle' }, order, [])).toBeNull();
  expect(nextBundleToLoad({ skeletal: 'error', muscular: 'idle' }, order, ['muscular'])).toBe('muscular');
});
```

  - **`assetsSlice.test.ts`:**
    - `bundleRetry` sets status `idle` and puts the id first in `requested`.
    - `retryBundle` dispatches `bundleRetry` with the manifest's `meshIds` for that bundle. Task 4 owns the Review Focus test that the selection is cleared.
  - **`contentSlice.test.ts`:** stub `fetch`.
    - `bootstrap` stores all three files and sets `boot: 'ready'`.
    - Any schema failure sets `boot: 'error'`.
    - `loadStructures treats 404 as empty` gives `structures.skeletal` = `{ status: 'ready', entries: {} }`.
  - **`meshRegistry.test.ts` addition:** `subscribe` is called once per `register` and once per `unregister(ids)` call. The returned function unsubscribes.

- [ ] **Step 2: Run** `npx vitest run src/features src/scene/meshRegistry.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the Produces list.
  - The listener middleware (`src/app/listeners.ts`) handles `bundleRetry` → `useGLTF.clear(bundleUrl(file))`, and `bundleReady(id)` → `loadStructures` for every system that has meshes in that bundle.
  - `App` dispatches `bootstrap()` on mount. Until `boot === 'ready'` it renders the shell with a CSS pulse placeholder. If `boot === 'error'`, it renders `<p role="alert">Couldn't start the atlas. Please reload.</p>`.
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS. The Plan 1 e2e tests still pass, since `skeletal` loads first.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(app): redux store, boot loading and progressive bundle scheduling"`

---

### Task 3: Systems slice and toggle rows

**Files:**
- Create: `src/features/systems/systemsSlice.ts`, `src/features/systems/selectors.ts`
- Modify: `src/app/listeners.ts`
- Test: `src/features/systems/systemsSlice.test.ts`, `selectors.test.ts`

**Interfaces:**
- Consumes: `SystemIdSchema` options (Plan 1), `Taxonomy`, assets selectors (Task 2).
- Produces:
  - systems slice state: `Record<SystemId, { enabled: boolean; opacity: number }>`. Defaults: `skeletal` enabled, every system `opacity: 1`.
  - Actions:
    - `systemToggled(id: SystemId)`
    - `uiGroupToggled(groupId: string)`: if any of the group's systems is enabled, disable them all; otherwise enable them all.
  - Listener: when a system becomes enabled, dispatch `bundlesRequested(selectBundlesForSystem(state, id))` for any bundle not yet `ready`.
  - `type ToggleRow = { id: string; label: string; color: string; systems: SystemId[]; on: boolean | 'mixed'; status: BundleStatus }`
  - `selectToggleRows(state): ToggleRow[]`
    - One row per uiGroup, plus one row for each system that isn't in any uiGroup.
    - Rows are limited to systems that have at least one structure in the index.
    - Rows are sorted by the taxonomy `order` of their first system.
    - A group row's `color` is its first system's colour.
    - `status` aggregates the bundles of the row's systems, with priority `error` > `loading` > `idle` > `ready`.

- [ ] **Step 1: Write the failing tests.**
  - Use a fixture state: the real `content/taxonomy.json`, an index with one structure each in skeletal, muscular, cardiovascular, nervous and digestive, and bundle statuses.

| Test | Expect |
|---|---|
| `defaults to skeletal only` | `enabled` is true only for `skeletal` |
| `uiGroupToggled turns a mixed group off, then on` | nervous on, digestive off → toggle → both off → toggle → both on |
| `builds Phase 1 rows in taxonomy order` | `selectToggleRows(...).map(r => r.id)` = `['skeletal','muscular','cardiovascular','major-organs']`, and the group row has `label: 'Major Organs'` |
| `reports mixed and aggregated status` | group with nervous on and digestive off → `on: 'mixed'`; bundles `organs: 'loading'` → `status: 'loading'`; any `error` → `'error'` |
| `requests bundles when a system is enabled` | with the listener attached, `systemToggled('muscular')` → `assets.requested` contains `'muscular'` |

- [ ] **Step 2: Run** `npx vitest run src/features/systems`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(systems): system state, ui grouping and toggle rows"`

---

### Task 4: Dissection and selection slices

**Files:**
- Create: `src/features/dissection/dissectionSlice.ts`, `src/features/selection/selectionSlice.ts`
- Test: `src/features/dissection/dissectionSlice.test.ts`, `src/features/selection/selectionSlice.test.ts`

**Interfaces:**
- Consumes: `MeshId`, `parseMeshId` (Plan 1).
- Produces:
  - `type DissectionSnapshot = { hidden: MeshId[]; isolated: MeshId[] | null; faded: MeshId[] | null }`
  - dissection state: `DissectionSnapshot & { fadeOpacity: number; past: DissectionSnapshot[] }`. Initial: `{ hidden: [], isolated: null, faded: null, fadeOpacity: 0.15, past: [] }`.
  - Actions, all with `MeshId[]` payloads where shown:
    - `hide(ids)`, `isolate(ids)`, `fadeOthers(ids)`
    - `showAll()`, `exitIsolate()`, `exitFade()`, `undo()`
    - `reveal(ids)`: removes the ids from `hidden`; exits isolate if any id isn't in `isolated`; exits fade if any id isn't in `faded`.
  - Every action except `undo` pushes the previous snapshot onto `past`, capped at 50 with the oldest dropped. **An action that changes nothing returns the same state object and pushes nothing.**
  - Id arrays are kept sorted and de-duplicated.
  - `selectCanUndo(state): boolean` and `selectHasDissection(state): boolean`
  - selection state: `{ selectedIds: MeshId[]; hoveredId: MeshId | null }`
  - Selection actions: `selected(ids: MeshId[])`, `selectionCleared()`, `hovered(id: MeshId | null)`.
    - Plus `extraReducers`: `hide` removes the hidden ids from `selectedIds`. `bundleRetry` removes its `payload.meshIds` from `selectedIds`, and clears `hoveredId` if it's one of them.

- [ ] **Step 1: Write the failing tests.**

```ts
const r = (s: DissectionState | undefined, ...as: AnyAction[]) => as.reduce((st, a) => dissectionReducer(st, a), s as DissectionState);
const s0 = dissectionReducer(undefined, { type: '@@init' });

it('starts empty', () => expect(s0).toEqual({ hidden: [], isolated: null, faded: null, fadeOpacity: 0.15, past: [] }));
it('hide keeps ids sorted and unique and records history', () => {
  const s = r(s0, hide(['tibia--l', 'femur--l', 'femur--l']));
  expect(s.hidden).toEqual(['femur--l', 'tibia--l']); expect(s.past).toHaveLength(1);
});
it('isolate clears faded; fadeOthers clears isolated', () => {
  expect(r(s0, fadeOthers(['a']), isolate(['femur--l']))).toMatchObject({ isolated: ['femur--l'], faded: null });
  expect(r(s0, isolate(['a']), fadeOthers(['femur--l']))).toMatchObject({ isolated: null, faded: ['femur--l'] });
});
it('showAll clears everything and is undoable', () => {
  const s = r(s0, hide(['a']), isolate(['b']), showAll());
  expect(s).toMatchObject({ hidden: [], isolated: null, faded: null });
  expect(r(s, undo())).toMatchObject({ hidden: ['a'], isolated: ['b'] });
});
it('undo walks back one step at a time and is a no-op when empty', () => {
  const s = r(s0, hide(['a']), hide(['b']));
  expect(r(s, undo()).hidden).toEqual(['a']);
  expect(r(s, undo(), undo()).hidden).toEqual([]);
  expect(r(s0, undo())).toBe(s0);
});
it('caps history at 50', () => {
  const ids = Array.from({ length: 60 }, (_, i) => `m${String(i).padStart(2, '0')}`);
  let s = s0; for (const id of ids) s = r(s, hide([id]));
  expect(s.past).toHaveLength(50);
  for (let i = 0; i < 50; i++) s = r(s, undo());
  expect(s.hidden).toEqual(ids.slice(0, 10));
});
it('no-op actions keep the same state and history', () => {
  const s = r(s0, hide(['a']));
  expect(r(s, hide(['a']))).toBe(s);
  expect(r(s0, showAll())).toBe(s0);
  expect(r(s0, exitIsolate())).toBe(s0);
});
it('reveal unhides and exits isolate/fade that would hide the target', () => {
  expect(r(s0, hide(['a']), isolate(['b']), reveal(['a']))).toMatchObject({ hidden: [], isolated: null });
  expect(r(s0, isolate(['a', 'b']), reveal(['a'])).isolated).toEqual(['a', 'b']);
  expect(r(s0, fadeOthers(['b']), reveal(['a'])).faded).toBeNull();
});
```

  - **`selectionSlice.test.ts`:**
    - `selected` replaces the selection.
    - `hovered(null)` clears the hover.
    - `hide` removes hidden ids from the selection.
    - `bundleRetry clears selection of meshes from that bundle`: from `selectedIds: ['femur--l', 'biceps-brachii--l']` and `hoveredId: 'femur--l'`, dispatching `bundleRetry({ id: 'skeletal', meshIds: ['femur--l', 'sternum'] })` leaves `selectedIds` as `['biceps-brachii--l']` and `hoveredId` as `null`.

- [ ] **Step 2: Run** `npx vitest run src/features/dissection src/features/selection`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use a small `withHistory(state, mutate)` helper that compares the before and after snapshots, and only pushes history when they differ.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(dissection): hide/isolate/fade/show-all with capped undo; selection slice"`

---

### Task 5: Materials, lights and the scene state applier

**Files:**
- Create: `src/scene/resolveMeshState.ts`, `src/scene/materials.ts`, `src/scene/applyMeshStates.ts`, `src/scene/SceneStateApplier.tsx`, `src/scene/Lights.tsx`
- Modify: `src/scene/AtlasCanvas.tsx` (uses `Lights`, AgX tone mapping, `alpha`; mounts `SceneStateApplier`)
- Test: `src/scene/resolveMeshState.test.ts`, `materials.test.ts`, `applyMeshStates.test.ts`

**Interfaces:**
- Consumes: the systems, dissection and selection slices; `selectStructureLookup` (Task 2); `MeshRegistry.subscribe` (Task 2); `Tissue` and `SystemId` (Plan 1).
- Produces:
  - `type MeshState = { visible: boolean; opacity: number; ghost: boolean; highlight: 'none' | 'hovered' | 'selected'; pickable: boolean }`
  - `resolveMeshState(i: { meshId: MeshId; systemEnabled: boolean; systemOpacity: number; dissection: DissectionSnapshot & { fadeOpacity: number }; selectedIds: MeshId[]; hoveredId: MeshId | null }): MeshState`
    - Rules exactly as in §6.3.
    - `highlight` is `'none'` whenever `visible` is false.
    - `pickable = visible && opacity >= 0.5`.
  - `selectResolvedMeshStates(state, meshIds: MeshId[]): Map<MeshId, MeshState>`. Memoised. Unknown structures count as `systemEnabled: false`.
  - `RENDER_ORDER: Record<SystemId, number>`, as in the Global Constraints.
  - `type MaterialState = 'base' | 'hovered' | 'selected' | 'ghost'`
  - `TISSUE_LOOKS: Record<Tissue, { color: string; roughness: number; clearcoat: number; sheen: number }>`. Values follow §5.2:
    - bone: roughness ≥ 0.8, clearcoat 0
    - organ, artery, vein: clearcoat ≥ 0.3
    - cartilage, tendon, ligament: sheen > 0
    - every tissue colour is distinct
  - `createMaterialLibrary(fadeOpacity: number): { get(key: { system: SystemId; tissue: Tissue; color?: string; state: MaterialState }): Material; fallback(): Material; dispose(): void }`
    - Cached by `system|tissue|color|state`, so the same key returns the same instance.
    - Uses `MeshPhysicalMaterial`.
    - `ghost`: `transparent: true`, `depthWrite: false`, `opacity: fadeOpacity`.
    - `hovered`: `emissive` = the base colour, `emissiveIntensity` 0.25.
    - `selected`: `emissiveIntensity` 0.6, plus a cool tint (`emissive: '#6FA8FF'`).
  - `materialStateFor(s: MeshState): MaterialState`. Selected beats hovered, which beats ghost, which beats base.
  - `applyMeshStates(a: { registry: MeshRegistry; prev: Map<MeshId, MeshState>; next: Map<MeshId, MeshState>; lookup: (id: MeshId) => { system: SystemId; tissue: Tissue; color?: string } | undefined; library: ReturnType<typeof createMaterialLibrary> }): number`
    - Sets `mesh.visible`, `mesh.material`, `mesh.renderOrder` (`RENDER_ORDER[system]`, +10 when ghost) and `mesh.userData.pickable`, but only for meshes whose state changed or that are new.
    - Returns the count of changed meshes.
    - A mesh with no lookup gets `library.fallback()` and a single `console.warn` per id.
  - `<SceneStateApplier />`, inside the Canvas.
    - Subscribes with `store.subscribe` and `registry.subscribe`, never `useSelector`.
    - Recomputes and applies on change, then calls `invalidate()`.
  - `<Lights />` (§5.2):
    - a warm key directional light from the upper front-left,
    - a cool, dimmer fill light from the right,
    - a strong rim light from behind,
    - `<Environment resolution={256}>` with three local `Lightformer`s, so no HDR file is downloaded.

- [ ] **Step 1: Write the failing tests.**
  - **`resolveMeshState.test.ts`**, as a table. The base input is `{ meshId: 'femur--l', systemEnabled: true, systemOpacity: 1, dissection: empty with fadeOpacity 0.15, selectedIds: [], hoveredId: null }`.

| Case | Change | Expect |
|---|---|---|
| default | — | `{ visible: true, opacity: 1, ghost: false, highlight: 'none', pickable: true }` |
| system off | `systemEnabled: false` | `visible: false, pickable: false` |
| hidden | `hidden: ['femur--l']` | `visible: false` |
| isolated other | `isolated: ['sternum']` | `visible: false` |
| isolated self | `isolated: ['femur--l']` | `visible: true` |
| faded other | `faded: ['sternum']` | `opacity: 0.15, ghost: true, pickable: false` |
| faded self | `faded: ['femur--l']` | `opacity: 1, ghost: false` |
| selected | `selectedIds: ['femur--l']` | `highlight: 'selected'` |
| hovered | `hoveredId: 'femur--l'` | `highlight: 'hovered'` |
| both | selected + hovered | `highlight: 'selected'` |
| invisible selected | hidden + selected | `highlight: 'none'` |
| half opacity | `systemOpacity: 0.5` | `opacity: 0.5, pickable: true, ghost: false` |
| low opacity | `systemOpacity: 0.49` | `pickable: false` |

  - **`materials.test.ts`:**
    - same key → same instance; different state → different instance
    - ghost material: `transparent`, `!depthWrite`, `opacity === 0.15`
    - `hovered.emissiveIntensity < selected.emissiveIntensity`
    - the `TISSUE_LOOKS` constraints above
    - `color` override: the organ material's colour equals the given hex
    - `dispose` disposes every created material, checked with a spy on `Material.prototype.dispose`
  - **`applyMeshStates.test.ts`**, with real `three` `Mesh` objects in a real registry:
    - applies visibility, material, renderOrder (muscular → 3, ghost muscular → 13) and pickable
    - a second call with the same `next` returns 0 and leaves `mesh.material` identical
    - a mesh with no lookup gets the fallback material and warns once across two calls

- [ ] **Step 2: Run** `npx vitest run src/scene`. Expected: FAIL.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Look at the result.** Run `npm run dev`. Toggle systems by temporarily exposing the store as `window.__store` in dev and calling `__store.dispatch(systemToggled('muscular'))` from the console. Remove that line before committing; the panel arrives in Task 8.
  - Bones should look matte ivory, muscles red, vessels glossy red and blue, organs glossy in distinct hues.
  - The silhouette should separate from the background thanks to the rim light.
  - Save a screenshot to `docs/img/phase-1-materials.png`.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(scene): tissue materials, studio lights, diff-based scene state applier"`

---

### Task 6: Gestures, picking and hover label

**Files:**
- Create: `src/scene/gestures.ts`, `src/scene/pointerPosition.ts`, `src/scene/Picking.tsx`, `src/features/selection/HoverLabel.tsx`
- Modify: `src/scene/AtlasCanvas.tsx`, wrapping the bundles in `<Picking>`
- Test: `src/scene/gestures.test.ts`, `src/features/selection/HoverLabel.test.tsx`

**Interfaces:**
- Consumes: `meshIdOf` (Plan 1), the selection slice (Task 4), `mesh.userData.pickable` (Task 5).
- Produces:
  - `STATIONARY_PX = 5`, `LONG_PRESS_MS = 500`, `DOUBLE_TAP_MS = 300`, `DOUBLE_TAP_PX = 24`
  - `classifyRelease(g: { button: number; pointerType: 'mouse' | 'touch' | 'pen'; dx: number; dy: number; ms: number }): 'click' | 'drag' | 'context' | 'long-press'`
  - `createTapTracker(): { tap(p: { x: number; y: number; t: number }): 'single' | 'double' }`
  - `pickMeshId(intersections: { object: Object3D }[]): MeshId | null`. The first intersection whose object has `userData.pickable === true`, mapped through `meshIdOf`.
  - `pointerPosition`: a tiny external store with `set(x, y)`, `subscribe` and `get`, read with `useSyncExternalStore`. It is not Redux.
  - `<Picking onContextRequest(p: { x: number; y: number; meshId: MeshId | null }): void>{children}</Picking>`, a group with R3F handlers:
    - `onPointerMove`: update `pointerPosition`, and dispatch `hovered(id)` only when the id changes (mouse only).
    - `onPointerOut`: dispatch `hovered(null)`.
    - Pointer down and up feed `classifyRelease`:
      - `click` → `selected([id])`
      - `context` → `onContextRequest`
      - `drag` → nothing
    - A long-press timer starts on touch or pen down and is cancelled after moving more than `STATIONARY_PX`. When it fires → `onContextRequest`.
    - Double-click or double-tap on a mesh → `cameraApi.focusMeshes([id])`. The camera arrives in Task 7; wire it there.
    - The canvas wrapper's native `contextmenu` event is **always** `preventDefault()`ed.
    - `<Canvas onPointerMissed>` (a click on empty space) → `selectionCleared()`.
  - `<HoverLabel />`. A DOM tooltip at the pointer, offset (12, 16) px, showing `common` and the side: `Femur (left)`. Hidden when `hoveredId` is null or on coarse pointers.

- [ ] **Step 1: Write the failing tests.**

```ts
it.each([
  [{ button: 0, pointerType: 'mouse', dx: 2, dy: 2, ms: 120 }, 'click'],
  [{ button: 0, pointerType: 'mouse', dx: 8, dy: 0, ms: 120 }, 'drag'],
  [{ button: 2, pointerType: 'mouse', dx: 1, dy: 1, ms: 200 }, 'context'],
  [{ button: 2, pointerType: 'mouse', dx: 30, dy: 0, ms: 400 }, 'drag'],
  [{ button: 0, pointerType: 'touch', dx: 1, dy: 1, ms: 600 }, 'long-press'],
  [{ button: 0, pointerType: 'touch', dx: 1, dy: 1, ms: 150 }, 'click'],
  [{ button: 0, pointerType: 'mouse', dx: 1, dy: 1, ms: 900 }, 'click'],
] as const)('classifyRelease(%o) = %s', (g, want) => expect(classifyRelease(g)).toBe(want));

it('detects double taps by time and distance', () => {
  const t = createTapTracker();
  expect(t.tap({ x: 0, y: 0, t: 0 })).toBe('single');
  expect(t.tap({ x: 10, y: 10, t: 250 })).toBe('double');
  expect(t.tap({ x: 10, y: 10, t: 900 })).toBe('single');
  expect(t.tap({ x: 60, y: 10, t: 1000 })).toBe('single');
});

it('pickMeshId skips non-pickable hits and walks up names', () => {
  // ghost (pickable false) in front of femur child mesh under group 'femur--l'
  expect(pickMeshId([{ object: ghost }, { object: femurChild }])).toBe('femur--l');
  expect(pickMeshId([{ object: ghost }])).toBeNull();
});
```

  - **`HoverLabel.test.tsx`:** with a store where `hoveredId = 'femur--l'` and an index containing femur, after `pointerPosition.set(100, 50)` the text `Femur (left)` is shown at `left: 112px; top: 66px`. With `hoveredId = null`, nothing renders.

- [ ] **Step 2: Run** `npx vitest run src/scene/gestures.test.ts src/features/selection`. Expected: FAIL.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(picking): gesture classification, hover/click picking, hover label"`

---

### Task 7: Camera rig, presets, focus and limits

**Files:**
- Create: `src/scene/camera.ts`, `src/scene/CameraRig.tsx`
- Modify: `src/scene/AtlasCanvas.tsx` (replace the bare `CameraControls` with `CameraRig`), `src/scene/Picking.tsx` (double-click focus)
- Test: `src/scene/camera.test.ts`

**Interfaces:**
- Consumes: `Manifest['meshes'][string]['bounds']` (Plan 1), `MeshId`.
- Produces:
  - `type Bounds = { min: [number, number, number]; max: [number, number, number] }`
  - `type Preset = 'anterior' | 'posterior' | 'left' | 'right' | 'superior' | 'inferior'`
  - `unionBounds(ids: MeshId[], meshes: Manifest['meshes']): Bounds | null`
  - `bodyBounds(manifest: Manifest): Bounds`. The union of the `skeletal` bundle's meshes.
  - `fitDistance(b: Bounds, fovDeg: number, aspect: number, padding = 1.15): number`
    - `r` = half the diagonal of `b`
    - `fovH = 2·atan(tan(fovV/2)·aspect)`
    - `d = padding · r / sin(min(fovV, fovH)/2)`
  - `presetPose(p: Preset, b: Bounds, distance: number): { position: [number, number, number]; target: [number, number, number] }`
    - The target is the centre of `b`. The position is the target plus:
      - anterior `(0,0,d)`, posterior `(0,0,-d)`
      - left `(d,0,0)`, right `(-d,0,0)`
      - superior `(0,d,0.01)`, inferior `(0,-d,0.01)`
  - `distanceLimits(focus: Bounds | null, body: Bounds): { min: number; max: number }`
    - min = 1.1 × the half-diagonal of `focus`, or of `body` when focus is null
    - max = 4 × the body's y-extent
  - `type CameraApi = { focusMeshes(ids: MeshId[]): Promise<void>; goToPreset(p: Preset): Promise<void>; resetView(): Promise<void>; zoom(step: 1 | -1): void }`
  - `CameraApiProvider`, `useCameraApi(): CameraApi`
  - `<CameraRig />` owns a drei `CameraControls`:
    - `smoothTime` 0.25, about a 600 ms transition (§6.1).
    - `dollyToCursor: true`.
    - `mouseButtons.right = TRUCK`, and `touches.two = TOUCH_DOLLY_TRUCK`.
    - Camera `near = 0.01`, `far = 100`.
  - Behaviour:
    - The initial pose is `presetPose('anterior', body, fitDistance(body, 35, aspect))`.
    - `focusMeshes` fits to `unionBounds` with `fitToBox(box, animate, { paddingTop/Bottom/Left/Right: 0.15 })`, then sets `minDistance` from `distanceLimits`.
    - `resetView` restores the initial pose and the body limits.
    - Everything is instant under reduced motion.

- [ ] **Step 1: Write the failing tests.**

```ts
const body: Bounds = { min: [-0.3, -0.9, -0.15], max: [0.3, 0.9, 0.15] };
it('fits the body for landscape and portrait viewports', () => {
  expect(fitDistance(body, 35, 16 / 9)).toBeCloseTo(3.673, 2);
  expect(fitDistance(body, 35, 0.5)).toBeCloseTo(7.09, 1);
});
it.each([
  ['anterior', [0, 0, 3]], ['posterior', [0, 0, -3]], ['left', [3, 0, 0]],
  ['right', [-3, 0, 0]], ['superior', [0, 3, 0.01]], ['inferior', [0, -3, 0.01]],
] as const)('presetPose(%s)', (p, pos) => expect(presetPose(p, body, 3)).toEqual({ position: pos, target: [0, 0, 0] }));
it('unions mesh bounds and returns null for unknown ids', () => {
  const meshes = { a: m([0, 0, 0], [1, 1, 1]), b: m([-1, 0, 0], [0, 2, 1]) };
  expect(unionBounds(['a', 'b'], meshes)).toEqual({ min: [-1, 0, 0], max: [1, 2, 1] });
  expect(unionBounds(['zz'], meshes)).toBeNull();
});
it('derives zoom limits', () => {
  const femur: Bounds = { min: [0, 0, 0], max: [0.2, 0.3, 0] }; // half-diagonal 0.1803
  expect(distanceLimits(femur, body)).toEqual({ min: expect.closeTo(0.1983, 3), max: expect.closeTo(7.2, 6) });
  expect(distanceLimits(null, body).min).toBeCloseTo(1.0565, 3);
});
```

- [ ] **Step 2: Run** `npx vitest run src/scene/camera.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `camera.ts`, then `CameraRig`, then double-click focus in `Picking`.
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(camera): presets, focus-on-selection, zoom limits, reduced motion"`

---

### Task 8: Systems panel

**Files:**
- Create: `src/ui/Panel.tsx`, `src/ui/IconButton.tsx`, `src/ui/Chip.tsx`, `src/features/systems/SystemsPanel.tsx`
- Test: `src/features/systems/SystemsPanel.test.tsx`
- Install: `npm i @radix-ui/react-switch @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-tooltip`

**Interfaces:**
- Consumes: `selectToggleRows`, `systemToggled`, `uiGroupToggled` (Task 3), `bundleRetry` (Task 2).
- Produces:
  - `<Panel side: 'left' | 'right'; label: string; collapsed: boolean; onToggle(): void>`, a translucent floating panel: `bg-slate-900/60 backdrop-blur-md`, rounded, and collapsible to an icon rail.
  - `<SystemsPanel />`: `<section aria-label="Body systems">`. One Radix `Switch` per row, labelled by the row label. Each row shows a colour chip and a status:
    - `loading`: a spinner with `aria-label="Loading {label}"`.
    - `error`: a button labelled `Retry {label}`, which dispatches `retryBundle(id)` for each bundle of the row in `error`.
  - A `'mixed'` row renders the switch with `aria-checked="mixed"`.
  - The collapse button is labelled `Collapse panel` / `Expand panel`. The panel starts collapsed below 768 px.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `lists the four Phase 1 rows` | switches named `Skeletal`, `Muscular`, `Cardiovascular`, `Major Organs`, in that order; only Skeletal checked |
| `toggling a system dispatches` | clicking `Muscular` → store `systems.muscular.enabled === true` |
| `toggling the group toggles all its systems` | clicking `Major Organs` → nervous, respiratory, digestive, urinary and lymphatic all enabled |
| `shows loading and retry states` | `organs: 'loading'` → `Loading Major Organs` visible; `organs: 'error'` → clicking `Retry Major Organs` sets status `idle` |
| `collapses` | clicking `Collapse panel` hides the switches; `Expand panel` shows them |

- [ ] **Step 2: Run** `npx vitest run src/features/systems/SystemsPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, and mount `SystemsPanel` in `App` at the top-left.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(ui): systems panel with loading and retry"`

---

### Task 9: Inspector, dissection controls, toolbar, shortcuts, first-run hint

**Files:**
- Create:
  - `src/features/inspector/selectors.ts`, `src/features/inspector/Inspector.tsx`
  - `src/features/dissection/DissectionMenu.tsx`, `ExitChips.tsx`, `Toolbar.tsx`
  - `src/app/shortcuts.ts`, `src/app/useShortcuts.ts`
  - `src/features/onboarding/FirstRunHint.tsx`
  - `src/features/selection/SelectionAnnouncer.tsx`
- Test: `src/features/inspector/selectors.test.ts`, `Inspector.test.tsx`, `src/features/dissection/Toolbar.test.tsx`, `src/app/shortcuts.test.ts`, `src/features/onboarding/FirstRunHint.test.tsx`

**Interfaces:**
- Consumes: the content, systems, dissection and selection slices; `CameraApi` (Task 7); `Picking`'s `onContextRequest` (Task 6); `parseMeshId`, `toMeshId` (Plan 1).
- Produces:
  - **`selectInspectorModel(state): InspectorModel | null`**

    ```
    InspectorModel = {
      structureId; meshIds: MeshId[]; side: 'Left' | 'Right' | 'Both' | null; paired: boolean;
      common; latin?; systemLabel; systemColor; regionLabel; groupLabel?;
      overview?; function?; details?: Details; sources: Source[];
      contentStatus: 'loading' | 'ready'
    }
    ```

    It's `null` when nothing is selected, or when selected ids span more than one structure.
  - **`<Inspector />`:** `<aside aria-label="Structure details" data-layout="drawer" | "sheet">`
    - A header with `common`, the italic `latin`, a side badge, and a system chip.
    - A breadcrumb: `System › Region (› Group)`.
    - Overview and Function sections.
    - A details card for muscles (Origin, Insertion, Innervation, Blood supply, Primary action), bones (Type, Articulates with, showing common names), and facts (a list).
    - Sources as links.
    - When `contentStatus === 'ready'` and there's no overview: the text `Description coming soon.` When loading: a pulse skeleton.
    - For paired structures, chips `Left`, `Right` and `Both`, which change the selection.
    - The action row: buttons `Focus`, `Isolate`, `Hide` and `Fade others`, plus a `Close details` button.
    - The sheet layout has a peek height showing the name and the action row.
  - **`<DissectionMenu>`:** a controlled Radix `DropdownMenu`, anchored to a 1 px span at the requested point.
    - On a structure, it selects the mesh first, then shows `Focus`, `Isolate`, `Hide`, `Fade others`.
    - On empty space: `Show all`, `Reset view`.
  - **`<ExitChips />`:** an `Exit isolate` button while `isolated` is set, and `Exit fade` while `faded` is set.
  - **`<Toolbar />`:** bottom-centre buttons with these aria-labels:
    - `Anterior view`, `Posterior view`, `Left lateral view`, `Right lateral view`, `Superior view`, `Inferior view`
    - `Reset view`
    - `Undo` (disabled when `!selectCanUndo`)
    - `Show all` (disabled when `!selectHasDissection`)
  - **Shortcuts:**

    ```
    type Command =
      | 'hide' | 'isolate' | 'fade' | 'focus' | 'undo' | 'deselect' | 'context-menu'
      | 'zoom-in' | 'zoom-out' | 'reset-view' | `preset:${Preset}`
    ```

    - `shortcutFor(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; targetTag: string; targetEditable: boolean }): Command | null`
    - `useShortcuts()` registers one `keydown` listener on `window` and runs commands on the selection, through `CameraApi` and the store. Selection commands do nothing when nothing is selected.
  - **`<FirstRunHint />`:**
    - The text is `Drag to rotate · Scroll to zoom · Click any part`, or `Drag · Pinch · Tap` on coarse pointers.
    - A `Got it` button stores `localStorage['atlas.hintDismissed'] = '1'`.
  - **`<SelectionAnnouncer />`:** a visually hidden `aria-live="polite"` region with `Selected Femur, left side.`, `Selected Femur, both sides.` or `Selected Sternum.`, and an empty string when nothing is selected.
  - **Action semantics** (§6.3):
    - Hide → `hide(selectedIds)`.
    - Isolate → `isolate(selectedIds)`, then `focusMeshes(selectedIds)`.
    - Fade others → `fadeOthers(selectedIds)`.
    - Focus → `focusMeshes(selectedIds)`.
    - Selecting a structure whose system has no structures loaded dispatches `loadStructures(system)`.

- [ ] **Step 1: Write the failing tests.**

```ts
// shortcuts.test.ts
const k = (key: string, o: Partial<Parameters<typeof shortcutFor>[0]> = {}) =>
  shortcutFor({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, targetTag: 'BODY', targetEditable: false, ...o });
it.each([
  ['h', 'hide'], ['H', 'hide'], ['i', 'isolate'], ['g', 'fade'], ['f', 'focus'], ['Escape', 'deselect'],
  ['1', 'preset:anterior'], ['2', 'preset:posterior'], ['3', 'preset:left'], ['4', 'preset:right'],
  ['5', 'preset:superior'], ['6', 'preset:inferior'], ['0', 'reset-view'], ['+', 'zoom-in'], ['=', 'zoom-in'], ['-', 'zoom-out'],
])('%s → %s', (key, cmd) => expect(k(key)).toBe(cmd));
it('maps modifiers', () => {
  expect(k('z', { ctrlKey: true })).toBe('undo');
  expect(k('z', { metaKey: true })).toBe('undo');
  expect(k('F10', { shiftKey: true })).toBe('context-menu');
  expect(k('z')).toBeNull();
});
it('ignores typing and Alt', () => {
  expect(k('h', { targetTag: 'INPUT' })).toBeNull();
  expect(k('h', { targetTag: 'TEXTAREA' })).toBeNull();
  expect(k('h', { targetEditable: true })).toBeNull();
  expect(k('h', { altKey: true })).toBeNull();
});
```

  - **`selectors.test.ts`:**
    - femur--l selected gives `side: 'Left'`, `paired: true`, `systemLabel: 'Skeletal'`, `regionLabel: 'Lower limb'`
    - both sides selected gives `'Both'`
    - selecting `sternum` gives `side: null`
    - a mixed-structure selection gives `null`
    - no structures entry and status `ready` gives `overview: undefined, contentStatus: 'ready'`
  - **`Inspector.test.tsx`:**
    - With a full muscle entry: shows the headings `Origin`, `Insertion`, `Innervation`, `Blood supply`, `Primary action` and their values, plus the source link.
    - With a stub entry: shows `Description coming soon.`
    - Clicking `Right` sets `selectedIds = ['femur--r']`.
    - Clicking `Hide` hides the selection, and the Inspector disappears.
    - `data-layout` is `sheet` when `window.innerWidth = 500`, and `drawer` at 1280. Use a `matchMedia` stub.
  - **`Toolbar.test.tsx`:**
    - `Undo` and `Show all` are disabled on a fresh store.
    - After `hide(['femur--l'])` both are enabled.
    - Clicking `Undo` restores the femur, and `Undo` is disabled again.
    - Preset buttons call the mocked `CameraApi.goToPreset` with the right preset.
  - **`FirstRunHint.test.tsx`:**
    - The hint shows.
    - `Got it` hides it and writes the key.
    - It's not shown when the key exists.
    - It still renders when `localStorage.getItem` throws.

- [ ] **Step 2: Run** `npx vitest run src/features src/app/shortcuts.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement**, and mount everything in `App`:
  - Inspector on the right, Toolbar at the bottom, ExitChips above the toolbar.
  - `DissectionMenu` driven by `Picking.onContextRequest`.
  - FirstRunHint centred low, SelectionAnnouncer anywhere.
  - Canvas `aria-label="3D model of the human body. Use the panels and keyboard shortcuts to explore."`
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(ui): inspector, dissection menu, toolbar, shortcuts, first-run hint, live region"`

---

### Task 10: End-to-end flows, mobile and test hooks

**Files:**
- Modify: `src/app/testHooks.ts`, `playwright.config.ts` (add a `mobile` project using `devices['Pixel 7']`)
- Create: `e2e/dissection.spec.ts`, `e2e/mobile.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `window.__atlas`, in dev only, extends Plan 1's hook with:
  - `select(ids: MeshId[]): void`
  - `getState(): RootState`
  - `dispatch: AppDispatch`. e2e tests use it to set up state, for example `dispatch({ type: 'systems/systemToggled', payload: 'muscular' })`.
  - `screenPointOf(id: MeshId): { x: number; y: number } | null`. Projects the mesh's world bounding-box centre to client pixels.
  - `waitIdle(): Promise<void>`. Resolves when no camera transition is running.

- [ ] **Step 1: Write the failing e2e tests.** Each test waits for `__atlas.ready`.

| Test (`dissection.spec.ts`) | Steps → expectation |
|---|---|
| `clicking a bone selects it and opens the Inspector` | `screenPointOf('femur--l')` → `page.mouse.click` → `aside[aria-label="Structure details"]` contains `Femur` |
| `hover shows a label` | move to the femur point → `Femur (left)` visible |
| `hide then undo` | select femur--l → click `Hide` → `getState().dissection.hidden` contains it, Inspector gone → `Ctrl+Z` → hidden empty |
| `isolate then show all` | select → `Isolate` → `Exit isolate` visible → click `Show all` → `isolated === null` |
| `right-drag pans without opening the menu` | right button down at the centre, move 60 px, up → no `role="menu"` visible |
| `right-click on a bone opens the menu` | right-click at the femur point → menu items `Focus`, `Isolate`, `Hide`, `Fade others` |
| `presets and reset do not throw` | click each preset button, then `Reset view` → no console errors (collect `page.on('pageerror')`) |
| `enabling muscles loads and shows them` | click `Muscular` switch → `getState().assets.bundles.muscular` becomes `ready` within 30 s; `Loading Muscular` disappears |

| Test (`mobile.spec.ts`, mobile project) | Expectation |
|---|---|
| `inspector is a bottom sheet` | after `__atlas.select(['femur--l'])`, `aside` has `data-layout="sheet"` |
| `systems panel starts collapsed` | `Expand panel` button visible, `Skeletal` switch hidden |
| `tap selects` | `page.touchscreen.tap` at the femur point → Inspector shows `Femur` |

- [ ] **Step 2: Run** `npm run test:e2e`. Expected: FAIL until the hooks exist, then fix any real bugs found.
- [ ] **Step 3: Implement** the hook extensions.
- [ ] **Step 4: Run** `npm run test:e2e`. Expected: all PASS on both projects.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "test(e2e): dissection, picking, menu, mobile flows"`

---

### Task 11: GitHub Pages deploy

**Files:**
- Create: `.github/workflows/deploy.yml`, `e2e/base-path.spec.ts`
- Modify: `playwright.config.ts` (a `base-path` project that uses `vite preview` when `E2E_BASE` is set), `package.json` (`test:e2e:base`)

**Interfaces:**
- Consumes: `ATLAS_BASE_PATH` (Plan 1).
- Produces:
  - A deploy workflow on pushes to `main`:
    - permissions `pages: write`, `id-token: write`
    - `npm ci && npm run ci`
    - build with `ATLAS_BASE_PATH=/${{ github.event.repository.name }}/`
    - `actions/upload-pages-artifact` with `dist`, then `actions/deploy-pages`
  - It works whatever the repo ends up being called.
  - `test:e2e:base` runs `ATLAS_BASE_PATH=/atlas-check/ npm run build` and Playwright with `E2E_BASE=/atlas-check/` against `vite preview --base /atlas-check/`. Use `cross-env` so the script runs from PowerShell.

- [ ] **Step 1: Write the failing test.**

```ts
test('built site works under a sub-path', async ({ page, request }) => {
  const base = process.env.E2E_BASE!;
  const manifest = await (await request.get(`${base}models/manifest.json`)).json();
  for (const b of manifest.bundles) expect((await request.get(`${base}models/${b.file}`)).status()).toBe(200);
  expect((await request.get(`${base}content/en/index.json`)).status()).toBe(200);
  await page.goto(base);
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(5000);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
```

- [ ] **Step 2: Run** `npm run test:e2e:base`. Expected: PASS once the content copy from Task 2 and `bundleUrl` respect `BASE_URL`. Fix whatever fails.
- [ ] **Step 3: Write `deploy.yml`.** Add a README note that the owner must set Settings → Pages → Source to "GitHub Actions" after creating the repo.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "ci: GitHub Pages deploy with repo-name base path"`

---

### Task 12: Phase 1 performance pass

**Files:**
- Create: `docs/phase-1-performance.md`

- [ ] **Step 1: Measure.** Run `npm run build && npm run preview` and open `/?debug`. Enable all four systems. Record:
  - fps idle and while orbiting, with the laptop GPU's name,
  - draw calls and triangles,
  - shell-interactive time and skeleton-visible time (fast connection, and DevTools "Fast 4G"),
  - picking cost: a `performance.now()` around `pickMeshId` over 100 moves, logged in dev.
- [ ] **Step 2: Compare** against §9.1.
  - If draw calls exceed 1,500, fps falls under 60 on the laptop, or the skeleton-visible time is over budget: write **"Needs optimisation"** with the numbers and stop. The `BatchedMesh` work (§7.3) gets its own plan from the owner. Don't build it here.
  - Otherwise write **"Within budget"**.
- [ ] **Step 3: Commit.** `git add -A && git commit -m "docs: phase 1 performance measurements"`
