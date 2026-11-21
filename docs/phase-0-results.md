# Phase 0 Results — Foundation & Asset Spike

**Decision: Go**

The Phase 0 spike confirms that headless Blender 5.3.0 can extract licensed Z-Anatomy geometry cleanly into a compact, properly oriented Meshopt-compressed glTF bundle that loads in under 6 seconds over Fast 4G on production builds and stays comfortably inside the skeletal and full-atlas asset budgets.

## Source & Tooling Environment

- **Source file:** `pipeline/source/Z-Anatomy.blend` (`Startup.blend` from `Z-Anatomy_Template.zip` / `Z-Anatomy.zip`)
- **Z-Anatomy version:** `2023-05-02`
- **Source file size:** `304,817,801` bytes
- **Source SHA-256:** `9de642d94eb00ffe19c2f1e1ae27f2042269951d86e6689a7eb925369b32a86d`
- **Blender:** `5.3.0` (invoked headless with `--factory-startup --disable-autoexec` so the embedded `z-anatomy.py` addon script is bypassed)

## Inventory & Selection

Full `.blend` object inventory (`pipeline/out/inventory.json`):

| Metric | Count |
| --- | ---: |
| Total objects in `.blend` | 7,184 |
| `MESH` objects | 4,569 |
| `FONT` objects (labels) | 1,660 |
| `CURVE` objects (leader lines / vessels) | 951 |
| `LIGHT` objects | 3 |
| `CAMERA` objects | 1 |
| `1: Skeletal system` collection objects | 2,218 |
| `1: Skeletal system` `MESH` objects | 1,244 |

Within the 1,244 skeletal `MESH` objects (`622` joint `.j` helpers, `344` insertion `.i` helpers, `1` `.g` helper, `6` ethmoid Boolean cutters, and `271` anatomical bone meshes):

- **Shipped skeletal meshes:** `263` meshes across `151` canonical structures (`pipeline/name-map.json`, `0 added`, `0 needsReview`).
- **Excluded from skeletal bundle:** `6` auditory ossicle meshes (`Incus.l`, `Incus.r`, `Malleus.l`, `Malleus.r`, `Stapes.l`, `Stapes.r`) because per-object origin against the excluded Dundee `Anatomy of the Inner Ear` (`CC-BY-NC-SA 4.0`) model could not be verified, plus `2` internal cavity meshes (`Sinus of frontal bone`, `Sinus of sphenoid bone`).
- **Excluded NC / unverified third-party models in source `.blend`:** `Anatomy of the Inner Ear` (University of Dundee, `CC-BY-NC-SA 4.0`), `Kidney` (`lissiecowley`, `CC-BY-NC 4.0`), and `Brainder` / `White matter` (University of Washington, no license stated). Shipped geometry derives solely from Z-Anatomy (`CC-BY-SA 4.0`) and BodyParts3D (`CC-BY-SA 2.1 Japan` per `Z-Anatomy-License.txt` / DBCLS attribution).

## Compression, Size & Budget Results

`pipeline/blender/export.py` applies modifiers (`export_apply=True`), strips materials (`export_materials='NONE'`), omits cameras and lights, and relies on glTF right-handed Y-up export (no `.l`/`.r` runtime mirroring needed for skeletal bones since all 42 `MIRROR` modifiers sit on midline unpaired bones).

| Stage | Size (bytes) | Size (MiB) | Triangles | Notes |
| --- | ---: | ---: | ---: | --- |
| Raw glTF (`pipeline/out/raw/skeletal.glb`) | 13,040,492 | 12.44 MiB | 672,587 | Unquantized, no Meshopt |
| Optimized (`simplify.ratio = 1.0` + quantize + Meshopt) | 6,041,788 | 5.76 MiB | — | Exceeded 5 MiB skeletal budget |
| Optimized (`simplify.ratio = 0.7`, `error = 0.001` + quantize + Meshopt) | 4,701,748 | 4.48 MiB | 511,561 | **Shipped** (`public/models/skeletal.6c6d593d.glb`), 63.9% smaller than raw |
| Optimized GLB gzipped (wire transfer estimate) | 3,751,524 | 3.58 MiB | 511,561 | Static CDN / GitHub Pages gzip transfer |

- **Skeletal budget (`5 MiB` = `5,242,880` bytes):** Passed with `541,132` bytes (`10.3%`) headroom (`4,701,748` bytes).
- **Production JS bundle (`npm run build`):** `1,408.55 kB` raw / `387.92 kB` gzipped (inside the `< 400 KB` gzipped target in §8.6).

## Orientation & Verification Checks

Run via `npm run assets:verify` (`tsx pipeline/cli.ts verify`):

| Check | Measured Result | Expected | Status |
| --- | --- | --- | --- |
| Body height (union Y-extent) | `1.6962 m` | `1.4–2.2 m` | PASS |
| `above` (`frontal-bone` center Y vs `femur--l` center Y) | `0.7886` > `-0.2002` | `>` | PASS |
| `anterior` (`body-of-sternum` center Z vs `vertebra-t6` center Z) | `0.0784` > `-0.0790` | `>` | PASS |
| `leftSide` (`femur--l` center X > `0`) | `+0.0902` > `0` (`femur--r` `-0.0902`) | `>` | PASS |
| Asset verifier & content checker | `0 errors, 0 warnings` | `0 errors` | PASS |

## Runtime Viewer & Network Timing

Measured in headless Chromium (`1280x800`, WebGL via `ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002808) Direct3D11 vs_5_0 ps_5_0, D3D11)`, `/?debug` HUD, cache disabled):

| Metric | Measured Result | Notes |
| --- | ---: | --- |
| Idle FPS (`/?debug` `frameloop="always"`) | `240` fps | Default `/` uses `frameloop="demand"` (`0` idle frames) |
| Orbiting FPS (continuous mouse drag) | `240` fps | `263` draw calls, `511.6K` triangles (`511,561` exact) |
| Time to visible skeleton (`vite preview`, Fast 4G `9 Mbps` / `60 ms` RTT, uncompressed preview GLB) | `5,423 ms` (`5.4 s`) | `index.js` `411 ms`, `manifest.json` `106 ms`, uncompressed `4.70 MB` GLB `4,120 ms` (gzipped static hosting `~3.75 MB` would save ~`0.8 s`) |
| Time to visible skeleton (`vite preview`, Slow 4G `1.6 Mbps` / `150 ms` RTT) | `25,648 ms` | `22,612 ms` GLB download at `1.6 Mbps` |
| Time to visible skeleton (`vite dev`, Fast 4G `9 Mbps` / `60 ms` RTT) | `26,473 ms` | Unbundled 673-module ESM waterfall in Vite dev server only |

## Extrapolation to Full Atlas (1,000–1,500 Meshes)

Using the shipped skeletal averages at `simplify.ratio = 0.7`, `error = 0.001` (`17,877` bytes/mesh, `1,945` triangles/mesh):

| Target Scale | Estimated Optimized Size | Estimated Triangles | vs §7.4 Total Budget (`40 MiB` = `41,943,040 B`) | vs §9.1 Draw Calls (`~1,500`) |
| --- | ---: | ---: | --- | --- |
| `1,000` meshes | ~`17.9 MB` (~`17.0 MiB`) | ~`1.95M` | Comfortably within budget (`42.6%`) | Within threshold (`~1,000`) |
| `1,250` meshes | ~`22.3 MB` (~`21.3 MiB`) | ~`2.43M` | Comfortably within budget (`53.3%`) | Approaching threshold (`~1,250`) |
| `1,500` meshes | ~`26.8 MB` (~`25.6 MiB`) | ~`2.92M` | Within budget (`64.0%`) | At threshold (`~1,500`); profile `BatchedMesh` |

Notes for subsequent phases:

1. **Per-bundle budget (`15 MiB`):** Splitting the remaining structures across the Muscular, Organs, and Cardiovascular bundles keeps each bundle well below `15 MiB` (each would sit near `~5–9 MiB` at skeletal density, supporting up to ~`880` skeletal-density meshes per bundle).
2. **Draw calls (§9.1):** One mesh equals one draw call (`263` today). When multiple heavy systems are visible simultaneously (`1,000–1,500` meshes), profile on mid-range / integrated GPUs and adopt `THREE.BatchedMesh` per bundle if draw calls approach `~1,500`.
3. **JS bundle headroom (§8.6):** Current production JS is `387.92 kB` gzipped against the `400 KB` target; Plans 1+2 UI additions should introduce lazy chunking (e.g., splitting UI panels or `MeshoptDecoder` / detail views) so gzipped initial JS stays under `400 KB`.
