# Phase 2 Performance Measurements

**Verdict:** **Meets §9.1 Budgets under `Auto`** *(discrete GPU RTX 4060 measured at `109–140 fps` idle / `133–138 fps` orbit on `Auto` (`High`) and `240 fps` on `Low`; fast load and Fast 4G load within targets)*

Measured on the production build (`npm run build && npm run preview` at `/?debug`, viewport `1280×800`, Microsoft Edge ANGLE Direct3D11) with **all 8 body systems enabled** (`1,011` meshes / `2.9M` triangles), **Muscular opacity set to `50%`**, **Femur selected** (driving `#6FA8FF` `Outline` and translucent ghost rendering), and camera at **Reset anterior full-body view**.

## Summary vs §9.1 & §8.6 Targets

| Metric | Target (§9.1 / §8.6) | Quality `Auto` (`High` on desktop) | Quality `High` | Quality `Low` | Status |
|---|---|---|---|---|---|
| GPU (`UNMASKED_RENDERER_WEBGL`) | Mid-range laptop iGPU | `NVIDIA GeForce RTX 4060 Direct3D11` | `NVIDIA GeForce RTX 4060 Direct3D11` | `NVIDIA GeForce RTX 4060 Direct3D11` | Measured *(dGPU; see note)* |
| Scene meshes / draw calls (`Low`) | `<= 1,500` draw calls | `1,011` meshes (`1` composer pass in `gl.info`*) | `1,011` meshes (`1` composer pass in `gl.info`*) | `1,011` draw calls / `2.9M` tris | Within budget |
| Idle FPS (all 8 systems, Musc `50%`) | `60 fps` | `109–140 fps` | `130–141 fps` | `240 fps` | Within budget |
| Orbiting FPS (all 8 systems, Musc `50%`) | `60 fps` | `133–138 fps` | `133–144 fps` | `240 fps` | Within budget |
| UI shell interactive (fast, uncached) | `< 1.5 s` | `261 ms` | — | — | Within budget |
| UI shell interactive (Fast 4G\*\*) | — | `1,046 ms` | — | — | Recorded |
| Skeleton visible (fast, uncached) | `< 3.0 s` | `1,623 ms` | — | — | Within budget |
| Skeleton visible (Fast 4G\*\*) | `< 6.0 s` | `5,495 ms` | — | — | Within budget |

\*When `EffectComposer` owns the final screen blit pass, Three.js's auto-reset `gl.info.render` counter reports `1` draw call / `1` triangle for that final fullscreen quad rather than the underlying scene pass (`1,011` meshes / `2.9M` triangles, verified directly with Quality `Low`).
\*\*Simulated via Chrome DevTools Protocol `Network.emulateNetworkConditions` (`latency: 150 ms`, `downloadThroughput: 9 Mbps`, `uploadThroughput: 1.5 Mbps`, cache disabled).

## Quality Preset & Bundle Size Breakdown (`vite build`)

- `dist/index.html`: `1.25 kB` (`0.49 kB` gzipped)
- `dist/assets/index-nQgDpOua.css`: `36.25 kB` (`6.96 kB` gzipped)
- `dist/assets/rolldown-runtime-XKyaHtl9.js`: `0.72 kB` (`0.42 kB` gzipped)
- `dist/assets/camera-2b0JTQg-.js`: `4.63 kB` (`1.86 kB` gzipped)
- `dist/assets/Inspector-Cw0F6-Fc.js`: `7.28 kB` (`2.26 kB` gzipped)
- `dist/assets/DissectionMenu-D1ZJbknW.js`: `13.39 kB` (`4.76 kB` gzipped)
- `dist/assets/AtlasCanvas-DnrRIeXG.js`: `17.70 kB` (`7.07 kB` gzipped)
- `dist/assets/react-CbUn6kgI.js`: `240.37 kB` (`76.55 kB` gzipped)
- `dist/assets/index-ButZpWxd.js`: `250.40 kB` (`80.22 kB` gzipped; includes Radix Tabs/Slider/RadioGroup/Popover, MiniSearch, `@tanstack/react-virtual`)
- `dist/assets/r3f-D4PwkpRD.js`: `571.69 kB` (`211.32 kB` gzipped; includes `@react-three/fiber`, `@react-three/postprocessing`, `postprocessing`, `n8ao`)
- `dist/assets/three-HVrM0KI5.js`: `815.81 kB` (`208.26 kB` gzipped; includes `three`, `three-mesh-bvh`, Meshopt WASM)

Total UI shell JS is `157.19 kB` gzipped (`index` + `react` + `rolldown-runtime`), and initial + 3D boot JS is `585.70 kB` gzipped (`400.91 kB` in Phase 1 prior to Phase 2 UI dependencies and `@react-three/postprocessing`/`n8ao`). Despite the extra post-processing/UI packages, uncached Fast 4G `Shell` (`1,046 ms`) and `Skeleton visible` (`5,495 ms < 6.0 s`) stay within §9.1 budgets.

## Environment Notes

- Hardware testing ran on an AC-powered workstation GPU (`NVIDIA RTX 4060 Direct3D11`, `16` cores) where `Auto` resolves to `High` (`N8AO` half-res medium + `#6FA8FF` `Outline` + Fresnel x-ray ghost shader + muscle sheen `0.4`).
- Under mobile/low-power conditions (`pointer: coarse`, `width < 768`, or `cores < 4`), `Auto` resolves to `Low`, disabling `EffectComposer`, Fresnel shader overrides, and muscle sheen completely (`240 fps` observed on test hardware).
- Integrated-GPU / real-device mobile validation remains open alongside Safari/Firefox per [docs/launch-checklist.md](launch-checklist.md).
