# Phase 3B Cross-sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor cut the body with one axial, sagittal or coronal plane, slide it, and flip which side is kept. Cut faces look solid, nothing on the removed side can be clicked, and the section travels in share links.

**Architecture:**
- A `section` slice holds `{ enabled, axis, t, flip }`.
- A pure `sectionPlane()` turns that state and the body bounds into a plane.
- One shared `THREE.Plane` is mutated in place and attached to every MaterialLibrary material, using local clipping.
- Caps use the back-face trick: opaque materials go double-sided while a section is on, and back-facing fragments output a flat cap colour.
- Picking filters out hits on the removed side.

**Tech Stack:** Existing. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-24-phase-3-design.md` §5 ("P3 §"). **Depends on:** Plan 3A (`docs/superpowers/plans/2026-11-24-phase-3a-share-pins.md`), for the codec field `x` and `CameraApi`. **Code baseline:** `main` after Plan 3A.

## Global Constraints

- **One plane at a time.** `t ∈ [0, 1]`, rounded to 0.005, default 0.5. The default axis is `axial`. `flip` defaults to false.
- **Kept side by default:**
  - axial keeps y ≤ y₀ (inferior),
  - sagittal keeps x ≤ x₀ (the patient's right, since +X is the patient's left),
  - coronal keeps z ≤ z₀ (posterior).

  `flip` keeps the opposite side.
- **Camera on enable, axis change or flip** (`presetForSection`):

  | Axis | Normal | Flipped |
  |---|---|---|
  | axial | superior | inferior |
  | sagittal | left | right |
  | coronal | anterior | posterior |

  Moving the slider never moves the camera.
- **Cap colour** = the material's base colour × 0.55, unlit. Only `base`, `hovered` and `selected` materials get caps; `ghost` materials never do.
- **Zero cost when off:** with the section disabled, materials are exactly as they were before this plan (`FrontSide`, no clipping planes, the original `onBeforeCompile`), and `gl.localClippingEnabled` is false.
- **Picking while sectioned:** the raycaster's `firstHitOnly` is **false**, so the back face of a cut mesh can be hit. Hits with `plane.distanceToPoint(point) < 0` are ignored. When the section is off, `firstHitOnly` goes back to true.
- **Selection outline:** off while the section is enabled. AO follows Task 4's visual check.
- **Copy is exact:** `Cross-section` (the toolbar button and the switch), `Axial`, `Sagittal`, `Coronal`, `Section position`, `Flip side`.
- **Shortcut:** `X` → `'toggle-section'`. Ignored while typing, in dialogs, and during the quiz.
- **Share field:** `x: [axisIndex, t, flip]`, where axisIndex 0 is axial, 1 sagittal, 2 coronal.

## Review Focus

1. **Clicking the solid-looking cut face** must select that structure. The ray's first hit is the clipped front face, so only `firstHitOnly = false` plus filtering makes this work. → Task 3, `picks the back face of a cut mesh`, plus e2e.
2. **Clicking where a removed structure used to be** must select nothing on the removed side. → Task 3 unit test and e2e `removed side is not pickable`.
3. **A slider at t = 0 or t = 1.** Everything or nothing is clipped, without NaN planes or crashes. → Task 1, edge cases.
4. **Toggling the section off** restores the materials' sidedness and shaders exactly. Otherwise ghost or transparency rendering regresses. → Task 2, `setClipPlane(null) restores originals`.
5. **A share link with a section** restores it, including on a fresh load before the materials exist. → Task 5 tests.

---

## Task 0: Gate

- [ ] **Step 1:** Confirm Plan 3A is merged: `src/features/share/codec.ts` exists and `npm run ci && npm run test:e2e` pass.

### Task 1: Section state and plane math

**Files:**
- Create: `src/features/section/sectionSlice.ts`, `src/features/section/sectionPlane.ts`
- Modify: `src/app/store.ts` (adds the reducer)
- Test: `src/features/section/sectionSlice.test.ts`, `sectionPlane.test.ts`

**Interfaces:**
- Consumes: `Bounds`, `Preset` (`src/scene/camera.ts`).
- Produces:
  - `type SectionAxis = 'axial' | 'sagittal' | 'coronal'`
  - `type SectionState = { enabled: boolean; axis: SectionAxis; t: number; flip: boolean }`
  - Actions: `sectionToggled()`, `sectionSet(Partial<SectionState>)` (clamps and rounds `t`), `sectionAxisSet(axis)`, `sectionPositionSet(t)`, `sectionFlipped()`.
  - `sectionPlane(s: Pick<SectionState, 'axis' | 't' | 'flip'>, b: Bounds): { normal: [number, number, number]; constant: number }`. `-0` is normalised to `0`.
  - `presetForSection(axis: SectionAxis, flip: boolean): Preset`
  - `isClipped(point: [number, number, number], plane: { normal; constant }): boolean`, meaning `dot(n, p) + c < 0`.

- [ ] **Step 1: Write the failing tests.**

```ts
const b: Bounds = { min: [-0.3, -0.9, -0.15], max: [0.3, 0.9, 0.15] };
it.each([
  [{ axis: 'axial', t: 0.25, flip: false }, { normal: [0, -1, 0], constant: -0.45 }],
  [{ axis: 'axial', t: 0.25, flip: true }, { normal: [0, 1, 0], constant: 0.45 }],
  [{ axis: 'sagittal', t: 0.5, flip: false }, { normal: [-1, 0, 0], constant: 0 }],
  [{ axis: 'sagittal', t: 0.5, flip: true }, { normal: [1, 0, 0], constant: 0 }],
  [{ axis: 'coronal', t: 0.5, flip: false }, { normal: [0, 0, -1], constant: 0 }],
] as const)('sectionPlane(%o)', (s, want) => {
  const p = sectionPlane(s, b);
  expect(p.normal).toEqual(want.normal);
  expect(p.constant).toBeCloseTo(want.constant, 9);
  expect(Object.is(p.constant, -0)).toBe(false);
});
it('handles the ends of the range', () => {
  expect(sectionPlane({ axis: 'axial', t: 0, flip: false }, b).constant).toBeCloseTo(-0.9, 9);
  expect(sectionPlane({ axis: 'axial', t: 1, flip: false }, b).constant).toBeCloseTo(0.9, 9);
});
it('classifies clipped points', () => {
  const p = sectionPlane({ axis: 'axial', t: 0.5, flip: false }, b); // keeps y <= 0
  expect(isClipped([0, 0.1, 0], p)).toBe(true);
  expect(isClipped([0, -0.1, 0], p)).toBe(false);
});
it.each([
  ['axial', false, 'superior'], ['axial', true, 'inferior'], ['sagittal', false, 'left'],
  ['sagittal', true, 'right'], ['coronal', false, 'anterior'], ['coronal', true, 'posterior'],
] as const)('presetForSection(%s, %s) = %s', (a, f, p) => expect(presetForSection(a, f)).toBe(p));
```

  - **Slice tests:**
    - The default is `{ enabled: false, axis: 'axial', t: 0.5, flip: false }`.
    - `sectionPositionSet(0.1234)` gives `t: 0.125`; `1.7` gives `1`; `-1` gives `0`.
    - `sectionToggled` flips `enabled`, and `sectionFlipped` flips `flip`.
- [ ] **Step 2: Run** `npx vitest run src/features/section`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(section): section state and plane math"`

### Task 2: Clipping and caps in the material library

**Files:**
- Modify: `src/scene/materials.ts`
- Test: `src/scene/materials.test.ts` (extend)

**Interfaces:**
- Consumes: the existing `createMaterialLibrary` and its `setQuality` behaviour.
- Produces: `setClipPlane(plane: Plane | null): void` on the library object.
  - **With a plane:**
    - Every existing and future material gets `clippingPlanes = [plane]`, the same `Plane` instance.
    - Non-ghost materials get `side = DoubleSide`, plus a cap `onBeforeCompile`. It adds `uniform vec3 capColor;` and, just before `#include <opaque_fragment>`, `if (!gl_FrontFacing) { outgoingLight = capColor; }`.
    - `customProgramCacheKey` returns `'atlas-cap'`, combined with any quality key.
    - `needsUpdate = true`.
  - **With null:** restores `clippingPlanes = null`, `side = FrontSide`, and the material's previous `onBeforeCompile` and cache key. This includes the high-quality ghost fresnel and sheen setup from `setQuality`.
  - `setQuality` and `setClipPlane` compose in either order.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `applies the plane to all materials, including later ones` | create base and ghost → `setClipPlane(p)` → both `clippingPlanes[0] === p`; a material created afterwards also has it |
| `caps only opaque variants` | base, hovered and selected are `DoubleSide` with cache key containing `atlas-cap`; ghost stays `FrontSide` with no cap key |
| `setClipPlane(null) restores originals` | after `setQuality('high')` then `setClipPlane(p)` then `setClipPlane(null)`: ghost `onBeforeCompile` is still the fresnel function, base is `FrontSide`, `clippingPlanes` is null, and the cache keys equal the values before `setClipPlane` |
| `cap shader injects the back-face branch` | call the cap `onBeforeCompile` on a fake shader `{ fragmentShader: 'x\n#include <opaque_fragment>', uniforms: {} }` → it contains `gl_FrontFacing`, and `uniforms.capColor.value` equals the base colour × 0.55 |
| `order independence` | `setClipPlane(p)` then `setQuality('high')` gives the same keys as the reverse order |

- [ ] **Step 2: Run** `npx vitest run src/scene/materials.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the per-material "original" hooks in a `WeakMap<Material, {...}>`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(render): clip plane and back-face caps in material library"`

### Task 3: SectionController and picking

**Files:**
- Create: `src/scene/SectionController.tsx`, `src/scene/sectionPlaneStore.ts`
- Modify:
  - `src/scene/gestures.ts`: `pickMeshId(intersections, clip?)`.
  - `src/scene/Picking.tsx`: passes the current plane.
  - `src/scene/AtlasCanvas.tsx`: mounts `SectionController`.
  - `src/scene/SceneStateApplier.tsx`: exposes its library to the controller through context, or a module, as in the existing code.
  - `src/scene/Effects.tsx`: turns the Outline off while `section.enabled`.
- Test: `src/scene/gestures.test.ts` (extend)

**Interfaces:**
- Produces:
  - `sectionPlaneStore: { get(): Plane | null }`. The live shared plane, or null when off.
  - `pickMeshId(intersections: readonly { object: Object3D; point?: Vector3 }[], clip?: Plane | null): MeshId | null`. Skips hits where `clip && point && clip.distanceToPoint(point) < 0`.
  - `<SectionController />`, inside the Canvas. It subscribes to `section`, `assets.manifest` and the library.
    - **Enabled:**
      - `gl.localClippingEnabled = true`.
      - Update the shared plane from `sectionPlane(state, bodyBounds(manifest))` with `plane.normal.set(...)` and `plane.constant = ...`.
      - Call `library.setClipPlane(plane)` once on enable.
      - Set `raycaster.firstHitOnly = false`.
      - On enable, axis change or flip: `camera.goToPreset(presetForSection(axis, flip))`.
      - `invalidate()` on every change.
    - **Disabled:** reverse all of the above.

- [ ] **Step 1: Write the failing tests.**

```ts
const plane = new Plane(new Vector3(0, -1, 0), 0); // keeps y <= 0
it('ignores hits on the removed side', () => {
  expect(pickMeshId([{ object: meshNamed('skull'), point: new Vector3(0, 0.5, 0) }], plane)).toBeNull();
});
it('picks the back face of a cut mesh', () => {
  const femur = meshNamed('femur--l');
  expect(pickMeshId([
    { object: femur, point: new Vector3(0, 0.2, 0) },   // clipped front face
    { object: femur, point: new Vector3(0, -0.05, 0) }, // back face on kept side
  ], plane)).toBe('femur--l');
});
it('behaves as before without a plane', () =>
  expect(pickMeshId([{ object: meshNamed('skull'), point: new Vector3(0, 0.5, 0) }])).toBe('skull'));
```

  - `meshNamed` makes a `Mesh` with that name and `userData.pickable = true`.
- [ ] **Step 2: Run** `npx vitest run src/scene/gestures.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(section): live clipping, picking filter and camera framing"`

### Task 4: Section UI, shortcut and visual check

**Files:**
- Create: `src/features/section/SectionPopover.tsx`
- Modify: `src/features/dissection/Toolbar.tsx` (a `Cross-section` button that opens the popover, `aria-pressed` while enabled), `src/app/shortcuts.ts` and `useShortcuts.ts` (`x` → `'toggle-section'`), `src/features/about/AboutDialog.tsx` (adds `X` to the shortcuts table)
- Test: `src/features/section/SectionPopover.test.tsx`, extend `src/app/shortcuts.test.ts`

**Interfaces:**
- Produces: `<SectionPopover />`, a Radix Popover containing:
  - a Switch `Cross-section`,
  - a RadioGroup with `Axial`, `Sagittal`, `Coronal`,
  - a Radix Slider `Section position` (min 0, max 1, step 0.005, showing `{Math.round(t*100)}%`),
  - a button `Flip side`.

  The controls other than the switch are disabled while the section is off.

- [ ] **Step 1: Write the failing tests.**

| Test | Expect |
|---|---|
| `enables and configures` | click the `Cross-section` toolbar button → popover; toggle the switch → `section.enabled`; choose `Coronal` → `axis: 'coronal'`; focus the slider and press `End` → `t: 1`, label `100%`; `Flip side` → `flip: true` |
| `controls disabled while off` | the radios, slider and flip button have `disabled` / `data-disabled` |
| `shortcut` | `x` and `X` → `'toggle-section'`; inside an input → `null` |

- [ ] **Step 2: Run** `npx vitest run src/features/section src/app/shortcuts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Visual check.** Run `npm run dev` with all systems on and quality High, then try each axis at t = 0.5 and 0.3.
  - Cut faces should look solid in tissue-tinted colours.
  - Save `docs/img/phase-3b-axial.png`, `-sagittal.png` and `-coronal.png`.
  - If AO shows dark halos along the cut, also skip `N8AO` in `Effects` while `section.enabled`, and note it in the commit message.
  - If some open meshes show obvious holes, add their MeshIds to `CAP_EXCLUDE` in `materials.ts`, where they get a neutral `#8e95a0` cap colour, and list them in the commit message.
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(ui): cross-section popover and shortcut"`

### Task 5: Share-link integration

**Files:**
- Modify: `src/features/share/thunks.ts` (`captureViewState` includes `x` when enabled; `applyViewState` dispatches `sectionSet` from `x`, or disables the section when `x` is absent)
- Test: `src/features/share/thunks.test.ts` (extend)

- [ ] **Step 1: Write the failing tests.**
  - `captures the section`: enabled sagittal at 0.3, flipped → `x: [1, 0.3, 1]`.
  - `applies the section`: a view with `x: [2, 0.7, 0]` → `section` is `{ enabled: true, axis: 'coronal', t: 0.7, flip: false }`.
  - `a link without x turns the section off`.
- [ ] **Step 2: Run** `npx vitest run src/features/share`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(share): include cross-section in links"`

### Task 6: End-to-end tests, docs and performance

**Files:**
- Create: `e2e/section.spec.ts`, `docs/phase-3b-performance.md`
- Modify: `src/app/testHooks.ts` (adds `section(): SectionState`), `README.md`, `docs/architecture.md`

- [ ] **Step 1: Write the e2e tests.**

| Test | Steps → expectation |
|---|---|
| `toggle with X and frame the cut` | press `x` → `__atlas.section().enabled`; after `waitIdle`, `getPose().position[1]` > the body centre y (superior view) |
| `removed side is not pickable` | sagittal at 0.5 (keeps the patient's right) → click `screenPointOf('femur--l')` from the `anterior` preset → the selection does not contain `femur--l` |
| `cut face is pickable` | axial at the femur's mid-height (compute `t` from the manifest bounds) → from `superior`, click the projected femur centre → selection `['femur--l']` |
| `share link carries the section` | coronal at 0.4 → `encodeView()` → reload with the hash → `section()` is `{ enabled: true, axis: 'coronal', t: 0.4, flip: false }` |
| `turning off restores rendering` | enable, then disable → a screenshot diff against the pre-enable screenshot with `maxDiffPixelRatio: 0.01` (desktop project only) |

- [ ] **Step 2: Run** `npm run test:e2e`. Fix real bugs until it passes.
- [ ] **Step 3: Measure** fps with all systems on and the section enabled while dragging the slider, on Auto and Low quality. Record the results in `docs/phase-3b-performance.md`. Stop for the owner if a v1 §9.1 budget fails.
- [ ] **Step 4: Update docs.** Add cross-sections to the README and the clipping/caps approach to `docs/architecture.md`.
- [ ] **Step 5: Run** `npm run ci && npm run test:e2e`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "test(e2e): cross-sections; docs"`
