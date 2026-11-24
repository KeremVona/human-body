# Phase 3C Motion Demos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four illustrative motion demos: elbow flexion, knee flexion, shoulder abduction and heartbeat. They're built from rigid bone rotation and procedural heart pulsing, with crossing muscles ghosted and agonists glowing. A Motion tab provides play, pause, speed, scrub and stop.

**Architecture:**
- The demos are data (`content/motions.json`), validated by Zod and `check:content`.
- Pure math turns a phase into poses: hinge angle, pivot rotation, heartbeat scale.
- A `motion` slice holds only low-frequency state: active demo, playing, speed, direction, scrubbed phase.
- A single in-Canvas `MotionPlayer` advances the phase in `useFrame` and writes mesh transforms imperatively (v1 §8.2).
- Ghosting and agonist glow go through `resolveMeshState`, as motion-only overrides that never touch dissection or undo.

**Tech Stack:** Existing. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-24-phase-3-design.md` §6 ("P3 §"). **Depends on:** Plan 3A (`CameraApi`, test hooks) and Plan 3B (it must keep working with clipping). **Code baseline:** `main` after Plan 3B.

## Global Constraints

- **Hinge angle:** eased with `angle(phase) = min + (max − min)·(1 − cos 2π·phase)/2`.
  - Phase is in [0, 1) and wraps.
  - The direction is `flex` while phase < 0.5, and `extend` otherwise.
- **Heartbeat:**
  - 72 bpm by default, amplitude 0.04.
  - Atria lead the ventricles by 0.15 of a cycle.
  - `heartbeatScale(p, a) = 1 + a·(bump(p, 0.10) + 0.6·bump(p, 0.35))` with `bump(p, c) = exp(−((p − c)/0.06)²)`.
- **Speed:** `0.5×` or `1×`. Hinge period is `periodS`; a heartbeat lasts 60 / bpm seconds.
- **Transforms:** moved meshes are restored to their **exact original** `position`, `quaternion` and `scale` on stop, on unload, and when a new demo starts.
- **Overrides:** motion overrides never dispatch dissection actions and never add undo history.
- **Quiz:** starting the quiz stops any demo, and demos can't start during the quiz.
- **Reduced motion:** demos start paused at phase 0.25, and the scrub slider is shown first.
- **Copy is exact:**
  - `Motion` (the tab), `Play`, `Pause`, `Stop`, `Speed`, `0.5×`, `1×`, `Motion position`
  - `Illustrative motion — real joints and hearts move in more complex ways.`
  - Live region: `Playing {label}.`, `Paused.`, `Stopped.`
- **Frame loop:** `frameloop="demand"` stays. `MotionPlayer` calls `invalidate()` each frame only while playing.

## Review Focus

1. **Stopping mid-motion** must leave every bone exactly where it started. Accumulated float drift or a missed mesh would permanently dislocate the skeleton until reload. → Task 3, `stop restores exact transforms`.
2. **A demo whose bundle isn't loaded yet**, or a mesh that fails to register. It must wait or skip without throwing, and still play with the meshes that exist. → Task 3, `missing meshes are skipped`; Task 4, `startMotion waits for bundles`.
3. **Pins and cross-sections during motion.** Pins must follow the moving bone, and clipping must still apply. → Task 6 e2e.
4. **Starting the quiz or toggling a system off mid-demo.** The demo stops, and the transforms and overrides are cleared. → Task 4 listener tests.
5. **`motions.json` referencing a MeshId** that a later asset rebuild removed. CI must fail with a clear message. → Task 1, `check:content reports unknown motion meshes`.

---

## Task 0: Gate

- [ ] **Step 1:** Confirm Plan 3B is merged (`src/features/section/` exists) and `npm run ci && npm run test:e2e` pass.

### Task 1: Motion data schema, validation and file

**Files:**
- Create: `src/features/motion/schema.ts`, `content/motions.json`
- Modify: `src/data/checkContent.ts` (adds an optional `motions` input), `scripts/check-content.ts` (reads `content/motions.json`), `vite.config.ts` (only if `content/` copying needs it; it already copies `content/`)
- Test: `src/features/motion/schema.test.ts`, extend `src/data/checkContent.test.ts`

**Interfaces:**
- Consumes: `MESH_ID_RE`, `SystemIdSchema`, the `Preset` type.
- Produces:
  - `Anchor = { mesh: MeshId; anchor: [number, number, number] }`. Each anchor value is in [0, 1].
  - **`HingeDef`**:

    ```
    {
      id; kind: 'hinge'; label; view: Preset; systems: SystemId[];
      moving: MeshId[]; ghost: MeshId[];
      agonists: { flex: MeshId[]; extend: MeshId[] };
      pivot: Anchor; axis: [number, number, number]; range: [number, number]; periodS: number;
    }
    ```

    - `axis` must be non-zero. `range` is in degrees with min < max, both in [−180, 180]. `periodS` is in [1, 20].
  - **`PulseDef`**: `{ id; kind: 'pulse'; label; view: Preset; systems: SystemId[]; groups: { meshes: MeshId[]; phase: number }[]; bpm: number; amplitude: number; center?: Anchor }`. `bpm` is in [40, 180] and `amplitude` in (0, 0.15].
  - `MotionDefSchema` is a discriminated union on `kind`. `MotionsFileSchema = { motions: MotionDef[] }`, with unique ids.
  - **New `checkContent` errors:**
    - `motions.json: "<id>" references unknown mesh "<meshId>"`, for any id in `moving`, `ghost`, `agonists`, `pivot.mesh`, `center.mesh` or `groups[].meshes`.
    - `motions.json: "<id>" lists "<meshId>" as both moving and ghost`
    - schema errors prefixed `motions.json:`
  - **`content/motions.json` starting values.** Tune them in Task 5.
    - `elbow-flexion`:
      - `view: 'left'`, `systems: ['skeletal', 'muscular']`
      - `moving`: radius--l, ulna--l, every `*-of-hand--l` and carpal/metacarpal/phalanx `--l` bone, plus forearm and hand muscles `--l`
      - `ghost`: biceps, brachialis and triceps parts `--l`, with ids taken from the manifest
      - `agonists.flex`: biceps and brachialis parts `--l`; `agonists.extend`: triceps parts `--l`
      - `pivot: { mesh: 'humerus--l', anchor: [0.5, 0.03, 0.5] }`, `axis: [-1, 0, 0]`, `range: [0, 145]`, `periodS: 4`
    - `knee-flexion`:
      - `view: 'left'`
      - `moving`: tibia--l, fibula--l, patella--l, every foot bone `--l`, plus leg and foot muscles `--l`
      - `ghost`: quadriceps and hamstring parts `--l`; agonists flex = hamstrings, extend = quadriceps
      - `pivot: { mesh: 'femur--l', anchor: [0.5, 0.03, 0.5] }`, `axis: [1, 0, 0]`, `range: [0, 135]`, `periodS: 4`
    - `shoulder-abduction`:
      - `view: 'anterior'`
      - `moving`: humerus--l plus everything distal in the elbow demo, plus arm muscles `--l`
      - `ghost`: deltoid parts and supraspinatus `--l`; agonists flex = deltoid parts and supraspinatus, extend = latissimus dorsi `--l`
      - `pivot: { mesh: 'humerus--l', anchor: [0.5, 0.95, 0.5] }`, `axis: [0, 0, 1]`, `range: [0, 90]`, `periodS: 5`
    - `heartbeat`:
      - `view: 'anterior'`, `systems: ['cardiovascular']`
      - `groups: [{ meshes: ['left-atrium', 'right-atrium'], phase: 0 }, { meshes: ['left-ventricle', 'right-ventricle', …papillary muscles and valve leaflets present in the manifest], phase: 0.15 }]`
      - `bpm: 72`, `amplitude: 0.04`
    - Use only MeshIds that exist in `public/models/manifest.json`. Derive the lists with a scratch script over the manifest, but write them out literally in the JSON.

- [ ] **Step 1: Write the failing tests.**
  - **Schema:**
    - accepts one valid hinge and one valid pulse
    - rejects `axis: [0, 0, 0]`, `range: [90, 10]`, `anchor` 1.2, `bpm` 300, and duplicate ids
  - **`checkContent`:**
    - `check:content reports unknown motion meshes`: `moving: ['gone--l']` → `motions.json: "elbow-flexion" references unknown mesh "gone--l"`
    - the moving/ghost overlap error
    - no motions input → no motion errors (backward compatible)
- [ ] **Step 2: Run** `npx vitest run src/features/motion src/data`. Expected: FAIL.
- [ ] **Step 3: Implement** the schema and checks, then write `content/motions.json`.
- [ ] **Step 4: Run** `npm test && npm run check:content`. Expected: PASS, with 0 errors.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(motion): motion definitions schema, validation and demo data"`

### Task 2: Motion math

**Files:**
- Create: `src/features/motion/math.ts`
- Test: `src/features/motion/math.test.ts`

**Interfaces:**
- Produces:
  - `anchorPoint(anchor: [number, number, number], b: Bounds): [number, number, number]`, meaning `min + anchor·(max − min)`.
  - `hingeAngleDeg(phase: number, range: [number, number]): number`. Wraps the phase with `phase − floor(phase)`.
  - `hingeDirection(phase: number): 'flex' | 'extend'`
  - `rotateAboutPivot(pivot: [number, number, number], axis: [number, number, number], angleDeg: number): { position: [number, number, number]; quaternion: [number, number, number, number] }`. The axis is normalised. Uses `position = pivot − R·pivot`.
  - `heartbeatScale(phase: number, amplitude: number): number`
  - `scaleAboutPoint(center: [number, number, number], s: number): [number, number, number]`, meaning `center·(1 − s)`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('maps anchors into bounds', () =>
  expect(anchorPoint([0.5, 0, 1], { min: [0, 0, 0], max: [2, 4, 6] })).toEqual([1, 0, 6]));
it('eases the hinge angle over a cycle', () => {
  expect(hingeAngleDeg(0, [0, 145])).toBeCloseTo(0, 9);
  expect(hingeAngleDeg(0.25, [0, 145])).toBeCloseTo(72.5, 9);
  expect(hingeAngleDeg(0.5, [0, 145])).toBeCloseTo(145, 9);
  expect(hingeAngleDeg(1.25, [0, 145])).toBeCloseTo(72.5, 9);
  expect([0.1, 0.49, 0.5, 0.9].map(hingeDirection)).toEqual(['flex', 'flex', 'extend', 'extend']);
});
it('rotates about a pivot, leaving the pivot fixed', () => {
  const { position, quaternion } = rotateAboutPivot([0, 1, 0], [0, 0, 2], 90);
  const m = new Matrix4().compose(new Vector3(...position), new Quaternion(...quaternion), new Vector3(1, 1, 1));
  expect(new Vector3(0, 1, 0).applyMatrix4(m).toArray().map((n) => +n.toFixed(9))).toEqual([0, 1, 0]);
  expect(new Vector3(0, 0, 0).applyMatrix4(m).toArray().map((n) => +n.toFixed(9))).toEqual([1, 1, 0]);
});
it('beats lub-dub', () => {
  expect(heartbeatScale(0.10, 0.04)).toBeCloseTo(1.04, 3);
  expect(heartbeatScale(0.35, 0.04)).toBeCloseTo(1.024, 3);
  expect(heartbeatScale(0.7, 0.04)).toBeCloseTo(1, 4);
});
it('scales about a fixed centre', () => expect(scaleAboutPoint([1, 2, 3], 1.1).map((n) => +n.toFixed(9))).toEqual([-0.1, -0.2, -0.3]));
```

  - Check the rotation: rotating the origin by 90° about +Z through the pivot (0, 1, 0) maps it to (1, 1, 0). The offset (0, −1, 0) rotated by +90° about Z becomes (1, 0, 0).
  - Check the heartbeat: at 0.10 the second bump contributes `0.6·exp(−(0.25/0.06)²)` ≈ 0. At 0.35 the first contributes ≈ 0, so the scale is ≈ 1 + 0.04·0.6.
- [ ] **Step 2: Run** `npx vitest run src/features/motion/math.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with three.js `Quaternion.setFromAxisAngle` and `Vector3.applyQuaternion`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(motion): hinge, pivot and heartbeat math"`

### Task 3: Motion slice, overrides and MotionPlayer

**Files:**
- Create: `src/features/motion/motionSlice.ts`, `src/features/motion/motionPhase.ts`, `src/scene/MotionPlayer.tsx`, `src/scene/motionTransforms.ts`
- Modify:
  - `src/app/store.ts` (adds the reducer)
  - `src/scene/resolveMeshState.ts`: new inputs `motionGhost` and `motionActive`; new `MeshState.active`.
  - `src/scene/materials.ts`: `MaterialState` adds `'active'`, plus `setActivePulse(intensity: number)`.
  - `src/scene/applyMeshStates.ts`: compares the new field.
  - `src/scene/AtlasCanvas.tsx`: mounts `MotionPlayer`.
- Test: `src/features/motion/motionSlice.test.ts`, `src/scene/motionTransforms.test.ts`, extend `resolveMeshState.test.ts` and `materials.test.ts`

**Interfaces:**
- Produces:
  - **motion state:**

    ```
    {
      defs: MotionDef[] | null; loadStatus: 'idle' | 'loading' | 'ready' | 'error';
      activeId: string | null; playing: boolean; speed: 0.5 | 1;
      direction: 'flex' | 'extend' | null; scrubPhase: number;
    }
    ```

  - Actions: `motionsLoaded(defs)`, `motionsFailed()`, `motionActivated({ id, playing })`, `motionPlayed()`, `motionPaused(phase)`, `motionScrubbed(phase)`, `motionSpeedSet(speed)`, `motionDirectionChanged(dir)`, `motionStopped()`.
  - `selectMotionOverrides(state): { ghost: ReadonlySet<MeshId>; active: ReadonlySet<MeshId> }`. Memoised.
    - Empty when nothing is active.
    - For a hinge: `ghost` = def.ghost, and `active` = `agonists[direction]` while playing, or `agonists.flex` when paused at phase < 0.5.
    - For a pulse: both are empty.
  - **`resolveMeshState` changes:**
    - `motionGhost.has(id) && visible` → `ghost: true`, `opacity: fadeOpacity`, `pickable: false`.
    - `motionActive.has(id) && visible` → `active: true`.
    - `materialStateFor` precedence: selected, then hovered, then active, then ghost, then base.
  - **The library's `'active'` material:** emissive = the base colour. `setActivePulse(i)` sets `emissiveIntensity = i` on all active materials.
  - `motionPhase`: an external store (`get`, `set`, `subscribe`) for the live phase, written by `MotionPlayer`. It's never in Redux.
  - **`createMotionTransforms(registry: MeshRegistry)`**, returning:
    - `begin(ids: MeshId[]): void`: snapshots each existing mesh's `position`, `quaternion` and `scale` (cloned). Missing ids are skipped.
    - `applyHinge(def: HingeDef, pivot, angleDeg): void`: sets every snapshotted moving mesh to `rotateAboutPivot`, composed with its original transform. Originals are identity in practice (the pipeline applies transforms), but compose anyway.
    - `applyPulse(groups: { ids: MeshId[]; scale: number }[], center): void`
    - `restore(): void`: copies the snapshots back exactly, then calls `updateMatrixWorld(true)` on each mesh, and clears the snapshots.
  - **`<MotionPlayer />`**, inside the Canvas:
    - On `activeId` change: `restore()`, then `begin()` with the new def's meshes.
    - In `useFrame`, while playing: `phase += delta·speed / period`; apply; `motionPhase.set`; dispatch `motionDirectionChanged` only when the direction changes; `library.setActivePulse(0.25 + 0.35·(0.5 − 0.5·cos 4π·phase))`; `invalidate()`.
    - While paused: apply once at `scrubPhase`.
    - On `motionStopped` or unmount: `restore()`.
    - The hinge pivot comes from `anchorPoint(def.pivot.anchor, manifest.meshes[def.pivot.mesh].bounds)`. The pulse centre comes from the `center` anchor, or the union bounds centre of all group meshes.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `stop restores exact transforms` | registry with 3 meshes at non-trivial transforms → `begin` → `applyHinge` 1,000 times with random angles → `restore()` → each mesh's `position`, `quaternion` and `scale` `.equals(original)` is true (exact, not approximate) |
| `missing meshes are skipped` | `begin(['femur--l', 'gone--l'])` → no throw; `applyHinge` only moves `femur--l` |
| `pulse scales about the centre` | one mesh, centre (1,0,0), scale 1.1 → `position ≈ (-0.1, 0, 0)`, `scale (1.1, 1.1, 1.1)` |
| `overrides follow direction` (selector) | active hinge, playing, direction `extend` → `active` = the extend agonists; `ghost` = def.ghost; stopped → both empty |
| `motion ghost is unpickable` (resolve) | `motionGhost` has the id → `ghost: true`, `pickable: false`, `opacity: 0.15` |
| `active highlight precedence` (materials) | `materialStateFor({…, active: true, ghost: true, highlight: 'none'})` → `'active'`; with `highlight: 'hovered'` → `'hovered'` |
| `setActivePulse` | only active materials change `emissiveIntensity` |
| slice transitions | `motionActivated({id, playing:true})` → playing; `motionPaused(0.3)` → `scrubPhase` 0.3; `motionStopped` → `activeId` null, `direction` null |

- [ ] **Step 2: Run** `npx vitest run src/features/motion src/scene`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(motion): motion state, overrides and imperative player"`

### Task 4: Thunks and listeners

**Files:**
- Create: `src/features/motion/thunks.ts`
- Modify: `src/app/listeners.ts`
- Test: `src/features/motion/thunks.test.ts`

**Interfaces:**
- Consumes: `waitForBundles` (`src/features/search/revealAndFocus.ts`), `selectBundlesForSystem`, `systemToggled`, the camera extra argument, and the quiz start action (`quizStarted` in `quizSlice`).
- Produces:
  - `loadMotions(): AppThunk<Promise<void>>`. Fetches `${BASE_URL}content/motions.json`, parses it with `MotionsFileSchema`, and is cached.
  - `startMotion(id: string): AppThunk<Promise<void>>`, in this order:
    1. Refuse if the quiz is active.
    2. Make sure the defs are loaded.
    3. Enable `def.systems` and `waitForBundles`.
    4. `camera.goToPreset(def.view)`.
    5. `motionActivated({ id, playing: !prefersReducedMotion() })`, with `scrubPhase` 0.25 under reduced motion.
  - `stopMotion(): AppThunk`. Dispatches `motionStopped`.
  - **Listeners:**
    - `quizStarted` → `motionStopped`.
    - `systemToggled` that disables one of the active def's `systems` → `motionStopped`.
    - Bundle retry of a bundle holding moving meshes → `motionStopped`.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `startMotion waits for bundles` | muscular off and its bundle idle → start `elbow-flexion` → `systems.muscular.enabled`, and it resolves only after `bundleReady('muscular')`; `goToPreset('left')` called; `activeId === 'elbow-flexion'` and `playing` |
| `reduced motion starts paused` | `matchMedia` reduce → `playing: false`, `scrubPhase: 0.25` |
| `refused during quiz` | quiz `asking` → no state change |
| `quiz start stops motion` | an active demo, then dispatch the quiz start action → `activeId === null` |
| `disabling a needed system stops motion` | active elbow demo, then `systemToggled('muscular')` to off → stopped |
| `bad motions file` | fetch returns `{ motions: [{ kind: 'hinge' }] }` → `loadStatus: 'error'`, no throw |

- [ ] **Step 2: Run** `npx vitest run src/features/motion/thunks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(motion): start/stop thunks and safety listeners"`

### Task 5: Motion tab and visual tuning

**Files:**
- Create: `src/features/motion/MotionPanel.tsx`
- Modify: `src/features/tree/LeftPanel.tsx` (a lazy `Motion` tab), `src/features/selection/SelectionAnnouncer.tsx` (or a new sibling live region for motion status), `content/motions.json` (tuning)
- Test: `src/features/motion/MotionPanel.test.tsx`

**Interfaces:**
- Produces: `<MotionPanel />`.
  - It's a list of demo buttons, labelled with each demo's `label`.
  - With a demo active, it shows: the caption copy; `Play`/`Pause` (one toggle button whose label reflects the state); a `Speed` radio group with `0.5×` and `1×`; a `Motion position` slider (0–1, step 0.01) that reads `motionPhase` while playing and dispatches `motionPaused(p)` and then `motionScrubbed(p)` when dragged; and `Stop`.
  - The demo buttons are disabled with `title="Finish the quiz first"` during the quiz.
  - A live region announces `Playing {label}.`, `Paused.` or `Stopped.`

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `lists demos` | 4 buttons with the 4 labels from the fixture defs |
| `play/pause/stop` | click `Elbow flexion and extension` → mocked `startMotion('elbow-flexion')`; with active playing state, click `Pause` → `motionPaused`; `Stop` → `stopMotion` |
| `scrub pauses and sets phase` | slider `End` → dispatches `motionPaused` then `motionScrubbed(1)` |
| `caption and live region` | caption text present; after play, the live region reads `Playing Elbow flexion and extension.` |
| `disabled during quiz` | quiz active → demo buttons disabled |

- [ ] **Step 2: Run** `npx vitest run src/features/motion/MotionPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Tune visually.** Run `npm run dev` and play each demo.
  - **Elbow:** the forearm should swing **anteriorly and up**, not backwards. If it goes backwards, negate `axis`.
  - **Knee:** the leg should swing **posteriorly**.
  - **Shoulder:** the arm should rise **laterally** to the patient's left (+X).
  - **Hinge alignment:** the moving bones' proximal ends should stay at the joint. Adjust `pivot.anchor` until there's no visible gap or overlap at 0° and at the maximum angle.
  - **Heartbeat:** the atria should visibly lead the ventricles. Nothing should drift after a minute.
  - **Mesh lists:** add any distal meshes that are left behind to `moving`, and any muscle crossing the joint to `ghost`.
  - Record each demo with the OS screen recorder, or save start and peak screenshots to `docs/img/phase-3c-<id>-{start,peak}.png`.
- [ ] **Step 5: Run** `npm test && npm run check:content`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(ui): motion tab; tune demo pivots and mesh lists"`

### Task 6: End-to-end tests, docs and performance

**Files:**
- Create: `e2e/motion.spec.ts`, `docs/phase-3c-performance.md`
- Modify: `src/app/testHooks.ts` (adds `motionPhase(): number` and `meshTransform(id): { position: number[]; quaternion: number[]; scale: number[] } | null`), `README.md`, `docs/architecture.md`, `src/features/about/AboutDialog.tsx` (adds a sentence on illustrative motion)

- [ ] **Step 1: Write the e2e tests.**

| Test | Steps → expectation |
|---|---|
| `elbow demo moves the forearm and restores it` | record the `radius--l` transform → Motion tab → `Elbow flexion and extension` → wait until `motionPhase() > 0.2` → the transform differs → `Stop` → the transform equals the recording exactly |
| `crossing muscles are ghosted and unpickable` | during the elbow demo, clicking at `screenPointOf(<a ghost id from motions.json>)` doesn't select that id |
| `pins follow the bone` | add a pin on `radius--l` (Plan 3A flow) → play the elbow demo to phase ≈ 0.5 (pause, then `End` on the slider) → the pin's screen point moved more than 30 px versus phase 0 |
| `works with a section` | enable a sagittal section, play the heartbeat → no page errors; `motionPhase()` advances |
| `quiz stops the demo` | play a demo → `__atlas.startQuiz(1)` → `getState().motion.activeId === null`, and the `radius--l` transform is restored |

- [ ] **Step 2: Run** `npm run test:e2e`. Fix real bugs until it passes.
- [ ] **Step 3: Measure** fps while each demo plays, with all systems on, on Auto and Low. Record the results in `docs/phase-3c-performance.md`. Stop for the owner if a v1 §9.1 budget fails.
- [ ] **Step 4: Update docs.** Add motion demos to the README, with their honesty note; add the motion player and overrides to `docs/architecture.md`.
- [ ] **Step 5: Run** `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "test(e2e): motion demos; docs"`
