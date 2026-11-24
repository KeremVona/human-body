# Phase 3: Post-MVP Expansion — Design

**Date:** 2026-11-24
**Status:** Draft, written at the owner's request without a Q&A round. Every decision here is a **[Call]** unless marked **[Owner]** or **[Spec]** (taken from the v1 design). The owner can overturn any of them.
**Parent spec:** `docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md` ("v1 spec"). §-references with a `v1` prefix point there, for example v1 §10.
**Starting point:** Phases 0–2 are shipped. The current code is the source of truth for names (the `src/` tree as of commit `26d8df8`).

---

## 1. Intent

The v1 spec froze four items for Phase 3 (v1 §10):
1. cross-section clipping planes,
2. animations (joint motion, a beating heart),
3. user pins/annotations and shareable URLs,
4. further systems and additional locales.

Phase 3 delivers all four as **four independent sub-projects**, each with its own plan. Each one leaves the live site shippable.

| Sub-project | Plan file | What a visitor gets |
|---|---|---|
| **3A Share & Pins** | `plans/2026-11-24-phase-3a-share-pins.md` | "Share view" link that restores camera, systems, dissection, selection; personal pins with notes |
| **3B Cross-sections** | `plans/2026-11-24-phase-3b-cross-sections.md` | Axial / sagittal / coronal cut through the body with solid-looking cut faces |
| **3C Motion demos** | `plans/2026-11-24-phase-3c-motion.md` | Four illustrative animations: elbow flexion, knee flexion, shoulder abduction, heartbeat |
| **3D Systems & locales** | `plans/2026-11-24-phase-3d-systems-locales.md` | Lymphatic detail, skin (if licensable geometry exists), and the app in a second language |

**Order [Call]:** 3A → 3B → 3C → 3D.
- 3B and 3C extend the share-link format from 3A.
- 3D is last because it adds meshes, and every earlier feature then has to keep working with them.

**Audience and quality bar** are unchanged from v1 §1: curious non-experts, a portfolio-grade repo, and the §9.1 budgets.

## 2. Goals, non-goals, anti-goals

**Goals**
- A copied link reproduces exactly what the sender saw, months later, as long as the parts still exist.
- Cross-sections look like real cuts (solid faces, not hollow shells), and nothing on the removed side can be clicked.
- The animations are honest: they're labelled as illustrative, built from rigid bone motion and highlighting, not fake soft-tissue simulation.
- Everything new is lazy-loaded. The skeleton-visible time on Fast 4G (5.5 s today, budget 6 s) must not get worse.

**Non-goals**
- Accounts, cloud sync, or server storage of pins. Pins stay on the device (v1 non-goal: no backend).
- Skinned or rigged animation, soft-tissue deformation, physiologically accurate cardiac cycles.
- More than one clipping plane at a time.
- Professional translation. Translations are drafted and marked as such.

**Anti-goals**
- Share links that silently show something different from what was shared.
- Personal notes leaking into share links without the person choosing to include them.
- Any Phase 3 feature that pushes initial JS or skeleton-visible time over budget.
- Shipping geometry with unverified or non-commercial provenance. The Plan 1 licensing exclusions stay in force.

## 3. Constraints carried over

- **v1 §8.2 still holds:** meshes are not React components. New per-mesh behaviour goes through the `resolveMeshState` → `applyMeshStates` loop, or through one imperative per-frame component (motion).
- **Budgets (v1 §9.1, §7.4):**
  - ≤ 1,500 draw calls. 1,011 are used today.
  - ≤ 41,943,040 bytes of assets in total. 27,707,108 are used today.
  - Skeleton visible < 6 s on Fast 4G.
  - 60 fps on a mid-range laptop.
- **Storage:** all `localStorage` access goes through try/catch, and the app must work without storage.
- **Exact copy:** UI copy is pinned in plans and tested, as in v1.
- **Licensing:** only Z-Anatomy and BodyParts3D geometry ships (Plan 1 §"Excluded for licensing" in `pipeline/README.md`).

---

## 4. 3A — Shareable views & pins

### 4.1 What a share link contains [Call]

A link has the form `https://keremvona.github.io/human-body/#v1.<payload>`.
- **The fragment** (after `#`) is never sent to the server, so GitHub Pages needs no routing.
- **The payload** is `base64url( deflate-raw( UTF-8 JSON ) )`, compressed with the browser's built-in `CompressionStream`.

The JSON, called `ViewStateV1`:

| Key | Meaning | Rule |
|---|---|---|
| `c` | camera `[px,py,pz,tx,ty,tz]` | metres, rounded to 3 decimals |
| `s` | enabled systems | array of SystemIds |
| `o` | non-default system opacities | `{ [SystemId]: number }`; omitted when every system is at 1 |
| `h`, `i`, `f` | dissection `hidden`, `isolated`, `faded` | MeshId arrays; `i`/`f` omitted when null |
| `sel` | selection | MeshId array |
| `x` | cross-section (added by 3B) | `[axis, t, flip]`, omitted when off |
| `p` | pins (only if the sender ticks "Include my pins") | see §4.3 |

**Reading a link (decode rules):**
- An unknown version prefix shows `This link was made by a newer version of the atlas.` and nothing is applied.
- Unknown MeshIds and SystemIds are dropped, and the app shows `Some parts in this link no longer exist and were skipped.`
- A malformed payload shows `This link couldn't be read.` and nothing is applied.
- The link is applied once, after boot:
  1. enable its systems and wait for their bundles,
  2. set the dissection (as a fresh baseline, with the undo history cleared),
  3. set the selection, the section and the camera.
- The hash stays in the address bar, so reloading re-applies the link. The app never rewrites the URL as you explore, so the browser history isn't spammed with entries.

**Share UI:**
- A top-bar button labelled `Share view` opens a popover containing a read-only link field, `Copy link`, and an `Include my pins` checkbox (off by default).
- Copying shows `Link copied`. If the clipboard API fails, the link field's text is selected for manual copying.
- Links longer than 4,000 characters also show `This link is long and some apps may cut it off.`

### 4.2 Camera pose

`CameraApi` gains `getPose(): Pose` and `setPose(pose: Pose, animate: boolean): Promise<void>`, where `Pose = { position: Vec3; target: Vec3 }`. Zoom limits are reset to the body limits when a pose is set.

### 4.3 Pins [Call]

- **What a pin is:** `{ id, meshId, local: Vec3, label, note, createdAt }`.
  - `local` is the hit point in the mesh's **local** coordinates, so pins follow meshes that move (3C).
  - `label` is 1–80 characters; `note` is 0–500 characters.
- **Where pins are kept:** `localStorage['atlas.pins.v1']`, at most 200 pins. Storage failures leave pins in memory for the session and show `Pins can't be saved on this device.` once.
- **Placing a pin:**
  1. Choose `Add pin` from the context menu on a structure, or use the `P` shortcut while a structure is selected and the pointer is over it.
  2. The pin goes at the surface point under the pointer.
  3. A small editor opens with `Label` (pre-filled with the structure's common name) and `Note`.
- **How pins are drawn:** DOM markers projected to screen positions each rendered frame.
  - A pin is hidden while its mesh isn't visible.
  - It's dimmed to 35% opacity when another visible mesh is in front of it (a raycast, throttled to visible pins, at most 50 per frame).
  - Pins are hidden during the quiz.
- **The Pins tab** in the left panel lists pins by label. Each row has `Go to` (frames the pin), `Edit` and `Delete`. Deleting shows `Pin deleted` with `Undo` for 5 s.
- **Pins in share links:**
  - Pins appear in a link only when `Include my pins` is ticked.
  - Pins from a link are shown **read-only**, labelled `Shared pin`, and aren't saved unless the visitor clicks `Save shared pins`.

## 5. 3B — Cross-sections

### 5.1 Behaviour [Call]

- **One plane at a time.** Planes:
  - `axial`: normal on Y. The default keeps the **inferior** part, so the camera moves to the `superior` preset to look at the cut.
  - `sagittal`: X. The default keeps the patient's **right** part; the camera moves to `left`.
  - `coronal`: Z. The default keeps the **posterior** part; the camera moves to `anterior`.
- **Position:** `t ∈ [0, 1]` across the body bounds on that axis, default 0.5, step 0.005.
- **Flip:** keeps the opposite side instead.
- **UI:** a `Cross-section` popover in the toolbar. It has a switch `Cross-section`, radio buttons `Axial` / `Sagittal` / `Coronal`, a `Section position` slider and a `Flip side` button. The section is included in share links (`x`).
- **Shortcut:** `X` toggles the section.

### 5.2 Rendering [Call]

- **Clipping:** turn on `gl.localClippingEnabled`, and set `clippingPlanes = [plane]` on **every material in the MaterialLibrary**. That's one shared `Plane` object mutated in place, so moving the slider costs nothing per mesh.
- **Caps (solid cut faces):** use the back-face trick instead of stencil buffers, which would add draw calls. Opaque materials become `DoubleSide`, and an `onBeforeCompile` makes back-facing fragments output a flat, unlit cap colour: the tissue colour × 0.55. With a closed mesh cut open, you then see a solid cut face. Ghost (transparent) materials get no cap.
- **Picking:** a hit on the removed side is skipped (`plane.distanceToPoint(hit.point) < 0`), so you can click what's behind the cut.
- **Post-processing:**
  - The selection outline is turned off while a section is active, because the outline pass doesn't respect clipping.
  - AO stays on unless a visual check in the plan shows halos at the cut. In that case AO is also turned off while sectioning.

## 6. 3C — Motion demos

### 6.1 Approach [Call]

There's no rig: the GLB meshes have no armatures (confirmed by the Plan 1 inventory). Motion is built from:
- **Hinge motion:** a set of meshes rotates rigidly about a pivot and an axis.
  - Muscles that **cross** the joint are ghosted, since they can't deform.
  - **Agonist** muscles pulse with an emissive glow while the joint is moving in the direction they produce.
- **Pulse motion (heartbeat):** each heart mesh scales about the heart's centre with a lub-dub curve at 72 bpm, amplitude 4%. The atria are phase-shifted 0.15 of a cycle earlier than the ventricles.

Every demo shows the caption `Illustrative motion — real joints and hearts move in more complex ways.`

### 6.2 Demos (v1 set)

| id | Label | Kind | Moves | Range / rate |
|---|---|---|---|---|
| `elbow-flexion` | Elbow flexion and extension | hinge | left radius, ulna, carpals, metacarpals, hand phalanges + forearm/hand muscles | 0°–145°, 4 s cycle |
| `knee-flexion` | Knee flexion and extension | hinge | left tibia, fibula, patella, foot bones + leg/foot muscles | 0°–135°, 4 s cycle |
| `shoulder-abduction` | Shoulder abduction | hinge | left humerus and everything distal + arm muscles | 0°–90°, 5 s cycle |
| `heartbeat` | Heartbeat | pulse | heart chambers and valves present in the manifest | 72 bpm |

The demos live in **data** (`content/motions.json`), validated by a Zod schema and by `check:content`. Pivots are expressed as a position *inside* a reference mesh's bounding box (normalised 0–1 per axis), so they survive asset rebuilds. The exact mesh lists and pivot anchors are authored by the builder and checked visually.

### 6.3 Interaction [Call]

- **Panel:** a `Motion` tab in the left panel lists the demos. It has `Play` / `Pause`, `Speed` (`0.5×` / `1×`), a `Motion position` scrub slider and `Stop`.
- **Starting a demo:**
  1. enables the required systems (and loads their bundles),
  2. frames the moving meshes from the demo's preset view,
  3. ghosts the crossing muscles (a motion-only override that doesn't touch the dissection or undo history).
- **Stop** restores every moved mesh's original transform and clears the overrides.
- **Reduced motion:** demos start paused, and the scrub slider is the primary control.
- **Quiz:** starting the quiz stops any demo.
- Cross-sections and pins keep working during motion. Pins follow their meshes.

## 7. 3D — More systems and a second language

### 7.1 Systems [Call]

- **Lymphatic detail:** add lymph nodes and the thymus/tonsils from Z-Anatomy's `6: Lymphoid organs` collection, to a new `lymphatic` bundle.
- **Integumentary (skin):** add a skin bundle **only if** the survey finds a full-body skin surface of Z-Anatomy/BodyParts3D provenance. The current inventory has no mesh named "skin"; `9: Regions of human body` (299 meshes) is the candidate to survey.
  - If it qualifies: new tissue `skin`, a soft matte look, and a default opacity of **0.35** when first enabled, so the body underneath stays readable.
- **Budget:** 3D may add at most **450 meshes** (≤ 1,461 draw calls total) and **12,000,000 bytes**. Anything bigger needs the deferred `BatchedMesh` work (v1 §7.3) first, which is out of Phase 3's scope.
- Cranial nerves (Dundee, CC-BY 4.0) stay excluded unless per-object provenance can be shown.

### 7.2 Locales

- **Which language: [Owner — open].** The plan starts by asking the owner which language to add. The infrastructure supports any number of languages.
- **Content:** `content/<locale>/index.json` and `content/<locale>/structures/*.json`, with the same ids and schemas as English.
  - A missing translated entry falls back to English field by field, and the Inspector shows `Not yet translated` for that entry.
  - `check:content` validates every locale and reports translation coverage.
- **UI text:** extracted into `src/i18n/messages/<locale>.ts`, a typed object with English as the source of keys, through a small `t(key, vars)` helper. No i18n library is needed. Existing exact-copy tests keep running against `en`.
- **Choosing the language:**
  - The first visit uses `navigator.language` if a matching locale exists, otherwise `en`.
  - A `Language` setting goes in the Settings menu, persisted as `atlas.locale`.
  - `?lang=<locale>` overrides both. Share links don't carry the language.
  - `<html lang>` is updated to match.
- **Translation quality:** drafted by the implementing agent, with the README and the About dialog stating `Translations are machine-assisted drafts.` in English, plus its translation.

## 8. Cross-cutting

- **Code splitting:** `share`, `pins`, `section`, `motion` and the non-English message catalogues each live in their own lazy chunk. Only the URL-hash check runs at boot, and it doesn't import the codec unless a hash is present.
- **Test hooks** (dev only, `window.__atlas`): add `encodeView(): Promise<string>`, `pinScreenPoints()`, `section()` and `motionPhase()` as each sub-project needs them.
- **Performance:** each sub-project ends with a measurement doc, `docs/phase-3x-performance.md`, using the Phase 2 method. It stops for the owner if a budget fails.
- **Docs:** each sub-project updates the README features list, `docs/architecture.md` and the About dialog's shortcuts table.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Back-face caps look wrong on open (non-watertight) meshes | Visual check in 3B. Caps fall back to a neutral grey for listed meshes, `CAP_EXCLUDE` in code |
| Rigid hinge motion looks broken where bones meet | Ghost the crossing muscles; pivots tuned visually; caption sets expectations |
| Share links break after asset rebuilds | Ids are permanent (v1 §7.5); unknown ids are dropped with a notice |
| Locale work balloons (1,000+ names) | Field-by-field fallback; coverage report; names and featured content first |
| 3D exceeds the draw-call budget | Hard cap of 450 meshes; BatchedMesh is a separate plan |

## 10. Left to the builder

- Exact visuals: the pin marker style, the cap colour factor (within 0.45–0.65), and the motion easing curves.
- Exact mesh lists and pivot anchors for each demo, within §6.2.
- Which lymphatic structures fit the 450-mesh cap.
- The internal shape of slices, thunks and helpers, as long as the plans' Interfaces hold.
