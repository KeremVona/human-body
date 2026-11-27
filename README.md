# Anatomy Atlas

Open-source, browser-based 3D human anatomy atlas — explore `1,406` meshes across `805` anatomical structures with instant dissection, bilingual English/Turkish UI & content, and zero account wall.

![Anatomy Atlas demo](docs/img/demo.gif)

Live demo: **[keremvona.github.io/human-body](https://keremvona.github.io/human-body/)**

## Features

- **Nine toggleable body systems across six 3D bundles:** Skeletal (`263` meshes), Muscular (`459` meshes), Cardiovascular (`216` meshes), Organ systems (`73` meshes across Nervous, Respiratory, Digestive, Urinary, and shared lymphoid organs), Lymphatic (`153` meshes), and Integumentary skin (`242` meshes, starting at a translucent `35%` default opacity so underlying structures remain clickable), each with an independent `0–100%` opacity slider.
- **English & Turkish localization (`en` / `tr`):** Boot language is chosen from `?lang=tr`, saved `Settings → Language` preference (`localStorage`), or browser `navigator.languages`. Non-English catalogues and content fetch lazily with field-level English fallback and bilingual search (searching in Turkish or English finds matching structures). _Translations are machine-assisted drafts._
- **125 featured structures:** Plain-English overviews, functions, muscle attachments (`origin`, `insertion`, `innervation`, `blood supply`, `action`), bone articulations, key organ/vessel facts, and source links cited directly to OpenStax _Anatomy and Physiology 2e_ (`CC-BY 4.0`) and Wikipedia (`CC-BY-SA 4.0`).
- **Autocomplete search & virtualised tree browser:** Press `/` to search common names, Latin TA terms, and lay synonyms with automatic system loading and camera focus, or switch the left explorer to the `Browse` hierarchy tree with full keyboard navigation and per-row visibility toggles.
- **Real-time dissection tools & cross-sections:** Focus (`F`), Isolate (`I`), Hide (`H`), Fade others (`G`), Left/Right paired switching, context menu (right-click, `Shift+F10`, or long-press), up to `50` steps of Undo (`Ctrl/Cmd+Z`), and live Axial/Sagittal/Coronal clipping planes (`X` or `Cross-section` in the toolbar) with tissue-tinted cut caps, slice position slider, and side flip.
- **Guided anatomy tours:** Open **Tours** in the top bar for five curated step-by-step walkthroughs (*From bone to muscle: the arm*, *How the heart beats*, *Bending the elbow*, *Slice through the chest*, and *Lymph nodes & immunity*) that orchestrate camera poses, system opacities, cross-sections, and motion demos, support `ArrowLeft`/`ArrowRight` step navigation and shareable `#tour/<id>/<n>` links, pause quizzes cleanly while active, and restore your prior view on exit.
- **Follow a bite of food:** An animated, narrated journey through the digestive system (English and Turkish), reachable from **Tours**, the **Inspector**, or `#journey/digestion`, with stage organs lighting up, secreting glands pulsing with duct droplets, live nutrient bars, peristaltic squeeze rings, smooth camera follow, speed controls, reduced-motion support, and view restoration on exit.
- **Find & Click study quiz:** 10-question timed-feedback quiz over featured structures in enabled systems, pausing dissection tools during active play, saving your best score in `localStorage`, and restoring pre-quiz state when closed.
- **Shareable view links:** Copy a compressed `#v1.` URL capturing camera pose, enabled body systems, opacities, dissection state, selection, cross-section, and optional pins — loading a link skips deleted IDs with a gentle notice (and active tour steps offer **Link to this step**).
- **Personal 3D pins:** Right-click (or long-press on touch) any part and select **Add pin** (`P`) to anchor labeled notes onto the mesh surface with occlusion dimming, mesh-visibility tracking, Undo on delete, and `localStorage` persistence (`atlas.pins.v1`).
- **Motion demos:** Illustrative playback in the `Motion` tab (`Elbow flexion and extension`, `Knee flexion and extension`, `Shoulder abduction`, and `Heartbeat`) featuring play/pause, `0.5×`/`1×` speeds, a scrubbable timeline, semi-transparent cross-joint muscles, agonist highlights, live 3D pin tracking, and cross-section compatibility. Note: these demos are simplified illustrative animations, not clinical biomechanical simulations.
- **Configurable graphics quality & visual effects:** Top-bar `Settings` menu (`Auto`, `High`, `Low`) controlling N8AO contact shadows, `#6FA8FF` selection outlines, Fresnel-rimmed x-ray ghosts, and muscle sheen.
- **Fast first view & offline PWA support:** Loads a simplified `490 KB` `skeletal-preview` GLB before streaming the interactive skeleton, installs cleanly with icons and prompt-based updates (`Reload` toast), and includes an opt-in full offline download in `Settings`.
- **Camera presets & responsive UI:** Anterior/Posterior/Left/Right/Superior/Inferior presets (`1–6`), zoom (`+`/`-`), reset view (`0`), desktop side Inspector (`>= 768px`), and touch-friendly bottom sheet on mobile viewports.

## Tech Stack

- **UI & State:** React 19, TypeScript, Redux Toolkit, Radix UI (`Dialog`, `Switch`, `Slider`, `Tabs`, `Popover`, `RadioGroup`, `DropdownMenu`), MiniSearch, `@tanstack/react-virtual`, Tailwind CSS v4.
- **3D Engine:** Three.js, React Three Fiber (`frameloop="demand"`), `@react-three/postprocessing` (`N8AO`, `Outline`), `camera-controls`, `three-mesh-bvh`, Meshopt decoding.
- **Asset Pipeline:** Headless Blender 5.3 + `@gltf-transform` / `meshoptimizer` + Zod schema validation.
- **Testing & CI:** Vitest (`node` + `jsdom` projects), Playwright (Desktop Chrome + mobile `Pixel 7` + base-path preview checks), ESLint, Prettier.

## Architecture

Individual meshes are never mounted as React components subscribing to Redux. Instead, `BundleModel` registers every decoded `THREE.Mesh` into `MeshRegistry` (`Map<MeshId, Mesh>`) and builds appearance-keyed `BatchedMesh` groups (`src/scene/batching/`), while `SceneStateApplier` subscribes imperatively to the store, computes only changed states (`selectResolvedMeshStates` → `applyMeshStates`), plans per-batch states and per-mesh promotions (`planBatches` → `applyBatchPlan`), swaps shared materials from `MaterialLibrary`, and calls `invalidate()` on demand.

Read [docs/architecture.md](docs/architecture.md) for the full layer diagram, slice responsibilities, `BatchRenderer` layer, bundle loading order, and testing strategy, and [docs/pipeline-writeup.md](docs/pipeline-writeup.md) for how a `304.8 MB` `.blend` archive was distilled to `29.99 MB` across six compressed GLB bundles.

## Running Locally

Requires **Node.js 24+**.

```sh
npm install
npm run dev
```

Append `?debug` to the URL to display live FPS, draw-call, triangle, mesh, batch, promoted, and individual counts (append `?batching=off` to bypass `BatchedMesh` rendering and use the Phase 3 unbatched draw path).

Verification commands:

```sh
npm run ci            # typecheck, lint, Vitest suites, check:content, assets:verify, production build
npm run test:e2e      # Playwright Desktop Chrome + Pixel 7 e2e suites against Vite dev server
npm run test:e2e:sw   # Service Worker update toast & offline E2E checks against built preview
npm run test:e2e:base # Sub-path production build (ATLAS_BASE_PATH=/atlas-check/) + Vite preview smoke test
npm run icons         # Regenerate PNG app & maskable icons in public/icons/
```

## Rebuilding 3D Assets

All six compressed bundles (`public/models/*.glb`) and `public/models/manifest.json` are committed in the repository. To regenerate them from upstream source:

1. Install **Blender 5.3** (tested on `5.3.0`) and add its path to `.env.local` (ignored by git):
   ```ini
   BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 5.3\blender.exe
   ```
2. Download `Z-Anatomy.blend` (version `2023-05-02`) to `pipeline/source/Z-Anatomy.blend` (ignored by git).
3. Run the pipeline steps:
   ```sh
   npm run assets:inventory  # survey .blend objects into pipeline/out/inventory.json
   npm run assets:namemap    # reconcile pipeline/name-map.json against selected rules
   npm run assets:build      # headless Blender export + Meshopt optimize + update manifest & index
   npm run assets:verify     # verify budgets, bounds, orientation probes, and mesh/index parity
   ```

See [pipeline/README.md](pipeline/README.md) for licensing exclusions and object selection rules.

## Contributing Content

Educational copy lives in `content/en/` (`index.json`, `structures/<system>.json`, and `tours.json`) with localized overlays in `content/<locale>/` (currently `tr/` for Turkish, including `5/5` translated tours).

- Follow [content/STYLE.md](content/STYLE.md): write plain, accessible prose, avoid HTML or Markdown formatting inside JSON text fields, and adapt only from `CC-BY 4.0` (OpenStax) or `CC-BY-SA 4.0` (Wikipedia) with exact `sources[]` citations. Note: non-English translations are machine-assisted drafts.
- Validate changes before committing:
  ```sh
  npm run check:content
  npm run content:report
  ```

## Known Gaps

- **Safari, Firefox, and physical phone:** Desktop Chrome, Microsoft Edge, and Playwright `Pixel 7` mobile emulation are verified green; macOS Safari, iOS Safari, Desktop Firefox, and real-device Android Chrome are marked `not tested` in [docs/launch-checklist.md](docs/launch-checklist.md).

## Licensing

- **Code** (`src/`, `pipeline/`, `scripts/`, tests, config): [MIT License](LICENSE).
- **3D Models & Content** (`public/models/`, `content/`): [CC-BY-SA 4.0](LICENSE-ASSETS). Non-commercial (`CC-BY-NC` / `CC-BY-NC-SA`) and unverified-license third-party models present in the upstream `.blend` archive are excluded by pipeline rules.

## Credits

- **3D Models:** [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) (`CC-BY-SA 4.0`), built on BodyParts3D (© The Database Center for Life Science, `CC-BY-SA 2.1 Japan` / `CC-BY 4.0`).
- **Content:** Adapted from [OpenStax _Anatomy and Physiology 2e_](https://openstax.org/books/anatomy-and-physiology-2e/pages/1-introduction) (`CC-BY 4.0`) and [Wikipedia](https://en.wikipedia.org) (`CC-BY-SA 4.0`).

## Disclaimer

This atlas is for learning and curiosity. It is not medical advice.
