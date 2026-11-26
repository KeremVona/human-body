# Phase 4A Performance Measurements

**Verdict:** **Desktop Budgets Met — Real Laptop iGPU & Phone Gate Unverified (DevTools 4× CPU Throttle Emulated)**  
Desktop budgets pass cleanly (`27` scene draw calls on `Low` with all `9` systems enabled vs `1,406` without batching, `<= 200` budget; `<= 40` default, `<= 400` worst case; `240 fps` idle / `222–240 fps` orbiting on `Auto`; JS heap `~1.13×–1.25×` of `?batching=off` baseline, well within `<= 1.5×`). Physical mid-range laptop iGPU and physical phone verification remain unverified until measured on target devices.

Measured on the production build (`npm run build && vite preview` at `/?debug`, viewport `1280×800`, Microsoft Edge `--headless=new` ANGLE Direct3D11 on `NVIDIA GeForce RTX 4060`, `--enable-precise-memory-info`) with **all 9 body systems enabled** (`1,406` meshes / `3.1M` triangles, `integumentary` at default opacity `0.35`).

## Desktop Summary (`NVIDIA GeForce RTX 4060 Direct3D11`)

| Metric (All 9 Systems, `1,406` Meshes) | Phase 4 §3 Budget | Batching ON (`Auto`) | Batching OFF (`Auto`) | Batching ON (`Low`) | Batching OFF (`Low`) |
| --- | --- | --- | --- | --- | --- |
| Active batches / individual meshes | — | `27` batches / `0` promoted / `0` indiv. | `0` batches / `1,406` indiv. | `27` batches / `0` promoted / `0` indiv. | `0` batches / `1,406` indiv. |
| Scene draw calls (`gl.info.render.calls`) | `<= 200` (common) | `1` composer pass* | `1` composer pass* | **`27`** | `1,406` |
| Idle FPS | `>= 60 fps` | **`240 fps`** | `147–176 fps` | **`240 fps`** | `216–223 fps` |
| Orbiting FPS (`4 s` continuous drag) | `>= 60 fps` | **`222–240 fps`** | `129–143 fps` | **`190–240 fps`** | `221–238 fps` |
| JS heap (`usedJSHeapSize`, idle–drag) | `<= 1.5×` Phase 3D | `218.8–238.1 MB` (`~1.20×`) | `168.4–199.8 MB` | `220.0–240.4 MB` (`~1.13×–1.25×`) | `170.4–212.2 MB` |

\*When `EffectComposer` owns the final screen blit pass on `Auto` (`High`), `gl.info.render.calls` reports the `1` fullscreen pass; the `?debug` HUD reports the underlying `batches 27 · promoted 0 · individual 0` counts directly. On `Low`, `gl.info.render.calls` reports the direct WebGL draw-call count (`27` vs `1,406` — a **52× reduction**).

## Default, All-Systems, and Worst-Case Draw-Call Budgets (E2E `Low` Quality)

| Scenario | Phase 4 §3 Budget | Measured (`batches + promoted`) | Status |
| --- | --- | --- | --- |
| Default view (`skeletal` enabled) | `<= 40` | `2` (`Spike` / `batching.spec.ts <= 40`) | Pass |
| All 9 systems enabled (`1,406` meshes) | `<= 200` | `27` | Pass |
| Fade others on `femur--l` with all 9 systems enabled | `<= 400` | `<= 400` (`batching.spec.ts` verified) | Pass |

## Real-Device & Throttled Checks

| Target Device | Status | Measured FPS (All 9 Systems) | Notes |
| --- | --- | --- | --- |
| Mid-range laptop iGPU | **Unverified** (not yet measured on hardware) | Pending owner device reading | Desktop DevTools **4× CPU throttle** (`Auto`, batching ON, RTX 4060 GPU): `115–131 fps` idle / `98–114 fps` orbiting (`27` batches, `220.0–244.6 MB` heap) — **emulated, not verified**. |
| Physical phone | **Unverified** (not yet measured on hardware) | Pending owner device reading | Needs real phone `?debug` check on `Auto` (`Low` resolved automatically via coarse pointer / viewport) to confirm `>= 30 fps`. |
