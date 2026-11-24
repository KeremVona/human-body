# Phase 3A Share Links & Pins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Share view` link that restores the camera, systems, opacity, dissection and selection exactly. Add personal pins with notes, stored on the device and optionally included in links.

**Architecture:**
- A pure, versioned codec (`ViewStateV1` ⇄ `#v1.<base64url(deflate-raw(json))>`).
- A capture thunk that reads the store and `CameraApi.getPose()`.
- An apply thunk, run once after boot, that reuses the existing bundle-waiting and dissection actions.
- Pins live in a new `pins` slice, persisted to `localStorage`. They're drawn as DOM markers projected by a small in-Canvas probe, using the same pattern as `pointerPosition`.
- Everything except the boot-time hash check is lazy-loaded.

**Tech Stack:** The existing stack. `CompressionStream` / `DecompressionStream` (built into browsers and Node 24), `navigator.clipboard`, and `@radix-ui/react-popover` (already installed).

**Spec:** `docs/superpowers/specs/2026-11-24-phase-3-design.md` §4 and §8 ("P3 §"). The parent spec is `docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md` ("v1 §").
**Code baseline:** commit `26d8df8`. Names below that aren't created by this plan already exist in `src/`.

## Global Constraints

- The v1 §8.2 rule holds: no per-mesh React components.
- **Hash format:** `#v1.` followed by base64url (no padding) of the deflate-raw-compressed UTF-8 JSON.
  - Camera numbers are rounded to 3 decimals.
  - Keys are exactly those in the P3 §4.1 table.
  - Defaults are omitted: `o` when every opacity is 1, `i` and `f` when null, `x` when off, `p` when no pins.
- **Copy is exact:**
  - `Share view`, `Copy link`, `Link copied`, `Include my pins`
  - `This link is long and some apps may cut it off.` (shown when longer than 4,000 characters)
  - `This link was made by a newer version of the atlas.`
  - `Some parts in this link no longer exist and were skipped.`
  - `This link couldn't be read.`
  - `Add pin`, `Label`, `Note`, `Save`, `Cancel`, `Pins`, `Go to`, `Edit`, `Delete`, `Pin deleted`, `Undo`
  - `Shared pin`, `Save shared pins`, `Pins can't be saved on this device.`
- **Pin limits:** label 1–80 characters (trimmed), note 0–500, at most 200 stored pins. The storage key is `atlas.pins.v1`.
- **Boot cost:** the boot path imports nothing from `src/features/share/` or `src/features/pins/` unless `location.hash` starts with `#v`, or pins exist in storage. The `Share view` button and the `Pins` tab load their code on first use.
- **Applying a link:** happens once per page load, after `assets.boot === 'ready'`. It's not undoable, and it clears the dissection undo history.
- **Shortcut `P`:** add a pin at the pointer when a structure is selected and the pointer is over a pickable mesh. It's ignored while typing, in dialogs, and during the quiz.

## Review Focus

1. **A link made before an asset rebuild references MeshIds that no longer exist.** It applies everything else and shows the "skipped" notice. → Task 1, `decode drops unknown ids and reports them`, and Task 3, `applyViewState skips unknown ids`.
2. **A truncated or hand-edited hash.** It shows `This link couldn't be read.` and leaves the default view untouched, with no crash. → Task 1, `decode rejects malformed payloads`.
3. **A pin's mesh is hidden, its system is off, or its bundle hasn't loaded.** The marker isn't shown and doesn't crash; it appears once the mesh is visible. → Task 5, `projectPins skips missing and invisible meshes`.
4. **`localStorage` throws or is full.** Pins still work for the session, and the notice appears once. → Task 4, `pins survive a throwing storage`.
5. **A pin note contains HTML or a very long unbroken word.** It renders as text and wraps inside the panel. → Task 6, the component test `renders notes as text`, plus the e2e overflow check.

---

## Task 0: Gate

- [ ] **Step 1:** Run `npm run ci && npm run test:e2e`. Expected: PASS on a clean checkout of `main`.

### Task 1: View-state codec

**Files:**
- Create: `src/features/share/viewState.ts`, `src/features/share/codec.ts`
- Test: `src/features/share/codec.test.ts`

**Interfaces:**
- Consumes: `SystemId`, `SystemIdSchema` (`src/data/schema.ts`); `MeshId`, `isMeshId` (`src/data/ids.ts`).
- Produces:
  - **`type ViewStateV1`**:

    ```
    {
      c: [number, number, number, number, number, number];
      s: SystemId[];
      o?: Partial<Record<SystemId, number>>;
      h: MeshId[]; i?: MeshId[]; f?: MeshId[];
      sel: MeshId[];
      x?: [0 | 1 | 2, number, 0 | 1];
      p?: SharedPin[];
    }
    ```

    - `x` (the section) is filled in by Plan 3B, and is only parsed here.
    - `SharedPin = { m: MeshId; l: [number, number, number]; t: string; n?: string }`
  - **`ViewStateV1Schema`** (Zod). Bounds:
    - camera numbers are finite,
    - opacities are in [0, 1],
    - `x[1]` is in [0, 1],
    - `t` is 1–80 characters, `n` ≤ 500,
    - `p` has at most 200 pins.
  - **`encodeViewState(v: ViewStateV1): Promise<string>`**. Returns the full hash, beginning `#v1.`. It rounds the camera to 3 decimals, sorts and de-duplicates the id arrays, and omits the defaults.
  - **`decodeViewState(hash: string, known: { meshIds: ReadonlySet<MeshId>; systems: ReadonlySet<SystemId> }): Promise<DecodeResult>`**

    ```
    DecodeResult =
      | { ok: true; view: ViewStateV1; dropped: number }
      | { ok: false; reason: 'newer-version' | 'malformed' }
    ```

    - A `#v<N>.` prefix with N > 1 → `newer-version`.
    - A bad base64, a bad inflate, invalid JSON or a schema failure → `malformed`.
    - Unknown ids and systems, including pins on unknown meshes, are dropped and counted in `dropped`.
  - **`isViewHash(hash: string): boolean`**: true when the hash matches `/^#v\d+\./`.

- [ ] **Step 1: Write the failing tests.**

```ts
const known = { meshIds: new Set(['femur--l', 'femur--r', 'sternum']), systems: new Set(['skeletal', 'muscular'] as const) };
const view: ViewStateV1 = { c: [0.12345, 0, 3.2, 0, 0, 0], s: ['skeletal'], h: ['sternum'], sel: ['femur--l'] };

it('round-trips and rounds the camera', async () => {
  const hash = await encodeViewState(view);
  expect(hash.startsWith('#v1.')).toBe(true);
  expect(hash).not.toMatch(/[+/=]/);
  const r = await decodeViewState(hash, known);
  expect(r).toEqual({ ok: true, dropped: 0, view: { ...view, c: [0.123, 0, 3.2, 0, 0, 0] } });
});
it('omits defaults and sorts ids', async () => {
  const r = await decodeViewState(await encodeViewState({ ...view, h: ['sternum', 'femur--r', 'sternum'], o: {} }), known);
  expect(r.ok && r.view).toEqual({ c: [0.123, 0, 3.2, 0, 0, 0], s: ['skeletal'], h: ['femur--r', 'sternum'], sel: ['femur--l'] });
});
it('decode drops unknown ids and reports them', async () => {
  const r = await decodeViewState(await encodeViewState({ ...view, h: ['sternum', 'gone--l'], s: ['skeletal', 'nervous'] }), known);
  expect(r).toMatchObject({ ok: true, dropped: 2, view: { h: ['sternum'], s: ['skeletal'] } });
});
it('decode rejects malformed payloads', async () => {
  for (const h of ['#v1.', '#v1.!!!', '#v1.' + 'A'.repeat(40), '#v1.e30']) // e30 = '{}' uncompressed
    expect(await decodeViewState(h, known)).toEqual({ ok: false, reason: 'malformed' });
});
it('flags newer versions', async () =>
  expect(await decodeViewState('#v2.abc', known)).toEqual({ ok: false, reason: 'newer-version' }));
it('recognises view hashes', () => {
  expect(isViewHash('#v1.abc')).toBe(true);
  expect(isViewHash('#debug')).toBe(false);
  expect(isViewHash('')).toBe(false);
});
```

- [ ] **Step 2: Run** `npx vitest run src/features/share/codec.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use `new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))`, and base64url by hand (`btoa` over a binary string, then replace `+/` with `-_` and strip `=`).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(share): versioned view-state codec"`

### Task 2: Camera pose API

**Files:**
- Modify: `src/scene/camera.ts` (`CameraApi`, `createCameraController`), `src/scene/CameraRig.tsx`
- Test: `src/scene/camera.test.ts` (extend)

**Interfaces:**
- Produces:
  - `type Pose = { position: [number, number, number]; target: [number, number, number] }`
  - `CameraApi.getPose(): Pose | null`. Null when no rig is bound.
  - `CameraApi.setPose(pose: Pose, animate: boolean): Promise<void>`
    - Resets `minDistance` / `maxDistance` to `distanceLimits(null, body)`, then `controls.setLookAt(...)`.
    - Animation is forced off under reduced motion.
  - In `CameraRig`, `getPose` reads `controls.getPosition()` and `controls.getTarget()`.

- [ ] **Step 1: Write the failing test.** `createCameraController` forwards `getPose` and `setPose` to the bound implementation. Unbound, `getPose()` returns `null` and `setPose` resolves.
- [ ] **Step 2: Run** `npx vitest run src/scene/camera.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Update every existing `CameraApi` test double in the repo; `npm run typecheck` will find them.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(camera): getPose/setPose"`

### Task 3: Capture and apply thunks, and the boot hook

**Files:**
- Create: `src/features/share/thunks.ts`, `src/features/share/ShareNotice.tsx`, `src/features/share/bootShare.ts`
- Modify: `src/features/dissection/dissectionSlice.ts` (adds `dissectionBaselineSet`), `src/App.tsx` (calls `bootShare` after boot, mounts `ShareNotice`), `src/app/testHooks.ts` (adds `encodeView()`)
- Test: `src/features/share/thunks.test.ts`, extend `dissectionSlice.test.ts`

**Interfaces:**
- Consumes: the Task 1 codec, the Task 2 camera, `waitForBundles` (`src/features/search/revealAndFocus.ts`), `selectBundlesForSystem` (`src/features/assets/assetsSlice.ts`), `opacitySet`, `systemToggled` (`systemsSlice`), `selected`, `selectionCleared` (`selectionSlice`).
- Produces:
  - `dissectionBaselineSet(snapshot: DissectionSnapshot)`. Replaces `hidden`, `isolated` and `faded`, and sets `past` to `[]`.
  - `captureViewState(opts: { includePins: boolean }): AppThunk<ViewStateV1>`. Uses `camera.current?.getPose()`, falling back to the default anterior pose from `presetPose('anterior', bodyBounds(manifest), fitDistance(…, 35, 16/9))`.
  - `applyViewState(view: ViewStateV1): AppThunk<Promise<void>>`, in this order:
    1. Set system `enabled` to exactly `view.s`. Use the `systemToggled` diffs, or a new `systemsSet(enabled: SystemId[])` action if simpler.
    2. Apply `o`, resetting the others to 1.
    3. `waitForBundles` for the bundles of the enabled systems.
    4. `dissectionBaselineSet`.
    5. `selected(view.sel)`, or `selectionCleared()`.
    6. `camera.current?.setPose(…, false)`.

    `p` is ignored in this task. Task 4 extends `applyViewState` to dispatch `sharedPinsLoaded(view.p ?? [])` and `captureViewState` to fill `p` when `includePins` is true, with tests `applies shared pins read-only` and `captures own pins only when asked`.
  - `share` slice state: `{ notice: 'skipped' | 'newer-version' | 'malformed' | null }`, with `noticeShown`, `noticeDismissed`.
  - `bootShare(store): Promise<void>`. If `isViewHash(location.hash)`, it lazy-imports the codec, decodes against the manifest's meshIds and the taxonomy's systems, then either applies the view (setting the `skipped` notice when `dropped > 0`) or sets the matching notice.
  - `<ShareNotice />`: a dismissible `role="status"` toast showing the P3 copy for the current notice.
  - Test hook: `encodeView(): Promise<string>`, which runs `captureViewState({ includePins: false })` and encodes the result.

- [ ] **Step 1: Write the failing tests.** Use a real store from `makeStore` and a fake camera.

| Test | Expect |
|---|---|
| `captureViewState reads store and camera` | with skeletal + muscular on, muscular opacity 0.5, `hidden: ['sternum']`, selection `['femur--l']`, and the camera at `{position:[0,0,3], target:[0,0,0]}` → `{ c:[0,0,3,0,0,0], s:['muscular','skeletal'], o:{muscular:0.5}, h:['sternum'], sel:['femur--l'] }` |
| `applyViewState restores everything and clears undo` | from a store with some undo history → after applying the view above (bundles marked ready): systems, opacity, hidden and selection match; `dissection.past` is `[]`; `setPose` called once with `animate: false` |
| `applyViewState skips unknown ids` | decode result with `dropped: 1` given to `bootShare` → `share.notice === 'skipped'` and everything else applied |
| `bootShare ignores non-view hashes` | `location.hash = '#debug'` → no dispatches; the codec module is never imported (spy on the dynamic-import wrapper) |
| `malformed hash shows the notice and changes nothing` | `#v1.zzz` → `share.notice === 'malformed'`; systems still default |
| `dissectionBaselineSet` | replaces the sets and empties `past` |

- [ ] **Step 2: Run** `npx vitest run src/features/share src/features/dissection`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(share): capture/apply view state and apply links at boot"`

### Task 4: Pins slice and storage

**Files:**
- Create: `src/features/pins/pinsSlice.ts`, `src/features/pins/storage.ts`
- Modify: `src/app/store.ts` (adds the `pins` reducer), `src/app/listeners.ts` (persists on change), `src/features/share/thunks.ts` (shared pins in capture and apply; see Task 3), `src/features/share/thunks.test.ts`
- Test: `src/features/pins/pinsSlice.test.ts`, `storage.test.ts`

**Interfaces:**
- Produces:
  - `type Pin = { id: string; meshId: MeshId; local: [number, number, number]; label: string; note: string; createdAt: number; shared?: true }`
  - pins state: `{ items: Pin[]; editingId: string | null; placing: boolean; storageFailed: boolean; storageNoticeShown: boolean; lastDeleted: Pin | null }`
  - Actions:
    - `pinAdded({ meshId, local, label })`. Generates an id with `crypto.randomUUID()`, opens the editor (`editingId`), and is refused (returns unchanged) when there are already 200 non-shared pins.
    - `pinEdited({ id, label, note })`. Trims; an empty label reverts to the previous label.
    - `pinDeleted(id)`. Sets `lastDeleted`.
    - `pinDeleteUndone()`.
    - `editorClosed()`.
    - `sharedPinsLoaded(pins: SharedPin[])`. Replaces the existing shared pins.
    - `sharedPinsSaved()`. Converts shared pins to own pins, up to the cap.
    - `pinsHydrated(pins: Pin[])`.
    - `storageFailed()`, `storageNoticeShown()`.
  - `loadPins(): Pin[]` and `savePins(pins: Pin[]): boolean`. Both use try/catch. Loading validates with Zod and drops invalid entries; saving never writes shared pins.
  - Listener: after any pins action except `storageFailed` and `storageNoticeShown`, call `savePins(own pins)`. On `false`, dispatch `storageFailed` once.
  - Hydration: `pinsHydrated(loadPins())` is dispatched lazily, on the first open of the Pins tab or right after boot if storage has a non-empty `atlas.pins.v1`. Read only the raw length at boot, so boot stays cheap.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `adds, edits, deletes and undoes` | add → 1 item with `editingId` set → edit the label to `'  My pin  '` → `'My pin'` → delete → 0 items, `lastDeleted` set → undo → back at the same index |
| `enforces limits` | a label of 81 chars is trimmed to 80; a 501-char note is trimmed to 500; the 201st `pinAdded` is ignored |
| `shared pins are read-only until saved` | `sharedPinsLoaded([…2])` → 2 items with `shared: true`; `pinEdited` on one is ignored; `sharedPinsSaved()` → 2 own pins |
| `pins survive a throwing storage` | `setItem` throws → after `pinAdded`, state still has the pin, `storageFailed` is true, and the notice action is dispatched exactly once across 3 more adds |
| `loadPins drops invalid entries` | storage holds `[valid, {meshId:'Bad Id'}, 'x']` → `[valid]` |
| `savePins never writes shared pins` | the saved JSON excludes `shared` items |

- [ ] **Step 2: Run** `npx vitest run src/features/pins`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(pins): pins slice with guarded persistence"`

### Task 5: Placing pins and pin markers

**Files:**
- Create: `src/scene/PinProbe.tsx`, `src/features/pins/pinProjection.ts`, `src/features/pins/PinLayer.tsx`, `src/features/pins/PinEditor.tsx`
- Modify:
  - `src/scene/Picking.tsx`: records the last pickable hit `{ meshId, point }` in a module store, `lastHit`.
  - `src/scene/AtlasCanvas.tsx`: mounts `PinProbe`.
  - `src/features/dissection/DissectionMenu.tsx`: adds an `Add pin` item for structure targets.
  - `src/app/shortcuts.ts`: `p` → `'add-pin'`.
  - `src/app/useShortcuts.ts`, `src/App.tsx`: mount `PinLayer` and `PinEditor`.
- Test: `src/features/pins/pinProjection.test.ts`, extend `src/app/shortcuts.test.ts`, `src/features/pins/PinEditor.test.tsx`

**Interfaces:**
- Produces:
  - `lastHit: { get(): { meshId: MeshId; point: Vector3 } | null; set(...) }`. The point is in world space, taken from the picking intersection.
  - `worldToLocal(mesh: Object3D, world: [number, number, number]): [number, number, number]` and `localToWorld(mesh, local)`.
  - `projectPins(a: { pins: Pin[]; registry: MeshRegistry; camera: Camera; size: { width: number; height: number }; occlusion: (pin: Pin, world: Vector3) => boolean }): PinScreen[]`
    - `PinScreen = { id: string; x: number; y: number; dimmed: boolean }`
    - Skips pins whose mesh is missing, not `visible`, or behind the camera (NDC z outside [-1, 1]).
    - `dimmed` comes from `occlusion`.
  - `pinScreens`: an external store with `set`, `get` and `subscribe`, read with `useSyncExternalStore`.
  - `<PinProbe />`: in `useFrame`, runs after the scene state applier. Projects the pins and writes `pinScreens` only when the result changed.
    - Occlusion uses a `Raycaster` from the camera to the pin and is checked for at most 50 pins per frame (round-robin). A first hit on a different visible pickable mesh more than 0.01 m closer than the pin means it's occluded.
    - It's hidden entirely while `quiz.status !== 'off'`.
  - `<PinLayer />`: absolutely positioned 16 px circular markers, each a `button` with `aria-label="Pin: {label}"`, at 35% opacity when dimmed. Clicking one opens the Pins tab focused on that pin.
  - `addPinAtPointer(): AppThunk`. Reads `lastHit`; if it's on a selected or pickable mesh, converts the point with `worldToLocal` and dispatches `pinAdded` with `label = structure.common`.
  - `<PinEditor />`: a Radix Popover anchored at the new pin. Fields `Label` (required) and `Note` (a textarea), buttons `Save` and `Cancel`. Cancelling a brand-new pin deletes it.

- [ ] **Step 1: Write the failing tests.**

```ts
it('round-trips world/local through a moved mesh', () => {
  const m = new Mesh(); m.position.set(1, 0, 0); m.rotation.set(0, Math.PI / 2, 0); m.updateMatrixWorld();
  const local = worldToLocal(m, [1, 0, -1]);
  expect(localToWorld(m, local).map((n) => +n.toFixed(6))).toEqual([1, 0, -1]);
});
it('projectPins skips missing and invisible meshes', () => {
  // registry: femur--l visible at origin, sternum invisible; camera looking at origin from +Z
  const out = projectPins({ pins: [pin('a', 'femur--l'), pin('b', 'sternum'), pin('c', 'gone')], registry, camera, size: { width: 800, height: 600 }, occlusion: () => false });
  expect(out.map((p) => p.id)).toEqual(['a']);
  expect(out[0]).toMatchObject({ x: 400, y: 300, dimmed: false });
});
it('projectPins skips points behind the camera', () => { /* pin at z = 10 behind a camera at z = 3 looking at -Z → [] */ });
```

  - **`shortcuts.test.ts`:** `p` → `'add-pin'`; `P` → `'add-pin'`; in an input → `null`.
  - **`PinEditor.test.tsx`:**
    - Saving with an empty label is disabled.
    - `Cancel` on a new pin removes it.
    - `renders notes as text`: a note of `<b>x</b>` shows the literal text and no `b` element.
- [ ] **Step 2: Run** `npx vitest run src/features/pins src/app/shortcuts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(pins): place pins on surfaces and draw projected markers"`

### Task 6: Pins tab and Share popover

**Files:**
- Create: `src/features/pins/PinsPanel.tsx`, `src/features/share/SharePopover.tsx`
- Modify:
  - `src/features/tree/LeftPanel.tsx`: adds a third tab, `Pins`, lazy-loaded.
  - `src/features/about/TopBar.tsx`: the `Share view` button.
  - `src/scene/camera.ts` / `CameraRig.tsx`: adds `CameraApi.lookAtPoint(world: [number, number, number], distance?: number): Promise<void>`, with a default distance of 0.4 m, toward the point from the current camera direction.
  - `src/features/about/AboutDialog.tsx`: adds `P` to the shortcuts table.
- Test: `src/features/pins/PinsPanel.test.tsx`, `src/features/share/SharePopover.test.tsx`

**Interfaces:**
- Produces:
  - **`<PinsPanel />`:**
    - Lists pins by `createdAt`, newest first. Each row shows the label and the structure name, with buttons `Go to`, `Edit` and `Delete`.
    - Shared pins show a `Shared pin` badge, and the list header shows `Save shared pins` while any exist.
    - With no pins, it shows `No pins yet. Right-click a part and choose Add pin.` On touch: `…Long-press a part and choose Add pin.`
    - After a delete, a `Pin deleted` status with `Undo` stays for 5 s.
    - Notes wrap (`break-words`).
  - **`<SharePopover />`:**
    - Opening it runs `captureViewState`, then `encodeViewState`, and shows `location.origin + location.pathname + hash` in a read-only input labelled `Share link`.
    - `Include my pins` re-encodes the link.
    - `Copy link` writes to the clipboard and shows `Link copied`. On rejection it selects the input text.
    - The long-link warning appears above 4,000 characters.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `lists pins and goes to one` | 2 pins → rows in newest-first order; `Go to` calls the mocked `lookAtPoint` with the pin's world point (registry mesh at the identity transform) |
| `empty state` | no pins → the empty copy (mouse variant) |
| `delete and undo` | `Delete` → row gone, `Pin deleted` visible → `Undo` → row back |
| `renders notes as text` | the note `<b>x</b>` appears literally |
| `share link copies` | the clipboard mock resolves → the input value starts with `http://localhost:3000/#v1.` (jsdom origin); click `Copy link` → `Link copied` |
| `clipboard failure selects the text` | the clipboard rejects → the input's `selectionStart === 0` and `selectionEnd === value.length` |
| `include pins changes the link` | ticking `Include my pins` with 1 pin → the decoded view has `p.length === 1` |
| `long link warning` | the encoder is mocked to return 4,001 characters → the warning is visible |

- [ ] **Step 2: Run** `npx vitest run src/features/pins src/features/share`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(ui): pins tab and share popover"`

### Task 7: End-to-end tests, docs and performance

**Files:**
- Create: `e2e/share.spec.ts`, `e2e/pins.spec.ts`, `docs/phase-3a-performance.md`
- Modify: `src/app/testHooks.ts` (adds `pinScreenPoints(): PinScreen[]`), `README.md`, `docs/architecture.md`

- [ ] **Step 1: Write the e2e tests.**

| Test | Steps → expectation |
|---|---|
| `a shared link restores the view` | enable muscular, hide `femur--l`, select `sternum`, go to the `left` preset, wait idle → `hash = await __atlas.encodeView()` → open a new page at `/` + `hash` → wait ready → state has muscular enabled, `hidden` contains `femur--l`, selection `['sternum']`, and `getPose` is within 0.01 of the original |
| `a stale link applies what it can` | build a hash with an unknown MeshId (`await __atlas.encodeView()`, then decode, edit and re-encode in the page through the lazy codec module) → the toast text `Some parts in this link no longer exist and were skipped.` |
| `a malformed link is harmless` | `/#v1.garbage` → toast `This link couldn't be read.`; only skeletal enabled |
| `copy link` | grant clipboard permissions (Chromium) → `Share view` → `Copy link` → the clipboard text equals the input value |
| `add, persist and delete a pin` | right-click at `screenPointOf('femur--l')` → `Add pin` → type the label `Test pin` → `Save` → a marker `Pin: Test pin` is visible → reload → the marker is still there → Pins tab → `Delete` → gone after reload |
| `pins hide with their mesh` | add a pin on the femur → `H` → the marker is gone → `Ctrl+Z` → back |
| `notes do not overflow` | a pin whose note is a 300-char unbroken word → Pins tab `scrollWidth <= clientWidth` (desktop and mobile projects) |

- [ ] **Step 2: Run** `npm run test:e2e`. Fix real bugs until it passes.
- [ ] **Step 3: Measure** using the Phase 2 method: the shell, the skeleton-visible time on fast and Fast 4G connections, the main-chunk gzip size, and fps with 50 pins placed. Record the results in `docs/phase-3a-performance.md`. If any v1 §9.1 budget fails, write "Needs optimisation" and stop for the owner.
- [ ] **Step 4: Update docs.** Add Share links and Pins to the README features, and add the `share`/`pins` slices and the projection probe to `docs/architecture.md`.
- [ ] **Step 5: Run** `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "test(e2e): share links and pins; docs"`
