# Interactive 3D Human Anatomy Atlas: Design

**Date:** 2026-11-21
**Status:** Approved by owner, 2026-11-21
**Scope:** Product architecture, UX, core features, phased roadmap. No implementation code.

Notation used throughout:
- **[Owner]** marks a decision the project owner made.
- **[Call]** marks a decision made while writing this document, which the owner can overturn.
- Anything with neither tag is left to the builder.

---

## 1. Intent and the why

A free, open-source, browser-based 3D anatomy atlas in the spirit of Complete Anatomy, Human Anatomy Atlas and BioDigital Human. Visitors can rotate a segmented human body, peel it apart layer by layer, click any structure to learn what it is, and test themselves with a find-and-click quiz.

- **Audience [Owner]:** curious people. These are non-experts exploring out of interest, not medical students cramming for exams. The app should make sense in the first five seconds with no tutorial, and friendly plain-English descriptions matter more than exhaustive clinical data.
- **Why it exists [Owner]:** it's an open-source personal project by a software engineering student, built to grow their portfolio. So it has two audiences:
  1. **Visitors**, who should be impressed within seconds of opening the link.
  2. **Reviewers and interviewers**, who will read the repo. The architecture, tests and README must hold up to a close reading.
- **What success looks like [Call]:**
  - A live public URL on free static hosting.
  - A polished Phase 1 that runs at a smooth frame rate on a mid-range laptop.
  - A repo with a clear README (with a GIF), architecture notes, CI and meaningful tests.
  - A short write-up of the asset pipeline and performance work, which is the most interview-worthy part.

## 2. Goals, non-goals, anti-goals

**Goals**
- The full brief (sections 5–6) delivered in phases, with Phase 1 done properly before Phase 2 starts.
- Anatomy content (names, descriptions, translations) can be edited without touching or re-exporting 3D files.
- First paint is fast. The skeleton is visible and interactive before the heavier systems finish downloading.
- Works on desktop and on modern phones and tablets with touch **[Call]**. Desktop is the primary target, and mobile must be usable without being crippled.

**Non-goals (v1)**
- User accounts, a backend, a database or server-side anything.
- Medical-grade accuracy claims, or clinical or diagnostic use.
- Every structure in the source model. v1 ships a curated subset (section 7.3).
- Cross-sections, animation, annotations and shareable URLs. These are Phase 3.

**Anti-goals: failure even if it technically works**
- A load screen of more than a few seconds before anything appears.
- Choppy rotation. Visitors will forgive missing features but not lag.
- Visual mush, where overlapping structures can't be told apart.
- Licensing violations: model files that aren't properly attributed or share-alike licensed.
- A codebase where the 3D scene, state and content are tangled together, which reviewers would notice.

## 3. Constraints

- **Stack [Owner]:** React with TypeScript (TSX), Tailwind CSS with no PostCSS, and Redux Toolkit. The owner left the 3D and modelling choices to this design.
- **Open source [Owner].** The code is MIT-licensed **[Call]**. The 3D model files and anything derived from them are CC-BY-SA 4.0, a requirement of the source model (section 7.1). The `content/` folder is also CC-BY-SA 4.0 **[Call]**, because its names come from Z-Anatomy and its text may be adapted from CC-BY-SA sources. The licenses are stated separately in the repo: `LICENSE` for the code (MIT), and `LICENSE-ASSETS` for `public/models/` and `content/` (CC-BY-SA 4.0). The README explains the split.
- **Repo [Owner]:** https://github.com/KeremVona/human-body, so the Pages site will be served from `/human-body/`. The Vite `base` path still comes from one config value (an env variable with a `/` default for local dev), so a rename later is a one-line change.
- **Only compatibly licensed geometry ships.** Z-Anatomy bundles some reference models under non-commercial licenses (CC-BY-NC, CC-BY-NC-SA). These are excluded from every bundle; only Z-Anatomy and BodyParts3D geometry is exported.
- **Zero running cost [Call].** Static hosting only. Any per-file size limit of the chosen host constrains how the model files are split.
- **Decoupled data model [Owner, from the brief].** Mesh node names map strictly to external JSON metadata.
- **Progressive loading [Owner, from the brief].** The skeleton and UI shell load first, and the other systems load asynchronously.

## 4. Technology choices

| Concern | Choice | Notes |
|---|---|---|
| Build | **Vite** + React 19 + TypeScript (strict) | [Call] |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` | [Owner] Tailwind with no PostCSS. The v4 Vite plugin needs no PostCSS config. |
| App state | **Redux Toolkit** | [Owner] |
| 3D rendering | **three.js** via **@react-three/fiber** (R3F) | [Call] Declarative scene, React-native mental model, largest ecosystem. |
| 3D helpers | **@react-three/drei** | [Call] `CameraControls` (smooth transitions, `fitToBox`, `setLookAt`), `useGLTF` with Meshopt decoding, `Bvh`, `Lightformer`/`Environment`. |
| Picking performance | **three-mesh-bvh** (via drei `<Bvh>`) | [Call] Raycasting against dense meshes stays fast on every pointer move. |
| Post-processing | **@react-three/postprocessing** (N8AO ambient occlusion, optional outline) | [Call] Phase 2 polish, kept behind a quality setting. |
| Accessible UI primitives | **Radix UI primitives** (slider, dropdown/context menu, dialog, tooltip) styled with Tailwind | [Call] Keyboard and screen-reader behaviour out of the box. |
| Search | **MiniSearch** | [Call] Small library, prefix and fuzzy matching, good for autocomplete over a few thousand names. |
| Long lists | **TanStack Virtual** | [Call] The hierarchy tree can have thousands of rows. |
| Content validation | **Zod** schemas | [Call] The same schema powers TypeScript types and the CI content check. |
| Asset pipeline | **Blender (headless Python)** + **glTF-Transform CLI** | [Call] See section 7. |
| Unit and component tests | **Vitest** + React Testing Library | [Call] |
| End-to-end tests | **Playwright** (Chromium; WebGL works headless via SwiftShader) | [Call] |
| CI/CD | **GitHub Actions** → **GitHub Pages** | [Call] Free, no extra account. Per-file limit is 100 MB, and the realistic budget is far below that (section 7.4). Netlify, Vercel or Cloudflare Pages also work if the owner prefers. |

Exact library versions are left to the builder: use the current stable major of each at project start.

## 5. User experience

### 5.1 Layout

The full-bleed canvas covers 100% of the viewport. All UI floats above it in translucent, softly blurred panels that can be collapsed.

```
┌──────────────────────────────────────────────────────────────────┐
│ [≡ Atlas]  [ 🔍 Search structures…        ]            [ ? ] [⚙] │  top bar (search: Phase 2)
│ ┌─────────────┐                                  ┌─────────────┐ │
│ │ Systems     │                                  │ Inspector   │ │
│ │ ☑ Skeletal ▬│                                  │ Femur       │ │
│ │ ☑ Muscular ▬│        3D CANVAS (full bleed)    │ Os femoris  │ │
│ │ ☐ Cardio  ⟳ │                                  │ Skeletal ·  │ │
│ │ ☐ Organs    │          [hover label]           │ Lower limb  │ │
│ │─────────────│                                  │ [Isolate]   │ │
│ │ Tree (Ph.2) │                                  │ [Hide][Fade]│ │
│ └─────────────┘                                  │ Overview…   │ │
│                                                  └─────────────┘ │
│        [Ant][Post][L][R][Sup][Inf] [⟲ Reset view] [↶ Undo] [Show all] │  bottom toolbar
└──────────────────────────────────────────────────────────────────┘
```

- **Left panel:** system toggles (Phase 1), then opacity sliders and a tab for the hierarchy tree (Phase 2). It can be collapsed to an icon rail.
- **Right drawer: the Inspector.** It slides in when a structure is selected and closes on Esc or deselect. On narrow screens (under 768 px) it becomes a **bottom sheet** with a peek height showing the name and action buttons **[Call]**.
- **Bottom toolbar:** orientation presets, Reset view, Undo, and Show all (reset dissection).
- **Hover label:** a single DOM tooltip that follows the cursor, showing the common name. It is not a 3D label per mesh.
- **Dissection actions** appear in two places **[Call]**:
  1. As a button row at the top of the Inspector, which is always discoverable.
  2. As a context menu on right-click (desktop) or long-press (touch) over a structure.
  A floating menu anchored to the 3D object was rejected because it hides the thing the visitor is looking at.
- **Quiz banner (Phase 2):** shown top-centre while quiz mode is on.

### 5.2 Visual style

- **Background:** a soft slate radial gradient (dark centre-lit, roughly `#2a3038` → `#14171c`). It's set via CSS behind a transparent canvas, so it costs no GPU work and Tailwind can theme it.
- **Lighting [Call]:** studio three-point setup.
  - A warm-neutral key directional light from the upper front-left.
  - A cool, dimmer fill light from the right.
  - A strong rim light from behind, so silhouettes separate from the background.
  - Soft image-based reflections from local `Lightformer`s, so no external HDR file is downloaded.
  - AgX or ACES tone mapping and sRGB output.
- **Materials by tissue type**, not per mesh. They're defined in code, and the GLB files carry no materials (section 7.2).

| Tissue | Look |
|---|---|
| Bone | Matte ivory, high roughness, no clearcoat |
| Cartilage | Pale blue-white, slight sheen |
| Muscle | Deep red, medium roughness. A subtle striation normal map only if UVs exist; otherwise a fresnel sheen (Phase 2 polish). |
| Tendon / ligament | Silvery off-white, slight sheen |
| Artery | Saturated red, glossy |
| Vein | Blue, glossy |
| Nerve | Yellow, satin |
| Organs | Distinct per-organ hues (lungs pink, liver maroon, and so on), glossy clearcoat |

- **Interaction feedback:**
  - Hover: a light emissive tint.
  - Selection: a stronger tint, plus an outline in Phase 2 polish.
  - Faded or ghosted structures: low opacity. In Phase 2, an optional "x-ray" fresnel ghost shader that keeps silhouettes readable and hides transparency-sorting artefacts.

### 5.3 First run

- The UI shell paints at once. The skeleton fades in, facing the camera in the anterior view.
- A small dismissible hint reads "Drag to rotate · Scroll to zoom · Click any part". On touch it reads "Drag · Pinch · Tap". Dismissal is remembered in `localStorage`.
- Other systems download in the background and their toggles show a small spinner until ready. **[Call]** Only the skeleton is visible by default. Other systems never pop in uninvited; they appear when toggled. Toggling a system that hasn't loaded yet shows the spinner, and the system appears when it arrives.

### 5.4 Input map

| Action | Mouse | Touch | Keyboard |
|---|---|---|---|
| Orbit | Left-drag | One-finger drag | — |
| Pan | Right-drag / Shift+drag | Two-finger drag | — |
| Zoom | Wheel (zoom toward cursor) | Pinch | `+` / `-` |
| Hover label | Move | — (none on touch) | — |
| Select | Click | Tap | — |
| Focus on structure | Double-click | Double-tap | `F` (selected) |
| Context menu | Right-click | Long-press | `Shift+F10` |
| Hide / Isolate / Fade others | menu | menu | `H` / `I` / `G` |
| Undo | — | — | `Ctrl/Cmd+Z` |
| Deselect / close drawer | Click empty space | Tap empty space | `Esc` |
| Presets | toolbar | toolbar | `1`–`6`, `0` = reset |

Respect `prefers-reduced-motion`: camera transitions become near-instant cuts.

## 6. Feature behaviour

The features are those in the owner's brief **[Owner]**. This section pins down exact behaviour.

### 6.1 Camera

- `CameraControls` from drei, with damping on.
- **Zoom limits:**
  - `minDistance` is derived from the bounding sphere of the selected structure, or the whole body if nothing is selected, so the camera stops just outside it.
  - `maxDistance` keeps the full body comfortably in frame.
  - The camera near plane is set small, so close-up inspection of small bones doesn't clip.
  - It is accepted that a visitor can still orbit inside a hollow organ; preventing that fully would need collision checks. Not a v1 goal.
- **Focus on selection:** `fitToBox(structureBounds, animate, padding)`, with a transition of about 600 ms. The orbit target moves to the structure's centre, so further orbiting happens around it.
- **Orientation convention [Call]:** the pipeline normalises the model so that:
  - **+Y** is superior,
  - **+Z** is anterior (the body faces +Z),
  - **+X** is the patient's **left**,
  - the origin is at the body's bounding-box centre.
  Presets are views *from* that side: "Left Lateral" looks at the patient's left side, so the camera sits on +X.
- **Presets** animate with `setLookAt` toward the current target. **Reset view** returns to the default anterior full-body framing and clears the focus target.
- **Camera state lives outside Redux** (section 8.4).

### 6.2 Systems and layers

- **Phase 1 toggles [Owner, from the brief]:** Skeletal, Muscular, Cardiovascular, Major Organs.
- **[Call] "Major Organs" is a UI grouping, not a data system.** Every organ carries its real system in the metadata (respiratory, digestive, urinary, nervous for the brain, and so on), so the data never has to be migrated. In Phase 1 the single "Major Organs" toggle controls all of those systems at once. Phase 2 can split it into separate toggles without changing the data.
- **Phase 2 opacity sliders:** each system gets a slider from 0–100%.
  - At 100% the material is opaque.
  - Below 100%, the material becomes transparent, with `depthWrite` off, at that opacity.
  - At 0% the system is effectively hidden but its toggle stays on.
  - The slider and the toggle are independent.
- **Picking through ghosts [Call]:** structures below 50% effective opacity are not clickable, so visitors can click the deep structure behind a ghosted layer. Their hover label also won't show.
- **Render order:** deeper systems render first and outer systems last (skeletal → organs → cardiovascular → muscular → skin), which reduces sorting artefacts with transparency.

### 6.3 Selection and dissection

**State.** The selection is `selectedIds`: empty, one mesh, or both sides of a pair (section 6.4). The dissection state is:

```
hidden:   Set<MeshId>      // explicitly hidden meshes
isolated: Set<MeshId>|null // when non-null, only these (plus nothing else) are shown
faded:    Set<MeshId>|null // when non-null, everything visible EXCEPT these is ghosted
```

**Resolution rules.** For each mesh, every time state changes:

1. **Visible** if its system is on, AND it is not in `hidden`, AND (`isolated` is null OR it is in `isolated`).
2. **Effective opacity**:
   - If `faded` is non-null and the mesh is not in it, use `fadeOpacity` (default 15%).
   - Otherwise use the system's opacity.
3. **Highlight:** selected beats hovered, which beats none.

**Actions** (all apply to the current selection, which is one mesh, or both sides of a pair; see section 6.4):

| Action | Effect | Undoable |
|---|---|---|
| **Hide** | Adds the selected meshes to `hidden` and clears the selection. | yes |
| **Isolate** | Sets `isolated` to the selected meshes and clears `faded`. Then fits the camera to them. | yes |
| **Fade others** | Sets `faded` to the selected meshes and clears `isolated`. | yes |
| **Show all** (toolbar) | Clears `hidden`, `isolated` and `faded`. Does not change system toggles or opacity. | yes |
| **Exit isolate / exit fade** | An "Exit" chip shown while either mode is on. Clears that mode. | yes |
| **Undo** | Restores the previous dissection snapshot. | — |

- **Undo stack [Call]:** a list of dissection snapshots (`{hidden, isolated, faded}` as id arrays), capped at 50. Only dissection actions are undoable. System toggles, opacity and camera are not, because they have their own obvious controls. There is no redo in v1.
- **Reset** in the brief means two separate buttons **[Call]**:
  - **Show all** resets the dissection.
  - **Reset view** resets the camera.
  Keeping them apart avoids losing a careful dissection by accident.
- **Selecting a hidden or not-visible structure** from search, the tree or the quiz reveal:
  1. Turn its system on, loading it if needed.
  2. Remove it from `hidden`.
  3. If isolate mode is on and it isn't in `isolated`, exit isolate mode.
  4. Select it and focus the camera.

### 6.4 Left and right structures

- The source model has separate meshes for paired structures, such as the left femur and the right femur.
- **[Call]** Each mesh has its own `MeshId` (`femur--l`, `femur--r`), and both point to one `StructureId` (`femur`) in the metadata.
- Selection, hide and isolate act on the **mesh**, so a visitor can hide just the left femur.
- The Inspector shows the shared structure content with a "Left" or "Right" badge.
- Search returns one result per structure ("Femur"). Choosing it selects both sides and frames them together. The Inspector then offers "Left / Right / Both" chips.

### 6.5 Inspector

The Inspector reads from the metadata (section 7.5) and shows:

- **Header:** common name, Latin/TA name in italics, side badge, and a system chip in the system's colour.
- **Breadcrumb:** System › Region (› Group).
- **Overview:** 1–3 plain-English sentences. **Function:** one short paragraph.
- **Details card**, only when present, shaped by structure kind:
  - **Muscle:** Origin, Insertion, Innervation, Blood supply, Primary action.
  - **Bone:** Type (long, short, flat…), Articulates with.
  - **Organ / vessel / nerve:** a short key-facts list.
- **Sources:** a link to each content source and its license.
- **Missing content.** When a structure has no written content yet, the Inspector still shows name, system and region, with a neutral "Description coming soon" line. It must never show a blank or broken panel.

### 6.6 Search (Phase 2)

- MiniSearch over common names, Latin names and synonyms, with prefix and light fuzzy matching. The index is built in the browser from `index.json` at startup.
- Results appear as you type, showing name, Latin name and system chip. Arrow keys move, Enter picks, Esc closes.
- Picking a result runs the "selecting a not-visible structure" flow (section 6.3).

### 6.7 Hierarchy tree (Phase 2)

- Shows System › Region › (optional Group) › Structure › (Left, Right) mesh leaves.
- Virtualised, with expand/collapse and a per-row eye icon for hide/show.
- Clicking a row selects it and the camera follows. The tree auto-expands to the current selection.
- The tree is also the **accessible alternative to the canvas**: everything clickable in 3D can be reached by keyboard here.

### 6.8 Quiz mode (Phase 2)

- Turning the quiz on shows a banner reading "Find: **the Sternum**", with a score and a skip button. Hover labels are hidden during the quiz.
- **Question pool [Call]:** structures from visible systems that have written content and are big enough on screen to be fair to click. A size threshold in the metadata or manifest drops tiny structures. The prompt names the side when it matters ("the **left** kidney").
- **Correct click:** green flash, +1, and the next question.
- **Wrong click:** a red flash on what they clicked, with its name ("That's the Clavicle"). After 3 wrong attempts, reveal the answer: fly to it, highlight it, and move on.
- A round is 10 questions, followed by a summary. The best score is stored in `localStorage`. The quiz never changes dissection state permanently; any reveal-related visibility changes are undone at the end of the round.

## 7. Assets and content

### 7.1 Source model [Call]

- **Z-Anatomy**: an open-source, fully separated human atlas in Blender format, built on BodyParts3D. It's licensed **CC-BY-SA 4.0**, which fits an open-source project **[Owner: open source]**.
- **Phase 0 must confirm:**
  - the exact license text and the required attribution wording,
  - the object naming scheme,
  - which collections map to which systems,
  - whether the meshes have usable UVs.
- Attribution appears in three places: an "About / Credits" dialog in the app, the README, and `LICENSE-ASSETS`.
- The raw `.blend` file is **not** committed. It's large, and processed outputs are what ship. The README documents where to download it and its version or checksum.

### 7.2 Pipeline

`pipeline/` is reproducible from one command (such as `npm run assets`). It is run by the developer, not by CI on every push, because Blender in CI is slow. CI only validates the committed outputs.

1. **Blender headless export** (`blender -b source.blend -P pipeline/export.py -- --config pipeline/config.json`):
   - Select objects by **allowlist** from `config.json`. This is the curation lever (section 7.3). **[Call]** The allowlist is organised as bundle › system › region › entries. Each entry names the Z-Anatomy object(s), and can set a `tissue` and an optional `color` when the group default doesn't fit. So the allowlist already says where every structure belongs, and the pipeline never has to guess it.
   - Apply transforms and normalise orientation and origin to the convention in section 6.1.
   - Rename every exported node to its stable **MeshId** (section 7.5), using a mapping table from Z-Anatomy object names to MeshIds. The table is generated on the first run, then hand-corrected and committed as `pipeline/name-map.json`.
   - Optionally decimate dense meshes to a per-system triangle budget.
   - Strip materials, textures, cameras and lights. Appearance is decided in code (section 5.2).
   - Export one GLB per **bundle** (section 7.4).
2. **glTF-Transform optimisation** for each bundle: `dedup` → `weld` → `simplify` (with a conservative error) → `quantize` → **Meshopt** compression.
   - [Call] Meshopt rather than Draco, because it decodes faster and has a smaller decoder.
3. **Emit `public/models/manifest.json`:**
   - the bundles, their files, byte sizes and content hashes (for cache-busting),
   - the meshes in each bundle,
   - per-mesh precomputed bounding boxes and on-screen size class, used for camera framing and quiz fairness.
4. **Emit or refresh the content scaffold:** for every new structure, add a stub entry to the content files (section 7.5). The stub has the id, the common name and the Latin name from the source, plus the `system`, `region`, `tissue` and `paired` values taken from the allowlist. Stubs therefore pass the CI content check from day one. Existing hand-written content is never overwritten. After the first run, `tissue` and `color` are edited in `content/`, not in the allowlist, so appearance can change without re-exporting.

### 7.3 v1 curation [Call]

Z-Anatomy has far more detail than v1 needs: every small nerve branch, ligament and vessel. Thousands of separate meshes means thousands of draw calls, which hurts frame rate, especially on phones. v1 ships a curated subset with a target of about **1,000–1,500 meshes total**:

| Bundle | Contents (indicative) |
|---|---|
| Skeletal | All bones (~200 meshes, including paired) plus major cartilages |
| Muscular | Major named superficial and intermediate muscles (several hundred meshes) |
| Cardiovascular | Heart, aorta and major branches, venae cavae, major limb vessels |
| Organs | Brain, lungs, trachea, liver, gallbladder, stomach, intestines, pancreas, spleen, kidneys, bladder |

If profiling still shows too many draw calls, the next step is three.js **`BatchedMesh`** per bundle and material, which keeps per-object visibility and picking. It's planned as a measured optimisation, not built upfront.

### 7.4 Bundles vs systems

- A **bundle** is a unit of *download*. A **system** is a unit of *meaning*. They are deliberately separate: the manifest maps meshes to bundles, and the content maps structures to systems.
- In v1 the four bundles line up with the four Phase 1 toggles. Later, a system can be split or merged across files without touching UI or content.
- **Size budget [Call]:**
  - Skeletal bundle at most about 5 MB compressed, since it gates first view.
  - Every bundle at most about 15 MB.
  - Total v1 assets at most about 40 MB.
  This keeps processed models comfortably committable to git without LFS.

### 7.5 Content data model

**Ids [Call]:**
- `StructureId`: lowercase kebab-case, ASCII, stable forever (`femur`, `biceps-brachii`, `left-ventricle`).
- `MeshId`: `StructureId` plus an optional side suffix `--l` or `--r` (`femur--l`). Unpaired structures use the bare id (`sternum`). The GLB node name **is** the MeshId.

**Files [Call]:**

```
content/
  taxonomy.json                 // systems (id, colour, order), regions, groups
  en/
    index.json                  // small: every structure's id, names, synonyms, system, region, tissue, color? — loaded at startup (search, tree, hover labels, materials)
    structures/<system>.json    // full entries for that system — loaded with/after the matching bundle
  <locale>/…                    // future translations: same shape, same ids
```

**Structure entry, conceptually:**

```
id:          "biceps-brachii"
system:      "muscular"
region:      "upper-limb"
group?:      "arm-anterior-compartment"
paired:      true                      // has --l / --r meshes
kind:        "muscle" | "bone" | "organ" | "vessel" | "nerve" | "other"   // decides the Inspector's details layout
tissue:      "bone" | "cartilage" | "muscle" | "tendon" | "ligament" | "artery" | "vein" | "nerve" | "organ" | "other"   // decides the material
color?:      hex string                // optional per-structure hue (used for organs); overrides the tissue's default colour
names:       { common, latin?, synonyms[] }
overview?:   string                    // plain English, 1–3 sentences
function?:   string
details?:    kind-specific (muscle: origin, insertion, innervation, bloodSupply, action)
featured:    boolean                   // eligible for quiz; has written content
sources[]:   { title, url, license }
```

- Zod schemas in `src/data/schema.ts` define this shape. TypeScript types are inferred from them.
- **CI content check** (`npm run check:content`), which fails the build on:
  - schema violations,
  - duplicate ids,
  - a MeshId in the manifest with no structure entry,
  - a structure entry with no mesh (a warning, not a failure),
  - a structure entry missing a system or region.
- **Writing content [Call].** Writing good descriptions for over 1,000 structures is a content project, not an engineering one. So:
  - v1 ships full written content (overview, function, muscle details) for a curated set of about **100–150 featured structures**.
  - Every other structure shows name, Latin name, system and region (section 6.5).
  - Content may be adapted from license-compatible sources, with attribution in `sources[]`: Wikipedia (CC-BY-SA 4.0) and OpenStax *Anatomy and Physiology 2e* (CC-BY 4.0) **[Call]**. It must be rewritten in plain language, not pasted. Other references may be cited for facts only.
- **Who writes it [Owner]:** Claude drafts the featured entries as part of the build. **[Call]** Every factual field (origin, insertion, innervation, blood supply, action, articulations) is checked against at least one source listed in that entry's `sources[]` while drafting. The owner may spot-check entries but is not a required gate. The Credits dialog and README say the content is educational, not medical advice.

## 8. Application architecture

### 8.1 Layers

```
┌─────────────────────────── React DOM (Tailwind + Radix) ───────────────────────────┐
│  TopBar · SystemsPanel · Inspector · Toolbar · HoverLabel · ContextMenu · Quiz     │
└───────────────▲───────────────────────────────────────────────▲────────────────────┘
                │ useSelector / dispatch                         │ CameraApi (context)
┌───────────────┴───────────── Redux Toolkit store ─────────────┴────────────────────┐
│  assets · systems · dissection(+history) · selection · content · ui · quiz         │
└───────────────▲────────────────────────────────────────────────────────────────────┘
                │ store.subscribe (imperative)                ▲ dispatch on pointer events
┌───────────────┴────────────── R3F Scene ────────────────────┴──────────────────────┐
│  <Canvas> · Lights · CameraRig · <Bvh> · BundleModel×N · SceneStateApplier          │
│                 MeshRegistry (Map<MeshId, Mesh>) · MaterialLibrary                  │
└───────────────▲────────────────────────────────────────────────────────────────────┘
                │ fetch
┌───────────────┴──────────── Static files ───────────────────────────────────────────┐
│  models/manifest.json · models/*.glb · content/taxonomy.json · content/en/*.json    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 The key performance rule

**Individual meshes are not React components, and they do not subscribe to the store.**

With over 1,000 meshes, per-mesh components that each subscribe to Redux would cause heavy re-render storms. Instead:

1. `BundleModel` loads a GLB with `useGLTF`, walks the scene once, and registers every mesh in a **`MeshRegistry`** (a module-level `Map<MeshId, Mesh>` exposed through context). It also assigns the starting material from the `MaterialLibrary`, using `system`, `tissue` and `color` from `index.json`. `index.json` is always loaded before any bundle (section 8.6). A mesh with no index entry gets a neutral fallback material and a console warning.
2. **`SceneStateApplier`** is a non-visual component.
   - It subscribes to the relevant slices with memoised selectors.
   - When they change, it computes the **diff** of resolved per-mesh state using the rules in section 6.3.
   - It then imperatively sets `mesh.visible`, swaps `mesh.material` to the right variant, and sets `renderOrder`.
   - It requests a frame. The Canvas uses `frameloop="demand"`, which saves battery when idle.
3. **`MaterialLibrary`** holds one material per (system × tissue-or-colour × state), where state is `base | hovered | selected | ghost`. Structures with their own `color` (mostly organs, a few dozen) get their own key; everything else shares its tissue's materials. Changing a system's opacity mutates that system's shared materials, not thousands of meshes. Materials are created lazily on first use and then reused.

React re-renders the scene graph only when a bundle loads. Every other change is a cheap imperative update.

### 8.3 Redux slices

| Slice | Holds | Notes |
|---|---|---|
| `assets` | manifest, per-bundle status (`idle/loading/ready/error`), progress | Thunks start loads. The skeletal bundle starts immediately; the others start after the first frame renders. |
| `content` | `index` (always), per-system `structures` (lazy), load status | Plain thunks fetch static JSON. RTK Query is overkill for static files. |
| `systems` | per system `{ enabled, opacity }`, plus the UI grouping definition ("Major Organs") | |
| `dissection` | `{ hidden, isolated, faded, fadeOpacity }` + `past[]` (≤50 snapshots) | Sets are stored as sorted id arrays, so the state stays serialisable. A small reducer helper pushes history for undoable actions. |
| `selection` | `selectedIds` (one mesh, or both sides of a pair), `hoveredId` | `hoveredId` changes only when the hovered mesh *changes*, not on every pointer move, so dispatch frequency stays low. |
| `ui` | panel open states, hint dismissed, quality setting | |
| `quiz` (Phase 2) | `active, round, currentTarget, attempts, score, history` | |

### 8.4 Camera

Camera pose is high-frequency and imperative, so it stays out of Redux.

- `CameraRig` owns the `CameraControls` instance and provides a **`CameraApi`** through React context: `focusMeshes(ids)`, `goToPreset(name)`, `resetView()`.
- UI components call `CameraApi` directly. Flows that span slices, such as the search-pick flow, are written as small orchestration functions: dispatch the state changes, wait for the bundle to be ready, then call `CameraApi`.
- Phase 3 shareable URLs will read and write the pose through the same API.

### 8.5 Picking

- R3F pointer events on bundle groups, sped up by `<Bvh>`. The handler reads the first intersected mesh that is visible and pickable (effective opacity at least 50%), and maps `object.name` → MeshId.
- `onPointerMove` dispatches a hover change only when the id differs.
- A **click** is told apart from a drag by a small pointer-travel threshold (a few pixels), so ending a rotation doesn't select something. The same threshold applies to the right button: right-press-and-release without moving opens the context menu, while right-drag pans and opens nothing.
- Double-click focuses. On touch: tap selects, double-tap focuses, long-press opens the context menu.

### 8.6 Progressive loading sequence

1. HTML shell, CSS and JS load (target: well under 400 KB gzipped of JS, including three.js). The panels render.
2. Fetch `manifest.json`, `taxonomy.json` and `en/index.json` in parallel. These are small.
3. Start the skeletal bundle. The canvas shows a subtle loading shimmer, then the skeleton fades in.
4. After the first rendered frame, fetch the remaining bundles one at a time, most likely next first: muscular, then organs, then cardiovascular. Each system's toggle shows its status.
5. Fetch each system's `structures/<system>.json` when its bundle is ready, or right away if a visitor selects a structure from it.
6. Each bundle sits in its own `<Suspense>` boundary, so one slow or failed bundle never blocks the others. On failure, the toggle shows a retry control.

HTTP caching is handled by content-hashed filenames from the manifest. A service worker for offline use is out of scope.

### 8.7 Repository layout

```
/content                 anatomy content (JSON, per locale)
/pipeline                Blender export script, config/allowlists, name-map, glTF-Transform steps, README
/public/models           generated GLBs + manifest.json (committed outputs)
/src
  app/                   store setup, typed hooks, root providers
  data/                  zod schemas, loaders, MiniSearch index
  scene/                 Canvas, CameraRig, Lights, BundleModel, MeshRegistry, MaterialLibrary, SceneStateApplier, picking
  features/
    systems/  dissection/  selection/  inspector/  search/  tree/  quiz/
                         each: slice + selectors + components + tests
  ui/                    shared presentational components (Panel, IconButton, Chip…)
/e2e                     Playwright specs
/docs                    this design, architecture notes, pipeline write-up
```

## 9. Quality bar

### 9.1 Performance budgets [Call]

| Metric | Target |
|---|---|
| UI shell interactive | < 1.5 s on a fast connection |
| Skeleton visible | < 3 s on a fast connection, < 6 s on a typical 4G phone |
| Frame rate, all v1 systems on | 60 fps on a mid-range laptop's integrated GPU; ≥ 30 fps on a recent mid-range phone |
| Hover response | No visible lag; picking under 2 ms on desktop |
| Draw calls, everything visible | Measured and recorded. If over about 1,500, apply the `BatchedMesh` step (section 7.3). |

Add a hidden developer stats overlay (`?debug`) showing fps, draw calls and triangle count, to back these numbers in the write-up.

### 9.2 Testing [Call]

- **Unit (Vitest):**
  - the dissection reducer, including the undo stack and every row of section 6.3's action table,
  - the visibility and opacity resolution function, which is pure and tested exhaustively,
  - selectors,
  - the search ranking,
  - quiz scoring.
- **Component (RTL):** the Inspector with full, partial and missing content; the Systems panel's toggle and loading states; search keyboard navigation.
- **Content contract:** `check:content` runs in CI (section 7.5).
- **End-to-end (Playwright, Chromium):**
  - App loads, the skeleton bundle is ready, and the WebGL canvas renders.
  - Selecting a structure opens the Inspector with the right name.
  - Hide → Undo restores it.
  - Isolate → Show all.
  - Search pick reveals a hidden system.
  - A dev-only `window.__atlas` test hook (stripped from production builds) exposes "select MeshId", so e2e tests don't depend on clicking exact pixels.
- Visual regression screenshots are optional and deferred, because WebGL output differs slightly between machines.

### 9.3 Accessibility

- Every action is reachable from the keyboard, through the tree (Phase 2) and the shortcuts (section 5.4). Visible focus rings.
- **Accepted Phase 1 gap [Call]:** Phase 1 has no tree or search, so a keyboard-only visitor can't *select* a structure until Phase 2. Everything else in Phase 1 (panels, toggles, presets, Inspector, dissection on a selection) must still be fully keyboard-operable. The README says so until Phase 2 closes the gap.
- Radix primitives for menus, sliders and dialogs.
- Panels have ARIA landmarks. The canvas has a text description and announces the selected structure through a live region.
- Colour is never the only signal. System chips also carry text labels.

### 9.4 CI

GitHub Actions on every push and pull request: typecheck → lint → unit/component tests → content check → build → Playwright smoke tests. On `main`, deploy to GitHub Pages.

## 10. Roadmap

Each phase has a definition of done. A phase isn't started until the previous one meets it.

### Phase 0: Asset spike (de-risk first) [Call]

Prove the riskiest assumption before building UI: that Z-Anatomy can be turned into small, well-named, correctly oriented GLB bundles.

- Download Z-Anatomy, confirm the license and attribution text, and list its collections and naming.
- Write the export script for **one bundle (skeletal)**, generate the first `name-map.json`, and run glTF-Transform.
- Load it in a bare R3F page with orbit controls. Measure file size, triangle count, draw calls and fps.
- **Done when:** the skeletal bundle is within budget and correctly oriented, every node has a MeshId, and the numbers are recorded in `docs/`. If budgets are clearly unreachable, revisit section 7.3 before going on.

### Phase 1: Core viewer and dissection MVP

- Project scaffold: Vite, TS strict, Tailwind v4 plugin, Redux store, ESLint/Prettier, Vitest, Playwright, CI, Pages deploy.
- Pipeline for all four bundles, plus the manifest and content scaffold.
- Scene: lights, background, materials by tissue type, `BundleModel`, `MeshRegistry`, `SceneStateApplier`, progressive loading.
- Camera: orbit, pan and zoom with limits; double-click focus; six presets; Reset view.
- Picking: hover tint and label, click select, click-vs-drag threshold, touch equivalents.
- Dissection: Hide, Isolate, Fade others, Show all, Undo, plus the context menu and shortcuts.
- Systems panel: four toggles (Skeletal, Muscular, Cardiovascular, Major Organs) with loading states.
- Inspector: name, Latin name, system, region, overview, function, muscle details where present. Mobile bottom sheet.
- Content: schema, CI check, and about 100–150 featured structures written.
- About/Credits dialog with attribution. README with GIF and architecture summary.
- **Done when:**
  - every feature above works on desktop Chrome and Firefox, and on one real phone the owner has. **[Call]** Safari and iOS are checked on a real device if one is available, otherwise through a free open-source tier of a device cloud (such as BrowserStack). If neither is possible, the gap is noted in the README rather than blocking the release,
  - the performance budgets (section 9.1) are met or deviations are documented,
  - CI is green, and the live URL is public.

### Phase 2: Layering, search and study tools

- Per-system opacity sliders, and picking through ghosts.
- Split "Major Organs" into its real systems (Respiratory, Digestive, Urinary, Nervous/brain) if the content supports it.
- Autocomplete search with the reveal-and-fly flow.
- Virtualised hierarchy tree with per-row show/hide.
- Find & Click quiz mode.
- Visual polish: ambient occlusion, selection outline, x-ray ghost shader, muscle sheen. All behind a quality toggle that defaults to "auto" based on device.
- **Done when:** these features are covered by unit and e2e tests, and the budgets still hold with polish set to "auto".

### Phase 3: Post-MVP expansion (out of scope for v1) [Owner, from the brief]

- Cross-section clipping planes (axial, sagittal, coronal), using three.js clipping planes with cap rendering.
- Animations: joint flexion and extension, a beating heart. Needs rigged or morph-target assets, which is a separate pipeline effort.
- User pins and annotations (`localStorage`), and shareable URLs encoding camera pose, dissection state and selection. Should be compact, for example base64 of sorted id lists.
- Further systems: lymphatic, integumentary (skin), detailed nervous system. Additional locales.

The architecture already accounts for Phase 3: the `CameraApi` serialises the pose, dissection state is already serialisable, the content is already split by locale, and bundles can be added through the manifest.

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Z-Anatomy export is messier than expected (names, orientation, broken meshes) | High | Phase 0 spike, a hand-corrected `name-map.json`, and curation by allowlist |
| Too many draw calls, or file sizes too large, for phones | Medium | Curation budget (section 7.3), Meshopt, `frameloop="demand"`, and `BatchedMesh` as the planned fallback |
| Transparency sorting artefacts with ghosted layers | Medium | Render order by depth of system, `depthWrite` off for ghosts, x-ray shader in Phase 2 |
| Writing content takes far longer than the code | High | Curated featured set, a graceful fallback for structures without content, contributions welcomed through the JSON format |
| License non-compliance | Low (if followed) | `LICENSE-ASSETS`, Credits dialog, and sources per structure |
| Scope creep before Phase 1 is polished | Medium | Definitions of done; Phase 3 is explicitly frozen |

## 12. Left to the builder

- Exact colour values, typography, iconography and panel styling, within section 5.2's direction.
- Exact library versions, ESLint rule set, and file naming conventions.
- Camera transition timings and easing, zoom padding factors, and fade opacity tuning (default 15%).
- Exact allowlist contents per bundle, within section 7.3's size and count budgets.
- Which ~100–150 structures are featured.
- Internal shape of thunks, orchestration helpers and selectors, as long as section 8.2's rule holds.
