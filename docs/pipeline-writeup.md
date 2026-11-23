# Building a Web-Scale 3D Anatomy Asset Pipeline from Z-Anatomy

## The Problem: Desktop Blender Archive vs. Mobile Browser Budget

Open-source anatomical datasets are usually built for offline desktop 3D software rather than mobile browsers. Our upstream source, [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) (built on BodyParts3D), arrives as a `304.8 MB` Blender file (`Z-Anatomy.blend`, 2023-05-02 release) containing `7,184` objects: `4,569` meshes, `1,660` 3D font labels, `951` curve objects, lights, cameras, and helper geometry. Shipping that raw scene to the web would take minutes over cellular connections and crash integrated GPUs.

Our target design budgets (`docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md`) set two hard limits before any application code shipped:

- **Initial launch bundle (`skeletal`):** `<= 5 MiB` so a visitor on simulated Fast 4G sees an interactive 3D skeleton in under `6 seconds`.
- **Full Phase 1 atlas (`skeletal`, `muscular`, `cardiovascular`, `organs`):** `<= 40 MiB` compressed GLB assets, `<= 15 MiB` per bundle, and `<= 1,500` draw calls when all four bundles are visible simultaneously.

## Pipeline Design

Rather than exporting meshes manually from Blender's GUI—an error-prone process impossible to reproduce across contributors—we built a five-stage CLI under `pipeline/`:

1. **`inventory` (`pipeline/cli.ts inventory`):** Runs Blender `5.3.0` headless (`--factory-startup --disable-autoexec`, bypassing Z-Anatomy's bundled startup add-on) to dump every object's type, vertex/polygon count, collections, modifiers, materials, and world bounds into `pipeline/out/inventory.json`.
2. **`select` (`pipeline/src/select.ts`):** Evaluates declarative allowlist rules (`pipeline/config.json`) per bundle, matching explicit collection trees (`1: Skeletal system`, `4: Muscular system`, `5: Cardiovascular system`, plus `6:`–`8:` organ collections), filtering out excluded names, helper suffixes, and unverified models.
3. **Export (`pipeline/blender/export.py`):** Launches headless Blender per bundle, selects only matched objects, converts beveled curves cleanly to meshes, applies modifiers (`export_apply=True`), strips materials (`export_materials='NONE'`) because runtime shading comes from the viewer's shared `MaterialLibrary`, renames every node to its canonical `MeshId`, and writes raw unoptimized `.glb` files.
4. **Optimize (`pipeline/src/optimize.ts`):** Processes raw GLBs in pure Node using `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, and `meshoptimizer`. Each bundle runs `prune()`, `dedup()`, `weld()`, Meshopt `simplify()` (`ratio: 0.7`, `error: 0.001`), `quantize()` (14-bit positions, 10-bit normals), and `EXT_meshopt_compression` before computing a content-hashed filename (`<bundle>.<hash>.glb`).
5. **Verify (`pipeline/cli.ts verify`):** Checks every bundle against `public/models/manifest.json` and `content/en/index.json`: byte budgets, non-empty vertex data, human-scale bounding height (`1.6962 m`), anatomical orientation probes (`frontal-bone` above `femur--l`, `body-of-sternum` anterior to `vertebra-t6`, `femur--l` on `+X`), and bidirectional mesh/index parity.

## Four Surprises Hidden in `.blend`

Surveying `7,184` raw objects uncovered four pitfalls that would have broken a naive exporter:

### 1. Third-Party Non-Commercial Geometry Inside a CC-BY-SA File

While Z-Anatomy itself is `CC-BY-SA 4.0` (derived from DBCLS BodyParts3D under `CC-BY-SA 2.1 Japan`), its embedded license notice credits several reference models under incompatible licenses: University of Dundee's *Anatomy of the Inner Ear* (`CC-BY-NC-SA 4.0`), `lissiecowley`'s *Kidney* (`CC-BY-NC 4.0`), University of Washington *Brainder* / *White matter* meshes (no license stated), and University of Dundee cranial nerves. Blender objects carry no per-mesh license tag. Worse, the six high-poly auditory ossicles (`1,268`–`2,171` vertices each) could not be proven separate from the Dundee ear model. Our pipeline therefore enforces explicit allowlists + blocklists in `pipeline/config.json`, leaving those models out of shipped bundles and recording every exclusion in `LICENSE-ASSETS` and `pipeline/README.md`.

### 2. Paired Objects vs. Midline `MIRROR` Modifiers

It would be easy to assume bilateral anatomy relies on Blender `MIRROR` modifiers and try splitting mirrored geometry into `.l` and `.r` meshes during export. Inspection showed the exact opposite: across `1: Skeletal system`, all `118` left/right bone pairs already exist as separate `.l` and `.r` objects, while all `42` `MIRROR` modifiers sit on **unpaired midline** structures (`Xiphoid process`, `Thyroid gland`, `Soft palate`, spinal cord tracts). Setting `export_apply=True` without splitting loose parts preserves symmetrical midline anatomy cleanly.

### 3. Helper Meshes, Boolean Cutters, and Beveled Curves

Almost half of `1: Skeletal system`'s `1,244` `MESH` objects are not bones at all: `622` are 2-vertex `.j` label leader lines, `344` are 2-vertex `.i` indicator pins, and `6` are hidden `BOOLEAN` cutter meshes (`Anterior/Middle/Posterior cells of ethmoid bone.{l,r}`) nested cleanly inside the skull. Conversely, systemic arteries, veins, bronchi, ureters, esophagus, jejunum, and major spinal nerves are stored in Z-Anatomy as **beveled `CURVE` objects** (`bevel_depth > 0`), not `MESH` objects. Each bundle rule opts in explicitly via `types: ["MESH", "CURVE"]`, exporting solid evaluated geometry for vessels and nerves while dropping 2-vertex lines and cutter meshes.

### 4. Raw Name Quirks

Z-Anatomy names closely follow *Terminologia Anatomica*, yet batch processing turned up trailing/leading spaces (`" Posterior transverse collateral sulcus.l"`), parenthesized labels (`Atlas (C1)`, `(Adductor minimus).l`), spelling typos (`Bucinators` → *Buccinator*), and one asymmetrical missing suffix (`Iliocostalis colli muscle` sitting on patient `+X` beside `Iliocostalis colli muscle.r`). Rather than inventing ad-hoc runtime heuristics, every mapping is checked into `pipeline/name-map.json` so re-runs fail loudly on any unmapped object.

## Measured Results: Before and After

At `simplify.ratio = 0.7`, `error = 0.001`:

| Bundle | Meshes | Triangles | Raw GLB | Shipped GLB | Budget | Savings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `skeletal` | 263 | 511,561 | 13.04 MB | **4.70 MB** (`4.48 MiB`) | 5 MiB | 63.9% |
| `muscular` | 459 | 1,432,926 | 38.79 MB | **13.70 MB** (`13.07 MiB`) | 15 MiB | 64.7% |
| `cardiovascular` | 216 | 617,917 | 19.03 MB | **6.06 MB** (`5.78 MiB`) | 15 MiB | 68.2% |
| `organs` | 73 | 328,420 | 11.05 MB | **3.25 MB** (`3.10 MiB`) | 15 MiB | 70.6% |
| **Total** | **1,011** | **2.89M** | **81.92 MB** | **27.71 MB** (`26.42 MiB`) | **40 MiB** | **66.2%** |

Wire size is even smaller over static HTTP gzip (~`3.75 MB` for `skeletal`). Combined with code-splitting (`102.41 kB` gzipped initial UI shell, `400.91 kB` initial + 3D viewer), preloaded manifest/index hints, and `CENTER` BVH bounds, simulated Fast 4G skeleton load completed in **`5,881 ms`** (`2,881 ms` unthrottled) and picking averaged **`0.0010 ms/move`** (`0.100 ms` across 100 pointer moves) at `1,011` draw calls.

## Trade-offs & What Comes Next

Keeping one `THREE.Mesh` per anatomical part (`1,011` draw calls across all four systems) trades a higher draw-call count for straightforward per-mesh BVH raycasting, instant material swaps, and zero geometry re-packing. When idle, `<Canvas frameloop="demand">` renders zero frames; orbiting runs at `240 fps` on discrete GPUs and `57–60 fps` in baseline integrated-GPU captures (prior to `dpr={[1, 1.5]}` and drag-picking skips). If Phase 2 expands mesh count toward `1,500+` or integrated mobile GPUs need lower draw-call overhead, per-bundle `THREE.BatchedMesh` packing remains the clean next optimization alongside client-side search, hierarchy navigation, and shareable camera URLs.
