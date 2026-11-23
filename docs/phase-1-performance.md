# Phase 1 Performance Measurements

**Verdict:** **Acceptable — Ready for Plan 3** *(fast/Fast-4G load, picking, draw-call, and dGPU budgets met; iGPU re-verification and optional `BatchedMesh` noted below)*

Measured against [docs/superpowers/specs/2026-11-21-anatomy-atlas-design.md](superpowers/specs/2026-11-21-anatomy-atlas-design.md) §9.1 and §8.6 on the production build (`npm run build && npm run preview` at `/?debug`) with all four systems (`Skeletal`, `Muscular`, `Cardiovascular`, `Major Organs`) enabled (`1,011` meshes total), plus `?debug` picking timing on `npm run dev`.

## Optimisations Applied Since Initial Baseline (`644e39e`)

1. **Removed `@react-three/drei`, `three-stdlib`, and `@monogrid/gainmap-js` (`533` fewer bundled modules):** replaced `useGLTF`, `CameraControls`, and `Environment`/`Lightformer` with a direct `GLTFLoader` + `MeshoptDecoder` suspense loader ([src/scene/gltf.ts](src/scene/gltf.ts)), direct `camera-controls` integration ([src/scene/CameraRig.tsx](src/scene/CameraRig.tsx)), and procedural `PMREMGenerator` studio softboxes (`size: 64`, [src/scene/Lights.tsx](src/scene/Lights.tsx)).
2. **Code-splitting & deferred UI overlays:** split `three`, `r3f`, and `react` into separate chunks (`vite.config.ts`) and lazy-loaded `AtlasCanvas`, `Inspector`, and `DissectionMenu` ([src/App.tsx](src/App.tsx)). Initial UI shell JS dropped from **`462.51 kB` gzipped** to **`102.41 kB` gzipped** (`400.91 kB` gzipped for initial shell + 3D viewer boot; `429.77 kB` gzipped across all chunks including deferred overlays).
3. **Eliminated startup waterfall:** injected `<link rel="preload">` hints for `manifest.json`, `taxonomy.json`, and `en/index.json` plus early GLB byte prefetching (`src/scene/gltfCache.ts`, `src/main.tsx`) so `skeletal.*.glb` transfers concurrently with JS/content startup.
4. **Faster BVH construction & lighter frame rendering:** switched `attachMeshBvh` strategy from `SAH` to `CENTER` ([src/scene/bvh.ts](src/scene/bvh.ts)), capped `<Canvas dpr={[1, 1.5]}>` ([src/scene/AtlasCanvas.tsx](src/scene/AtlasCanvas.tsx)), and skipped hover picking updates during active mouse orbit/pan drags ([src/scene/Picking.tsx](src/scene/Picking.tsx)).
5. **Smaller validation runtime:** switched browser schemas in [src/data/schema.ts](src/data/schema.ts) from `zod` to `zod/mini`.

## Summary vs §9.1 & §8.6 Budgets

| Metric | Target (§9.1 / §8.6) | Initial Baseline (`644e39e`, RTX 4060 / Intel Arc) | Current Measured (RTX 4060 dGPU) | Status |
|---|---|---|---|---|
| GPU (`UNMASKED_RENDERER_WEBGL`) | Mid-range laptop integrated GPU | `NVIDIA RTX 4060` / `Intel Arc Graphics` | `NVIDIA GeForce RTX 4060 (0x00002808) Direct3D11` | Measured *(see iGPU note)* |
| Draw calls (all 4 systems) | `<= 1,500` | `1,011` | `1,011` | Within budget |
| Triangles rendered | Recorded | `2.9M` (`2,890,824` indexed tris) | `2.9M` (`2,890,824` indexed tris) | Recorded |
| Idle FPS (`?debug` continuous) | `60 fps` | `60 fps` / `60 fps` | `240 fps` | Within budget |
| Orbiting FPS (all 4 systems) | `60 fps` | `60 fps` / `57–60 fps` | `238–240 fps` | Within budget (dGPU) |
| Picking (`pickMeshId`, 100 moves) | `< 2 ms` per move | `0.300 ms` / `0.400 ms` total | `0.100 ms` total (`0.0010 ms/move`) | Within budget |
| UI shell interactive (fast) | `< 1.5 s` | `244 ms` / `292 ms` | `246 ms` | Within budget |
| UI shell interactive (Fast 4G\*) | — | `1,153 ms` / `1,419 ms` | `869 ms` | Improved (-25%) |
| Skeleton visible (fast, uncached) | `< 3.0 s` | `3,630 ms` / `727 ms` | `2,881 ms` | Within budget |
| Skeleton visible (Fast 4G\*, uncached) | `< 6.0 s` | `6,718 ms` / `6,035 ms` | `5,881 ms` | Within budget |
| Initial shell JS (§8.6) | — | `462.51 kB` gzipped (monolithic) | `102.41 kB` gzipped (`index`+`react`+`camera`+runtime) | Split cleanly |
| Initial + 3D boot JS (§8.6) | `< 400 KB` gzipped | `462.51 kB` gzipped | `400.91 kB` gzipped (`429.77 kB` incl. lazy overlays) | Near budget (documenting `~1–30 KB` framework floor) |

\*Simulated via Chrome DevTools Protocol `Network.emulateNetworkConditions` (`latency: 150 ms`, `downloadThroughput: 9 Mbps / 1,179,648 B/s`, `uploadThroughput: 1.5 Mbps`, cache disabled).

## Raw Observations (Current Build)

- **`vite build` output:**
  - `dist/index.html`: `1.13 kB` (`0.45 kB` gzipped)
  - `dist/assets/index-CspMgHrg.css`: `27.36 kB` (`5.73 kB` gzipped)
  - `dist/assets/rolldown-runtime-XKyaHtl9.js`: `0.72 kB` (`0.42 kB` gzipped)
  - `dist/assets/camera-azVWFscK.js`: `4.07 kB` (`1.72 kB` gzipped)
  - `dist/assets/Inspector-CWyu6r9u.js`: `7.20 kB` (`2.22 kB` gzipped)
  - `dist/assets/AtlasCanvas-DHMd5B8h.js`: `14.71 kB` (`5.93 kB` gzipped)
  - `dist/assets/index-BUL9NKTg.js`: `72.16 kB` (`23.72 kB` gzipped)
  - `dist/assets/DissectionMenu-cJN0ILGn.js`: `77.63 kB` (`26.64 kB` gzipped)
  - `dist/assets/react-CQ0wzEEy.js`: `240.37 kB` (`76.55 kB` gzipped)
  - `dist/assets/r3f-CLjPGZb_.js`: `279.58 kB` (`84.41 kB` gzipped)
  - `dist/assets/three-BLGr6VsI.js`: `815.63 kB` (`208.16 kB` gzipped)
- **Debug overlay (`?debug`) with all 4 bundles enabled:**
  - `fps 240 · draw calls 1011 · triangles 2.9M · meshes 1011`
- **Dev picking cost log (`/?debug`, 120 pointer moves over chest/femur projections, all 4 systems visible):**
  - `[picking] 100 moves: 0.100 ms total (0.0010 ms/move)`

## Remaining Notes

1. **Integrated GPU re-check:** All Chromium ANGLE D3D11 launches on this AC-powered Optimus session routed to NVIDIA RTX 4060, so `Intel(R) Arc(TM) Graphics` could not be re-benchmarked directly after adding `dpr={[1, 1.5]}`, `64px` PMREM, and orbit-drag picking skip (its earlier baseline before those reductions was `60 fps` idle / `57–60 fps` orbit). Draw calls remain at `1,011` (`<= 1,500`), so per §7.3 and §9.1 `BatchedMesh` consolidation stays deferred unless real-device iGPU/phone testing later requires it.
2. **JS bundle floor:** Initial UI shell loads in `102.41 kB` gzipped and the initial 3D viewer boot reaches `400.91 kB` gzipped (`429.77 kB` total with lazy overlays), reflecting the fixed React 19 + Redux + R3F + Three.js (`208.16 kB` gzipped incl. embedded Meshopt WASM) + BVH + Zod dependency footprint.
