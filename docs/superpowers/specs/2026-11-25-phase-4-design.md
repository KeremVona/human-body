# Phase 4: Headroom, Offline & Guided Tours — Design

**Date:** 2026-11-25
**Status:** Draft, written at the owner's request with no Q&A round ("plan and spec it without asking me questions"). Every decision is a **[Call]** unless marked otherwise, and the owner can overturn any of them.
**Parent specs:** `2026-11-21-anatomy-atlas-design.md` ("v1 §") and `2026-11-24-phase-3-design.md` ("P3 §").
**Starting point:** Phases 0–3 are shipped (`main` at `4becef9`). Measured state, from `docs/phase-3d-performance.md`:

| Fact | Value | Budget | Headroom |
|---|---|---|---|
| Meshes = draw calls (all 9 systems, Low) | 1,406 | 1,500 | **94** |
| Fast 4G, skeleton visible | 5,697 ms | 6,000 ms | **0.3 s** |
| Asset bytes | 29,995,648 | 41,943,040 | 12 MB |
| Devices measured | RTX 4060 desktop only | mid-range laptop iGPU and a phone (v1 §9.1) | **not yet verified** |

---

## 1. Why Phase 4 looks like this

The v1 spec defined no Phase 4. Phase 3 used up nearly all the performance headroom, and the atlas has never been measured on the hardware its budgets name. So Phase 4 does two things, in this order:

1. **Restores headroom:** draw calls and load time. Without it, every future feature (more structures, more systems, richer effects) is blocked.
2. **Adds the first feature that's purely about learning:** guided tours. Curious visitors (v1 §1) can then follow a story instead of having to know what to click. Tours reuse everything Phases 2–3 built: share-link view states, cross-sections, motion demos and both languages.

| Sub-project | Plan | What a visitor gets |
|---|---|---|
| **4A Batched rendering** | `plans/2026-11-25-phase-4a-batched-rendering.md` | The same atlas, much smoother on laptops and phones. Draw calls drop from about 1,400 to under 200 |
| **4B Fast first view & offline** | `plans/2026-11-25-phase-4b-first-view-offline.md` | A skeleton silhouette in under 3 s on mobile data; repeat visits load from cache; installable, and works offline |
| **4C Guided tours** | `plans/2026-11-25-phase-4c-guided-tours.md` | Five short narrated tours (in English and Turkish) that move the camera, cut, animate and highlight for you |

**Order:** 4A → 4B → 4C. 4B's measurements assume 4A's renderer. 4C has no technical dependency on 4A or 4B, but runs last so its performance check covers the final renderer.

## 2. Goals, non-goals, anti-goals

**Goals**
- Verify the v1 §9.1 budgets on **real mid-range hardware** for the first time, and keep them verified from now on.
- Reach the draw-call and load-time headroom in §3 without any visible change in how the atlas looks or behaves.
- A visitor with no anatomy knowledge can finish a tour and come away knowing something new.

**Non-goals**
- WebGPU, a new renderer, or new 3D assets beyond the skeletal preview (§4B).
- Accounts or sync. Offline storage stays on the device.
- User-authored tours. A dev-only authoring aid exists, but tours ship as repo content.

**Anti-goals**
- Batching that changes any visible result: colours, opacity, clipping caps, highlights, picking, pins, motion. Phase 1–3 behaviour is the reference.
- A service worker that serves a stale or broken app with no way to update.
- Tours that strand the visitor in a changed view. Exiting always restores the view from before the tour.

## 3. Budgets for Phase 4 [Call]

| Metric | Budget | Notes |
|---|---|---|
| Draw calls, default view (skeleton, no selection) | ≤ 40 | Measured on Low quality (no composer) |
| Draw calls, all systems on, any one dissection mode, one selection | ≤ 200 | |
| Draw calls, worst case (fade others on everything with a large kept set, plus a motion demo) | ≤ 400 | |
| fps on a mid-range laptop iGPU, all systems on | ≥ 60 on Auto | v1 §9.1, measured on a real device |
| fps on a recent mid-range phone, all systems on | ≥ 30 on Auto (resolves to Low) | v1 §9.1, measured on a real device |
| **First view** (skeleton preview drawn), Fast 4G, cold | **< 3,000 ms** | New metric |
| **Interactive skeleton** (full skeletal bundle pickable), Fast 4G, cold | **< 6,500 ms** | Replaces v1's "skeleton visible < 6 s". It's allowed 0.5 s more, because the preview now covers the first view, while the extra preview download delays the full bundle slightly. **[Call — budget change]** |
| Repeat visit, interactive skeleton | < 1,500 ms | Served from the service-worker cache |
| JS heap after all systems load | ≤ 1.5× the Phase 3D value | Batching duplicates geometry on the CPU (§4.4) |

**Real-device measurements:** each sub-project's performance doc records one laptop with an integrated GPU and one phone.
- The owner supplies them, or the agent asks the owner to run the measurement page.
- If no device is available, the doc records Chrome DevTools 4× CPU throttle results, labelled **"emulated, not verified"**, and the gate is reported to the owner as unverified.

---

## 4. 4A — Batched rendering

### 4.1 Approach

Use three.js `BatchedMesh` (r187). Each **batch** holds every mesh that shares an *appearance key*: `(bundle, system, tissue, color)`. That's exactly the MaterialLibrary key without the material state. A batch draws all its visible instances in **one draw call**, using one material from the existing library.

### 4.2 Batch state and promotion

The existing `resolveMeshState` → `applyMeshStates` loop stays the single source of truth. A new **BatchRenderer** layer sits between the resolved states and the GPU.

1. **Batch state.** Each batch is rendered in one of two states: `base` or `ghost`. The batch takes the state of the majority of its *visible* members; a tie means `base`. A batch with no visible members is hidden (`visible = false`).
2. **Promotion.** A mesh is *promoted* (drawn as its own individual `Mesh` from the registry, as today) when it's visible and any of these hold:
   - its material state differs from the batch state (`hovered`, `selected` or `active`, or ghost in a base batch, or the reverse),
   - it's moved by an active motion demo,
   - it has a pin being edited (none today; this rule is reserved).

   A promoted mesh's batch instance is hidden with `setVisibleAt(false)`.
3. **Hidden meshes** have their instance hidden and aren't promoted.
4. **Materials.** A batch's material is `library.get({ ...key, state: batchState })`, so system opacity, quality and clipping caps all apply unchanged. `renderOrder` follows the existing rule (`RENDER_ORDER[system]`, +10 for ghost). `sortObjects` is on when the material is transparent.
5. **Kill switch.** `?batching=off` renders the Phase 3 way (individual meshes only), for debugging and A/B measurement.

### 4.3 Picking, pins, outline, motion, sections

- **Picking:** raycasts hit `BatchedMesh` objects, with a BVH from `computeBatchedBoundsTree` (three-mesh-bvh 0.9). The hit's `batchId` (the instance id) maps to a MeshId through `batch.userData.meshIds`, and per-instance pickability comes from `batch.userData.pickable` (a `Uint8Array`). `pickMeshId` and the section filter work on both hit kinds.
- **Pins:** projection reads the registry mesh's world matrix. Registry meshes keep identity transforms unless motion is moving them, in which case they're promoted. Occlusion raycasts use the same hit-to-MeshId mapping.
- **Outline (High quality):** the selected meshes are always promoted, so the existing Outline selection works as before.
- **Motion:** moving and pulsing meshes are promoted for the length of the demo.
- **Sections:** batch materials come from the library, so `setClipPlane` covers them automatically.

### 4.4 Memory

The registry keeps each individual mesh's geometry (it's needed for promotion), and the batches hold copies, so CPU memory roughly doubles. The JS-heap budget in §3 covers this.
- Individual meshes that have never been promoted aren't in the scene, so their GPU buffers aren't uploaded until first promotion.
- If the heap budget fails, the fallback is to build a promoted mesh's geometry on demand from the batch's buffers. That's a separate follow-up, not built speculatively.

### 4.5 Spike gate

4A starts with a throwaway spike on the skeletal bundle only, measuring:
- draw calls,
- fps,
- memory,
- raycast correctness against three-mesh-bvh's batched BVH.

If the batched BVH or raycasting is broken in this three / three-mesh-bvh combination, the plan stops for the owner rather than writing custom raycasting.

## 5. 4B — Fast first view & offline

### 5.1 Skeletal preview [Call]

- **A new pipeline output:** one merged, heavily simplified mesh of the whole skeleton. It isn't pickable, has no MeshIds and isn't registered, and it's at most **600,000 bytes**. It's recorded in the manifest as an optional `preview: { file, bytes, sha256 }`.
- **Loading:** it's preloaded first (an `index.html` `<link rel="preload">` plus the existing meta-tag pattern) and drawn in the bone material the moment it arrives.
- **Swapping it out:** when the full skeletal bundle becomes ready, the preview fades out over 300 ms (instantly under reduced motion) and is disposed.
- **Before the full bundle is ready:** hover and click do nothing, and a small chip reads `Loading details…`.

### 5.2 Service worker and installability [Call]

- **Tooling:** `vite-plugin-pwa` (Workbox) with `registerType: 'prompt'`.
- **Precache:** the app shell (HTML, JS, CSS), `content/taxonomy.json`, `content/en/index.json`, the manifest and the skeletal preview.
- **Runtime caching:**
  - `models/*.glb`: **cache-first** (the filenames are content-hashed, so they never change).
  - `content/**`: **stale-while-revalidate**.
- **Updates:** when a new version is waiting, a toast reads `A new version is available.` with a `Reload` button. There's no forced reload.
- **Offline download:**
  - Settings gets `Download for offline use (≈ {size} MB)`. It fetches every bundle and every content file for the active language into the cache, with progress shown as `Downloading… {percent}%`.
  - When finished it shows `Available offline`.
  - Quota errors show `Not enough storage on this device.`
- **Installability:** a web app manifest using `APP_NAME`, scoped to the base path (`/human-body/`), with 192 px and 512 px icons and a maskable icon.
- **Development:** the service worker is disabled in dev and in e2e, unless `E2E_SW=1` turns it on for the dedicated offline test.

## 6. 4C — Guided tours

### 6.1 Content model [Call]

The **structure** of a tour is language-neutral, in `content/tours.json`:

```
{ tours: [ {
    id, systems?: SystemId[],
    steps: [ { id, view: ViewStateV1 (JSON object, not encoded), motion?: { id: MotionId; phase?: number; play?: boolean } } ]
} ] }
```

The **text** lives per locale, in `content/<locale>/tours.json`:

```
{ tours: { [tourId]: { title (≤ 60), summary (≤ 160), steps: { [stepId]: { title (≤ 60), body (≤ 400) } } } } }
```

- Text is plain only, with the same no-markup rule as structure content.
- It falls back to English field by field, like the P3 §7.2 content fallback.
- `check:content` validates:
  - every view's MeshIds and SystemIds against the manifest and taxonomy,
  - every motion id against `content/motions.json`,
  - that English text exists for every tour and step,
  - the length and markup rules.

### 6.2 Playing a tour

- **Starting:** captures the current view (`captureViewState({ includePins: false })`) to restore on exit, then applies step 1.
- **Each step:** applies `view` through `applyViewState`, with the **camera animated** (unlike share links) and **undo history kept**: it's a tour, not a fresh link. If the step has `motion`, it then starts that demo, paused at `phase`, or playing when `play: true`.
- **Exploring mid-tour:** the visitor can orbit, click and dissect between steps. `Next` and `Back` re-apply the step's view.
- **Exit or Finish:** stops any motion and restores the captured view (animated).
- **Mutual exclusion:** tours can't start during a quiz, and the quiz can't start during a tour.
- **Linking:** the hash `#tour/<tourId>/<stepNumber>` opens a tour at a step (1-based). An invalid id or step shows `This tour couldn't be found.` The Share popover offers `Link to this step` while a tour is active.

### 6.3 UI

- A top-bar button `Tours` opens a dialog listing each tour's title, summary and `{n} steps`, with a `Start` button.
- While a tour runs, a **tour bar** sits above the toolbar. It shows the step title, the body, `Step {i} of {n}`, `Back`, `Next` (`Finish` on the last step) and `Exit tour`.
- Arrow keys ← → move between steps and `Esc` exits, but only while no text field or dialog has focus. Existing shortcuts keep working.
- **Authoring aid (dev builds only):** `Copy as tour step` in the Share popover copies the current view as tour-step JSON.

### 6.4 Starter tours (en + tr)

| id | Title (en) | Uses |
|---|---|---|
| `arm-bone-to-muscle` | From bone to muscle: the arm | skeletal → muscular, isolate the arm, fade others |
| `how-the-heart-beats` | How the heart beats | cardiovascular, coronal section, heartbeat demo |
| `bending-the-elbow` | Bending the elbow | elbow demo, agonists highlighted |
| `slice-through-the-chest` | A slice through the chest | axial section at the thorax, organs |
| `lymph-nodes` | Your lymph nodes | lymphatic system, regional node groups |

Each tour has 4–7 steps. Tour text follows `content/STYLE.md`, and its facts are checked against the cited sources already in the structure entries.

## 7. Cross-cutting

- **New UI copy** goes into `src/i18n/messages/en.ts` and `tr.ts`, and passes the parity test.
- **Lazy loading:** tours code, the PWA registration UI and the batching module are lazy. The batching module is on the critical path, because it replaces rendering, so it's measured.
- **Test hooks** (dev only): `drawStats(): { batches; promoted; individual }`, `previewState()`, `tour()`.
- **Docs:** README features; `docs/architecture.md` gets the BatchRenderer layer, the caching strategy and the tours flow; the About dialog gets the shortcuts and a note on offline use.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Batched BVH or raycast bugs in this library combination | Spike gate (§4.5); stop rather than hand-roll |
| Transparent batches sort per instance differently from individual meshes | Per-batch `sortObjects`; visual A/B against `?batching=off` |
| Promotion churn when hovering quickly | Promotion is a cheap visibility toggle plus adding a mesh to the scene; no geometry rebuilds |
| The service worker pins an old broken build | Prompt-based updates; `skipWaiting` only on the user's click; a documented manual unregister path in the README |
| Tour text drifts from the 3D content after asset rebuilds | `check:content` validates tour ids in CI |
| No real devices available | The "emulated, not verified" label plus owner notification (§3) |

## 9. Left to the builder

- Icon artwork (derived from the existing favicon or app name), toast styling and tour-bar styling.
- Exact tour step wording and views, within §6.4 and STYLE.md.
- The preview simplification ratio, within its byte budget and as long as it's recognisably a skeleton.
