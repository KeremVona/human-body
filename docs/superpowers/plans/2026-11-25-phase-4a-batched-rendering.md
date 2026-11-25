# Phase 4A Batched Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut draw calls from about 1,406 to ≤ 200 in common states, with no visible or behavioural change, and verify the v1 frame-rate budgets on a real mid-range laptop and phone.

**Architecture:**
- At bundle load, meshes are grouped by appearance key `(bundle, system, tissue, color)` into `BatchedMesh` objects, using the existing library materials.
- After `applyMeshStates` runs, a pure `planBatches()` picks each batch's state (`base` or `ghost`, by visible majority) and the set of **promoted** meshes:
  - visible meshes whose material state differs from the batch's, or that are moved by a motion demo.
- `applyBatchPlan()`:
  - toggles instance visibility,
  - swaps batch materials,
  - shows only promoted individual meshes.
- The registry and `resolveMeshState` stay the single source of truth.
- Picking maps `BatchedMesh` hits back to MeshIds.

**Tech Stack:** three r187 `BatchedMesh`; three-mesh-bvh 0.9 `computeBatchedBoundsTree`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-25-phase-4-design.md` §3–§4 ("P4 §"). **Code baseline:** `main` at `4becef9`.

## Global Constraints

- **Appearance key:** `${bundleId}|${system}|${tissue}|${color ?? ''}`. Meshes with no index entry get key `${bundleId}|fallback` and the fallback material.
- **Batch state rule:**
  - Among a batch's members with `state.visible`, count the ghost states (`state.ghost && !highlight && !active`) against the base states (no ghost, no highlight, not active).
  - The batch state is `ghost` when ghosts > bases, and `base` otherwise.
  - No visible members means the state is `hidden` (`batch.visible = false`).
- **Promoted** = `state.visible && (materialStateFor(state) !== batchState || motionMoving.has(id))`.
  - A promoted mesh gets `mesh.visible = true` and its instance is hidden.
  - A visible member that isn't promoted gets its instance visible and `mesh.visible = false`.
  - A hidden member gets both hidden.
- **Batch rendering:**
  - Material: `library.get({ system, tissue, color, state: batchState })`.
  - `renderOrder = RENDER_ORDER[system] + (batchState === 'ghost' ? 10 : 0)`.
  - `sortObjects = material.transparent`. `perObjectFrustumCulled = true`.
- **Per-mesh flags:** `mesh.userData.pickable` and a new `mesh.userData.atlasVisible` (= `state.visible`) are kept on the **individual** mesh whether or not it's drawn. Batch-level pickability lives in `batch.userData.pickable: Uint8Array` (1 = pickable).
- **Kill switch:** `?batching=off` disables everything in this plan, giving the Phase 3 behaviour.
- **Budgets (P4 §3):**
  - draw calls ≤ 40 in the default view, ≤ 200 in common states, ≤ 400 in the worst case,
  - ≥ 60 fps on a mid-range iGPU and ≥ 30 fps on a phone, on Auto,
  - JS heap ≤ 1.5× Phase 3D.
- **No regressions:** all existing unit and e2e tests pass with batching **on**. The e2e suite also runs once with `?batching=off` through a Playwright project.

## Review Focus

1. **Hovering quickly across many meshes.** Promotion toggles every frame. There must be no flicker (a mesh drawn twice, or neither) and no growth in scene children. → Task 2, `promotion is exclusive`; Task 5, the e2e hover sweep.
2. **Fade others with a kept set larger than half a batch**, which flips that batch's state. Every kept mesh must still render solid and every faded mesh ghosted. → Task 2, the majority-flip cases.
3. **Clicking a batched mesh, or the cut face of a batched mesh** (a section plus `firstHitOnly = false`). It must return the right MeshId, and skip non-pickable instances. → Task 3 tests.
4. **A bundle retry or unload.** Its batches must be disposed and removed, and its handles dropped from the batch registry, with no stale draws or leaks. → Task 4, `unregister disposes batches`.
5. **Transparent system opacity (for example skin at 0.35) drawn from a batch.** It must still blend correctly over the systems underneath. → Task 5 visual A/B screenshot comparison.

---

### Task 0: Spike — a throwaway that is measured and then deleted

- [ ] **Step 1: Build the spike.** On a scratch branch, `spike/batching`, batch only the skeletal bundle inside `BundleModel`: one `BatchedMesh` per appearance key, with every instance visible and the individual meshes hidden.
  - Call `batch.computeBoundsTree()` after `import { computeBatchedBoundsTree } from 'three-mesh-bvh'` and `BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree`.
  - Click-select through a temporary hit mapping.
- [ ] **Step 2: Measure** on `/?debug` with Low quality:
  - draw calls (expected ≤ 40),
  - fps,
  - JS heap (`performance.memory.usedJSHeapSize` in Chromium) against `main`,
  - correct MeshIds on 20 manual clicks.
- [ ] **Step 3: Decide.** Write the results into `docs/phase-4a-spike.md` with a verdict: **Go**, or **Stop** with the reason.
  - Stop if the batched BVH or raycasting returns wrong instances, or crashes, in this three / three-mesh-bvh combination. In that case, report to the owner and don't continue.
- [ ] **Step 4: Clean up.** Delete the spike branch. Only the doc is committed to `main`: `git commit -m "docs: phase 4A batching spike"`.

### Task 1: Batch construction

**Files:**
- Create: `src/scene/batching/keys.ts`, `src/scene/batching/buildBatches.ts`, `src/scene/batching/batchRegistry.ts`
- Test: `src/scene/batching/keys.test.ts`, `buildBatches.test.ts`, `batchRegistry.test.ts`

**Interfaces:**
- Consumes: `MeshAppearance` (`src/scene/applyMeshStates.ts`), `MeshId`, `RENDER_ORDER`.
- Produces:
  - `appearanceKey(bundleId: string, a: MeshAppearance | undefined): string`
  - `type BatchHandle = { key: string; bundleId: string; appearance: MeshAppearance | null; batch: BatchedMesh; instanceOf: Map<MeshId, number>; meshIdAt: MeshId[]; state: 'base' | 'ghost' | 'hidden' }`
  - `buildBatches(bundleId: string, entries: { id: MeshId; mesh: Mesh; appearance: MeshAppearance | undefined }[], material: (a: MeshAppearance | null) => Material): BatchHandle[]`
    - Groups the entries by key.
    - Sizes each `BatchedMesh` exactly: the sum of vertex counts and index counts (non-indexed geometry counts its vertices as indices).
    - Adds a geometry and an instance per mesh, then `setMatrixAt(instance, mesh.matrixWorld)` after `mesh.updateWorldMatrix(true, false)`.
    - Initialises `userData = { atlasBatch: true, meshIds: meshIdAt, pickable: new Uint8Array(n) }`. Every instance starts hidden, and the batch starts `visible = false`.
    - Computes the batched BVH.
    - Names each batch `batch:${key}`.
  - `createBatchRegistry(): { add(handles: BatchHandle[]): void; removeBundle(bundleId: string): BatchHandle[]; all(): BatchHandle[]; byMesh(id: MeshId): { handle: BatchHandle; instance: number } | undefined; subscribe(l: () => void): () => void }`

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `keys` | `appearanceKey('organs', {system:'digestive', tissue:'organ', color:'#7a2e2a'})` → `organs\|digestive\|organ\|#7a2e2a`; an undefined appearance → `organs\|fallback` |
| `groups by appearance` | 5 meshes (3 bone in skeletal, 1 cartilage, 1 with no appearance) → 3 handles; the bone handle's `meshIdAt` lists the 3 ids in input order, and `instanceOf` maps them to 0..2 |
| `copies world matrices` | a mesh with position (1,2,3) → `batch.getMatrixAt(0, m)` has translation (1,2,3) |
| `starts hidden and unpickable` | `batch.visible === false`; every `getVisibleAt(i) === false`; `pickable` is all 0 |
| `exact capacity` | 2 box geometries (24 verts and 36 indices each) → the batch's max vertex count is 48 and max index count 72 (read through `batch.geometry` attribute counts, or the exposed internals in r187) |
| `registry byMesh and removeBundle` | add the handles of 2 bundles → `byMesh` finds an instance; `removeBundle('skeletal')` returns its handles, and `byMesh` for those ids is `undefined` afterwards |

- [ ] **Step 2: Run** `npx vitest run src/scene/batching`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(batching): build appearance-keyed BatchedMesh handles"`

### Task 2: Batch plan (pure)

**Files:**
- Create: `src/scene/batching/planBatches.ts`
- Test: `src/scene/batching/planBatches.test.ts`

**Interfaces:**
- Consumes: `MeshState`, `materialStateFor`.
- Produces:
  - `type BatchPlan = { batchState: Map<string, 'base' | 'ghost' | 'hidden'>; promoted: Set<MeshId>; instanceVisible: Map<MeshId, boolean> }`
  - `planBatches(input: { members: ReadonlyMap<string, readonly MeshId[]>; states: ReadonlyMap<MeshId, MeshState>; moving: ReadonlySet<MeshId> }): BatchPlan`. Implements the Global Constraints rules exactly. A member with no state counts as not visible.

- [ ] **Step 1: Write the failing tests.** `s(...)` builds a `MeshState`: visible, opacity 1, no ghost, highlight none, pickable, not active, unless overridden.

| Case | Members (key `k`) → states | Expect |
|---|---|---|
| all base | a, b, c base | `k: base`; promoted ∅; a, b, c instances visible |
| one hovered | a hovered, b, c base | `k: base`; promoted {a}; a's instance hidden, b and c visible |
| `promotion is exclusive` | any case | for every visible id: exactly one of `promoted.has(id)` and `instanceVisible.get(id)` is true |
| fade majority | a, b, c ghost; d base (kept) | `k: ghost`; promoted {d} |
| majority flip | a, b ghost; c, d, e base | `k: base`; promoted {a, b} |
| tie → base | a ghost; b base | `k: base`; promoted {a} |
| hidden members | a hidden; b base | `k: base`; promoted ∅; a's instance hidden and not promoted |
| none visible | a, b hidden | `k: hidden`; promoted ∅ |
| selected inside a ghost batch | a, b ghost; c selected | `k: ghost`; promoted {c} |
| active agonist | a, b base; c active | `k: base`; promoted {c} |
| moving overrides | a, b base, `moving` = {a} | promoted {a} |
| missing state | `states` lacks b | b's instance hidden, not promoted |

- [ ] **Step 2: Run** `npx vitest run src/scene/batching/planBatches.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(batching): pure batch-state and promotion planner"`

### Task 3: Picking and pin occlusion through batches

**Files:**
- Modify: `src/scene/gestures.ts`, `src/scene/Picking.tsx`, `src/scene/PinProbe.tsx`, `src/scene/applyMeshStates.ts` (also sets `mesh.userData.atlasVisible = state.visible`)
- Test: extend `src/scene/gestures.test.ts` and `src/scene/applyMeshStates.test.ts`

**Interfaces:**
- Produces:
  - `meshIdOfHit(hit: { object: Object3D; batchId?: number }): { id: MeshId; pickable: boolean } | null`
    - A batch hit (`object.userData.atlasBatch === true` with a numeric `batchId`) gives `meshIds[batchId]` and `pickable[batchId] === 1`.
    - Otherwise it uses the existing `meshIdOf(object)` and `object.userData.pickable === true`.
  - `pickMeshId(intersections, clip?)` now uses `meshIdOfHit`. Its signature and the section filter are unchanged.
  - **PinProbe occlusion:** raycasts the registry meshes whose `userData.atlasVisible && userData.pickable` are true. Three's raycaster doesn't check `visible`, so this works whether the mesh is drawn individually or through its batch. It never raycasts batches.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `maps a batch hit to its mesh` | batch with `userData = { atlasBatch: true, meshIds: ['femur--l','sternum'], pickable: Uint8Array [1, 0] }` → `meshIdOfHit({object: batch, batchId: 0})` → `{ id: 'femur--l', pickable: true }`; `batchId: 1` → pickable false |
| `pickMeshId skips non-pickable batch instances` | hits `[batch#1 (sternum, unpickable), batch#0 (femur)]` → `'femur--l'` |
| `section filter applies to batch hits` | a batch hit whose `point` is on the clipped side → skipped |
| `individual meshes unchanged` | the existing pickMeshId tests still pass |
| `atlasVisible mirrors state.visible` (applyMeshStates) | after apply → `mesh.userData.atlasVisible === state.visible` |

- [ ] **Step 2: Run** `npx vitest run src/scene/gestures.test.ts src/scene/applyMeshStates.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(batching): batch-aware picking and pin occlusion"`

### Task 4: BatchRenderer integration

**Files:**
- Create: `src/scene/batching/applyBatchPlan.ts`, `src/scene/batching/BatchLayer.tsx`, `src/scene/batching/flag.ts`
- Modify:
  - `src/scene/BundleModel.tsx`: after registration, when batching is enabled, builds batches and adds them to the batch registry; disposes them in the effect cleanup.
  - `src/scene/SceneStateApplier.tsx`: after `applyMeshStates`, runs `planBatches` and `applyBatchPlan` over all handles.
  - `src/scene/AtlasCanvas.tsx`: mounts `<BatchLayer>` inside `<Picking>`.
  - `src/features/motion/motionSlice.ts`: adds `selectMotionMoving`.
  - `src/scene/DebugStats.tsx`: shows `batches`, `promoted` and `individual` counts.
  - `src/app/testHooks.ts`: adds `drawStats()`.
- Test: `src/scene/batching/applyBatchPlan.test.ts`, `flag.test.ts`, extend `src/scene/BundleModel.test.tsx` and `motionSlice.test.ts`

**Interfaces:**
- Produces:
  - `batchingEnabled(search: string): boolean`. False only for `?batching=off`.
  - `selectMotionMoving(state): ReadonlySet<MeshId>`. Memoised. For an active hinge it's `def.moving`; for a pulse it's every group's meshes; otherwise empty.
  - `applyBatchPlan(a: { handles: BatchHandle[]; plan: BatchPlan; states: ReadonlyMap<MeshId, MeshState>; registry: MeshRegistry; library; }): { promoted: number; visibleBatches: number }`
    - Per handle:
      - set `state`, `visible`, `material`, `renderOrder` and `sortObjects`;
      - set `setVisibleAt` for each instance from `plan.instanceVisible`;
      - set `pickable[i]` from `states.get(id)?.pickable && instanceVisible`.
    - Per member mesh: `mesh.visible = plan.promoted.has(id)`.
    - **Write only what changed**, tracked per handle, so an unchanged frame does no `setVisibleAt` calls.
  - `<BatchLayer />` renders `<primitive object={handle.batch} />` for each handle in the batch registry, re-rendering on the registry's `subscribe`.
  - Bundle cleanup: `batchRegistry.removeBundle(bundleId)`, then `batch.disposeBoundsTree?.()` and `batch.dispose()` for each handle.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `applies a plan` | 3 meshes in one handle, plan with promoted {a} and b, c visible → `a.visible`, `!b.visible`, `!c.visible`; instance visibility `[false, true, true]`; `batch.visible`; the material is the library's base material; `pickable` `[0, 1, 1]` |
| `ghost batch material and order` | plan `ghost` for a muscular handle → material state ghost, `renderOrder === 13`, `sortObjects === true` |
| `no-op when unchanged` | applying the same plan twice → the second call makes no `setVisibleAt` calls (spy) |
| `flag` | `batchingEnabled('?batching=off') === false`; `''` and `'?debug'` → true |
| `unregister disposes batches` (BundleModel) | mount a bundle with batching on → the registry has handles → unmount → `removeBundle` called, `dispose` spied once per handle, and the registry is empty |
| `batching off keeps the Phase 3 path` | with the flag off, no handles are created and `mesh.visible` follows `state.visible` |
| `selectMotionMoving` | an active elbow def → its `moving` ids; stopped → empty |

- [ ] **Step 2: Run** `npx vitest run src/scene src/features/motion`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS with batching on (the default). Fix real regressions.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(batching): batch renderer integrated with scene state, motion and bundles"`

### Task 5: Equivalence tests and the batching-off project

**Files:**
- Create: `e2e/batching.spec.ts`
- Modify: `playwright.config.ts` (adds a `chromium-batching-off` project that runs the whole suite with `?batching=off` appended by a fixture, and excludes `batching.spec.ts`)

- [ ] **Step 1: Write the e2e tests.**

| Test | Steps → expectation |
|---|---|
| `draw calls drop` | Low quality, default view → `drawStats()` has `batches + promoted ≤ 40`; all systems on → `≤ 200`; fade others on `femur--l` with everything on → `≤ 400` |
| `pixel equivalence` | for each scenario (default; all systems; skin at 0.35 plus muscular at 0.5; fade others on the femur; isolate the heart; axial section at 0.5; femur selected on Low) → screenshot with batching on and off at the same pose (reload with the share hash from `encodeView()` to fix the pose) → `toMatchSnapshot` comparison of on vs off with `maxDiffPixelRatio: 0.005` (Low quality, so no AO noise) |
| `hover sweep` | move the mouse across 40 points over the body → every move has at most one drawn copy of each mesh (`drawStats().promoted ≤ 2`), and the scene children count is constant before and after |
| `click through batches` | all systems on, Low → click `screenPointOf('sternum')` with muscles enabled at 0.3 (so they're unpickable) → `sternum` selected |
| `motion with batching` | play the elbow demo to phase 0.5 → the radius is drawn (promoted); stop → `promoted === 0` |

- [ ] **Step 2: Run** `npm run test:e2e`. Expected: all projects PASS, including `chromium-batching-off`. Fix real differences. A pixel difference over the threshold is a bug, not a threshold to raise.
- [ ] **Step 3: Commit.** `git add -A && git commit -m "test(e2e): batching equivalence and draw-call budgets"`

### Task 6: Real-device measurement and docs

**Files:**
- Create: `docs/phase-4a-performance.md`
- Modify: `README.md`, `docs/architecture.md` (the BatchRenderer layer: keys, the state rule, promotion, the kill switch)

- [ ] **Step 1: Measure on the desktop,** as in Phase 3D: draw calls, fps and heap, on Auto and Low, with batching on and off, all systems on.
- [ ] **Step 2: Measure on real devices.** Ask the owner to open the production URL (or `npm run preview -- --host` on the LAN) with `?debug` on:
  1. a laptop with an integrated GPU,
  2. a phone.

  Record fps idle and orbiting with all systems on, plus the device names. If the owner can't, record DevTools 4× CPU throttle numbers labelled **"emulated, not verified"**, and report the gate as unverified.
- [ ] **Step 3: Compare with P4 §3.** If a budget fails, write "Needs optimisation" and stop for the owner.
- [ ] **Step 4: Update the docs,** then run `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "docs: phase 4A performance on real devices"`
